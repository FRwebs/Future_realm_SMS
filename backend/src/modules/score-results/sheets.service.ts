import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { Access, TEACHING_ROLES, currentTerm, iso, notifyStaff } from "../attendance-management/attendance.shared";
import { type ArmData, type SubjectView, loadAll, loadArm } from "./arm";
import { ABSENT, type CellValue, type Column, ensureColumns, fullName, liveFramework } from "./scores.shared";

/**
 * Entering scores: choosing the sheet, typing into it, keeping a draft, and handing it in. A sheet is
 * one subject in one arm for one term. It is pinned to the framework it began under, so a rule
 * published tomorrow cannot restate what was typed today.
 */

const cellSchema = z.record(z.string(), z.string());
const saveSchema = z.object({
  rows: z.array(z.object({ studentId: z.string().min(1), cells: cellSchema })).min(1, "There is nothing to save."),
  /** Only the cells that changed travel, so a save never overwrites what somebody else typed. */
  note: z.string().optional()
});
const deleteSchema = z.object({ reason: z.string().trim().min(8, "Say why the entry has to go — it stays on the record under your name.") });

export type GridPayload = Awaited<ReturnType<SheetsService["grid"]>>;

@Injectable()
export class SheetsService {
  constructor(private readonly access: Access) {}

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "ScoreSheet", entityId, metadata } });
  }

  async term(schoolId: string) {
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current, so there are no sheets to enter. Set one in School Configuration.");
    return { id: term.id, name: term.name, session: term.academicSession?.name ?? "" };
  }

  /** Whether this person may type into this subject-arm — the subject's own teacher, or an administrator. */
  private mayEnter(session: SessionPayload, subject: SubjectView): string | null {
    if (!subject.teacherId) return `Nobody teaches ${subject.name} in this arm, so nobody can enter a score for it. Name a teacher on Class & Timetable first.`;
    if (TEACHING_ROLES.has(session.role) && subject.teacherId !== session.userId && subject.assistantId !== session.userId) {
      return `${subject.name} here is entered by ${subject.teacher ?? "its own teacher"}. Ask a school administrator to enter it for them.`;
    }
    return null;
  }

  private locked(subject: SubjectView): string | null {
    if (subject.state === "Submitted") return "This sheet has been submitted and is waiting for a decision. It cannot be edited — a change after approval needs a correction request with a reason.";
    if (subject.state === "Approved") return "This sheet is approved and final. A change needs a correction request with a reason.";
    return null;
  }

  /* ───────────────────────── choosing a sheet ───────────────────────── */

  async chooser(session: SessionPayload, query: { level?: string; arm?: string }) {
    const term = await this.term(session.schoolId);
    const arms = await loadAll(session.schoolId, term);
    const levels = Array.from(new Set(arms.map((arm) => arm.room.levelName)));
    const level = query.level && levels.includes(query.level) ? query.level : null;
    const visible = arms.filter((arm) => !level || arm.room.levelName === level);
    const picked = arms.find((arm) => arm.room.id === query.arm) ?? null;
    const mine = (subject: SubjectView) => subject.teacherId === session.userId || subject.assistantId === session.userId;

    const sheetRow = (arm: ArmData, subject: SubjectView) => ({
      classId: arm.room.id, arm: arm.room.name, subjectId: subject.subjectId, subject: subject.name, teacher: subject.teacher, teacherId: subject.teacherId, state: subject.state,
      roll: subject.roll, entered: subject.rows.filter((row) => row.complete || row.absent === subject.columns.length).length, scored: subject.scored, mine: mine(subject)
    });
    const all = arms.flatMap((arm) => arm.subjects.map((subject) => sheetRow(arm, subject)));
    const expected = all.length;
    const inCount = all.filter((row) => row.state === "Submitted" || row.state === "Approved").length;
    return {
      term, levels, level, arms: arms.map((arm) => ({ id: arm.room.id, name: arm.room.name, level: arm.room.levelName })), picked: picked ? { id: picked.room.id, name: picked.room.name } : null,
      subjects: picked ? picked.subjects.map((subject) => sheetRow(picked, subject)) : [],
      kpis: { in: inCount, expected, outstanding: expected - inCount, approved: all.filter((row) => row.state === "Approved").length, withTeacher: all.filter((row) => row.state === "Returned").length, impossible: all.filter((row) => row.state === "Unassigned").length, impossibleNames: all.filter((row) => row.state === "Unassigned").slice(0, 3).map((row) => `${row.subject} ${row.arm}`) },
      outstanding: all.filter((row) => row.state !== "Approved" && (!level || visible.some((arm) => arm.room.id === row.classId))),
      unavailable: arms.length === 0
    };
  }

  /* ───────────────────────── the grid ───────────────────────── */

  async grid(session: SessionPayload, classId: string, subjectId: string) {
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    if (!subject) throw new NotFoundException(`${arm.room.name} does not offer that subject.`);
    const names = await prisma.user.findMany({ where: { id: { in: subject.enteredByIds } }, select: { id: true, firstName: true, lastName: true } });
    const framework = subject.pinned ? subject.sheet?.frameworkAt : null;
    const blocked = this.mayEnter(session, subject) ?? this.locked(subject);
    const windows = await this.windowsFor(session.schoolId, term.id, subject.columns);
    const others = new Map<string, number | null>();
    for (const row of subject.rows) {
      const totals = arm.subjects.filter((entry) => entry.subjectId !== subjectId).map((entry) => entry.rows.find((r) => r.id === row.id)?.total).filter((value): value is number => typeof value === "number");
      others.set(row.id, totals.length >= 3 ? totals.reduce((a, b) => a + b, 0) / totals.length : null);
    }
    return {
      term, arm: { id: arm.room.id, name: arm.room.name, section: arm.room.section, level: arm.room.levelName },
      subject: { id: subject.subjectId, name: subject.name, code: subject.code, category: subject.category, teacher: subject.teacher, teacherId: subject.teacherId, passMark: subject.passMark },
      state: subject.state, columns: subject.columns, pinned: subject.pinned, frameworkAt: framework ? iso(framework) : null,
      rows: subject.rows.map((row) => ({ id: row.id, name: row.name, adm: row.adm, cells: row.cells, others: others.get(row.id) ?? null, total: row.total, grade: row.grade, pos: row.pos, rating: row.rating, standing: row.standing, blank: row.blank, absent: row.absent, complete: row.complete })),
      stats: { scored: subject.scored, roll: subject.roll, mean: subject.mean, high: subject.high, low: subject.low, passed: subject.passed, failed: subject.failed, armMean: this.armMean(arm), blanks: subject.rows.filter((row) => !row.complete).length, absences: subject.rows.reduce((total, row) => total + row.absent, 0) },
      bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark })), passMark: subject.passMark,
      blocked, editable: !blocked, mine: subject.teacherId === session.userId, enteredBy: names.map((user) => fullName(user)),
      submittedAt: subject.sheet?.submittedAt?.toISOString() ?? null, returned: subject.state === "Returned" ? { note: subject.sheet?.decisionNote ?? "", at: subject.sheet?.returnedAt?.toISOString() ?? null } : null,
      windows, flags: subject.flags
    };
  }

  private armMean(arm: ArmData): number | null {
    const totals = arm.subjects.flatMap((subject) => subject.rows.map((row) => row.total)).filter((value): value is number => typeof value === "number");
    return totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
  }

  /** The entry windows the school set for these components, if it set any. A component with none is open. */
  private async windowsFor(schoolId: string, termId: string, columns: Column[]) {
    const ids = columns.map((column) => column.id).filter((id): id is string => Boolean(id));
    if (!ids.length) return [];
    const rows = await prisma.assessmentWindow.findMany({ where: { schoolId, termId, componentId: { in: ids } } });
    const now = new Date();
    return rows.map((row) => {
      const reopened = row.reopenedAt && row.reopenedAt > row.closesAt;
      const open = (now >= row.opensAt && now <= row.closesAt) || row.allowLateEntry || Boolean(reopened);
      const column = columns.find((entry) => entry.id === row.componentId);
      return { component: column?.name ?? "", key: column?.key ?? "", opensAt: row.opensAt.toISOString(), closesAt: row.closesAt.toISOString(), open, late: !open ? now > row.closesAt : false };
    });
  }

  /* ───────────────────────── writing ───────────────────────── */

  private parse(text: string | undefined, column: Column): CellValue | "ERR" {
    const raw = (text ?? "").trim().toUpperCase();
    if (!raw) return null;
    if (raw === "A" || raw === "ABS") return ABSENT;
    if (!/^\d+(\.\d+)?$/.test(raw)) return "ERR";
    const value = Number(raw);
    return value > column.max ? "ERR" : value;
  }

  /** The columns a sheet is entered under: what it is pinned to, or — for one not begun — today's framework, made ready to store against. */
  private async columnsFor(session: SessionPayload, term: { id: string }, arm: ArmData, subject: SubjectView): Promise<Column[]> {
    if (subject.sheet) return subject.columns;
    const columns = await ensureColumns(session.schoolId, subject.columns.length ? subject.columns : await liveFramework(session.schoolId, term.id, arm.room.section));
    if (!columns.length) throw new BadRequestException(`No assessment components are set for ${arm.room.name}'s section, so there is nothing to enter scores against. Set them in School Configuration.`);
    return columns;
  }

  /** The sheet's row, created — pinned to the framework — only once a save is known to be clean. */
  private async openSheet(session: SessionPayload, term: { id: string }, arm: ArmData, subject: SubjectView, columns: Column[]) {
    if (subject.sheet) return subject.sheet;
    return prisma.scoreSheet.create({ data: { schoolId: session.schoolId, termId: term.id, classId: arm.room.id, subjectId: subject.subjectId, status: "IN_PROGRESS", framework: columns as unknown as Prisma.InputJsonValue, enteredByIds: [] } });
  }

  async save(session: SessionPayload, classId: string, subjectId: string, body: unknown) {
    const input = saveSchema.parse(body);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    if (!subject) throw new NotFoundException(`${arm.room.name} does not offer that subject.`);
    const refusal = this.mayEnter(session, subject);
    if (refusal) throw new ForbiddenException(refusal);
    const lockedWhy = this.locked(subject);
    if (lockedWhy) throw new BadRequestException(lockedWhy);

    const columns = await this.columnsFor(session, term, arm, subject);
    const known = new Map(arm.students.map((student) => [student.id, student]));
    const byKey = new Map(columns.map((column) => [column.key, column]));
    const idOf = new Map(columns.map((column) => [column.key, column.id as string]));
    const windows = await this.windowsFor(session.schoolId, term.id, columns);
    const closed = new Set(windows.filter((entry) => !entry.open).map((entry) => entry.key));

    const existing = await prisma.scoreEntry.findMany({ where: { schoolId: session.schoolId, subjectId, student: { currentClassId: classId }, resultSheet: { termId: term.id } }, select: { id: true, studentId: true, assessmentComponentId: true, score: true } });
    const entryOf = new Map(existing.map((entry) => [`${entry.studentId}|${entry.assessmentComponentId}`, entry]));
    const absences = { ...((subject.sheet?.absences ?? {}) as Record<string, string[]>) };

    const sheets = await prisma.resultSheet.findMany({ where: { schoolId: session.schoolId, termId: term.id, studentId: { in: arm.students.map((student) => student.id) } }, select: { id: true, studentId: true } });
    const resultOf = new Map(sheets.map((entry) => [entry.studentId, entry.id]));

    const wanted: Array<{ studentId: string; key: string; value: number }> = [];
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    const removals: string[] = [];
    const problems: string[] = [];
    let changed = 0;
    const stamp = new Date();

    for (const row of input.rows) {
      const student = known.get(row.studentId);
      if (!student) {
        problems.push("A child who is not on this arm's roll was in the sheet.");
        continue;
      }
      for (const [key, text] of Object.entries(row.cells)) {
        const column = byKey.get(key);
        if (!column) continue;
        const value = this.parse(text, column);
        if (value === "ERR") {
          problems.push(`${student.name} · ${column.name}: "${text}" is not a mark from 0 to ${column.max}, and not an A for absent.`);
          continue;
        }
        const current = entryOf.get(`${student.id}|${idOf.get(key)}`);
        const absent = (absences[student.id] ?? []).includes(key);
        if (closed.has(key) && ((value === null && current) || (typeof value === "number" && current?.score !== value) || (value === ABSENT && !absent))) {
          problems.push(`${column.name} is closed to entry: its window has ended and was not reopened.`);
          continue;
        }
        if (value === ABSENT) {
          if (!absent) {
            absences[student.id] = [...(absences[student.id] ?? []), key];
            changed += 1;
          }
          if (current) removals.push(current.id);
          continue;
        }
        if (absent) {
          absences[student.id] = (absences[student.id] ?? []).filter((entry) => entry !== key);
          changed += 1;
        }
        if (value === null) {
          if (current) {
            removals.push(current.id);
            changed += 1;
          }
          continue;
        }
        if (current) {
          if (current.score !== value) {
            updates.push(prisma.scoreEntry.update({ where: { id: current.id }, data: { score: value, enteredById: session.userId, recordedAt: stamp, maxScore: column.max, isDraft: true } }));
            changed += 1;
          }
        } else {
          wanted.push({ studentId: student.id, key, value });
          changed += 1;
        }
      }
    }
    if (problems.length) throw new BadRequestException(problems.slice(0, 4).join(" · ") + (problems.length > 4 ? ` · and ${problems.length - 4} more` : ""));

    /* nothing has been written yet: the sheet, the result sheets and the marks all follow a clean read */
    const sheet = await this.openSheet(session, term, arm, subject, columns);
    const creates: Prisma.ScoreEntryCreateManyInput[] = [];
    for (const item of wanted) {
      let resultSheetId = resultOf.get(item.studentId);
      if (!resultSheetId) {
        const created = await prisma.resultSheet.create({ data: { schoolId: session.schoolId, studentId: item.studentId, termId: term.id, classId, createdById: session.userId, status: "DRAFT" } });
        resultSheetId = created.id;
        resultOf.set(item.studentId, resultSheetId);
      }
      const column = byKey.get(item.key) as Column;
      creates.push({ schoolId: session.schoolId, studentId: item.studentId, resultSheetId, subjectId, assessmentComponentId: idOf.get(item.key) as string, enteredById: session.userId, score: item.value, maxScore: column.max, isDraft: true, recordedAt: stamp });
    }

    const cleaned = Object.fromEntries(Object.entries(absences).filter(([, list]) => list.length));
    await prisma.$transaction([
      ...updates,
      ...(creates.length ? [prisma.scoreEntry.createMany({ data: creates })] : []),
      ...(removals.length ? [prisma.scoreEntry.deleteMany({ where: { id: { in: removals } } })] : []),
      prisma.scoreSheet.update({ where: { id: sheet.id }, data: { absences: cleaned as Prisma.InputJsonValue, enteredByIds: Array.from(new Set([...sheet.enteredByIds, session.userId])), status: sheet.status === "RETURNED" ? "RETURNED" : "IN_PROGRESS" } })
    ]);
    if (changed) await this.audit(session, AuditAction.UPDATE, sheet.id, { summary: `Scores saved · ${subject.name} · ${arm.room.name}`, changed });
    return { saved: changed, state: sheet.status === "RETURNED" ? "Returned" : "In progress" };
  }

  /**
   * A save that was typed on a device with no connection. Only the cells nobody has touched since it was captured are
   * written. A cell somebody else moved to a different mark in the meantime is set aside — both marks kept — so a person
   * chooses, instead of the later arrival silently overwriting the earlier one.
   */
  async replay(session: SessionPayload, classId: string, subjectId: string, body: unknown, capturedAt: Date) {
    const input = saveSchema.parse(body);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    if (!subject) throw new NotFoundException(`${arm.room.name} does not offer that subject.`);
    const refusal = this.mayEnter(session, subject);
    if (refusal) throw new ForbiddenException(refusal);
    const lockedWhy = this.locked(subject);
    if (lockedWhy) throw new BadRequestException(lockedWhy);

    const byKey = new Map(subject.columns.map((column) => [column.key, column]));
    const existing = subject.sheet
      ? await prisma.scoreEntry.findMany({ where: { schoolId: session.schoolId, subjectId, student: { currentClassId: classId }, resultSheet: { termId: term.id } }, select: { studentId: true, assessmentComponentId: true, score: true, recordedAt: true, enteredById: true } })
      : [];
    const entryOf = new Map(existing.map((entry) => [`${entry.studentId}|${entry.assessmentComponentId}`, entry]));
    const names = new Map(arm.students.map((student) => [student.id, student.name]));
    const who = new Map((await prisma.user.findMany({ where: { id: { in: Array.from(new Set(existing.map((entry) => entry.enteredById))) } }, select: { id: true, firstName: true, lastName: true } })).map((user) => [user.id, fullName(user)]));

    const clear: Array<{ studentId: string; cells: Record<string, string> }> = [];
    const conflicts: Array<{ studentId: string; student: string; key: string; column: string; max: number; school: { value: number; by: string; at: string }; device: { value: number | null; text: string } }> = [];
    for (const row of input.rows) {
      const cells: Record<string, string> = {};
      for (const [key, text] of Object.entries(row.cells)) {
        const column = byKey.get(key);
        const value = column ? this.parse(text, column) : "ERR";
        const current = column?.id ? entryOf.get(`${row.studentId}|${column.id}`) : undefined;
        const mine = typeof value === "number" ? value : null;
        if (column && current && value !== "ERR" && value !== ABSENT && current.enteredById !== session.userId && current.recordedAt > capturedAt && current.score !== mine) {
          conflicts.push({ studentId: row.studentId, student: names.get(row.studentId) ?? "A child", key, column: column.name, max: column.max, school: { value: current.score, by: who.get(current.enteredById) ?? "Someone", at: current.recordedAt.toISOString() }, device: { value: mine, text } });
          continue;
        }
        cells[key] = text;
      }
      if (Object.keys(cells).length) clear.push({ studentId: row.studentId, cells });
    }
    const applied = clear.reduce((sum, row) => sum + Object.keys(row.cells).length, 0);
    if (clear.length) await this.save(session, classId, subjectId, { rows: clear, note: input.note });
    return { applied, conflicts, subject: subject.name, arm: arm.room.name };
  }

  async submit(session: SessionPayload, classId: string, subjectId: string, body: unknown) {
    const note = z.object({ note: z.string().optional() }).parse(body ?? {}).note;
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    if (!subject?.sheet) throw new BadRequestException("Nothing has been entered for this sheet yet.");
    const refusal = this.mayEnter(session, subject);
    if (refusal) throw new ForbiddenException(refusal);
    const lockedWhy = this.locked(subject);
    if (lockedWhy) throw new BadRequestException(lockedWhy);
    if (!subject.scored) throw new BadRequestException("There is not a single mark on this sheet. Enter scores before submitting it.");
    const blanks = subject.rows.filter((row) => !row.complete).length;
    const stamp = new Date();
    await prisma.$transaction([
      prisma.scoreEntry.updateMany({ where: { schoolId: session.schoolId, subjectId, student: { currentClassId: classId }, resultSheet: { termId: term.id } }, data: { isDraft: false, submittedAt: stamp } }),
      prisma.scoreSheet.update({ where: { id: subject.sheet.id }, data: { status: "SUBMITTED", submittedById: session.userId, submittedAt: stamp, returnedAt: null, decisionNote: null, enteredByIds: Array.from(new Set([...subject.sheet.enteredByIds, session.userId])) } })
    ]);
    const approvers = await prisma.user.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null, id: { not: session.userId }, role: { in: ["EXAM_OFFICER", "EXAMINATION_OFFICER"] as never[] } }, select: { id: true } });
    const told = approvers.length
      ? await notifyStaff(session.schoolId, session.userId, approvers.map((approver) => approver.id), { title: "Score review · a sheet is waiting", body: `${subject.name} · ${arm.room.name} has been submitted (${subject.scored} of ${subject.roll} scored). It is in the review queue.`, channels: ["In-app inbox"], link: "/score-entry-results/review" })
      : { notified: 0, queued: 0, unreachable: [] as string[] };
    await this.audit(session, AuditAction.UPDATE, subject.sheet.id, { summary: `Score sheet submitted · ${subject.name} · ${arm.room.name}`, scored: subject.scored, blanks, note: note ?? null });
    return { state: "Submitted", scored: subject.scored, roll: subject.roll, blanks, reviewers: told.notified, fields: [["Sheet", `${subject.name} · ${arm.room.name}`], ["Scored", `${subject.scored} of ${subject.roll}`], ["With the review queue", told.notified ? `${told.notified} ${told.notified === 1 ? "person" : "people"} told` : "No Exam Officer is named — it waits in the queue"]] };
  }

  async remove(session: SessionPayload, classId: string, subjectId: string, body: unknown) {
    const input = deleteSchema.parse(body);
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === subjectId);
    if (!arm || !subject?.sheet) throw new NotFoundException("There is no entry to delete for that sheet.");
    const refusal = this.mayEnter(session, subject);
    if (refusal) throw new ForbiddenException(refusal);
    const lockedWhy = this.locked(subject);
    if (lockedWhy) throw new BadRequestException(lockedWhy);
    const removed = await prisma.scoreEntry.deleteMany({ where: { schoolId: session.schoolId, subjectId, student: { currentClassId: classId }, resultSheet: { termId: term.id } } });
    await prisma.scoreSheet.delete({ where: { id: subject.sheet.id } });
    await this.audit(session, AuditAction.DELETE, subject.sheet.id, { summary: `Score entry deleted · ${subject.name} · ${arm.room.name}`, reason: input.reason, removed: removed.count });
    return { removed: removed.count, state: "Not started", fields: [["Scores removed", String(removed.count)], ["Sheet is now", "Not started"]] };
  }

  /** What the Enter tab's one-arm broadsheet shows: every child against every subject, including the empty cells. */
  async broadsheet(session: SessionPayload, classId: string) {
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    return {
      term, arm: { id: arm.room.id, name: arm.room.name },
      subjects: arm.subjects.map((subject) => ({ subjectId: subject.subjectId, name: subject.name, code: subject.code, teacher: subject.teacher, state: subject.state, scored: subject.scored, mean: subject.mean })),
      rows: arm.students.map((student) => ({ id: student.id, name: student.name, adm: student.adm, totals: arm.subjects.map((subject) => subject.rows.find((row) => row.id === student.id)?.total ?? null) })),
      bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max }))
    };
  }
}
