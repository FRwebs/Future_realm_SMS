import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { loadAll, loadArm, type SubjectView } from "../score-results/arm";
import { letterhead } from "./lesson-notes/shared";
import { CREDIT_MARK, armName, fullName, gradeOf, rank, round1 } from "../score-results/scores.shared";
import { TeacherWorkspaceService } from "./workspace.service";

const DAY = 86_400_000;

const stats = (subject: SubjectView) => {
  const ranked = subject.rows.filter((row) => row.total !== null);
  return { roll: subject.roll, complete: subject.rows.filter((row) => row.complete).length, ranked: ranked.length, mean: subject.mean, high: subject.high?.total ?? null, low: subject.low?.total ?? null, passed: subject.passed, failed: subject.failed, pass: ranked.length - subject.failed };
};

/**
 * A teacher's scores: their own sheets (one subject-arm is one sheet), and the results those sheets produce — never another teacher's
 * subject. Everything is read from the same arm view the Enter, Review and Results pages are built from, so a mark typed in the grid is
 * the mark the results, the ranking and the explanation use.
 */
@Injectable()
export class TeacherScoresService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  private async mine(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there are no sheets.");
    const term = { id: me.term.id, name: me.term.name };
    const classIds = [...new Set(me.teaching.filter((row) => !row.assistant).map((row) => row.classId))];
    const arms = classIds.length ? await loadAll(session.schoolId, term, classIds) : [];
    const sheets = arms.flatMap((arm) => arm.subjects.filter((subject) => (subject.teacherId === session.userId || subject.coverIds.includes(session.userId))).map((subject) => ({ arm, subject })));
    return { me, term, sheets };
  }

  async sheets(session: SessionPayload) {
    const { me, term, sheets } = await this.mine(session);
    const now = new Date();
    const windows = await prisma.assessmentWindow.findMany({ where: { schoolId: session.schoolId, termId: term.id }, select: { closesAt: true, component: { select: { name: true } } } });
    const nextWindow = windows.filter((window) => window.closesAt >= now).sort((a, b) => a.closesAt.getTime() - b.closesAt.getTime())[0] ?? null;
    const closes = nextWindow?.closesAt ?? null;
    const pending = await prisma.syncDraft.count({ where: { schoolId: session.schoolId, userId: session.userId, syncedAt: null, type: "SCORE_ENTRY" } });
    const rows = sheets.map(({ arm, subject }) => {
      const s = stats(subject);
      const blank = subject.rows.reduce((sum, row) => sum + row.blank, 0);
      const over = subject.flags.filter((flag) => flag.kind === "anomaly" && flag.blocking).length;
      const held = me.teaching.find((entry) => entry.classId === arm.room.id && entry.subjectId === subject.subjectId);
      return {
        classId: arm.room.id, subjectId: subject.subjectId, subject: subject.name, arm: arm.room.name, state: subject.state, roll: s.roll, entered: s.complete, mean: s.mean, blanks: s.roll - s.complete, blankMarks: blank,
        basis: held?.basis ?? "Substantive", coverOf: held?.basis === "Cover" ? subject.teacher : null, until: held?.until ?? null, regOnly: false,
        returned: subject.state === "Returned" ? subject.sheet?.decisionNote ?? "Returned for correction" : null, flagged: over
      };
    });
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const registerOnly = await prisma.coverAssignment.findMany({ where: { schoolId: session.schoolId, coverUserId: session.userId, endedAt: null, scope: "REGISTER", subjectId: { not: null }, startsOn: { lte: today }, endsOn: { gte: today } }, select: { classId: true, subjectId: true, endsOn: true, ownerUserId: true } });
    const restricted = [];
    for (const cover of registerOnly) {
      const mapped = await prisma.classSubject.findFirst({ where: { schoolId: session.schoolId, classId: cover.classId, subjectId: cover.subjectId! }, select: { subject: { select: { name: true } }, classRoom: { select: { name: true, arm: true } }, teacherId: true } });
      if (!mapped) continue;
      const owner = cover.ownerUserId ?? mapped.teacherId;
      const person = owner ? await prisma.user.findUnique({ where: { id: owner }, select: { firstName: true, lastName: true } }) : null;
      restricted.push({ classId: cover.classId, subjectId: cover.subjectId!, subject: mapped.subject.name, arm: armName(mapped.classRoom), until: cover.endsOn.toISOString(), coverOf: person ? fullName(person) : null, regOnly: true });
    }
    const open = rows.filter((row) => row.state !== "Submitted" && row.state !== "Approved");
    return {
      restricted, windowName: nextWindow?.component.name ?? null,
      persona: me.persona, term: `${me.term?.name} ${me.term?.session}`, closes: closes?.toISOString() ?? null, daysLeft: closes ? Math.max(0, Math.ceil((closes.getTime() - now.getTime()) / DAY)) : null,
      pending, rows, assigned: me.teaching.length, assisting: me.teaching.filter((row) => row.assistant).length,
      kpis: { open: open.length, sheets: rows.length, entered: rows.reduce((sum, row) => sum + row.entered, 0), children: rows.reduce((sum, row) => sum + row.roll, 0), returned: rows.filter((row) => row.state === "Returned").length, firstReturned: rows.find((row) => row.state === "Returned") ?? null, blanks: rows.reduce((sum, row) => sum + row.blanks, 0) }
    };
  }

  async results(session: SessionPayload) {
    const { me, sheets } = await this.mine(session);
    const rows = sheets.map(({ arm, subject }) => {
      const s = stats(subject);
      return { classId: arm.room.id, subjectId: subject.subjectId, subject: subject.name, arm: arm.room.name, state: subject.state, ...s, passRate: s.ranked ? Math.round((s.pass / s.ranked) * 100) : null };
    });
    const live = rows.filter((row) => row.ranked > 0);
    const ranked = live.reduce((sum, row) => sum + row.ranked, 0);
    const base = sheets.flatMap(({ arm, subject }) =>
      subject.rows.filter((row) => row.total !== null && row.complete && row.absent === 0).map((row) => ({ classId: arm.room.id, subjectId: subject.subjectId, studentId: row.id, child: row.name, subject: subject.name, arm: arm.room.name, total: row.total as number, grade: row.grade, passMark: subject.passMark }))
    );
    const term = { id: me.term!.id };
    // The children worth a look: under the pass mark, near it, or well down on last term.
    const lastBy = new Map<string, Map<string, number>>();
    for (const key of [...new Set(base.map((entry) => `${entry.classId}:${entry.subjectId}`))]) {
      const [c, sub] = key.split(":") as [string, string];
      lastBy.set(key, await this.previousTotals(session.schoolId, term, c, sub));
    }
    const candidates = base.map((entry) => {
      const last = lastBy.get(`${entry.classId}:${entry.subjectId}`)?.get(entry.studentId) ?? null;
      const why = entry.total < entry.passMark ? "Below the pass mark" : entry.total < 45 ? "Close to the line" : last !== null && entry.total - last <= -6 ? "Falling" : null;
      return { ...entry, last, why };
    }).filter((entry): entry is typeof entry & { why: string } => entry.why !== null).sort((a, b) => a.total - b.total).slice(0, 8);
    const attendance = await this.attendanceOf(session.schoolId, term.id, [...new Set(candidates.map((entry) => entry.studentId))]);
    const look = candidates.map((entry) => ({ classId: entry.classId, subjectId: entry.subjectId, studentId: entry.studentId, child: entry.child, subject: entry.subject, arm: entry.arm, total: entry.total, grade: entry.grade, why: entry.why, last: entry.last, attendance: attendance.get(entry.studentId) ?? null }));
    const formId = me.formArms[0]?.id ?? null;
    const remarks = formId ? await prisma.reportRemark.count({ where: { schoolId: session.schoolId, termId: term.id, classId: formId, author: "FORM_MASTER", text: { not: "" } } }) : 0;
    return {
      average: ranked ? Math.round((live.reduce((sum, row) => sum + (row.mean ?? 0) * row.ranked, 0) / ranked) * 10) / 10 : null, ranked, children: rows.reduce((sum, row) => sum + row.roll, 0),
      below: live.reduce((sum, row) => sum + row.failed, 0), approved: rows.filter((row) => row.state === "Approved").length,
      rows, look, formArms: me.formArms, remarks: { written: remarks, roll: me.formArms[0]?.roll ?? 0 }, persona: me.persona
    };
  }

  /* ───────────────────────── a subject-arm, read for the page ───────────────────────── */

  private async owned(session: SessionPayload, classId: string, subjectId: string) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current.");
    const row = me.teaching.find((entry) => entry.classId === classId && entry.subjectId === subjectId);
    if (!row) throw new ForbiddenException("That subject-arm is not one you teach, so its results are not yours to read.");
    const term = { id: me.term.id, name: me.term.name };
    const arm = await loadArm(session.schoolId, term, classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === subjectId);
    if (!arm || !subject) throw new NotFoundException("That subject-arm has no results yet.");
    return { me, term, arm, subject, own: !row.assistant && row.basis !== "Cover" };
  }

  /** The term before this one, if the school has one on record — what "since last term" is read against. */
  private async previousTotals(schoolId: string, term: { id: string }, classId: string, subjectId: string) {
    const current = await prisma.term.findUnique({ where: { id: term.id }, select: { startDate: true } });
    if (!current) return new Map<string, number>();
    const before = await prisma.term.findFirst({ where: { schoolId, startDate: { lt: current.startDate } }, orderBy: { startDate: "desc" }, select: { id: true, name: true } });
    if (!before) return new Map<string, number>();
    const arm = await loadArm(schoolId, before, classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === subjectId);
    return new Map((subject?.rows ?? []).filter((row) => row.total !== null).map((row) => [row.id, row.total as number]));
  }

  private async attendanceOf(schoolId: string, termId: string, studentIds: string[]) {
    const marks = studentIds.length ? await prisma.studentAttendance.groupBy({ by: ["studentId", "status"], where: { schoolId, termId, studentId: { in: studentIds }, subjectId: null }, _count: true }) : [];
    const out = new Map<string, number>();
    for (const id of studentIds) {
      const own = marks.filter((entry) => entry.studentId === id);
      const total = own.reduce((sum, entry) => sum + entry._count, 0);
      const here = own.filter((entry) => entry.status === "PRESENT" || entry.status === "LATE").reduce((sum, entry) => sum + entry._count, 0);
      if (total) out.set(id, Math.round((here / total) * 100));
    }
    return out;
  }

  private columnMeans(subject: SubjectView) {
    return subject.columns.map((column) => {
      const values = subject.rows.filter((row) => row.total !== null).map((row) => row.cells[column.key]).filter((value): value is number => typeof value === "number");
      const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      return { key: column.key, name: column.name, short: column.short, max: column.max, exam: column.exam, mean: mean === null ? null : Math.round(mean * 10) / 10, pct: mean === null ? null : Math.round((mean / column.max) * 100) };
    });
  }

  /** One subject-arm: every child, ranked, with the components behind each total — and how each stands against last term, the class and its own comment. */
  async result(session: SessionPayload, classId: string, subjectId: string) {
    const { me, term, arm, subject, own } = await this.owned(session, classId, subjectId);
    const s = stats(subject);
    const grades = new Map<string, number>();
    for (const entry of subject.rows) if (entry.grade) grades.set(entry.grade, (grades.get(entry.grade) ?? 0) + 1);
    const [last, attendance, comments] = await Promise.all([
      this.previousTotals(session.schoolId, term, classId, subjectId),
      this.attendanceOf(session.schoolId, term.id, subject.rows.map((row) => row.id)),
      prisma.subjectComment.findMany({ where: { schoolId: session.schoolId, termId: term.id, classId, subjectId }, select: { studentId: true, text: true } }),
    ]);
    const written = new Set(comments.filter((comment) => comment.text.trim()).map((comment) => comment.studentId));
    const ranked = subject.rows.filter((row) => row.total !== null && row.complete && row.absent === 0).length;
    const order = new Map(arm.students.map((student, index) => [student.id, index + 1]));
    const third = (pos: number | null, isRanked: boolean) => (!isRanked || pos === null ? "Not ranked" : pos <= Math.ceil(ranked / 3) ? "Top third" : pos <= Math.ceil((2 * ranked) / 3) ? "Middle third" : "Bottom third");
    const sameSubject = me.teaching.filter((entry) => !entry.assistant && entry.subjectId === subjectId).map((entry) => ({ id: entry.classId, name: entry.arm }));
    const others = [];
    for (const other of sameSubject.filter((entry) => entry.id !== classId)) {
      const view = await loadArm(session.schoolId, term, other.id);
      const sheet = view?.subjects.find((entry) => entry.subjectId === subjectId);
      if (sheet && sheet.mean !== null) others.push({ id: other.id, name: other.name, mean: sheet.mean });
    }
    return {
      term: { id: term.id, name: term.name }, own, arm: { id: arm.room.id, name: arm.room.name }, subject: { id: subject.subjectId, name: subject.name }, state: subject.state, final: subject.state === "Approved", passMark: subject.passMark, creditMark: CREDIT_MARK,
      columns: subject.columns.map((column) => ({ key: column.key, name: column.name, short: column.short, max: column.max, exam: column.exam })), bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark })),
      stats: { ...s, passRate: s.ranked ? Math.round((s.pass / s.ranked) * 100) : null, creditRate: s.ranked ? Math.round((s.passed / s.ranked) * 100) : null, credit: s.passed, comments: written.size },
      high: subject.high, low: subject.low, components: this.columnMeans(subject), arms: sameSubject, others,
      distribution: arm.bands.map((band) => ({ label: band.label, count: grades.get(band.label) ?? 0, range: `${band.min}–${band.max}` })),
      hasLast: last.size > 0, letterhead: await letterhead(session.schoolId), session: me.term?.session ?? "",
      rows: subject.rows.slice().sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999)).map((entry) => {
        const isRanked = entry.total !== null && entry.complete && entry.absent === 0;
        const before = last.get(entry.id) ?? null;
        return {
          id: entry.id, name: entry.name, adm: entry.adm, roll: order.get(entry.id) ?? 0, cells: entry.cells, total: entry.total, grade: entry.grade, pos: isRanked ? entry.pos : null, rating: entry.rating, standing: entry.standing,
          third: third(entry.pos, isRanked), blank: entry.blank, absent: entry.absent, complete: Boolean(entry.complete), ranked: isRanked, last: before, since: isRanked && before !== null ? (entry.total as number) - before : null,
          attendance: attendance.get(entry.id) ?? null, comment: written.has(entry.id),
        };
      }),
      frameworkPinned: subject.pinned,
    };
  }

  /** One child in one subject: how the total was reached, where it stands, and the comment that prints beside it on the report card. */
  async student(session: SessionPayload, classId: string, subjectId: string, studentId: string) {
    const { me, term, arm, subject, own } = await this.owned(session, classId, subjectId);
    const index = arm.students.findIndex((student) => student.id === studentId);
    const row = subject.rows.find((entry) => entry.id === studentId);
    if (index < 0 || !row) throw new NotFoundException("That child is not on this subject-arm’s roll.");
    const [last, attendance, comment, entries, comments] = await Promise.all([
      this.previousTotals(session.schoolId, term, classId, subjectId),
      this.attendanceOf(session.schoolId, term.id, [studentId]),
      prisma.subjectComment.findUnique({ where: { termId_subjectId_studentId: { termId: term.id, subjectId, studentId } }, select: { text: true, updatedAt: true, authorId: true } }),
      prisma.scoreEntry.findMany({ where: { schoolId: session.schoolId, studentId, subjectId, resultSheet: { termId: term.id } }, select: { assessmentComponentId: true, recordedAt: true, enteredById: true } }),
      prisma.subjectComment.findMany({ where: { schoolId: session.schoolId, termId: term.id, classId, subjectId }, select: { studentId: true } }),
    ]);
    const people = await prisma.user.findMany({ where: { id: { in: [...new Set(entries.map((entry) => entry.enteredById))] } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((person) => [person.id, fullName(person)]));
    const means = this.columnMeans(subject);
    const isRanked = row.total !== null && row.complete && row.absent === 0;
    const ranked = subject.rows.filter((entry) => entry.total !== null && entry.complete && entry.absent === 0).length;
    const before = last.get(studentId) ?? null;
    const commented = new Set(comments.map((entry) => entry.studentId));
    return {
      term: { id: term.id, name: term.name, session: me.term?.session ?? "" }, own, arm: { id: arm.room.id, name: arm.room.name }, subject: { id: subject.subjectId, name: subject.name },
      isFormArm: me.formArms.some((entry) => entry.id === classId),
      student: { id: studentId, name: row.name, adm: row.adm, index, of: arm.students.length },
      peers: arm.students.map((student, at) => ({ id: student.id, name: student.name, adm: student.adm, index: at, written: commented.has(student.id) })),
      total: row.total, grade: row.grade, complete: Boolean(row.complete), absent: row.absent, blank: row.blank, ranked: isRanked, pos: isRanked ? row.pos : null, of: ranked,
      classMean: subject.mean, last: before, since: isRanked && before !== null ? (row.total as number) - before : null, attendance: attendance.get(studentId) ?? null,
      band: row.grade ? arm.bands.find((band) => band.label === row.grade)?.remark ?? "" : "",
      components: subject.columns.map((column, at) => {
        const entry = entries.find((candidate) => candidate.assessmentComponentId === column.id);
        const mean = means[at]!;
        return { key: column.key, name: column.name, short: column.short, max: column.max, exam: column.exam, value: row.cells[column.key] ?? null, classMean: mean.mean, enteredAt: entry?.recordedAt.toISOString() ?? null, enteredBy: entry ? nameOf.get(entry.enteredById) ?? null : null };
      }),
      comment: comment ? { text: comment.text, updatedAt: comment.updatedAt.toISOString() } : null,
      bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark })),
    };
  }

  async saveComment(session: SessionPayload, classId: string, subjectId: string, studentId: string, body: unknown) {
    const input = z.object({ text: z.string().max(1200, "Keep a subject comment under 1,200 characters.") }).parse(body);
    const { term, arm, subject, own } = await this.owned(session, classId, subjectId);
    if (!own) throw new ForbiddenException("You hold this on cover or as an assistant, so its comments are not yours to write.");
    if (!arm.students.some((student) => student.id === studentId)) throw new NotFoundException("That child is not on this subject-arm’s roll.");
    const text = input.text.trim();
    if (!text) {
      await prisma.subjectComment.deleteMany({ where: { termId: term.id, subjectId, studentId } });
      return { studentId, written: false };
    }
    await prisma.subjectComment.upsert({
      where: { termId_subjectId_studentId: { termId: term.id, subjectId, studentId } },
      update: { text, authorId: session.userId },
      create: { schoolId: session.schoolId, termId: term.id, classId, subjectId, studentId, authorId: session.userId, text },
    });
    void subject;
    return { studentId, written: true };
  }

  /** The form class against every subject it takes. Read only — each sheet belongs to its subject teacher. */
  async formBroadsheet(session: SessionPayload, classId: string) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current.");
    if (!me.formArms.some((entry) => entry.id === classId)) throw new ForbiddenException("The class broadsheet is for the form master of that arm.");
    const term = { id: me.term.id, name: me.term.name };
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm has no results yet.");
    const subjects = arm.subjects.filter((subject) => subject.counts);
    const rows = arm.students.map((student) => {
      const totals = subjects.map((subject) => subject.rows.find((row) => row.id === student.id)?.total ?? null);
      const live = totals.filter((value): value is number => value !== null);
      const average = live.length ? live.reduce((sum, value) => sum + value, 0) / live.length : null;
      return { id: student.id, name: student.name, adm: student.adm, totals, average: average === null ? null : round1(average), complete: live.length === subjects.length && subjects.length > 0 };
    });
    const ranks = rank(rows.filter((row) => row.complete).map((row) => ({ id: row.id, value: row.average as number })));
    const remarks = await prisma.reportRemark.count({ where: { schoolId: session.schoolId, termId: term.id, classId, author: "FORM_MASTER", text: { not: "" } } });
    const complete = rows.filter((row) => row.complete);
    return {
      term: { id: term.id, name: term.name, session: me.term.session }, arm: { id: arm.room.id, name: arm.room.name }, roll: rows.length,
      subjects: subjects.map((subject) => ({ subjectId: subject.subjectId, name: subject.name, code: subject.code, teacher: subject.teacher, state: subject.state, entered: subject.scored, mean: subject.mean })),
      rows: rows.map((row) => ({ ...row, pos: ranks.get(row.id) ?? null, grade: row.average === null ? null : gradeOf(arm.bands, row.average)?.label ?? null })),
      bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max })),
      kpis: { complete: complete.length, missing: rows.reduce((sum, row) => sum + (subjects.length - row.totals.filter((value) => value !== null).length), 0), average: complete.length ? round1(complete.reduce((sum, row) => sum + (row.average as number), 0) / complete.length) : null, remarks },
    };
  }
}
