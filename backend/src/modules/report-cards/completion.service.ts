import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { assertClassReadable, classScope } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../attendance-management/attendance.shared";
import { notifyGuardian } from "../guardian-management/guardians.shared";
import { type ArmData, loadAll, loadArm, loadStaffNames } from "../score-results/arm";
import { syncResultSheets } from "../score-results/sync";
import { portalOf } from "../student-records/records.shared";
import { mean, round1 } from "../score-results/scores.shared";
import { armState, cardReference, childCards, loadPolicy, owingStudents, sumState } from "./cards.shared";
import { CardService } from "./card.service";
import { RemarksService } from "./remarks.service";
import { notifyStudents, type StudentNotice } from "../student-portal/student-notify";

/**
 * Completion answers "which arms can I send out" — a card is generated for a child but published for an
 * arm. Publishing is the same whether it is one card or all of them: only cards with scores, a remark and
 * a review go; anything half-finished is skipped child by child and named, never sent.
 */

const scopeSchema = z.object({
  arms: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  level: z.string().optional(),
  students: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  everything: z.coerce.boolean().default(false)
});

const sendSchema = scopeSchema.extend({
  channels: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])),
  recipients: z.string().default("Primary guardian only"),
  message: z.string().trim().min(10, "Write the message that goes with the card."),
  /** The drawer sends "false" as text, and text "false" must not read as true. */
  publish: z.union([z.boolean(), z.string()]).default(false).transform((value) => value === true || value === "true")
});

const withholdSchema = z.object({ student: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)), reason: z.string().trim().min(8, "Record why — the family is not told, but the school's record is.") });
const reverseSchema = z.object({ batch: z.string().min(1) });

const SMS_PRICE = 3.8;

@Injectable()
export class CompletionService {
  constructor(private readonly cards: CardService, private readonly remarks: RemarksService) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "ReportCard", entityId, metadata } });
  }

  /** The arms a request names: some arms, a class, or the whole school. */
  private async targets(schoolId: string, term: { id: string }, scope: z.infer<typeof scopeSchema>) {
    if (scope.arms.length) return (await Promise.all(scope.arms.map((id) => loadArm(schoolId, term as never, id)))).filter((arm): arm is ArmData => arm !== null);
    const all = await loadAll(schoolId, term as never);
    if (scope.level) return all.filter((arm) => arm.room.levelName === scope.level);
    if (scope.everything) return all;
    if (scope.students.length) {
      const rows = await prisma.student.findMany({ where: { schoolId, id: { in: scope.students } }, select: { currentClassId: true } });
      const ids = new Set(rows.flatMap((row) => (row.currentClassId ? [row.currentClassId] : [])));
      return all.filter((arm) => ids.has(arm.room.id));
    }
    throw new BadRequestException("Choose an arm, a class, or the whole school.");
  }

  /* ───────────────────────── the school ───────────────────────── */

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    // A teaching person reads the cards of the arms they answer for, and nobody else's.
    const only = await classScope(session);
    const arms = await loadAll(schoolId, term, only ?? undefined);
    const policy = await loadPolicy(schoolId);
    const staff = await loadStaffNames(schoolId, arms.map((arm) => arm.room.classTeacherId ?? ""));
    const owing = policy.withholdForDebt ? await owingStudents(schoolId, term.id, arms.flatMap((arm) => arm.students.map((student) => student.id))) : undefined;
    const rows: Array<Awaited<ReturnType<CompletionService["armRow"]>>> = [];
    for (const arm of arms) rows.push(await this.armRow(schoolId, term.id, arm, owing, policy, staff));
    const total = (key: "roll" | "ready" | "blocked" | "owed" | "inReview" | "published" | "withheld") => rows.reduce((sum, row) => sum + row[key], 0);
    const unplaced = await prisma.student.count({ where: { schoolId, status: "ACTIVE", currentClassId: null } });
    const withoutSubjects = await prisma.classRoom.count({ where: { schoolId, deletedAt: null, isActive: true, students: { some: { status: "ACTIVE" } }, classSubjects: { none: { isActive: true } } } });
    return {
      term: { id: term.id, name: term.name, session: term.session }, policy, arms: rows, levels: Array.from(new Set(arms.map((arm) => arm.room.levelName))),
      kpis: { cards: total("roll"), ready: total("ready"), clear: rows.filter((row) => row.state === "Ready" || row.state === "Published").length, arms: rows.length, blocked: total("blocked"), owed: total("owed"), inReview: total("inReview"), published: total("published"), withheld: total("withheld"), blockedArms: rows.filter((row) => row.blocked).map((row) => row.name), owedArms: rows.filter((row) => row.owed).length, noPrincipal: rows.reduce((sum, row) => sum + row.noPrincipal, 0) },
      holding: { unassigned: Array.from(new Set(rows.flatMap((row) => row.unassigned.map((name) => `${name} · ${row.name}`)))), unplaced, withoutSubjects },
      publishDate: await this.remarks.publishDate(schoolId, term.id), unavailable: arms.length === 0, school: await this.remarks.schoolName(schoolId)
    };
  }

  private async armRow(schoolId: string, termId: string, arm: ArmData, owing: Set<string> | undefined, policy: Awaited<ReturnType<typeof loadPolicy>>, staff: Map<string, string>) {
    const cards = await childCards(schoolId, termId, arm, owing, policy);
    const sum = sumState(cards);
    const averages = cards.filter((card) => card.average !== null).map((card) => card.average as number);
    return { id: arm.room.id, name: arm.room.name, level: arm.room.levelName, master: arm.room.classTeacherId ? staff.get(arm.room.classTeacherId) ?? null : null, masterId: arm.room.classTeacherId, ...sum, average: averages.length ? round1(mean(averages) as number) : null, state: armState(sum), noPrincipal: cards.filter((card) => !card.review && !card.published).length, unassigned: arm.subjects.filter((subject) => subject.state === "Unassigned").map((subject) => subject.name) };
  }

  /* ───────────────────────── one arm ───────────────────────── */

  async arm(session: SessionPayload, classId: string) {
    await assertClassReadable(session, classId);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    const arm = await loadArm(schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const policy = await loadPolicy(schoolId);
    const ids = arm.students.map((student) => student.id);
    const owing = await owingStudents(schoolId, term.id, ids);
    const cards = await childCards(schoolId, term.id, arm, owing, policy);
    const links = await prisma.studentGuardian.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, isPrimary: true, guardian: { select: { userId: true, user: { select: { lastLoginAt: true } }, email: true } } } });
    const portal = new Map<string, "Active" | "Not activated">();
    const email = new Map<string, boolean>();
    for (const link of links) {
      if (portalOf(link.guardian.user) === "Active") portal.set(link.studentId, "Active");
      else if (!portal.has(link.studentId)) portal.set(link.studentId, "Not activated");
      if (link.guardian.email?.trim()) email.set(link.studentId, true);
    }
    const fm = arm.room.classTeacherId ? await prisma.user.findFirst({ where: { id: arm.room.classTeacherId }, select: { id: true, firstName: true, lastName: true, phone: true, role: true } }) : null;
    const sum = sumState(cards);
    const counted = arm.subjects.filter((subject) => subject.counts);
    return {
      school: await this.remarks.schoolName(schoolId), term: { id: term.id, name: term.name, session: term.session }, arm: { id: arm.room.id, name: arm.room.name, level: arm.room.levelName }, policy,
      master: fm ? { id: fm.id, name: fullName(fm), phone: fm.phone, role: fm.role } : null,
      sum, state: armState(sum), subjects: { approved: counted.filter((subject) => subject.state === "Approved").length, of: counted.length },
      children: cards.map((card) => ({ id: card.id, name: card.name, adm: card.adm, average: card.average, pos: card.pos, grade: card.grade, scores: card.scores, remark: card.remark, review: card.review, state: card.state, portal: portal.get(card.id) ?? "Not activated", fee: owing.has(card.id) ? "Outstanding" : "Settled", withheld: card.withheld, blockedBy: card.blockedBy.slice(0, 2), revision: card.revision, published: card.published })),
      principalWritten: cards.filter((card) => card.review).length, remarksWritten: cards.filter((card) => card.remark === "Submitted").length,
      emails: arm.students.filter((student) => email.get(student.id)).length, guardians: arm.students.filter((student) => portal.has(student.id)).length,
      publishDate: await this.remarks.publishDate(schoolId, term.id)
    };
  }

  /* ───────────────────────── publishing ───────────────────────── */

  async publish(session: SessionPayload, body: unknown) {
    const scope = scopeSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    const arms = await this.targets(schoolId, term, scope);
    const policy = await loadPolicy(schoolId);
    const only = new Set(scope.students);
    let published = 0;
    const skipped = { blocked: 0, owed: 0, inReview: 0, withheld: 0, already: 0, fees: 0 };
    const cardIds: string[] = [];
    const studentNotices: StudentNotice[] = [];
    const stamp = new Date();
    for (const arm of arms) {
      await syncResultSheets(schoolId, term, arm.room.id, session.userId);
      const fresh = (await loadArm(schoolId, term, arm.room.id)) as ArmData;
      const owing = policy.withholdForDebt ? await owingStudents(schoolId, term.id, fresh.students.map((student) => student.id)) : undefined;
      const children = (await childCards(schoolId, term.id, fresh, owing, policy)).filter((card) => !only.size || only.has(card.id));
      let armPublished = 0;
      for (const child of children) {
        if (child.state === "Published") skipped.already += 1;
        else if (child.state === "Withheld") skipped.withheld += 1;
        else if (child.state === "Blocked") skipped.blocked += 1;
        else if (child.state === "Remark owed") skipped.owed += 1;
        else if (child.state === "Awaiting review") skipped.inReview += 1;
        else if (child.owes) skipped.fees += 1;
        else {
          const data = await this.cards.build(schoolId, term, fresh, child.id, true);
          const json = { ...data, issuedAt: stamp.toISOString() } as unknown as Prisma.InputJsonValue;
          const links = await prisma.studentGuardian.findMany({ where: { studentId: child.id }, select: { guardianId: true, guardian: { select: { userId: true } } } });
          const reachable = links.some((link) => link.guardian.userId);
          const card = await prisma.reportCard.upsert({
            where: { schoolId_studentId_termId: { schoolId, studentId: child.id, termId: term.id } },
            update: { data: json, status: "PUBLISHED", publishedAt: stamp, lockedAt: stamp, publishedById: session.userId, deliveryState: reachable ? "DELIVERED" : "UNDELIVERED", reference: cardReference(data.admissionNumber, term.name), withheldAt: null, withheldReason: null },
            create: { schoolId, studentId: child.id, termId: term.id, classId: arm.room.id, status: "PUBLISHED", data: json, publishedAt: stamp, lockedAt: stamp, publishedById: session.userId, generatedById: session.userId, revision: 1, deliveryState: reachable ? "DELIVERED" : "UNDELIVERED", reference: cardReference(data.admissionNumber, term.name) }
          });
          await prisma.reportCardRevision.upsert({ where: { id: `${card.id}-r${card.revision}` }, update: {}, create: { id: `${card.id}-r${card.revision}`, schoolId, cardId: card.id, studentId: child.id, termId: term.id, revision: card.revision, kind: "ISSUE", reason: "Published", data: json, createdById: session.userId, notified: reachable } });
          const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId: child.id, termId: term.id } });
          if (sheet) {
            await prisma.resultSheet.update({ where: { id: sheet.id }, data: { status: "PUBLISHED", publishedAt: stamp, lockedAt: stamp } });
            await prisma.resultApproval.create({ data: { schoolId, resultSheetId: sheet.id, actorId: session.userId, action: "PUBLISH", fromStatus: sheet.status, toStatus: "PUBLISHED", note: "Report card published." } });
          }
          for (const link of links) await notifyGuardian(schoolId, link.guardianId, "Report card published", `${data.studentName}'s ${term.name} report card is now in the guardian portal.`, ["In-app"]);
          const own = await prisma.student.findUnique({ where: { id: child.id }, select: { userId: true } });
          if (own?.userId) studentNotices.push({ userId: own.userId, kind: "results", title: "Your report card is out", body: `Your ${term.name} report card is ready to read in Results.`, meta: { kind: "REPORT_CARD_PUBLISHED", cardId: card.id } });
          cardIds.push(card.id);
          published += 1;
          armPublished += 1;
        }
      }
      if (armPublished) await prisma.resultPublication.create({ data: { schoolId, termId: term.id, classId: arm.room.id, publishedById: session.userId, resultCount: armPublished, note: "Report cards published" } });
    }
    await notifyStudents(schoolId, studentNotices);
    const skippedTotal = Object.values(skipped).reduce((sum, value) => sum + value, 0) - skipped.already;
    if (!published) throw new BadRequestException(skipped.already && !skippedTotal ? "Those cards have all been published already." : `Nothing is ready to publish. ${skipped.blocked ? `${skipped.blocked} blocked on scores · ` : ""}${skipped.owed ? `${skipped.owed} remarks owed · ` : ""}${skipped.inReview ? `${skipped.inReview} awaiting review` : ""}`.replace(/ · $/, ""));
    const label = scope.arms.length === 1 ? arms[0].room.name : scope.level ?? "the whole school";
    const batch = await prisma.cardBatch.create({ data: { schoolId, termId: term.id, kind: "PUBLISH", scope: label, cards: published, skipped: skippedTotal, byId: session.userId, cardIds } });
    await this.audit(session, AuditAction.APPROVE, batch.id, { summary: `Report cards published · ${label} · ${published}`, skipped });
    return {
      published, skipped: skippedTotal, batch: batch.id, reversibleMinutes: policy.reversibleMinutes,
      fields: [["Published", `${published} ${published === 1 ? "card" : "cards"}`], ["Left out", skippedTotal ? `${skippedTotal} — something on their row is outstanding` : "None"], ["Reversible for", `${policy.reversibleMinutes} minutes`], ["Families told", "In-app · SMS, email and WhatsApp are a separate send"]]
    };
  }

  /** Taking a publish back, while it is still fresh. After that a correction reissues the card. */
  async unpublish(session: SessionPayload, body: unknown) {
    const input = reverseSchema.parse(body);
    const schoolId = session.schoolId;
    const policy = await loadPolicy(schoolId);
    const batch = await prisma.cardBatch.findFirst({ where: { id: input.batch, schoolId, kind: "PUBLISH" } });
    if (!batch) throw new NotFoundException("That publish is not on record.");
    if (Date.now() - batch.createdAt.getTime() > policy.reversibleMinutes * 60_000) throw new BadRequestException(`The ${policy.reversibleMinutes} minutes in which a publish can be taken back have passed. A change now reissues the card and tells the family why.`);
    const cards = await prisma.reportCard.findMany({ where: { id: { in: batch.cardIds }, schoolId } });
    if (cards.some((card) => card.revision > 1)) throw new BadRequestException("A card in this publish has already been revised, so it can only change through a correction.");
    for (const card of cards) {
      await prisma.reportCard.update({ where: { id: card.id }, data: { status: "GENERATED", publishedAt: null, lockedAt: null, deliveryState: null } });
      await prisma.resultSheet.updateMany({ where: { schoolId, studentId: card.studentId, termId: card.termId, status: "PUBLISHED" }, data: { status: "APPROVED", publishedAt: null, lockedAt: null } });
    }
    await prisma.resultPublication.updateMany({ where: { schoolId, termId: batch.termId, unpublishedAt: null, publishedAt: { gte: new Date(batch.createdAt.getTime() - 60_000) } }, data: { unpublishedAt: new Date() } });
    await prisma.cardBatch.create({ data: { schoolId, termId: batch.termId, kind: "UNPUBLISH", scope: batch.scope, cards: cards.length, byId: session.userId, cardIds: batch.cardIds } });
    await this.audit(session, AuditAction.UPDATE, batch.id, { summary: `Report cards taken back · ${batch.scope} · ${cards.length}` });
    return { cards: cards.length, fields: [["Taken back", String(cards.length)], ["Families", "Told in-app when they were published; nothing recalls that message"]] };
  }

  /* ───────────────────────── withholding ───────────────────────── */

  async withhold(session: SessionPayload, body: unknown) {
    const input = withholdSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    const student = await prisma.student.findFirst({ where: { id: input.student, schoolId }, select: { id: true, firstName: true, lastName: true, currentClassId: true, admissionNumber: true } });
    if (!student?.currentClassId) throw new BadRequestException("That child sits in no arm.");
    const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId: student.id, termId: term.id }, select: { status: true } });
    if (sheet?.status === "PUBLISHED") throw new BadRequestException("That card has already reached the family. It cannot be withheld now — only corrected.");
    const stamp = new Date();
    await prisma.reportCard.upsert({
      where: { schoolId_studentId_termId: { schoolId, studentId: student.id, termId: term.id } },
      update: { withheldAt: stamp, withheldReason: input.reason, withheldById: session.userId, deliveryState: "NOT_SENT" },
      create: { schoolId, studentId: student.id, termId: term.id, classId: student.currentClassId, status: "DRAFT", data: {}, withheldAt: stamp, withheldReason: input.reason, withheldById: session.userId, deliveryState: "NOT_SENT", reference: cardReference(student.admissionNumber, term.name) }
    });
    await this.audit(session, AuditAction.UPDATE, student.id, { summary: `Report card withheld · ${fullName(student)}`, reason: input.reason });
    return { withheld: true, fields: [["Child", fullName(student)], ["State", "Withheld — never published with the rest"], ["Reason", "Kept on the school's record"]] };
  }

  async release(session: SessionPayload, studentId: string) {
    const term = await this.cards.term(session.schoolId);
    const card = await prisma.reportCard.findFirst({ where: { schoolId: session.schoolId, studentId, termId: term.id, withheldAt: { not: null } } });
    if (!card) throw new NotFoundException("That card is not withheld.");
    await prisma.reportCard.update({ where: { id: card.id }, data: { withheldAt: null, withheldReason: null, withheldById: null, deliveryState: null } });
    await this.audit(session, AuditAction.UPDATE, card.id, { summary: "Report card released" });
    return { released: true };
  }

  /* ───────────────────────── printing and sending ───────────────────────── */

  async printSet(session: SessionPayload, query: Record<string, string | string[] | undefined>) {
    const scope = scopeSchema.parse({ arms: query.arms ?? query.arm, level: query.level, students: query.students, everything: query.everything });
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId, typeof query.term === "string" ? query.term : undefined);
    const arms = await this.targets(schoolId, term, scope);
    const only = new Set(scope.students);
    const out: Array<Awaited<ReturnType<CardService["view"]>>> = [];
    for (const arm of arms) {
      const children = (await childCards(schoolId, term.id, arm)).filter((card) => (!only.size || only.has(card.id)) && card.scores);
      for (const child of children.slice(0, 120)) out.push(await this.cards.view(session, child.id, term.id));
    }
    return { term: { id: term.id, name: term.name, session: term.session }, cards: out, count: out.length, drafts: out.filter((entry) => entry.state === "Draft").length };
  }

  async printRecord(session: SessionPayload, body: unknown) {
    const scope = scopeSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    const arms = await this.targets(schoolId, term, scope);
    const only = new Set(scope.students);
    let count = 0;
    let drafts = 0;
    for (const arm of arms) {
      const children = (await childCards(schoolId, term.id, arm)).filter((card) => (!only.size || only.has(card.id)) && card.scores);
      count += children.length;
      drafts += children.filter((card) => card.state !== "Published").length;
    }
    if (!count) throw new BadRequestException("There is no card with scores to print in that scope.");
    const label = scope.arms.length === 1 ? arms[0].room.name : scope.level ?? "the whole school";
    await prisma.cardBatch.create({ data: { schoolId, termId: term.id, kind: "PRINT", scope: label, cards: count, skipped: 0, byId: session.userId, cardIds: [] } });
    const params = new URLSearchParams();
    for (const id of scope.arms) params.append("arms", id);
    if (scope.level) params.set("level", scope.level);
    if (scope.everything) params.set("everything", "true");
    for (const id of scope.students) params.append("students", id);
    await this.audit(session, AuditAction.EXPORT, term.id, { summary: `Report cards printed · ${label} · ${count}`, drafts });
    return { href: `/print/cards?${params.toString()}`, hrefLabel: "Open the print run", cards: count, drafts, fields: [["Cards", String(count)], ["Drafts", drafts ? `${drafts} watermarked DRAFT — never handed out by mistake` : "None — every card is final"]] };
  }

  async send(session: SessionPayload, body: unknown) {
    const input = sendSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    if (!input.channels.length) throw new BadRequestException("Choose at least one channel.");
    if (input.publish) {
      try {
        await this.publish(session, body);
      } catch (error) {
        // Everything in scope already being out is not a reason to refuse the send.
        if (!(error instanceof BadRequestException) || !/already been published/i.test(error.message)) throw error;
      }
    }
    const arms = await this.targets(schoolId, term, input);
    const only = new Set(input.students);
    const channelSet = Array.from(new Set(["In-app", ...input.channels.flatMap((channel) => (/sms|whatsapp/i.test(channel) ? ["SMS"] : /email/i.test(channel) ? ["Email"] : []))]));
    let cardsSent = 0;
    let guardians = 0;
    let credits = 0;
    const unreached: string[] = [];
    for (const arm of arms) {
      const children = (await childCards(schoolId, term.id, arm)).filter((card) => card.published && (!only.size || only.has(card.id)));
      for (const child of children) {
        const links = await prisma.studentGuardian.findMany({ where: { studentId: child.id }, select: { isPrimary: true, guardianId: true } });
        const targets = /primary/i.test(input.recipients) ? links.filter((link) => link.isPrimary).slice(0, 1) : links;
        let reached = false;
        for (const link of targets.length ? targets : links.slice(0, 1)) {
          const result = await notifyGuardian(schoolId, link.guardianId, `Report card · ${child.name}`, input.message, channelSet);
          if (result.sent.length) {
            reached = true;
            guardians += 1;
            if (result.sent.includes("SMS")) credits += 1;
          }
        }
        if (reached) cardsSent += 1;
        else unreached.push(child.name);
      }
    }
    if (!cardsSent) throw new BadRequestException("No published card in that scope has a guardian who can be reached on those channels.");
    const label = input.arms.length === 1 ? arms[0].room.name : input.level ?? "the whole school";
    await prisma.cardBatch.create({ data: { schoolId, termId: term.id, kind: "SEND", scope: label, cards: cardsSent, skipped: unreached.length, channels: input.channels, byId: session.userId, cardIds: [] } });
    await this.audit(session, AuditAction.UPDATE, term.id, { summary: `Report cards sent off-app · ${label} · ${cardsSent}`, channels: input.channels });
    return { cards: cardsSent, guardians, credits, unreached: unreached.length, fields: [["Cards sent", String(cardsSent)], ["Guardians written to", String(guardians)], ["SMS credits", `${credits} · ₦${(credits * SMS_PRICE).toFixed(2)}`], ...(unreached.length ? [["Nobody to reach", unreached.slice(0, 3).join(", ")]] : [])], note: "Messages are queued on each channel the family can be reached by. Nothing is delivered from this system until a provider is connected." };
  }

}
