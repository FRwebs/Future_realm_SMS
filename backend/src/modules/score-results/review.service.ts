import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { assertSheetReadable, refuseTeaching, teachingScope } from "../../common/teaching-scope";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { Access, currentTerm, iso, notifyStaff } from "../attendance-management/attendance.shared";
import { daysSince } from "../student-records/records.shared";
import { type ArmData, type SubjectView, loadAll, loadArm, loadStaffNames, studentResults } from "./arm";
import { FLAG_OUTCOMES, type FlagOutcome } from "./scores.shared";
import { reopenResultSheets, syncResultSheets } from "./sync";

/**
 * Review is the administrator's first question: which arms are done, and who is holding the rest up.
 * A decision is taken on the sheet itself, where every child's scores are already on screen —
 * approving something you cannot see is not an approval — and never by the person who typed it.
 */

const decideSchema = z.object({ decision: z.string().min(1), reason: z.string().trim().optional(), tell: z.coerce.boolean().default(true) });
const bulkSchema = z.object({
  sheets: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  arms: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]))
});
const outcomeSchema = z.object({ key: z.string().min(1), outcome: z.string().min(1, "Choose an outcome."), note: z.string().trim().optional() });
const reverseSchema = z.object({ reason: z.string().trim().min(8, "Say why the approval is being taken back.") });

/** An approval can be taken back for two days; after that a score changes only through a correction. */
export const REVERSIBLE_HOURS = 48;

const sheetKey = (classId: string, subjectId: string) => `${classId}:${subjectId}`;

@Injectable()
export class ReviewService {
  constructor(private readonly access: Access) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "ScoreSheet", entityId, metadata } });
  }

  private async term(schoolId: string) {
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current, so there is nothing to review. Set one in School Configuration.");
    return { id: term.id, name: term.name, session: term.academicSession?.name ?? "" };
  }

  private enteredBy(session: SessionPayload, subject: SubjectView) {
    return Boolean(subject.sheet && (subject.sheet.enteredByIds.includes(session.userId) || subject.sheet.submittedById === session.userId));
  }

  /* ───────────────────────── the school ───────────────────────── */

  async overview(session: SessionPayload) {
    const term = await this.term(session.schoolId);
    // A head of department reviews their own department's sheets, and nothing outside it.
    const scope = await teachingScope(session);
    const arms = await loadAll(session.schoolId, term, scope ? [...new Set([...scope.department].map((key) => key.split(":")[0]!))] : undefined);
    if (scope) for (const arm of arms) arm.subjects = arm.subjects.filter((subject) => scope.department.has(`${arm.room.id}:${subject.subjectId}`));
    const windows = await prisma.assessmentWindow.findMany({ where: { schoolId: session.schoolId, termId: term.id }, include: { component: { select: { name: true } } }, orderBy: { closesAt: "asc" } });
    const staff = await loadStaffNames(session.schoolId, arms.map((arm) => arm.room.classTeacherId ?? ""));
    const school = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } });
    const all = arms.flatMap((arm) => arm.subjects.map((subject) => ({ arm, subject })));
    const expected = all.length;
    const inCount = all.filter((entry) => entry.subject.state === "Submitted" || entry.subject.state === "Approved").length;
    const approved = all.filter((entry) => entry.subject.state === "Approved");
    const submitted = all.filter((entry) => entry.subject.state === "Submitted");
    const ready = submitted.filter((entry) => !entry.subject.openFlags && !this.enteredBy(session, entry.subject));
    const returned = all.filter((entry) => entry.subject.state === "Returned");
    const unassigned = all.filter((entry) => entry.subject.state === "Unassigned");
    const mine = submitted.filter((entry) => this.enteredBy(session, entry.subject));
    const closes = windows.length ? windows[windows.length - 1].closesAt : null;

    const armRows = arms.map((arm) => {
      const sheets = arm.subjects;
      const done = sheets.filter((subject) => subject.state === "Approved").length;
      const sat = sheets.filter((subject) => subject.state === "Submitted" || subject.state === "Approved").length;
      const open = sheets.reduce((total, subject) => total + subject.openFlags, 0);
      const waiting = sheets.filter((subject) => subject.state !== "Approved" && subject.state !== "Submitted");
      const state = sheets.some((subject) => subject.state === "Unassigned") ? "Blocked" : sheets.some((subject) => subject.state === "Returned") ? "Returned" : sheets.every((subject) => subject.state === "Approved") ? "Approved" : sheets.some((subject) => subject.state === "Submitted") ? "Submitted" : sheets.some((subject) => subject.state === "In progress") ? "In progress" : "Not started";
      return {
        id: arm.room.id, name: arm.room.name, level: arm.room.levelName, master: arm.room.classTeacherId ? staff.get(arm.room.classTeacherId) ?? null : null, masterId: arm.room.classTeacherId,
        sheets: sheets.length, in: sat, approved: done, flags: open, roll: arm.students.length,
        pending: Array.from(new Set(waiting.map((subject) => subject.teacher ?? "Nobody named"))).slice(0, 3), pendingIds: Array.from(new Set(waiting.flatMap((subject) => (subject.teacherId ? [subject.teacherId] : [])))), state
      };
    });

    const now = new Date();
    const tracker = all.filter((entry) => entry.subject.state !== "Approved").map(({ arm, subject }) => {
      const since = subject.sheet?.returnedAt ?? subject.sheet?.submittedAt ?? subject.sheet?.updatedAt ?? null;
      const late = windows.some((window) => window.closesAt < now) && subject.state !== "Submitted";
      return {
        classId: arm.room.id, subjectId: subject.subjectId, unit: `${subject.name} · ${arm.room.name}`, sub: subject.state === "Unassigned" ? "No teacher assigned" : `${subject.roll} children · ${subject.scored} scored`,
        owner: subject.teacher ?? "Unassigned", ownerId: subject.teacherId, state: subject.state, age: since ? `${daysSince(since)} days` : "—", overdue: late || subject.state === "Unassigned" || subject.state === "Returned"
      };
    });

    const kinds = new Map<string, { title: string; found: string[]; count: number }>();
    for (const { arm, subject } of all) {
      for (const flag of subject.flags) {
        const entry = kinds.get(flag.kind) ?? { title: flag.title, found: [], count: 0 };
        entry.count += 1;
        entry.found.push(`${subject.name} ${arm.room.name} — ${flag.detail}`);
        kinds.set(flag.kind, entry);
      }
    }
    const verification = ["anomaly", "duplicate", "boundary", "zero"].map((kind) => ({
      kind, count: kinds.get(kind)?.count ?? 0, found: kinds.get(kind)?.found.slice(0, 2).join(" · ") ?? "",
      title: kind === "anomaly" ? "Anomaly detection" : kind === "duplicate" ? "Duplicate score patterns" : kind === "boundary" ? "Grade-boundary cases" : "Zero review",
      what: kind === "anomaly" ? "Score far from the child's own pattern" : kind === "duplicate" ? "Identical rows suggesting a copied sheet" : kind === "boundary" ? "Within one mark of a band boundary" : "A genuine zero, or a blank entered as zero"
    }));

    return {
      term, school: school?.name ?? "", scheme: arms[0]?.scheme ?? "", windows: windows.map((window) => ({ component: window.component.name, opensAt: window.opensAt.toISOString(), closesAt: window.closesAt.toISOString() })),
      closes: closes ? closes.toISOString() : null, closedDays: closes && closes < now ? daysSince(closes) : null,
      kpis: {
        expected, in: inCount, outstanding: expected - inCount, approved: approved.length, ready: ready.length, readyStudents: ready.reduce((total, entry) => total + entry.subject.roll, 0), readyArms: new Set(ready.map((entry) => entry.arm.room.id)).size,
        returned: returned.length, oldestReturned: returned.reduce((oldest, entry) => Math.max(oldest, entry.subject.sheet?.returnedAt ? daysSince(entry.subject.sheet.returnedAt) : 0), 0),
        impossible: unassigned.length, impossibleNames: unassigned.slice(0, 3).map((entry) => `${entry.subject.name} ${entry.arm.room.name}`),
        past: tracker.filter((row) => row.overdue).length
      },
      arms: armRows, tracker, verification,
      returned: returned.map((entry) => ({ classId: entry.arm.room.id, subjectId: entry.subject.subjectId, name: `${entry.subject.name} · ${entry.arm.room.name}`, teacher: entry.subject.teacher, teacherId: entry.subject.teacherId })),
      mine: mine.map((entry) => ({ classId: entry.arm.room.id, subjectId: entry.subject.subjectId, name: `${entry.subject.name} · ${entry.arm.room.name}` })),
      readySheets: ready.map((entry) => ({ classId: entry.arm.room.id, subjectId: entry.subject.subjectId, name: `${entry.subject.name} · ${entry.arm.room.name}`, roll: entry.subject.roll })),
      unavailable: arms.length === 0
    };
  }

  /* ───────────────────────── one arm ───────────────────────── */

  async armReview(session: SessionPayload, classId: string) {
    await refuseTeaching(session, "Scores → Review, one sheet at a time");
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const staff = await loadStaffNames(session.schoolId, [arm.room.classTeacherId ?? ""]);
    const results = studentResults(arm);
    const subjects = arm.subjects;
    const readySheets = subjects.filter((subject) => subject.state === "Submitted" && !subject.openFlags && !this.enteredBy(session, subject));
    return {
      term, arm: { id: arm.room.id, name: arm.room.name, level: arm.room.levelName, master: arm.room.classTeacherId ? staff.get(arm.room.classTeacherId) ?? null : null }, roll: arm.students.length,
      kpis: {
        approved: subjects.filter((subject) => subject.state === "Approved").length, sheets: subjects.length, awaiting: subjects.filter((subject) => subject.state === "Submitted").length,
        ready: readySheets.length, returned: subjects.filter((subject) => subject.state === "Returned").length, flags: subjects.reduce((total, subject) => total + subject.openFlags, 0),
        blocked: results.filter((result) => !result.ready).length
      },
      subjects: subjects.map((subject) => ({
        subjectId: subject.subjectId, name: subject.name, teacher: subject.teacher, teacherId: subject.teacherId, state: subject.state, scored: subject.scored, roll: subject.roll,
        entered: `${subject.rows.filter((row) => row.complete).length} of ${subject.roll}`, mean: subject.mean, flags: subject.openFlags, mine: this.enteredBy(session, subject)
      })),
      students: results.map((result) => {
        const statusRow = arm.subjects.map((subject) => subject.rows.find((row) => row.id === result.id)).filter(Boolean);
        return { id: result.id, name: result.name, adm: result.adm, scored: result.scored, expected: result.expected, average: result.average, pos: result.pos, grade: result.grade, ready: result.ready, blockedBy: result.blockedBy.slice(0, 3), absences: statusRow.reduce((total, row) => total + (row?.absent ?? 0), 0) };
      }),
      ready: readySheets.map((subject) => ({ subjectId: subject.subjectId, name: subject.name, roll: subject.roll })),
      armMean: results.length ? Math.round((results.filter((result) => result.average !== null).reduce((total, result) => total + (result.average as number), 0) / Math.max(1, results.filter((result) => result.average !== null).length)) * 10) / 10 : null,
      excluded: subjects.filter((subject) => subject.state === "Submitted" && (subject.openFlags || this.enteredBy(session, subject))).map((subject) => `${subject.name} · ${subject.openFlags ? `${subject.openFlags} open flags` : "you entered it"}`)
    };
  }

  /* ───────────────────────── one sheet ───────────────────────── */

  async sheetPage(session: SessionPayload, classId: string, subjectId: string) {
    await assertSheetReadable(session, classId, subjectId);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    if (!subject) throw new NotFoundException(`${arm.room.name} does not offer that subject.`);
    const sheet = subject.sheet;
    const people = await loadStaffNames(session.schoolId, [subject.teacherId ?? "", sheet?.decidedById ?? "", sheet?.submittedById ?? "", ...(sheet?.enteredByIds ?? [])]);
    const teacher = subject.teacherId ? await prisma.user.findFirst({ where: { id: subject.teacherId }, select: { phone: true, role: true, staffProfile: { select: { employeeNo: true, department: { select: { name: true } } } } } }) : null;
    const corrections = await prisma.scoreCorrection.findMany({ where: { schoolId: session.schoolId, classId, subjectId, termId: term.id }, select: { id: true, status: true } });
    const decidedAt = sheet?.decidedAt ?? null;
    const reversible = subject.state === "Approved" && decidedAt ? Date.now() - decidedAt.getTime() < REVERSIBLE_HOURS * 3_600_000 : false;
    const published = await prisma.resultSheet.count({ where: { schoolId: session.schoolId, student: { currentClassId: classId }, termId: term.id, status: "PUBLISHED", scoreEntries: { some: { subjectId } } } });
    const mine = this.enteredBy(session, subject);
    const distribution = arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark, count: subject.rows.filter((row) => row.grade === band.label).length }));
    return {
      term, arm: { id: arm.room.id, name: arm.room.name }, subject: { id: subject.subjectId, name: subject.name, category: subject.category, passMark: subject.passMark },
      state: subject.state, columns: subject.columns, pinned: subject.pinned, frameworkAt: sheet ? iso(sheet.frameworkAt) : null,
      teacher: subject.teacher ? { id: subject.teacherId, name: subject.teacher, phone: teacher?.phone ?? null, role: teacher?.role ?? "Teacher", staffNo: teacher?.staffProfile?.employeeNo ?? null, dept: teacher?.staffProfile?.department?.name ?? null } : null,
      rows: subject.rows, stats: { scored: subject.scored, roll: subject.roll, mean: subject.mean, high: subject.high, low: subject.low, passed: subject.passed, failed: subject.failed, armMean: results0(arm) }, distribution,
      flags: subject.flags.map((flag) => ({ ...flag, outcome: subject.outcomes[flag.key] ?? null })), outcomes: FLAG_OUTCOMES, openFlags: subject.openFlags,
      decision: { submittedAt: sheet?.submittedAt?.toISOString() ?? null, submittedBy: sheet?.submittedById ? people.get(sheet.submittedById) ?? null : null, decidedAt: decidedAt?.toISOString() ?? null, decidedBy: sheet?.decidedById ? people.get(sheet.decidedById) ?? null : null, note: sheet?.decisionNote ?? null, returnedAt: sheet?.returnedAt?.toISOString() ?? null },
      enteredBy: (sheet?.enteredByIds ?? []).map((id) => people.get(id)).filter(Boolean), corrections: { all: corrections.length, open: corrections.filter((entry) => entry.status === "AWAITING" || entry.status === "IN_REVIEW").length },
      mine, canDecide: subject.state === "Submitted" && !mine, reversible, reverseUntil: decidedAt ? new Date(decidedAt.getTime() + REVERSIBLE_HOURS * 3_600_000).toISOString() : null, published: published > 0,
      cardsWaiting: arm.students.length
    };
  }

  /* ───────────────────────── deciding ───────────────────────── */

  async decide(session: SessionPayload, classId: string, subjectId: string, body: unknown) {
    await assertSheetReadable(session, classId, subjectId);
    const input = decideSchema.parse(body);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    if (!subject?.sheet) throw new NotFoundException("That sheet has not been started, so there is nothing to decide.");
    if (subject.state !== "Submitted") throw new BadRequestException(`That sheet is ${subject.state.toLowerCase()}, not waiting for a decision.`);
    const kind = /approve/i.test(input.decision) ? "approve" : /rework|send/i.test(input.decision) ? "rework" : "decline";
    if (kind === "approve" && this.enteredBy(session, subject)) throw new BadRequestException("You entered or submitted this sheet, so you cannot approve it. Route it to someone else — the rule is enforced at the moment of approval, not afterwards.");
    if (kind !== "approve" && (input.reason ?? "").length < 8) throw new BadRequestException(kind === "decline" ? "Say exactly what is wrong — the teacher reads it word for word and has nothing else to go on." : "Name what has to change — the teacher works from this and nothing else.");
    if (kind === "approve" && subject.openFlags) throw new BadRequestException(`${subject.openFlags} verification ${subject.openFlags === 1 ? "flag has" : "flags have"} no outcome recorded. Record what was found for each before approving.`);
    const stamp = new Date();
    const sheet = subject.sheet;
    if (kind === "approve") {
      await prisma.scoreSheet.update({ where: { id: sheet.id }, data: { status: "APPROVED", decidedById: session.userId, decidedAt: stamp, decisionNote: input.reason ?? null } });
      const synced = await syncResultSheets(session.schoolId, term, classId, session.userId);
      await this.audit(session, AuditAction.APPROVE, sheet.id, { summary: `Score sheet approved · ${subject.name} · ${arm.room.name}`, scored: subject.scored });
      if (input.tell && subject.teacherId) await notifyStaff(session.schoolId, session.userId, [subject.teacherId], { title: "Score review · sheet approved", body: `${subject.name} · ${arm.room.name} is approved. Its ${subject.scored} scores are final.`, channels: ["In-app inbox"] });
      return { state: "Approved", classReady: synced.ready, fields: [["Sheet", `${subject.name} · ${arm.room.name}`], ["Scores now final", String(subject.scored)], ["Every sheet in the arm approved", synced.ready ? "Yes — its report cards can be generated" : "Not yet"], ["Reversible until", new Date(stamp.getTime() + REVERSIBLE_HOURS * 3_600_000).toISOString().slice(0, 16).replace("T", " ")]] };
    }
    if (kind === "rework") {
      await prisma.scoreSheet.update({ where: { id: sheet.id }, data: { status: "RETURNED", returnedAt: stamp, decisionNote: input.reason, decidedById: session.userId, decidedAt: stamp } });
      await prisma.scoreEntry.updateMany({ where: { schoolId: session.schoolId, subjectId, student: { currentClassId: classId }, resultSheet: { termId: term.id } }, data: { isDraft: true } });
      await this.audit(session, AuditAction.REJECT, sheet.id, { summary: `Score sheet sent back · ${subject.name} · ${arm.room.name}`, reason: input.reason ?? "" });
      if (input.tell && subject.teacherId) await notifyStaff(session.schoolId, session.userId, [subject.teacherId], { title: "Score review · sheet returned", body: `${subject.name} · ${arm.room.name} was sent back: ${input.reason}`, channels: ["In-app inbox", "Email"], urgency: "Firm", link: `/score-entry-results/enter/${classId}/${subjectId}` });
      return { state: "Returned", fields: [["Sheet", `${subject.name} · ${arm.room.name}`], ["Back with", subject.teacher ?? "its teacher"], ["What they were told", input.reason ?? ""]] };
    }
    const removed = await prisma.scoreEntry.deleteMany({ where: { schoolId: session.schoolId, subjectId, student: { currentClassId: classId }, resultSheet: { termId: term.id } } });
    await prisma.scoreSheet.delete({ where: { id: sheet.id } });
    await this.audit(session, AuditAction.REJECT, sheet.id, { summary: `Score sheet declined and voided · ${subject.name} · ${arm.room.name}`, reason: input.reason ?? "", removed: removed.count });
    if (input.tell && subject.teacherId) await notifyStaff(session.schoolId, session.userId, [subject.teacherId], { title: "Score review · sheet declined", body: `${subject.name} · ${arm.room.name} was declined and voided: ${input.reason}. It must be entered again from scratch.`, channels: ["In-app inbox", "Email"], urgency: "Firm", link: `/score-entry-results/enter/${classId}/${subjectId}` });
    return { state: "Not started", fields: [["Sheet", `${subject.name} · ${arm.room.name}`], ["Scores voided", String(removed.count)], ["Now", "Not started — the teacher enters it again"]] };
  }

  async reverse(session: SessionPayload, classId: string, subjectId: string, body: unknown) {
    await assertSheetReadable(session, classId, subjectId);
    const input = reverseSchema.parse(body);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === subjectId);
    if (!arm || !subject?.sheet || subject.state !== "Approved") throw new BadRequestException("Only an approved sheet can have its approval taken back.");
    const decidedAt = subject.sheet.decidedAt;
    if (!decidedAt || Date.now() - decidedAt.getTime() > REVERSIBLE_HOURS * 3_600_000) throw new BadRequestException(`The ${REVERSIBLE_HOURS} hours in which an approval can be taken back have passed. A change now needs a correction request with a reason.`);
    const published = await prisma.resultSheet.count({ where: { schoolId: session.schoolId, student: { currentClassId: classId }, termId: term.id, status: "PUBLISHED", scoreEntries: { some: { subjectId } } } });
    if (published) throw new BadRequestException("A result in this arm has already been published, so this approval can only change through a correction.");
    await prisma.scoreSheet.update({ where: { id: subject.sheet.id }, data: { status: "SUBMITTED", decidedAt: null, decidedById: null, decisionNote: input.reason } });
    const reopened = await reopenResultSheets(session.schoolId, classId, term.id, session.userId);
    await syncResultSheets(session.schoolId, term, classId, session.userId);
    await this.audit(session, AuditAction.UPDATE, subject.sheet.id, { summary: `Score sheet approval reversed · ${subject.name} · ${arm.room.name}`, reason: input.reason });
    return { state: "Submitted", reopened };
  }

  async approveReady(session: SessionPayload, body: unknown) {
    const input = bulkSchema.parse(body);
    const term = await this.term(session.schoolId);
    const only = input.arms.length ? input.arms : undefined;
    const arms = await loadAll(session.schoolId, term, only);
    const wanted = new Set(input.sheets);
    let approved = 0;
    let students = 0;
    const skipped: string[] = [];
    const touched = new Set<string>();
    for (const arm of arms) {
      for (const subject of arm.subjects) {
        if (subject.state !== "Submitted" || !subject.sheet) continue;
        if (wanted.size && !wanted.has(sheetKey(arm.room.id, subject.subjectId))) continue;
        if (this.enteredBy(session, subject)) {
          skipped.push(`${subject.name} · ${arm.room.name}: you entered it`);
          continue;
        }
        if (subject.openFlags) {
          skipped.push(`${subject.name} · ${arm.room.name}: ${subject.openFlags} open ${subject.openFlags === 1 ? "flag" : "flags"}`);
          continue;
        }
        await prisma.scoreSheet.update({ where: { id: subject.sheet.id }, data: { status: "APPROVED", decidedById: session.userId, decidedAt: new Date() } });
        await this.audit(session, AuditAction.APPROVE, subject.sheet.id, { summary: `Score sheet approved in bulk · ${subject.name} · ${arm.room.name}`, scored: subject.scored });
        approved += 1;
        students += subject.scored;
        touched.add(arm.room.id);
      }
    }
    for (const classId of touched) await syncResultSheets(session.schoolId, term, classId, session.userId);
    if (!approved) throw new BadRequestException(skipped.length ? `Nothing was approved. ${skipped.slice(0, 3).join(" · ")}` : "There is no submitted sheet ready to approve.");
    return { approved, students, skipped, fields: [["Sheets approved", String(approved)], ["Scores now final", String(students)], ...(skipped.length ? [["Left for a person to look at", skipped.slice(0, 3).join("; ")]] : [])] };
  }

  async flagOutcome(session: SessionPayload, classId: string, subjectId: string, body: unknown) {
    const input = outcomeSchema.parse(body);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === subjectId);
    if (!arm || !subject?.sheet) throw new NotFoundException("That sheet has not been started.");
    if (!subject.flags.some((flag) => flag.key === input.key)) throw new BadRequestException("That check is not on this sheet any more.");
    if (/follow-up/i.test(input.outcome) && (input.note ?? "").length < 5) throw new BadRequestException("Say what the follow-up is.");
    const outcome: FlagOutcome = { outcome: input.outcome, note: input.note ?? "", by: session.userId, at: new Date().toISOString() };
    await prisma.scoreSheet.update({ where: { id: subject.sheet.id }, data: { flagOutcomes: { ...subject.outcomes, [input.key]: outcome } as unknown as Prisma.InputJsonValue } });
    await this.audit(session, AuditAction.UPDATE, subject.sheet.id, { summary: `Verification outcome recorded · ${subject.name} · ${arm.room.name}`, outcome: input.outcome });
    return { recorded: true };
  }
}

function results0(arm: ArmData) {
  const totals = arm.subjects.flatMap((subject) => subject.rows.map((row) => row.total)).filter((value): value is number => typeof value === "number");
  return totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
}

