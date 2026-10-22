import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { classScope } from "../../common/teaching-scope";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { armName, fullName, iso, shortDay } from "../attendance-management/attendance.shared";
import { notifyGuardian } from "../guardian-management/guardians.shared";
import { loadStaffNames } from "../score-results/arm";
import { CardService } from "./card.service";
import { cardReference, loadPolicy } from "./cards.shared";

/**
 * The archive is every card ever issued, retrievable by child, arm, term and session — and it opens the
 * actual card as the family received it, because an archive that cannot show the document is only a log.
 */

const reissueSchema = z.object({
  student: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  term: z.string().optional(),
  reason: z.string().min(1, "Choose the reason."),
  delivery: z.string().default("Both")
});

@Injectable()
export class ArchiveService {
  constructor(private readonly cards: CardService) {}

  async overview(session: SessionPayload, query: { term?: string; arm?: string }) {
    const schoolId = session.schoolId;
    // A teaching person retrieves the cards of the arms they answer for — they do not browse the school.
    const only = await classScope(session);
    const terms = await prisma.term.findMany({ where: { schoolId }, include: { academicSession: { select: { name: true } } }, orderBy: { startDate: "desc" } });
    const sheets = await prisma.resultSheet.findMany({
      where: { schoolId, OR: [{ status: "PUBLISHED" }, { publishedAt: { not: null } }], ...(query.term ? { termId: query.term } : {}), ...(query.arm || only ? { student: { currentClassId: query.arm && (!only || only.includes(query.arm)) ? query.arm : only ? { in: only } : query.arm } } : {}) },
      select: { id: true, studentId: true, termId: true, publishedAt: true, student: { select: { firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { id: true, name: true, arm: true } }, guardians: { select: { guardian: { select: { userId: true } } } } } } },
      orderBy: { publishedAt: "desc" }, take: 400
    });
    const [cards, revisions, batches, withheld] = await Promise.all([
      prisma.reportCard.findMany({ where: { schoolId, studentId: { in: sheets.map((sheet) => sheet.studentId) } }, select: { studentId: true, termId: true, revision: true, deliveryState: true, reference: true } }),
      prisma.reportCardRevision.findMany({ where: { schoolId, kind: { not: "ISSUE" } }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.cardBatch.findMany({ where: { schoolId, kind: { in: ["PRINT", "SEND", "PUBLISH", "UNPUBLISH"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.reportCard.count({ where: { schoolId, withheldAt: { not: null } } })
    ]);
    const policy = await loadPolicy(schoolId);
    const reversible = (batch: (typeof batches)[number]) => batch.kind === "PUBLISH" && Date.now() - batch.createdAt.getTime() <= policy.reversibleMinutes * 60_000 && !batches.some((later) => later.kind === "UNPUBLISH" && later.createdAt > batch.createdAt && later.cardIds.some((id) => batch.cardIds.includes(id)));
    const cardOf = new Map(cards.map((card) => [`${card.studentId}|${card.termId}`, card]));
    const termName = new Map(terms.map((term) => [term.id, `${term.name} ${term.academicSession?.name ?? ""}`.trim()]));
    const rows = sheets.map((sheet) => {
      const card = cardOf.get(`${sheet.studentId}|${sheet.termId}`);
      const reachable = sheet.student.guardians.some((link) => link.guardian.userId);
      const delivery = card?.deliveryState === "NOT_SENT" ? "Not sent" : card?.deliveryState === "UNDELIVERED" || (!card?.deliveryState && !reachable) ? "Undelivered" : "Delivered";
      return { studentId: sheet.studentId, name: fullName(sheet.student), adm: sheet.student.admissionNumber, classId: sheet.student.currentClass?.id ?? null, arm: sheet.student.currentClass ? armName(sheet.student.currentClass) : "No arm", termId: sheet.termId, term: termName.get(sheet.termId) ?? "", revision: card?.revision ?? 1, state: (card?.revision ?? 1) > 1 ? "Revised" : "Published", delivery, reference: card?.reference ?? cardReference(sheet.student.admissionNumber, terms.find((term) => term.id === sheet.termId)?.name ?? ""), published: sheet.publishedAt ? iso(sheet.publishedAt) : null };
    });
    const people = await loadStaffNames(schoolId, batches.map((batch) => batch.byId));
    const students = await prisma.student.findMany({ where: { id: { in: revisions.map((entry) => entry.studentId) } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(students.map((student) => [student.id, fullName(student)]));
    const arms = await prisma.classRoom.findMany({ where: { schoolId, deletedAt: null, ...(only ? { id: { in: only } } : {}), students: { some: { status: "ACTIVE" } } }, select: { id: true, name: true, arm: true }, orderBy: [{ name: "asc" }] });
    return {
      terms: terms.map((term) => ({ id: term.id, name: term.name, session: term.academicSession?.name ?? "", current: term.isCurrent })), arms: arms.map((arm) => ({ id: arm.id, name: armName(arm) })),
      kpis: { issued: rows.length, sessions: new Set(terms.map((term) => term.academicSessionId)).size, revisions: revisions.length + rows.filter((row) => row.revision > 1 && !revisions.length).length, undelivered: rows.filter((row) => row.delivery === "Undelivered").length, withheld },
      rows,
      revisions: revisions.map((entry) => ({ id: entry.id, name: nameOf.get(entry.studentId) ?? "—", studentId: entry.studentId, termId: entry.termId, term: termName.get(entry.termId) ?? "", revision: entry.revision, kind: entry.kind, reason: entry.reason, at: iso(entry.createdAt), notified: entry.notified })),
      batches: batches.map((batch) => ({ id: batch.id, kind: batch.kind, scope: batch.scope, cards: batch.cards, by: people.get(batch.byId) ?? "—", at: shortDay(batch.createdAt), channels: batch.channels, reversible: reversible(batch), termId: batch.termId, term: termName.get(batch.termId) ?? "" })),
      policy: { reversibleMinutes: policy.reversibleMinutes },
      filters: { term: query.term ?? null, arm: query.arm ?? null }
    };
  }

  async reissue(session: SessionPayload, body: unknown) {
    const input = reissueSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId, input.term);
    const student = await prisma.student.findFirst({ where: { id: input.student, schoolId }, select: { id: true, firstName: true, lastName: true } });
    if (!student) throw new NotFoundException("That child is not in this school.");
    const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId: student.id, termId: term.id }, select: { status: true } });
    if (sheet?.status !== "PUBLISHED") throw new BadRequestException("That card has never been issued, so there is nothing to reissue. Publish it first.");
    let revision: number | null = null;
    let told = 0;
    if (/corrected/i.test(input.reason)) {
      const result = await this.cards.reissue(schoolId, session.userId, student.id, term.id, "Reissued after a corrected result", "REISSUE");
      revision = result?.revision ?? null;
      told = result?.told ?? 0;
    } else if (/delivered/i.test(input.reason) || /portal|both/i.test(input.delivery)) {
      const links = await prisma.studentGuardian.findMany({ where: { studentId: student.id }, select: { guardianId: true } });
      for (const link of links) {
        const sent = await notifyGuardian(schoolId, link.guardianId, "Report card", `${fullName(student)}'s ${term.name} report card is in the guardian portal.`, ["In-app", "SMS"]);
        if (sent.sent.length) told += 1;
      }
    }
    await prisma.cardBatch.create({ data: { schoolId, termId: term.id, kind: /print|both/i.test(input.delivery) ? "PRINT" : "SEND", scope: `${fullName(student)} · ${input.reason}`, cards: 1, byId: session.userId, cardIds: [] } });
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.UPDATE, entityType: "ReportCard", entityId: student.id, metadata: { summary: `Report card reissued · ${fullName(student)} · ${input.reason}`, delivery: input.delivery, revision } } });
    return { revision, told, href: /print|both/i.test(input.delivery) ? `/print/cards?students=${student.id}&term=${term.id}` : null, fields: [["Child", fullName(student)], ["Reason", input.reason], ["Revision", revision ? `Revision ${revision} · the earlier version is kept` : "The same card — nothing in it changed"], ["Families told", String(told)]] };
  }
}
