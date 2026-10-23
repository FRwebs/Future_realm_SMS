import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, type Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CasesService } from "../attendance-management/cases.service";
import { armName, fullName } from "../fee-management/fees.shared";
import { deliveryOf, guardianPortal, notifyGuardian } from "../guardian-management/guardians.shared";
import { daysSince } from "../student-records/records.shared";
import { TeacherWorkspaceService } from "./workspace.service";

/**
 * Guardians, as a form master holds them: a number to call, and what the families of their class have sent in. Contact details only —
 * never a fee, never consent files, never a restricted contact (which is simply not here, and the teacher is not told why).
 */
@Injectable()
export class TeacherFamiliesService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly cases: CasesService) {}

  /** The arms this person is form master of: what families send in is theirs to decide. */
  private async classes(session: SessionPayload) {
    const me = await this.workspace.me(session);
    return { me, ids: me.formArms.map((arm) => arm.id) };
  }

  async guardians(session: SessionPayload) {
    const { me, ids } = await this.classes(session);
    if (!ids.length) return { arms: [], rows: [], kpis: { households: 0, reachable: 0, noPhone: 0, otherLanguage: 0 } };
    const links = await prisma.studentGuardian.findMany({
      where: { student: { schoolId: session.schoolId, currentClassId: { in: ids }, status: "ACTIVE" }, guardian: { mergedIntoId: null, safeguardingRestrictedAt: null } },
      include: { student: { select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true, arm: true } } } }, guardian: { include: { user: { select: { lastLoginAt: true } } } } },
      orderBy: [{ guardian: { lastName: "asc" } }]
    });
    const byGuardian = new Map<string, { guardian: (typeof links)[number]["guardian"]; relation: string; children: Array<{ id: string; name: string; arm: string }> }>();
    for (const link of links) {
      const entry = byGuardian.get(link.guardianId) ?? { guardian: link.guardian, relation: link.relation ?? link.guardian.relationship, children: [] };
      entry.children.push({ id: link.student.id, name: fullName(link.student), arm: link.student.currentClass ? armName(link.student.currentClass) : "No arm" });
      byGuardian.set(link.guardianId, entry);
    }
    const calls = byGuardian.size ? await prisma.guardianContact.findMany({ where: { schoolId: session.schoolId, kind: "CALL", guardianId: { in: [...byGuardian.keys()] } }, orderBy: { createdAt: "desc" }, take: 400 }) : [];
    const callsOf = (guardianId: string) => calls.filter((call) => call.guardianId === guardianId).slice(0, 5).map((call) => {
      const detail = (call.detail ?? {}) as { outcome?: string; note?: string; child?: string; by?: string };
      return { at: call.createdAt.toISOString(), outcome: detail.outcome ?? call.summary, note: detail.note ?? "", child: detail.child ?? "", by: detail.by ?? "" };
    });
    const rows = [...byGuardian.entries()].map(([id, entry]) => ({
      id, name: fullName(entry.guardian), relation: entry.relation, phone: entry.guardian.phone, email: entry.guardian.email, children: entry.children, portal: guardianPortal(entry.guardian.user), delivery: deliveryOf(entry.guardian),
      language: entry.guardian.language, channel: entry.guardian.canReceiveSms ? (entry.guardian.canReceiveEmail ? "SMS or email" : "SMS") : entry.guardian.canReceiveEmail ? "Email" : "In-app", phoneOnly: entry.guardian.phoneOnly,
      calls: callsOf(id)
    }));
    return {
      arms: me.formArms, rows,
      kpis: { households: rows.length, reachable: rows.filter((row) => row.portal === "Active").length, noPhone: rows.filter((row) => !row.phone?.trim()).length, otherLanguage: rows.filter((row) => row.language !== "English").length }
    };
  }

  /**
   * A call to a family, kept on the child's record under the caller's name. A call that went unanswered is as worth recording as one that did:
   * it is how the next person knows a number has been tried.
   */
  async logCall(session: SessionPayload, guardianId: string, body: unknown) {
    const input = z.object({
      child: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (Array.isArray(value) ? value[0] : value)),
      outcome: z.enum(["Spoke to them", "No answer", "Left a message", "Number not working"]),
      note: z.string().trim().max(600).optional()
    }).parse(body);
    const { ids } = await this.classes(session);
    const link = await prisma.studentGuardian.findFirst({
      where: { guardianId, student: { schoolId: session.schoolId, currentClassId: { in: ids }, status: "ACTIVE" }, guardian: { mergedIntoId: null, safeguardingRestrictedAt: null }, ...(input.child ? { studentId: input.child } : {}) },
      include: { student: { select: { id: true, firstName: true, lastName: true } } }
    });
    if (!link) throw new ForbiddenException("That family is not in a class you are form master of, so a call to them is not yours to log.");
    const caller = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } });
    const child = fullName(link.student);
    const made = await prisma.guardianContact.create({
      data: {
        schoolId: session.schoolId, guardianId, kind: "CALL", channel: "Phone", summary: `Call · ${input.outcome}`, createdById: session.userId,
        detail: { outcome: input.outcome, note: input.note ?? "", studentId: link.studentId, child, by: caller ? fullName(caller) : "A teacher" } as Prisma.InputJsonValue
      }
    });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.CREATE, entityType: "GuardianContact", entityId: made.id, metadata: { summary: `Call logged · ${child} · ${input.outcome}` } } });
    return { id: made.id, child, outcome: input.outcome };
  }

  /** How many things the families of this person's own class are waiting on them for: what the Guardians item in their rail counts. */
  async waiting(session: SessionPayload) {
    const { ids } = await this.classes(session);
    if (!ids.length) return { families: 0 };
    const families = await prisma.guardianSubmission.count({
      where: { schoolId: session.schoolId, state: { in: ["NEW", "ASSIGNED", "IN_PROGRESS"] }, type: { in: ["Absence explanation", "Collection change"] }, student: { currentClassId: { in: ids } } }
    });
    return { families };
  }

  async submissions(session: SessionPayload) {
    const { me, ids } = await this.classes(session);
    if (!ids.length) return { arms: [], items: [], kpis: { waiting: 0, decided: 0, median: null, withoutEvidence: 0, collections: 0 }, oldest: 0 };
    const rows = await prisma.guardianSubmission.findMany({
      where: { schoolId: session.schoolId, student: { currentClassId: { in: ids } } },
      include: { guardian: { select: { firstName: true, lastName: true, relationship: true } }, student: { select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true, arm: true } } } } },
      orderBy: { createdAt: "desc" }, take: 60
    });
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, select: { startDate: true } });
    const items = [];
    // The days each child is down as absent, read for every child with an open explanation in one go.
    const asking = [...new Set(rows.filter((row) => row.studentId && row.type === "Absence explanation" && row.state !== "RESOLVED" && row.state !== "DECLINED").map((row) => row.studentId as string))];
    const absent = await this.cases.openAbsencesMany(session, asking);
    for (const row of rows) {
      const open = row.state !== "RESOLVED" && row.state !== "DECLINED";
      const absence = row.type === "Absence explanation";
      const collection = row.type === "Collection change";
      const absences = open && absence && row.studentId ? absent.get(row.studentId) ?? [] : [];
      const claimed = absences.filter((entry) => row.dates.includes(entry.date));
      const who = (row.payload ?? {}) as { name?: string; relation?: string; phone?: string; date?: string };
      items.push({
        id: row.id, type: row.type, child: row.student ? fullName(row.student) : "—", childId: row.studentId, arm: row.student?.currentClass ? armName(row.student.currentClass) : "",
        guardian: fullName(row.guardian), relation: row.guardian.relationship, detail: row.detail, state: open ? "New" : row.state === "DECLINED" ? "Declined" : "Resolved", open, canDecide: open && (absence || collection),
        days: daysSince(row.createdAt), outcome: row.outcome, at: row.createdAt.toISOString(), decidedAt: row.resolvedAt?.toISOString() ?? null,
        evidence: row.evidence, claimedDates: row.dates, kind: absence ? "absence" : collection ? "collection" : "other",
        collector: collection ? { name: who.name ?? "", relation: who.relation ?? "", phone: who.phone ?? "", date: who.date ?? null } : null,
        absences, claimed: claimed.map((entry) => entry.date),
        // What accepting and declining would do, in words the form master can check before they decide.
        ifAccept: absence ? `${claimed.length || row.dates.length || "The"} ${(claimed.length || row.dates.length) === 1 ? "absence becomes" : "absences become"} excused` : collection ? `${who.name ?? "The named adult"} is added as a collector${who.date ? ` for ${who.date} only` : ""}` : "",
        ifDecline: absence ? "The absences stand" : collection ? "Only the usual adults may collect" : ""
      });
    }
    const decided = rows.filter((row) => row.resolvedAt && (!term || row.resolvedAt >= term.startDate));
    const spans = decided.map((row) => ((row.resolvedAt as Date).getTime() - row.createdAt.getTime()) / 86_400_000).sort((a, b) => a - b);
    const open = items.filter((item) => item.open);
    return {
      arms: me.formArms, items,
      kpis: {
        waiting: open.length, decided: decided.length, accepted: decided.filter((row) => row.state === "RESOLVED").length, declined: decided.filter((row) => row.state === "DECLINED").length,
        median: spans.length ? Math.round(spans[Math.floor(spans.length / 2)]! * 10) / 10 : null,
        withoutEvidence: open.filter((item) => item.kind === "absence" && !item.evidence).length, collections: open.filter((item) => item.kind === "collection").length
      },
      oldest: open.reduce((max, item) => Math.max(max, item.days), 0)
    };
  }

  /**
   * Decide one submission from the class. An absence explanation is accepted by naming the days it covers (or declined with a reason the
   * family reads); a change of who collects a child is accepted by adding the named adult for the day the family gave, and nothing longer.
   */
  async decide(session: SessionPayload, id: string, body: Record<string, unknown>) {
    const { ids } = await this.classes(session);
    const row = await prisma.guardianSubmission.findFirst({ where: { id, schoolId: session.schoolId }, include: { student: { select: { id: true, currentClassId: true } } } });
    if (!row) throw new NotFoundException("That submission does not exist.");
    if (!row.student?.currentClassId || !ids.includes(row.student.currentClassId)) throw new ForbiddenException("That child is not in a class you are form master of, so the submission is not yours to decide.");
    if (row.type === "Absence explanation") {
      // Where the family named the days, those are the days offered — a teacher who accepts without ticking anything means what was asked.
      const given = Array.isArray(body.dates) ? body.dates : body.dates ? [body.dates] : [];
      if (!given.length && /accept/i.test(String(body.decision ?? "")) && row.dates.length) {
        const open = await this.cases.openAbsences(session, row.student.id);
        body = { ...body, dates: open.filter((entry) => row.dates.includes(entry.date)).map((entry) => entry.date) };
      }
      return this.cases.decideExplanation(session, id, body);
    }
    if (row.type === "Collection change") return this.decideCollection(session, row, body);
    throw new BadRequestException(`A ${row.type.toLowerCase()} is decided by the office, not from a class.`);
  }

  private async decideCollection(session: SessionPayload, row: { id: string; schoolId: string; guardianId: string; studentId: string | null; detail: string; state: string; payload: Prisma.JsonValue; ownerUserId: string | null }, body: Record<string, unknown>) {
    const input = z.object({ decision: z.string().min(1), note: z.string().trim().optional(), tell: z.coerce.boolean().default(true) }).parse(body);
    if (row.state === "RESOLVED" || row.state === "DECLINED") throw new BadRequestException("That has already been decided.");
    const accepted = /accept/i.test(input.decision);
    if (!accepted && (input.note ?? "").length < 4) throw new BadRequestException("Say why it is declined — the family is told.");
    const who = (row.payload ?? {}) as { name?: string; relation?: string; phone?: string; date?: string };
    if (accepted) {
      if (!who.name || !who.phone || !row.studentId) throw new BadRequestException("This request does not say who will collect, so there is nobody to add. Ask the family to send it again with a name and a number.");
      const until = who.date ? new Date(`${who.date}T23:59:59.999Z`) : new Date(Date.now() + 86_400_000);
      await prisma.authorisedCollector.create({ data: { schoolId: session.schoolId, studentId: row.studentId, guardianId: row.guardianId, name: who.name, relation: who.relation || "Named by the family", phone: who.phone, until, addedById: session.userId } });
    }
    const outcome = accepted ? `Accepted · ${who.name} may collect${who.date ? ` on ${who.date} only` : " until tomorrow"}${input.note ? ` · ${input.note}` : ""}` : `Declined · ${input.note}`;
    await prisma.guardianSubmission.update({ where: { id: row.id }, data: { state: accepted ? "RESOLVED" : "DECLINED", outcome, resolvedAt: new Date(), ownerUserId: row.ownerUserId ?? session.userId } });
    if (input.tell) await notifyGuardian(session.schoolId, row.guardianId, "About who collects your child", `The school has ${accepted ? "accepted" : "declined"} your request. ${outcome}`, ["In-app", "SMS"]);
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "GuardianSubmission", entityId: row.id, metadata: { summary: `Collection change ${accepted ? "accepted" : "declined"}` } } });
    return { id: row.id, state: accepted ? "Resolved" : "Declined" };
  }
}
