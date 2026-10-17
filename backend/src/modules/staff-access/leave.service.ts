import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { LEAVE_TYPE_DEFAULTS, type LeaveTypePolicy } from "../../../../src/lib/modules/staff-policy";
import type { FlowStageData } from "../../../../src/lib/modules/staff-flows";
import { FlowsService } from "./flows.service";
import { fullName, store, templateName } from "./staff-access.shared";

/**
 * Leave is a sequence, not a form: a request, the people who decide it in order, the cover that
 * has to exist before it is granted, and what it does to pay. The sequence is the school's own
 * (Flows); the terms of each type are the school's own (leave types).
 */

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the leave type."),
  entitlement: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().min(0).nullable()),
  unit: z.string().default("Working days"),
  accrual: z.string().default("Accrues monthly"),
  carry: z.string().default("None"),
  pay: z.string().default("Paid in full"),
  evidence: z.string().default("Not required"),
  decides: z.string().default("The school default · cover, Principal, Proprietor"),
  threshold: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().min(0).nullable()),
  notice: z.string().default("14 days"),
  restricted: z.array(z.string()).default([]),
  coverRequired: z.coerce.boolean().default(true),
  halfDays: z.coerce.boolean().default(false),
  statutory: z.coerce.boolean().default(true),
  visible: z.coerce.boolean().default(true)
});

const OWNERS = new Set<string>(["SCHOOL_OWNER", "PROPRIETOR"]);

type RequestRow = Awaited<ReturnType<LeaveService["loadRequests"]>>[number];

@Injectable()
export class LeaveService {
  constructor(private readonly flows: FlowsService) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── leave types ───────────────────────── */

  async types(schoolId: string): Promise<Array<LeaveTypePolicy & { code: string }>> {
    const leaveStore = store(schoolId, "leave-types");
    let rows = await leaveStore.list<LeaveTypePolicy>();
    if (!rows.length) {
      // A new school starts from the usual types; from here on they are its own to change.
      for (const [index, item] of LEAVE_TYPE_DEFAULTS.entries()) await leaveStore.put(slug(item.name), item.name, item, index);
      rows = await leaveStore.list<LeaveTypePolicy>();
    }
    return rows.map((row) => ({ ...row.data, code: row.code ?? slug(row.name) }));
  }

  async saveType(session: SessionPayload, code: string | null, body: unknown) {
    const input = typeSchema.parse(body);
    const leaveStore = store(session.schoolId, "leave-types");
    const existing = await this.types(session.schoolId);
    const key = code ?? slug(input.name);
    if (!code && existing.some((item) => item.code === key)) throw new BadRequestException(`${input.name} already exists.`);
    const per = input.unit === "No ceiling" ? "" : existing.find((item) => item.code === key)?.per ?? "a session";
    const data: LeaveTypePolicy = { ...input, unit: input.unit as LeaveTypePolicy["unit"], pay: input.pay as LeaveTypePolicy["pay"], per };
    await leaveStore.put(key, input.name, data, existing.findIndex((item) => item.code === key) >= 0 ? existing.findIndex((item) => item.code === key) : existing.length);
    await this.audit(session, code ? AuditAction.UPDATE : AuditAction.CREATE, "LeaveType", key, { summary: `Leave type ${code ? "changed" : "created"} · ${input.name}` });
    return { code: key };
  }

  async deleteType(session: SessionPayload, code: string) {
    const existing = (await this.types(session.schoolId)).find((item) => item.code === code);
    if (!existing) throw new NotFoundException("That leave type does not exist.");
    const used = await prisma.leaveRequest.count({ where: { schoolId: session.schoolId, type: existing.name } });
    if (used) throw new BadRequestException(`${used} ${used === 1 ? "request has" : "requests have"} been made under ${existing.name}. Hide it from staff instead, so the register keeps its history.`);
    await store(session.schoolId, "leave-types").remove(code);
    await this.audit(session, AuditAction.DELETE, "LeaveType", code, { summary: `Leave type deleted · ${existing.name}` });
    return { code };
  }

  /* ───────────────────────── who decides what ───────────────────────── */

  private applicable(stages: FlowStageData[], request: { days: number | null; type: string }, types: LeaveTypePolicy[]): FlowStageData[] {
    const days = request.days ?? 0;
    const unpaid = /Unpaid/.test(types.find((item) => item.name === request.type)?.pay ?? "");
    return stages.filter((stage) => {
      if (stage.scope === "Above 10 days") return days > 10;
      if (stage.scope === "Up to 10 days, in term time") return days <= 10;
      if (stage.scope === "Unpaid leave") return unpaid;
      if (stage.scope === "Maternity and paternity") return /Maternity|Paternity/.test(request.type);
      return true;
    });
  }

  private holds(stage: FlowStageData, session: SessionPayload, staffSupervisor: string | null): boolean {
    const role = session.role as string;
    if (OWNERS.has(role)) return true;
    switch (stage.who) {
      case "The head of department":
        return role === "HEAD_OF_DEPARTMENT" || role === "PRINCIPAL";
      case "The Principal":
        return role === "PRINCIPAL";
      case "The Proprietor":
        return false;
      case "Their line manager":
        return staffSupervisor === session.userId || role === "PRINCIPAL";
      case "The Bursar":
        return role === "BURSAR";
      case "The Exam Officer":
        return role === "EXAM_OFFICER";
      case "The school administrator":
        return role === "ADMIN_OFFICER" || role === "SCHOOL_ADMIN";
      default:
        return false;
    }
  }

  /* ───────────────────────── the register ───────────────────────── */

  async loadRequests(schoolId: string) {
    return prisma.leaveRequest.findMany({ where: { schoolId }, include: { staff: { include: { user: true, department: { select: { name: true } } } } }, orderBy: [{ startDate: "desc" }] });
  }

  private label(date: Date, end: Date) {
    const f = (value: Date, year: boolean) => value.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
    const sameDay = date.toDateString() === end.toDateString();
    return sameDay ? f(date, true) : `${f(date, false)} – ${f(end, true)}`;
  }

  private workingDays(from: Date, to: Date) {
    let count = 0;
    for (let cursor = new Date(from); cursor <= to; cursor = new Date(cursor.getTime() + 86_400_000)) if (cursor.getDay() !== 0 && cursor.getDay() !== 6) count += 1;
    return count;
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [types, stages, requests, sessionRow] = await Promise.all([
      this.types(schoolId),
      this.flows.stages(schoolId, "leave"),
      this.loadRequests(schoolId),
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } })
    ]);
    const now = new Date();
    const policy = new Map(types.map((item) => [item.name, item]));
    const inSession = requests.filter((request) => !sessionRow || (request.startDate >= sessionRow.startDate && request.startDate <= sessionRow.endDate));

    const rows = requests.map((request) => {
      const flow = this.applicable(stages, request, types);
      const current = flow.find((item) => item.name === request.stage) ?? flow[0] ?? null;
      const position = current ? flow.indexOf(current) : 0;
      const supervisor = request.staff.supervisorId;
      const mine = request.status === "PENDING" && request.staff.userId !== session.userId && Boolean(current) && this.holds(current as FlowStageData, session, supervisor);
      const taken = request.status === "APPROVED" && request.endDate < now;
      const status = request.status === "REJECTED" ? "Declined" : request.status === "APPROVED" ? (taken ? "Taken" : "Approved") : position === 0 ? "Waiting" : "In sequence";
      const sequence = request.status === "PENDING" ? (mine ? "With you" : current ? `With ${current.who.replace(/^The /, "the ")}` : "No stage") : "Complete";
      const type = policy.get(request.type);
      return {
        id: request.id,
        staffId: request.staffId,
        userId: request.staff.userId,
        name: fullName(request.staff.user),
        role: templateName(request.staff.user.role),
        department: request.staff.department?.name ?? "No department",
        type: request.type,
        pay: type?.pay ?? "Paid in full",
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        dates: this.label(request.startDate, request.endDate),
        days: request.days ?? this.workingDays(request.startDate, request.endDate),
        cover: request.cover ?? (request.coverState === "Not needed" ? "No cover needed" : "Not arranged"),
        coverState: request.coverState,
        stage: current?.name ?? null,
        stageWho: current?.who ?? null,
        stageDoes: current?.does ?? null,
        sequence,
        status,
        mine,
        source: request.source,
        reason: request.reason,
        decisionNote: request.decisionNote,
        createdAt: request.createdAt.toISOString(),
        coverRequired: type?.coverRequired ?? true
      };
    });

    const used = new Map<string, Map<string, number>>();
    for (const request of inSession.filter((item) => item.status === "APPROVED")) {
      const map = used.get(request.staffId) ?? new Map<string, number>();
      map.set(request.type, (map.get(request.type) ?? 0) + (request.days ?? this.workingDays(request.startDate, request.endDate)));
      used.set(request.staffId, map);
    }
    const staff = await prisma.staffProfile.findMany({ where: { schoolId, user: { deletedAt: null, accountStatus: { not: "INACTIVE" } } }, include: { user: true, department: { select: { name: true } } }, orderBy: { user: { firstName: "asc" } } });
    const entitlementFor = (name: string) => policy.get(name)?.entitlement ?? null;
    const balances = staff
      .filter((profile) => !/PARENT|STUDENT/.test(profile.user.role))
      .map((profile) => {
        const map = used.get(profile.id) ?? new Map<string, number>();
        const away = rows.some((row) => row.staffId === profile.id && row.status !== "Declined" && row.status !== "Waiting" && row.status !== "In sequence" && new Date(row.startDate) <= now && new Date(row.endDate) >= now);
        return {
          id: profile.id,
          name: fullName(profile.user),
          role: templateName(profile.user.role),
          department: profile.department?.name ?? "No department",
          annual: { used: map.get("Annual leave") ?? 0, of: entitlementFor("Annual leave") },
          sick: { used: map.get("Sick leave") ?? 0, of: entitlementFor("Sick leave") },
          other: Array.from(map.entries()).filter(([name]) => name !== "Annual leave" && name !== "Sick leave").reduce((sum, [, value]) => sum + value, 0),
          total: Array.from(map.values()).reduce((sum, value) => sum + value, 0),
          away
        };
      });

    const waiting = rows.filter((row) => row.mine);
    const awayToday = rows.filter((row) => row.status !== "Declined" && row.status !== "Waiting" && row.status !== "In sequence" && new Date(row.startDate) <= now && new Date(row.endDate) >= now);
    const noCover = rows.filter((row) => (row.status === "Waiting" || row.status === "In sequence") && row.coverState === "Not arranged" && row.coverRequired);
    const decided = inSession.filter((item) => item.status === "APPROVED");
    const lost = decided.reduce((sum, item) => sum + Math.min(item.days ?? this.workingDays(item.startDate, item.endDate), this.workingDays(item.startDate, item.endDate)), 0);
    const annualCap = entitlementFor("Annual leave");
    const annualUsed = balances.reduce((sum, row) => sum + row.annual.used, 0);
    const oldest = waiting.reduce<Date | null>((min, row) => (!min || new Date(row.createdAt) < min ? new Date(row.createdAt) : min), null);
    return {
      session: sessionRow ? sessionRow.name : null,
      types: types.map((type) => ({ ...type, requests: requests.filter((request) => request.type === type.name).length })),
      stages,
      rows,
      balances,
      kpis: {
        awayToday: awayToday.length,
        awayNames: awayToday.map((row) => row.name),
        waiting: waiting.length,
        oldestDays: oldest ? Math.floor((now.getTime() - oldest.getTime()) / 86_400_000) : 0,
        noCover: noCover.length,
        lost,
        annualUsedPct: annualCap && staff.length ? Math.round((annualUsed / (annualCap * staff.length)) * 100) : null,
        staff: staff.length
      }
    };
  }

  /* ───────────────────────── deciding ───────────────────────── */

  async decide(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ decision: z.enum(["approve", "decline", "return"]), note: z.string().trim().optional() }).parse(body);
    const [stages, types, request] = await Promise.all([
      this.flows.stages(session.schoolId, "leave"),
      this.types(session.schoolId),
      prisma.leaveRequest.findFirst({ where: { id, schoolId: session.schoolId }, include: { staff: { include: { user: true } } } })
    ]);
    if (!request) throw new NotFoundException("That request does not exist.");
    if (request.status !== "PENDING") throw new BadRequestException("That request has already been decided.");
    if (request.staff.userId === session.userId) throw new ForbiddenException("Nobody approves their own leave.");
    const flow = this.applicable(stages, request, types);
    if (!flow.length) throw new BadRequestException("No stage in the approval sequence applies to this request.");
    const current = flow.find((item) => item.name === request.stage) ?? flow[0];
    if (!this.holds(current, session, request.staff.supervisorId)) throw new ForbiddenException(`${current.name} sits with ${current.who.toLowerCase()}.`);
    if (input.decision !== "approve" && !input.note) throw new BadRequestException("A refusal or a return carries a reason the requester can read.");
    const policy = types.find((item) => item.name === request.type);

    if (input.decision === "decline") {
      await prisma.leaveRequest.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), decisionNote: input.note, decidedById: session.userId, stage: current.name } });
    } else if (input.decision === "return") {
      await prisma.leaveRequest.update({ where: { id }, data: { stage: flow[0].name, decisionNote: `Returned: ${input.note}`, decidedById: session.userId } });
    } else {
      const position = flow.indexOf(current);
      const last = position === flow.length - 1 || /Notified only|Comments only/.test(flow[position + 1]?.does ?? "");
      const coverOnly = /Confirms cover only/.test(current.does);
      if (coverOnly && last) throw new BadRequestException("A cover check cannot grant the request; the sequence needs a stage that decides.");
      if (coverOnly) {
        await prisma.leaveRequest.update({ where: { id }, data: { cover: input.note || request.cover, coverState: input.note || request.cover ? "Arranged" : request.coverState, stage: flow[position + 1].name, decisionNote: input.note ?? request.decisionNote, decidedById: session.userId } });
      } else if (last) {
        if (policy?.coverRequired && request.coverState === "Not arranged") throw new BadRequestException("Cover must exist before this is granted: its leave type refuses leave without it.");
        await prisma.leaveRequest.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), decisionNote: input.note ?? null, decidedById: session.userId, stage: current.name } });
      } else {
        await prisma.leaveRequest.update({ where: { id }, data: { stage: flow[position + 1].name, decisionNote: input.note ?? null, decidedById: session.userId } });
      }
    }
    await this.audit(session, input.decision === "approve" ? AuditAction.APPROVE : AuditAction.UPDATE, "LeaveRequest", id, { summary: `Leave ${input.decision} · ${fullName(request.staff.user)} · ${request.type}`, note: input.note ?? null, stage: current.name });
    return { id, decision: input.decision };
  }

  async decideMany(session: SessionPayload, body: unknown) {
    const input = z.object({ ids: z.array(z.string()).min(1, "Choose the requests."), decision: z.enum(["approve", "decline", "return"]), note: z.string().optional() }).parse(body);
    const done: string[] = [];
    const failed: string[] = [];
    for (const id of input.ids) {
      try {
        await this.decide(session, id, { decision: input.decision, note: input.note ?? (input.decision === "return" ? "Cover has to be arranged first." : undefined) });
        done.push(id);
      } catch (cause) {
        failed.push(cause instanceof Error ? cause.message : "A request could not be decided.");
      }
    }
    return { done: done.length, failed };
  }

  async record(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        staff: z.string().min(1, "Choose whose leave it was."),
        type: z.string().min(1),
        first: z.string().min(1, "Give the first day."),
        last: z.string().min(1, "Give the last day."),
        days: z.coerce.number().positive("Give the working days."),
        why: z.string().trim().min(5, "Say why it was not requested first — an auditor reads this."),
        cover: z.string().default("Covered internally"),
        deduct: z.coerce.boolean().default(true)
      })
      .parse(body);
    const profile = await prisma.staffProfile.findFirst({ where: { id: input.staff, schoolId: session.schoolId }, include: { user: true } });
    if (!profile) throw new NotFoundException("That person is not on the staff.");
    const from = new Date(input.first);
    const to = new Date(input.last);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) throw new BadRequestException("The last day cannot come before the first.");
    const created = await prisma.leaveRequest.create({
      data: {
        schoolId: session.schoolId,
        staffId: profile.id,
        type: input.type,
        startDate: from,
        endDate: to,
        reason: input.why,
        status: "APPROVED",
        reviewedAt: new Date(),
        days: input.deduct ? input.days : 0,
        cover: /No cover was needed|uncovered/.test(input.cover) ? null : input.cover,
        coverState: /No cover was needed/.test(input.cover) ? "Not needed" : /uncovered/.test(input.cover) ? "Not arranged" : "Arranged",
        source: "RECORDED",
        decidedById: session.userId,
        decisionNote: input.deduct ? "Recorded after the fact" : "Recorded after the fact · not deducted from the balance"
      }
    });
    await this.audit(session, AuditAction.CREATE, "LeaveRequest", created.id, { summary: `Leave recorded off-system · ${fullName(profile.user)} · ${input.type}`, days: input.days });
    return { id: created.id };
  }

  /** A person's own balance on a type, for the decision drawer. */
  balanceFor(rows: RequestRow[], staffId: string, type: string) {
    return rows.filter((row) => row.staffId === staffId && row.type === type && row.status === "APPROVED").reduce((sum, row) => sum + (row.days ?? 0), 0);
  }
}

export type { UserRole };
