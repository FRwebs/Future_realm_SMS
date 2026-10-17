import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { KPI_SET_DEFAULTS, isAutomaticSource, kpiSetFor, type KpiDefinition, type KpiSetName } from "../../../../src/lib/modules/staff-policy";
import { FlowsService } from "./flows.service";
import { StaffAccessService } from "./staff-access.service";
import { fullName, store, templateName } from "./staff-access.shared";

/**
 * Appraisal: a KPI set per kind of role, published to the people on it, completed by them,
 * reviewed by their manager, then moderated so one generous manager cannot inflate a
 * department. A KPI is either read from a figure the product already holds or rated by a
 * named person against stated evidence — never a number somebody simply types.
 */

const SETS: KpiSetName[] = ["teaching", "leadership", "support"];
const isSet = (value: string): value is KpiSetName => (SETS as string[]).includes(value);

const kpiSchema = z.object({
  name: z.string().trim().min(2, "Say what is being measured."),
  measure: z.string().trim().min(5, "Say how it is measured in a sentence."),
  source: z.string().min(1),
  weight: z.coerce.number().min(0).max(100),
  target: z.string().trim().min(1, "Give it a target."),
  scale: z.string().optional(),
  runningFigure: z.coerce.boolean().optional(),
  countsToPay: z.coerce.boolean().optional(),
  ifMissing: z.string().optional()
});

@Injectable()
export class AppraisalService {
  constructor(
    private readonly access: StaffAccessService,
    private readonly flows: FlowsService
  ) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── KPI sets ───────────────────────── */

  async set(schoolId: string, name: KpiSetName): Promise<{ kpis: KpiDefinition[]; changedAt: string | null; changedBy: string | null }> {
    const saved = await store(schoolId, "kpi-sets").get<{ kpis?: KpiDefinition[]; changedAt?: string; changedBy?: string }>(name);
    return { kpis: saved?.data.kpis ?? KPI_SET_DEFAULTS[name].map((item) => ({ ...item })), changedAt: saved?.data.changedAt ?? null, changedBy: saved?.data.changedBy ?? null };
  }

  private async writeSet(session: SessionPayload, name: KpiSetName, kpis: KpiDefinition[], summary: string) {
    const actor = await prisma.user.findUnique({ where: { id: session.userId } });
    await store(session.schoolId, "kpi-sets").put(name, `${name} set`, { kpis, changedAt: new Date().toISOString(), changedBy: actor ? fullName(actor) : "Someone" });
    await this.audit(session, AuditAction.UPDATE, "KpiSet", name, { summary });
  }

  async saveSet(session: SessionPayload, name: string, body: unknown) {
    if (!isSet(name)) throw new NotFoundException("That KPI set does not exist.");
    const input = z.object({ rows: z.array(z.object({ id: z.string().optional(), values: z.record(z.string(), z.string()) })) }).parse(body);
    const current = (await this.set(session.schoolId, name)).kpis;
    const next = current.map((item, index) => {
      const row = input.rows[index];
      if (!row) return item;
      const weight = Number(String(row.values.weight ?? item.weight).replace(/[^0-9.]/g, ""));
      return { ...item, name: (row.values.name ?? item.name).trim() || item.name, measure: (row.values.measure ?? item.measure).trim() || item.measure, weight: Number.isFinite(weight) ? weight : item.weight, target: (row.values.target ?? item.target).trim() || item.target };
    });
    await this.writeSet(session, name, next, `KPI set changed · ${name}`);
    return { name, total: next.reduce((sum, item) => sum + item.weight, 0) };
  }

  async saveKpi(session: SessionPayload, name: string, index: number | null, body: unknown) {
    if (!isSet(name)) throw new NotFoundException("That KPI set does not exist.");
    const input = kpiSchema.parse(body);
    const kpis = (await this.set(session.schoolId, name)).kpis;
    if (index === null) kpis.push(input);
    else if (kpis[index]) kpis[index] = { ...kpis[index], ...input };
    else throw new NotFoundException("That KPI does not exist.");
    await this.writeSet(session, name, kpis, `KPI ${index === null ? "added to" : "changed in"} ${name} · ${input.name}`);
    return { name, total: kpis.reduce((sum, item) => sum + item.weight, 0) };
  }

  /** Defining a KPI from outside any one set: the form says which set it goes on. */
  async defineKpi(session: SessionPayload, body: unknown) {
    const input = z.object({ set: z.string() }).passthrough().parse(body);
    return this.saveKpi(session, input.set, null, body);
  }

  async removeKpi(session: SessionPayload, name: string, index: number) {
    if (!isSet(name)) throw new NotFoundException("That KPI set does not exist.");
    const kpis = (await this.set(session.schoolId, name)).kpis;
    if (!kpis[index]) throw new NotFoundException("That KPI does not exist.");
    const [removed] = kpis.splice(index, 1);
    await this.writeSet(session, name, kpis, `KPI removed from ${name} · ${removed.name}`);
    return { name, total: kpis.reduce((sum, item) => sum + item.weight, 0) };
  }

  async copySet(session: SessionPayload, name: string, body: unknown) {
    if (!isSet(name)) throw new NotFoundException("That KPI set does not exist.");
    const input = z.object({ to: z.string() }).parse(body);
    if (!isSet(input.to)) throw new NotFoundException("That KPI set does not exist.");
    const kpis = (await this.set(session.schoolId, name)).kpis.map((item) => ({ ...item }));
    await this.writeSet(session, input.to, kpis, `KPI set copied · ${name} → ${input.to}`);
    return { name: input.to };
  }

  async resetSet(session: SessionPayload, name: string) {
    if (!isSet(name)) throw new NotFoundException("That KPI set does not exist.");
    await this.writeSet(session, name, KPI_SET_DEFAULTS[name].map((item) => ({ ...item })), `KPI set reset to the standard · ${name}`);
    return { name };
  }

  /* ───────────────────────── the cycle ───────────────────────── */

  private async cycleName(schoolId: string) {
    const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, include: { academicSession: true } });
    return term ? { name: `${term.name} ${term.academicSession?.name ?? ""}`.trim(), term } : { name: "The current cycle", term: null };
  }

  private weightedScore(ratings: Array<{ score: number; autoScore: number | null; weight: number | null }>): number | null {
    let total = 0;
    let weights = 0;
    for (const rating of ratings) {
      const value = rating.score > 0 ? rating.score : rating.autoScore ?? 0;
      if (!value) continue;
      const weight = rating.weight ?? 1;
      total += value * weight;
      weights += weight;
    }
    return weights ? Math.round((total / weights) * 10) / 10 : null;
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const cycle = await this.cycleName(schoolId);
    const [directory, published, appraisals, flow, sets] = await Promise.all([
      this.access.directory(session),
      store(schoolId, "appraisal-cycles").get<{ publishedAt: string; publishedBy: string; deadline: string | null; sets: string[] }>(cycle.name),
      prisma.staffAppraisal.findMany({ where: { schoolId, cycle: cycle.name }, include: { ratings: true, reviewer: { select: { firstName: true, lastName: true } } } }),
      this.flows.stages(schoolId, "appraisal"),
      Promise.all(SETS.map(async (name) => [name, await this.set(schoolId, name)] as const))
    ]);
    const byStaff = new Map(appraisals.map((item) => [item.staffId, item]));
    const roleNames = Array.from(new Set(directory.rows.map((row) => row.role))).sort();
    const people = directory.rows.map((row) => {
      const appraisal = byStaff.get(row.id);
      const setName = kpiSetFor(row.role);
      const rated = appraisal?.ratings.filter((rating) => rating.score > 0) ?? [];
      const selfRated = appraisal?.ratings.filter((rating) => rating.selfScore) ?? [];
      const stage = !appraisal ? "Not started" : appraisal.status === "ACKNOWLEDGED" ? "Complete" : appraisal.status === "SHARED" ? "Complete" : selfRated.length < (appraisal.ratings.length || 1) && !rated.length ? "Self-assessment" : "With you";
      const avg = (values: number[]) => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null);
      return {
        id: row.id,
        userId: row.userId,
        appraisalId: appraisal?.id ?? null,
        name: row.name,
        role: row.role,
        department: row.department,
        set: setName,
        stage,
        selfScore: avg(selfRated.map((rating) => rating.selfScore as number)),
        mine: appraisal?.overallScore ?? avg(rated.map((rating) => rating.score)),
        evidence: appraisal?.ratings.filter((rating) => rating.evidence).length ?? 0,
        reviewer: appraisal ? fullName(appraisal.reviewer) : null,
        isReviewer: appraisal?.reviewerId === session.userId
      };
    });
    const rolesTable = roleNames.map((role) => {
      const setName = kpiSetFor(role);
      const set = sets.find(([name]) => name === setName)![1];
      const total = set.kpis.reduce((sum, item) => sum + item.weight, 0);
      return { role, set: setName, kpis: set.kpis.length, weight: total, automatic: set.kpis.filter((item) => isAutomaticSource(item.source)).length, people: directory.rows.filter((row) => row.role === role).length, publishable: Math.round(total) === 100 };
    });
    const rated = people.filter((person) => person.mine).map((person) => person.mine as number);
    return {
      cycle: { name: cycle.name, termId: cycle.term?.id ?? null, publishedAt: published?.data.publishedAt ?? null, publishedBy: published?.data.publishedBy ?? null, deadline: published?.data.deadline ?? null, published: Boolean(published) || appraisals.length > 0 },
      flow,
      sets: Object.fromEntries(sets.map(([name, value]) => [name, value])),
      roles: rolesTable,
      people,
      kpis: {
        published: appraisals.length,
        completed: people.filter((person) => person.stage === "Complete" || person.stage === "With you").length,
        writing: people.filter((person) => person.stage === "Self-assessment").length,
        withMe: people.filter((person) => person.stage === "With you" && person.isReviewer).length,
        average: rated.length ? Math.round((rated.reduce((sum, value) => sum + value, 0) / rated.length) * 10) / 10 : null
      }
    };
  }

  async publish(session: SessionPayload, body: unknown) {
    const input = z
      .object({
        sets: z.array(z.string()).min(1, "Choose who the cycle goes to."),
        deadline: z.string().min(1, "Give the staff a deadline."),
        note: z.string().optional(),
        tell: z.coerce.boolean().default(true)
      })
      .parse(body);
    const schoolId = session.schoolId;
    const chosen = input.sets.filter(isSet);
    if (!chosen.length) throw new BadRequestException("Choose which KPI sets to publish.");
    for (const name of chosen) {
      const total = (await this.set(schoolId, name)).kpis.reduce((sum, item) => sum + item.weight, 0);
      if (Math.round(total) !== 100) throw new BadRequestException(`The ${name} set cannot publish: its weights total ${Math.round(total)}, not 100.`);
    }
    const cycle = await this.cycleName(schoolId);
    const directory = await this.access.directory(session);
    const activity = await this.access.activity(session);
    const metric = new Map(activity.rows.map((row) => [row.userId, row]));
    const principal = (await prisma.user.findFirst({ where: { schoolId, role: "PRINCIPAL", isActive: true } })) ?? (await prisma.user.findUnique({ where: { id: session.userId } }));
    let created = 0;
    for (const row of directory.rows) {
      const setName = kpiSetFor(row.role);
      if (!chosen.includes(setName)) continue;
      const profile = await prisma.staffProfile.findUnique({ where: { id: row.id } });
      if (!profile || (await prisma.staffAppraisal.findUnique({ where: { staffId_cycle: { staffId: row.id, cycle: cycle.name } } }))) continue;
      const reviewerId = profile.supervisorId && profile.supervisorId !== row.userId ? profile.supervisorId : principal?.id !== row.userId ? principal?.id ?? session.userId : session.userId;
      const kpis = (await this.set(schoolId, setName)).kpis;
      const activityRow = metric.get(row.userId);
      await prisma.staffAppraisal.create({
        data: {
          schoolId,
          staffId: row.id,
          reviewerId,
          termId: cycle.term?.id ?? null,
          cycle: cycle.name,
          ratings: { create: kpis.map((kpi) => ({ criterion: kpi.name, score: 0, weight: kpi.weight, autoScore: this.autoScore(kpi, activityRow) })) }
        }
      });
      created += 1;
    }
    await store(schoolId, "appraisal-cycles").put(cycle.name, cycle.name, { publishedAt: new Date().toISOString(), publishedBy: fullName((await prisma.user.findUnique({ where: { id: session.userId } })) ?? { firstName: "Someone", lastName: "" }), deadline: input.deadline, sets: chosen, note: input.note ?? null });
    if (input.tell && created) {
      await prisma.announcement.create({ data: { schoolId, createdById: session.userId, channel: "IN_APP", audience: "Teachers and staff", title: `${cycle.name} appraisal is open`, body: `Complete your self-assessment by ${new Date(input.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.${input.note ? ` ${input.note}` : ""}` } });
    }
    await this.audit(session, AuditAction.CREATE, "AppraisalCycle", cycle.name, { summary: `Appraisal cycle published · ${created} people`, sets: chosen });
    return { created, cycle: cycle.name };
  }

  /** What the product itself says about a KPI, on the scale of five, where it holds the figure. */
  private autoScore(kpi: KpiDefinition, row: Awaited<ReturnType<StaffAccessService["activity"]>>["rows"][number] | undefined): number | null {
    if (!row || !isAutomaticSource(kpi.source)) return null;
    const five = (done: number, of: number) => (of > 0 ? Math.round(Math.min(1, done / of) * 5 * 10) / 10 : null);
    if (/Attendance/.test(kpi.source)) return row.registers ? five(row.registers.marked, row.registers.of) : null;
    if (/Scores/.test(kpi.source)) return row.sheets ? five(row.sheets.submitted, row.sheets.total) : null;
    if (/Report Cards/.test(kpi.source)) return row.remarks ? five(row.remarks.written, row.remarks.of) : null;
    return null;
  }

  async extendDeadline(session: SessionPayload, body: unknown) {
    const input = z.object({ deadline: z.string().min(1, "Give the new deadline.") }).parse(body);
    const cycle = await this.cycleName(session.schoolId);
    const existing = await store(session.schoolId, "appraisal-cycles").get<Record<string, unknown>>(cycle.name);
    if (!existing) throw new BadRequestException("The cycle has not been published yet.");
    await store(session.schoolId, "appraisal-cycles").put(cycle.name, cycle.name, { ...existing.data, deadline: input.deadline });
    await this.audit(session, AuditAction.UPDATE, "AppraisalCycle", cycle.name, { summary: "Appraisal deadline extended", deadline: input.deadline });
    return { deadline: input.deadline };
  }

  async remind(session: SessionPayload, body: unknown) {
    const input = z.object({ people: z.array(z.string()).default([]), note: z.string().optional() }).parse(body);
    const cycle = await this.cycleName(session.schoolId);
    const appraisals = await prisma.staffAppraisal.findMany({ where: { schoolId: session.schoolId, cycle: cycle.name, ...(input.people.length ? { staffId: { in: input.people } } : {}), status: "DRAFT" }, include: { staff: { include: { user: true } } } });
    if (!appraisals.length) throw new BadRequestException("Nobody in the cycle is waiting.");
    const names = appraisals.map((item) => fullName(item.staff.user));
    await prisma.announcement.create({
      data: { schoolId: session.schoolId, createdById: session.userId, channel: "IN_APP", audience: "Teachers and staff", title: `Reminder · ${cycle.name} appraisal`, body: `${input.note ?? "Your appraisal is still open."} Waiting: ${names.slice(0, 8).join(", ")}${names.length > 8 ? ` and ${names.length - 8} more` : ""}.` }
    });
    await this.audit(session, AuditAction.CREATE, "AppraisalReminder", cycle.name, { summary: `Appraisal reminder sent · ${names.length} people` });
    return { reminded: names.length };
  }

  /* ───────────────────────── one appraisal ───────────────────────── */

  async one(session: SessionPayload, id: string) {
    const appraisal = await prisma.staffAppraisal.findFirst({ where: { id, schoolId: session.schoolId }, include: { ratings: true, staff: { include: { user: true, department: { select: { name: true } } } }, reviewer: true } });
    if (!appraisal) throw new NotFoundException("That appraisal does not exist.");
    const setName = kpiSetFor(templateName(appraisal.staff.user.role));
    const kpis = (await this.set(session.schoolId, setName)).kpis;
    const byName = new Map(appraisal.ratings.map((rating) => [rating.criterion, rating]));
    return {
      id: appraisal.id,
      staffId: appraisal.staffId,
      name: fullName(appraisal.staff.user),
      role: templateName(appraisal.staff.user.role),
      department: appraisal.staff.department?.name ?? "No department",
      set: setName,
      cycle: appraisal.cycle,
      status: appraisal.status,
      reviewer: fullName(appraisal.reviewer),
      isReviewer: appraisal.reviewerId === session.userId,
      isSelf: appraisal.staff.userId === session.userId,
      overall: appraisal.overallScore,
      strengths: appraisal.strengths,
      improvements: appraisal.improvements,
      reviewerComment: appraisal.reviewerComment,
      staffComment: appraisal.staffComment,
      sharedAt: appraisal.sharedAt?.toISOString() ?? null,
      kpis: kpis.map((kpi) => {
        const rating = byName.get(kpi.name);
        return { ...kpi, ratingId: rating?.id ?? null, self: rating?.selfScore ?? null, auto: rating?.autoScore ?? null, mine: rating && rating.score > 0 ? rating.score : null, comment: rating?.comment ?? null, evidence: rating?.evidence ?? null };
      })
    };
  }

  async rate(session: SessionPayload, id: string, body: unknown) {
    const input = z
      .object({
        ratings: z.array(z.object({ criterion: z.string(), score: z.coerce.number().min(0).max(5), comment: z.string().optional() })).default([]),
        scores: z.record(z.string(), z.coerce.number().min(0).max(5)).default({}),
        strengths: z.string().optional(),
        improvements: z.string().optional(),
        reviewerComment: z.string().optional()
      })
      .parse(body);
    const appraisal = await prisma.staffAppraisal.findFirst({ where: { id, schoolId: session.schoolId }, include: { ratings: true, staff: true } });
    if (!appraisal) throw new NotFoundException("That appraisal does not exist.");
    if (appraisal.reviewerId !== session.userId) throw new ForbiddenException("Only the reviewer writes the review.");
    if (appraisal.staff.userId === session.userId) throw new ForbiddenException("Nobody reviews their own appraisal.");
    if (appraisal.status !== "DRAFT") throw new BadRequestException("This review has already been shared.");
    const entries = [...input.ratings, ...Object.entries(input.scores).map(([criterion, score]) => ({ criterion, score, comment: undefined as string | undefined }))];
    for (const entry of entries) {
      const target = appraisal.ratings.find((rating) => rating.criterion === entry.criterion);
      if (!target) continue;
      await prisma.staffAppraisalRating.update({ where: { id: target.id }, data: { score: Math.round(entry.score), comment: entry.comment ?? target.comment } });
    }
    const fresh = await prisma.staffAppraisalRating.findMany({ where: { appraisalId: id } });
    await prisma.staffAppraisal.update({
      where: { id },
      data: { overallScore: this.weightedScore(fresh), strengths: input.strengths ?? appraisal.strengths, improvements: input.improvements ?? appraisal.improvements, reviewerComment: input.reviewerComment ?? appraisal.reviewerComment }
    });
    return { id };
  }

  async complete(session: SessionPayload, id: string) {
    const appraisal = await prisma.staffAppraisal.findFirst({ where: { id, schoolId: session.schoolId }, include: { ratings: true, staff: { include: { user: true } } } });
    if (!appraisal) throw new NotFoundException("That appraisal does not exist.");
    if (appraisal.reviewerId !== session.userId) throw new ForbiddenException("Only the reviewer completes the review.");
    if (appraisal.status !== "DRAFT") throw new BadRequestException("This review has already been shared.");
    const unrated = appraisal.ratings.filter((rating) => rating.score === 0 && rating.autoScore === null);
    if (unrated.length) throw new BadRequestException(`${unrated.length} ${unrated.length === 1 ? "KPI has" : "KPIs have"} no rating and no figure behind ${unrated.length === 1 ? "it" : "them"}: ${unrated.slice(0, 3).map((item) => item.criterion).join(", ")}.`);
    if (!appraisal.reviewerComment?.trim()) throw new BadRequestException("Write your review before you complete it.");
    await prisma.staffAppraisal.update({ where: { id }, data: { status: "SHARED", sharedAt: new Date(), overallScore: this.weightedScore(appraisal.ratings) } });
    await this.audit(session, AuditAction.APPROVE, "StaffAppraisal", id, { summary: `Appraisal completed · ${fullName(appraisal.staff.user)}` });
    return { id };
  }

  async returnForEvidence(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ note: z.string().trim().min(5, "Say what evidence is missing.") }).parse(body);
    const appraisal = await prisma.staffAppraisal.findFirst({ where: { id, schoolId: session.schoolId }, include: { staff: { include: { user: true } } } });
    if (!appraisal) throw new NotFoundException("That appraisal does not exist.");
    if (appraisal.reviewerId !== session.userId) throw new ForbiddenException("Only the reviewer can return it.");
    await prisma.staffAppraisal.update({ where: { id }, data: { improvements: `Returned for evidence: ${input.note}` } });
    await this.audit(session, AuditAction.UPDATE, "StaffAppraisal", id, { summary: `Appraisal returned for evidence · ${fullName(appraisal.staff.user)}`, note: input.note });
    return { id };
  }

  /** Managers side by side, so one generous reviewer cannot inflate a department. */
  async moderation(session: SessionPayload) {
    const cycle = await this.cycleName(session.schoolId);
    const appraisals = await prisma.staffAppraisal.findMany({ where: { schoolId: session.schoolId, cycle: cycle.name }, include: { staff: { include: { department: { select: { name: true } } } }, reviewer: true } });
    const groups = new Map<string, number[]>();
    const managers = new Map<string, number[]>();
    for (const item of appraisals.filter((entry) => entry.overallScore)) {
      const department = item.staff.department?.name ?? "No department";
      groups.set(department, [...(groups.get(department) ?? []), item.overallScore as number]);
      const manager = fullName(item.reviewer);
      managers.set(manager, [...(managers.get(manager) ?? []), item.overallScore as number]);
    }
    const mean = (values: number[]) => Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    return {
      cycle: cycle.name,
      reviewed: appraisals.filter((entry) => entry.overallScore).length,
      of: appraisals.length,
      departments: Array.from(groups.entries()).map(([name, values]) => ({ name, average: mean(values), count: values.length })).sort((a, b) => b.average - a.average),
      managers: Array.from(managers.entries()).map(([name, values]) => ({ name, average: mean(values), count: values.length })).sort((a, b) => b.average - a.average)
    };
  }
}
