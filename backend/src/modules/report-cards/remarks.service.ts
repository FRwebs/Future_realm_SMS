import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { assertClassReadable, classScope } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { Access, TEACHING_ROLES, fullName, iso, shortDay } from "../attendance-management/attendance.shared";
import { loadAll, loadArm, loadStaffNames, studentResults } from "../score-results/arm";
import { gradeOf, mean, ordinal, round1 } from "../score-results/scores.shared";
import { BANDS, REVIEW_FLAGS, TONES, bandOf, childCards, loadPolicy, remarkState, suggestion, toneFor, type RemarkRow } from "./cards.shared";
import { CardService } from "./card.service";

/**
 * Remarks are a judgement about a child, so they are never written against a name in a list: the page
 * puts the result the remark is about, and the terms before it, in front of the person writing. A form
 * master writes theirs; the Principal reads it, then adds a review; both print on the card.
 */

const saveSchema = z.object({
  student: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value[0] : value)),
  author: z.string().default("PRINCIPAL"),
  text: z.string().trim().min(1, "Write the remark — two or three sentences is plenty."),
  tone: z.string().optional(),
  flags: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  /** "false" must mean false — a draft is not a submission. */
  final: z.union([z.boolean(), z.string()]).default(true).transform((value) => value === true || value === "true")
});

const bandSchema = z.object({
  arms: z.union([z.string(), z.array(z.string())]).transform((value) => (Array.isArray(value) ? value : [value])),
  band: z.string().min(1, "Choose the band."),
  text: z.string().trim().min(10, "Write the wording to apply."),
  tone: z.string().optional(),
  onlyEmpty: z.union([z.boolean(), z.string()]).default(true).transform((value) => value === true || value === "true")
});

@Injectable()
export class RemarksService {
  constructor(private readonly access: Access, private readonly cards: CardService) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "ReportRemark", entityId, metadata } });
  }

  /** When the school's own calendar lets results go out: the latest release date among the term's assessment windows. */
  async schoolName(schoolId: string) {
    return (await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }))?.name ?? "";
  }

  async publishDate(schoolId: string, termId: string) {
    const windows = await prisma.assessmentWindow.findMany({ where: { schoolId, termId }, select: { releaseAt: true }, orderBy: { releaseAt: "desc" }, take: 1 });
    const date = windows[0]?.releaseAt ?? null;
    return date ? { iso: iso(date), days: Math.ceil((date.getTime() - Date.now()) / 86_400_000) } : null;
  }

  async overview(session: SessionPayload, query: { level?: string; arm?: string }) {
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    // A teaching person reads the remarks of the arms they are form master of, and nobody else's.
    const only = await classScope(session);
    const arms = await loadAll(schoolId, term, only ?? undefined);
    const levels = Array.from(new Set(arms.map((arm) => arm.room.levelName)));
    const level = query.level && levels.includes(query.level) ? query.level : null;
    const inScope = arms.filter((arm) => (!level || arm.room.levelName === level) && (!query.arm || arm.room.id === query.arm));
    const policy = await loadPolicy(schoolId);
    const names = await loadStaffNames(schoolId, arms.map((arm) => arm.room.classTeacherId ?? ""));
    const attendance = await prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId: term.id, subjectId: null, studentId: { in: inScope.flatMap((arm) => arm.students.map((student) => student.id)) } }, _count: { _all: true } });
    const att = new Map<string, { counted: number; ok: number }>();
    for (const row of attendance) {
      if (row.status === "EXCUSED") continue;
      const entry = att.get(row.studentId) ?? { counted: 0, ok: 0 };
      entry.counted += row._count._all;
      if (row.status !== "ABSENT") entry.ok += row._count._all;
      att.set(row.studentId, entry);
    }
    const students: Array<{ id: string; classId: string; arm: string; name: string; adm: string; average: number | null; band: string; attendance: number | null; teacher: string; reviewed: boolean; state: string }> = [];
    const tracker: Array<{ classId: string; arm: string; owner: string | null; ownerId: string | null; written: number; roll: number; state: string }> = [];
    for (const arm of inScope) {
      const cards = await childCards(schoolId, term.id, arm, undefined, policy);
      for (const card of cards) {
        const a = att.get(card.id);
        students.push({ id: card.id, classId: arm.room.id, arm: arm.room.name, name: card.name, adm: card.adm, average: card.average, band: bandOf(card.average), attendance: a?.counted ? Math.round((a.ok / a.counted) * 1000) / 10 : null, teacher: card.remark, reviewed: card.review, state: card.state });
      }
      const written = cards.filter((card) => card.remark === "Submitted").length;
      tracker.push({ classId: arm.room.id, arm: arm.room.name, owner: arm.room.classTeacherId ? names.get(arm.room.classTeacherId) ?? null : null, ownerId: arm.room.classTeacherId, written, roll: cards.length, state: written === cards.length ? "Complete" : written ? "In progress" : "Not started" });
    }
    const waiting = students.filter((student) => student.teacher === "Submitted" && !student.reviewed);
    return {
      term: { id: term.id, name: term.name, session: term.session }, levels, level, arms: arms.map((arm) => ({ id: arm.room.id, name: arm.room.name, level: arm.room.levelName })), arm: query.arm ?? null,
      label: query.arm ? arms.find((arm) => arm.room.id === query.arm)?.room.name ?? "One arm" : level ?? (only ? arms.map((arm) => arm.room.name).join(" and ") || "no arm" : "the whole school"),
      students, tracker,
      kpis: { students: students.length, teacherIn: students.filter((student) => student.teacher === "Submitted").length, waiting: waiting.length, reviewed: students.filter((student) => student.reviewed).length, firstWaiting: waiting[0] ? { classId: waiting[0].classId, id: waiting[0].id } : null, first: students[0] ? { classId: students[0].classId, id: students[0].id } : null },
      publishDate: await this.publishDate(schoolId, term.id), bands: BANDS, unavailable: arms.length === 0, school: await this.schoolName(schoolId),
      owing: tracker.filter((row) => row.state !== "Complete" && row.ownerId).map((row) => ({ id: row.ownerId as string, name: row.owner as string }))
    };
  }

  /** One child's review page: the result, what the form master wrote, the box for the Principal's own, and the history behind both. */
  async student(session: SessionPayload, classId: string, studentId: string) {
    await assertClassReadable(session, classId);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    const arm = await loadArm(schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const learner = arm.students.find((entry) => entry.id === studentId);
    if (!learner) throw new NotFoundException("That child is not on this arm's roll.");
    const results = studentResults(arm, false);
    const mine = results.find((entry) => entry.id === studentId);
    const cards = await childCards(schoolId, term.id, arm);
    const me = cards.find((entry) => entry.id === studentId);
    const index = arm.students.findIndex((entry) => entry.id === studentId);
    const [remarks, sheet, attendance, history, staff] = await Promise.all([
      prisma.reportRemark.findMany({ where: { schoolId, studentId, termId: term.id } }),
      prisma.resultSheet.findFirst({ where: { schoolId, studentId, termId: term.id }, select: { teacherComment: true, principalComment: true, status: true } }),
      prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId, studentId, termId: term.id, subjectId: null }, _count: { _all: true } }),
      prisma.resultSheet.findMany({ where: { schoolId, studentId, term: { academicSessionId: (await prisma.term.findUniqueOrThrow({ where: { id: term.id }, select: { academicSessionId: true } })).academicSessionId } }, include: { term: { select: { id: true, name: true, order: true } } }, orderBy: { term: { order: "asc" } } }),
      loadStaffNames(schoolId, [arm.room.classTeacherId ?? ""])
    ]);
    const fmRow = remarks.find((row) => row.author === "FORM_MASTER") as RemarkRow | undefined;
    const prRow = remarks.find((row) => row.author === "PRINCIPAL") as RemarkRow | undefined;
    const fm = remarkState(fmRow, sheet?.teacherComment);
    const pr = remarkState(prRow, sheet?.principalComment);
    const authors = await loadStaffNames(schoolId, [fmRow?.authorId ?? "", prRow?.authorId ?? ""]);
    const days = attendance.reduce((total, row) => total + row._count._all, 0);
    const absent = attendance.find((row) => row.status === "ABSENT")?._count._all ?? 0;
    const excused = attendance.find((row) => row.status === "EXCUSED")?._count._all ?? 0;
    const counted = days - excused;
    const first = learner.name.split(" ")[0];
    const subjects = arm.subjects.filter((subject) => subject.counts).map((subject) => {
      const row = subject.rows.find((entry) => entry.id === studentId);
      return { name: subject.name, total: row?.total ?? null, grade: row?.grade ?? null, pos: row?.pos ?? null, classAvg: subject.mean, standing: row?.standing ?? "—", state: subject.state };
    });
    const scored = subjects.filter((subject) => subject.total !== null);
    const best = scored.slice().sort((a, b) => (b.total as number) - (a.total as number))[0] ?? null;
    const weakest = scored.slice().sort((a, b) => (a.total as number) - (b.total as number))[0] ?? null;
    const armMean = mean(results.filter((entry) => entry.average !== null).map((entry) => entry.average as number));
    const peers = arm.students.map((entry) => ({ id: entry.id, name: entry.name, reviewed: cards.find((card) => card.id === entry.id)?.review ?? false }));
    const allowedFm = this.canWriteFormMaster(session, arm.room.classTeacherId);
    const canReview = (await this.access.can(session, "report-cards.remarks.approve"));
    return {
      school: await this.schoolName(schoolId), term: { id: term.id, name: term.name, session: term.session }, arm: { id: arm.room.id, name: arm.room.name, master: arm.room.classTeacherId ? staff.get(arm.room.classTeacherId) ?? null : null },
      student: { id: learner.id, name: learner.name, adm: learner.adm, first }, position: index + 1, of: arm.students.length, peers, next: arm.students[index + 1] ?? null, previous: arm.students[index - 1] ?? null,
      summary: { average: mine?.average ?? null, band: bandOf(mine?.average ?? null), pos: mine?.pos ?? null, outOf: results.filter((entry) => entry.average !== null).length, grade: mine?.grade ?? null, armAverage: armMean === null ? null : round1(armMean), best, weakest, passed: scored.filter((subject) => (subject.total as number) >= arm.passMark).length, subjects: subjects.length, blocked: !me?.scores, blockedBy: me?.blockedBy ?? [], state: me?.state ?? "Blocked" },
      attendance: { pct: counted > 0 ? Math.round(((counted - absent) / counted) * 1000) / 10 : null, absent, days },
      subjects,
      teacher: { state: fm.state, text: fm.text, by: fmRow ? authors.get(fmRow.authorId) ?? null : arm.room.classTeacherId ? staff.get(arm.room.classTeacherId) ?? null : null, role: `Form master · ${arm.room.name}`, when: fmRow?.submittedAt ? shortDay(fmRow.submittedAt) : fm.state === "Draft" ? "Draft · not submitted" : fm.state === "Submitted" ? "On the result sheet" : "", onBehalf: Boolean(fmRow?.onBehalf), ownerId: arm.room.classTeacherId },
      mine: { state: pr.state, text: pr.text, tone: prRow?.tone ?? toneFor(mine?.average ?? null), flags: prRow?.flags ?? (mine?.average !== null && mine?.average !== undefined && mine.average < 40 ? ["Recommend a guardian meeting"] : []), by: prRow ? authors.get(prRow.authorId) ?? null : null },
      suggestion: suggestion(mine?.average ?? null, first), tones: TONES, flagOptions: REVIEW_FLAGS, minRemark: (await loadPolicy(schoolId)).minRemark,
      history: history.filter((entry) => entry.term.id !== term.id).map((entry) => ({ term: entry.term.name, average: entry.averageScore, pos: entry.position, published: entry.publishedAt ? iso(entry.publishedAt) : null, state: entry.status, remark: (entry.principalComment ?? "").trim() || (entry.teacherComment ?? "").trim() || null })),
      canWriteFormMaster: allowedFm, canReview, published: me?.published ?? false, cardState: me?.state ?? "Blocked",
      gradeBands: arm.bands.map((band) => ({ label: band.label, min: band.min })), gradeOf: gradeOf(arm.bands, mine?.average ?? null)?.label ?? null, ordinal: mine?.pos ? ordinal(mine.pos) : null
    };
  }

  private canWriteFormMaster(session: SessionPayload, classTeacherId: string | null) {
    if (!TEACHING_ROLES.has(session.role)) return true;
    return classTeacherId === session.userId;
  }

  async save(session: SessionPayload, body: unknown) {
    const input = saveSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    const policy = await loadPolicy(schoolId);
    const student = await prisma.student.findFirst({ where: { id: input.student, schoolId }, select: { id: true, firstName: true, lastName: true, currentClassId: true, currentClass: { select: { classTeacherId: true, assistantClassTeacherId: true } } } });
    if (!student?.currentClassId) throw new BadRequestException("That child sits in no arm, so there is no card to write on.");
    const author = /principal/i.test(input.author) ? "PRINCIPAL" : "FORM_MASTER";
    let onBehalf = false;
    if (author === "PRINCIPAL") {
      if (!(await this.access.can(session, "report-cards.remarks.approve"))) throw new ForbiddenException("The Principal's review is written by someone who can approve report cards.");
    } else if (student.currentClass?.classTeacherId !== session.userId && student.currentClass?.assistantClassTeacherId !== session.userId) {
      if (TEACHING_ROLES.has(session.role)) throw new ForbiddenException("The form master's remark is written by the form master of that arm.");
      onBehalf = true;
    }
    if (input.final && input.text.length < policy.minRemark) throw new BadRequestException(`A remark of ${input.text.length} characters is not a remark. Write at least a sentence.`);
    const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId: student.id, termId: term.id }, select: { id: true, status: true } });
    if (sheet?.status === "PUBLISHED") throw new BadRequestException("That card has already been published. A change reaches the family as a correction, not as an edit.");
    const stamp = new Date();
    const data = { text: input.text, tone: input.tone ?? null, flags: input.flags, state: input.final ? "SUBMITTED" : "DRAFT", authorId: session.userId, onBehalf, submittedAt: input.final ? stamp : null };
    const row = await prisma.reportRemark.upsert({
      where: { studentId_termId_author: { studentId: student.id, termId: term.id, author } },
      update: data, create: { schoolId, studentId: student.id, termId: term.id, classId: student.currentClassId, author, ...data }
    });
    if (input.final && sheet) await prisma.resultSheet.update({ where: { id: sheet.id }, data: author === "PRINCIPAL" ? { principalComment: input.text } : { teacherComment: input.text } });
    await this.audit(session, AuditAction.UPDATE, row.id, { summary: `${author === "PRINCIPAL" ? "Principal's review" : "Form master's remark"} ${input.final ? "submitted" : "saved as a draft"} · ${fullName(student)}`, onBehalf });
    return { id: row.id, state: input.final ? "Submitted" : "Draft", onBehalf, fields: [["Child", fullName(student)], ["Saved as", input.final ? "Final · on the card" : "Draft · not on the card yet"], ...(onBehalf ? [["Written for the form master", "Logged under your name"]] : [])] };
  }

  /** The Principal's review for everyone in a band, in one go — wording to start from, never to be left unread. */
  async applyBand(session: SessionPayload, body: unknown) {
    const input = bandSchema.parse(body);
    const schoolId = session.schoolId;
    const term = await this.cards.term(schoolId);
    if (!BANDS.includes(input.band)) throw new BadRequestException("That is not a band.");
    let written = 0;
    let skipped = 0;
    const touched: string[] = [];
    for (const classId of input.arms) {
      const arm = await loadArm(schoolId, term, classId);
      if (!arm) continue;
      const results = studentResults(arm, false);
      const cards = await childCards(schoolId, term.id, arm);
      for (const result of results) {
        if (bandOf(result.average) !== input.band) continue;
        const card = cards.find((entry) => entry.id === result.id);
        if (card?.published || (input.onlyEmpty && card?.review)) {
          skipped += 1;
          continue;
        }
        const first = result.name.split(" ")[0];
        const sheet = await prisma.resultSheet.findFirst({ where: { schoolId, studentId: result.id, termId: term.id }, select: { id: true } });
        const text = input.text.replace(/\{first\}/g, first);
        await prisma.reportRemark.upsert({
          where: { studentId_termId_author: { studentId: result.id, termId: term.id, author: "PRINCIPAL" } },
          update: { text, tone: input.tone ?? null, state: "SUBMITTED", authorId: session.userId, submittedAt: new Date() },
          create: { schoolId, studentId: result.id, termId: term.id, classId, author: "PRINCIPAL", text, tone: input.tone ?? null, state: "SUBMITTED", authorId: session.userId, submittedAt: new Date() }
        });
        if (sheet) await prisma.resultSheet.update({ where: { id: sheet.id }, data: { principalComment: text } });
        written += 1;
        touched.push(result.id);
      }
    }
    if (!written) throw new BadRequestException(skipped ? `Nobody in that band needed one — ${skipped} already have a review or a published card.` : `Nobody in ${input.arms.length === 1 ? "that arm" : "those arms"} is in the ${input.band} band.`);
    await this.audit(session, AuditAction.UPDATE, touched[0], { summary: `Band review applied · ${input.band} · ${written} children`, skipped });
    return { written, skipped, fields: [["Band", input.band], ["Reviews written", String(written)], ...(skipped ? [["Left as they were", String(skipped)]] : [])], note: "Each one is on the child's card now. Open any of them to refine the wording." };
  }

}
