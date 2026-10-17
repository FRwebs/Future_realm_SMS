import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { currentTerm, iso, longDay } from "../attendance-management/attendance.shared";
import { type ArmData, loadAll, loadArm, loadStaffNames, studentResults } from "./arm";
import { CREDIT_MARK, gradeOf, mean, ordinal, rank, ratingOf, round1, round2 } from "./scores.shared";

/**
 * Results begin at the school, because a head teacher's first question is never "how did SSS 2A do" —
 * it is "how did the school do, and which arm is dragging it". Then the arm's broadsheet, then one
 * child. Every figure is read from approved sheets only, and says so.
 */

@Injectable()
export class ResultsService {
  private async term(schoolId: string) {
    const term = await currentTerm(schoolId);
    if (!term) throw new NotFoundException("No term is current, so there are no results to read. Set one in School Configuration.");
    return { id: term.id, name: term.name, session: term.academicSession?.name ?? "", sessionId: term.academicSessionId, start: term.startDate };
  }

  private armSummary(arm: ArmData) {
    const results = studentResults(arm, true);
    const computed = results.filter((result) => result.ready && result.average !== null);
    const average = mean(computed.map((result) => result.average as number));
    const top = computed.slice().sort((a, b) => (b.average as number) - (a.average as number))[0] ?? null;
    return {
      id: arm.room.id, name: arm.room.name, level: arm.room.levelName, masterId: arm.room.classTeacherId, roll: arm.students.length, computed: computed.length,
      average: average === null ? null : round1(average),
      pass: computed.length ? Math.round((computed.filter((result) => (result.average as number) >= arm.passMark).length / computed.length) * 100) : null,
      credit: computed.length ? Math.round((computed.filter((result) => (result.average as number) >= CREDIT_MARK).length / computed.length) * 100) : null,
      top: top ? { grade: top.grade, name: top.name } : null,
      incomplete: results.length > 0 && computed.length < results.length, blocked: results.length - computed.length,
      pending: arm.subjects.filter((subject) => subject.state !== "Approved").length, subjects: arm.subjects.length
    };
  }

  async overview(session: SessionPayload) {
    const term = await this.term(session.schoolId);
    const arms = await loadAll(session.schoolId, term);
    const names = await loadStaffNames(session.schoolId, arms.map((arm) => arm.room.classTeacherId ?? ""));
    const rows = arms.map((arm) => ({ ...this.armSummary(arm), master: arm.room.classTeacherId ? names.get(arm.room.classTeacherId) ?? null : null }));
    const total = rows.reduce((sum, row) => sum + row.roll, 0);
    const computed = rows.reduce((sum, row) => sum + row.computed, 0);
    const weighted = rows.reduce((sum, row) => sum + (row.average ?? 0) * row.computed, 0);
    const pass = rows.reduce((sum, row) => sum + (row.pass ?? 0) * row.computed, 0);
    const credit = rows.reduce((sum, row) => sum + (row.credit ?? 0) * row.computed, 0);
    const ranked = rows.filter((row) => row.average !== null);

    /* by subject across the school, from approved sheets */
    const bySubject = new Map<string, { name: string; totals: number[]; arms: Array<{ arm: string; mean: number }>; high: number }>();
    for (const arm of arms) {
      for (const subject of arm.subjects) {
        if (subject.state !== "Approved") continue;
        const entry = bySubject.get(subject.name) ?? { name: subject.name, totals: [], arms: [], high: 0 };
        const totals = subject.rows.map((row) => row.total).filter((value): value is number => typeof value === "number");
        entry.totals.push(...totals);
        if (subject.mean !== null) entry.arms.push({ arm: arm.room.name, mean: subject.mean });
        entry.high = Math.max(entry.high, ...totals, 0);
        bySubject.set(subject.name, entry);
      }
    }
    const passMark = arms[0]?.passMark ?? 40;
    const subjects = Array.from(bySubject.values()).map((entry) => ({
      name: entry.name, average: round1(mean(entry.totals) ?? 0), pass: Math.round((entry.totals.filter((value) => value >= passMark).length / Math.max(1, entry.totals.length)) * 100),
      credit: Math.round((entry.totals.filter((value) => value >= CREDIT_MARK).length / Math.max(1, entry.totals.length)) * 100), high: entry.high, weakest: entry.arms.slice().sort((a, b) => a.mean - b.mean)[0]?.arm ?? "—", scored: entry.totals.length
    })).sort((a, b) => b.average - a.average);

    const withoutSubjects = await prisma.classRoom.count({ where: { schoolId: session.schoolId, deletedAt: null, isActive: true, students: { some: { status: "ACTIVE" } }, classSubjects: { none: { isActive: true } } } });
    return {
      term, scheme: arms[0]?.scheme ?? "", passMark,
      kpis: { computed, total, average: computed ? round1(weighted / computed) : null, pass: computed ? Math.round(pass / computed) : null, credit: computed ? Math.round(credit / computed) : null, best: ranked.slice().sort((a, b) => (b.average as number) - (a.average as number))[0] ?? null, weakest: ranked.slice().sort((a, b) => (a.average as number) - (b.average as number))[0] ?? null, incomplete: rows.filter((row) => row.incomplete).length },
      arms: rows, subjects, withoutSubjects, blockedArms: rows.filter((row) => row.blocked > 0).map((row) => row.name)
    };
  }

  async armBroadsheet(session: SessionPayload, classId: string) {
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const summary = this.armSummary(arm);
    const results = studentResults(arm, true);
    const staff = await loadStaffNames(session.schoolId, [arm.room.classTeacherId ?? ""]);
    const students = results.slice().sort((a, b) => (b.average ?? -1) - (a.average ?? -1)).map((result) => ({
      id: result.id, name: result.name, adm: result.adm, average: result.average, grade: result.grade, pos: result.pos, total: result.total, ready: result.ready, blockedBy: result.blockedBy,
      totals: arm.subjects.map((subject) => (subject.state === "Approved" ? subject.rows.find((row) => row.id === result.id)?.total ?? null : null))
    }));
    const corrections = await prisma.scoreCorrection.findMany({ where: { schoolId: session.schoolId, classId, termId: term.id }, orderBy: { createdAt: "desc" }, take: 20 });
    return {
      term, arm: { id: arm.room.id, name: arm.room.name, level: arm.room.levelName, master: arm.room.classTeacherId ? staff.get(arm.room.classTeacherId) ?? null : null }, summary,
      subjects: arm.subjects.map((subject) => ({ id: subject.subjectId, name: subject.name, code: subject.code, state: subject.state, mean: subject.state === "Approved" ? subject.mean : null, pass: subject.state === "Approved" && subject.scored ? Math.round((subject.rows.filter((row) => (row.total ?? -1) >= subject.passMark).length / subject.scored) * 100) : null })),
      students, correctionIds: corrections.map((entry) => entry.id), scheme: arm.scheme, passMark: arm.passMark
    };
  }

  /** One child's result, every subject and every component — the page a family would be shown. */
  async studentPage(session: SessionPayload, classId: string, studentId: string) {
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const student = arm.students.find((entry) => entry.id === studentId);
    if (!student) throw new NotFoundException("That child is not on this arm's roll.");
    const results = studentResults(arm);
    const approved = studentResults(arm, true);
    const mine = results.find((entry) => entry.id === studentId);
    const theirs = approved.find((entry) => entry.id === studentId);
    const arms = await loadAll(session.schoolId, term, undefined);
    const level = arms.filter((entry) => entry.room.levelId === arm.room.levelId);
    const levelResults = level.flatMap((entry) => studentResults(entry, true).filter((result) => result.average !== null));
    const levelRanks = rank(levelResults.map((result) => ({ id: result.id, value: result.average as number })));
    const staff = await loadStaffNames(session.schoolId, arm.subjects.flatMap((subject) => [subject.teacherId ?? ""]));
    const passed = arm.subjects.filter((subject) => (subject.rows.find((row) => row.id === studentId)?.total ?? -1) >= subject.passMark).length;
    const credits = arm.subjects.filter((subject) => (subject.rows.find((row) => row.id === studentId)?.total ?? -1) >= CREDIT_MARK).length;
    const absences = arm.subjects.filter((subject) => (subject.rows.find((row) => row.id === studentId)?.absent ?? 0) > 0).map((subject) => subject.name);

    /* the session so far: this child's other terms, read from their own result sheets */
    const sheets = await prisma.resultSheet.findMany({ where: { schoolId: session.schoolId, studentId, term: { academicSessionId: term.sessionId } }, include: { term: { select: { id: true, name: true, order: true } } }, orderBy: { term: { order: "asc" } } });
    const termsList = sheets.map((sheet) => ({ id: sheet.term.id, name: sheet.term.name, average: sheet.averageScore, position: sheet.position, status: sheet.status, published: sheet.publishedAt?.toISOString() ?? null, current: sheet.term.id === term.id }));
    const priorTerms = termsList.filter((entry) => !entry.current && entry.average > 0);
    const sessionAverage = mean([...priorTerms.map((entry) => entry.average), ...(theirs?.average !== null && theirs?.average !== undefined ? [theirs.average] : [])]);
    const previous = priorTerms[priorTerms.length - 1];
    const attendance = await prisma.studentAttendance.groupBy({ by: ["status"], where: { schoolId: session.schoolId, studentId, termId: term.id, subjectId: null }, _count: { _all: true } });
    const attTotal = attendance.reduce((sum, row) => sum + row._count._all, 0);
    const attOk = attendance.filter((row) => row.status === "PRESENT" || row.status === "LATE").reduce((sum, row) => sum + row._count._all, 0);
    const card = await prisma.reportCard.findFirst({ where: { schoolId: session.schoolId, studentId, termId: term.id }, select: { status: true, publishedAt: true } });
    const corrections = await prisma.scoreCorrection.findMany({ where: { schoolId: session.schoolId, studentId, termId: term.id }, orderBy: { createdAt: "desc" } });

    return {
      term, scheme: arm.scheme, passMark: arm.passMark, arm: { id: arm.room.id, name: arm.room.name, level: arm.room.levelName }, student,
      summary: {
        average: mine?.average ?? null, approvedAverage: theirs?.average ?? null, grade: mine?.grade ?? null, pos: mine?.pos ?? null, outOf: results.filter((entry) => entry.average !== null).length,
        levelPos: theirs?.average != null ? levelRanks.get(studentId) ?? null : null, levelOutOf: levelResults.length, level: arm.room.levelName,
        scored: mine?.scored ?? 0, expected: mine?.expected ?? 0, passed, credits, armAverage: round1(mean(results.filter((entry) => entry.average !== null).map((entry) => entry.average as number)) ?? 0), ready: mine?.ready ?? false, blockedBy: mine?.blockedBy ?? []
      },
      absences,
      subjects: arm.subjects.map((subject) => {
        const row = subject.rows.find((entry) => entry.id === studentId);
        return { subjectId: subject.subjectId, name: subject.name, state: subject.state, teacher: subject.teacherId ? staff.get(subject.teacherId) ?? subject.teacher : null, columns: subject.columns, cells: row?.cells ?? {}, total: row?.total ?? null, grade: row?.grade ?? null, pos: row?.pos ?? null, rating: row?.rating ?? "Not scored", scored: subject.scored, passMark: subject.passMark, counts: subject.counts };
      }),
      session: { name: term.session, terms: termsList, average: sessionAverage === null ? null : round1(sessionAverage), direction: previous && theirs?.average != null ? Math.round((theirs.average - previous.average) * 10) / 10 : null },
      attendance: attTotal ? { pct: Math.round((attOk / attTotal) * 1000) / 10, days: attTotal } : null,
      card: card ? { status: card.status, published: card.publishedAt?.toISOString() ?? null } : null,
      corrections: corrections.map((entry) => ({ id: entry.id, subjectId: entry.subjectId, component: entry.componentName, from: entry.fromScore, to: entry.toScore, status: entry.status })),
      generated: longDay(new Date(iso(new Date()))), bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark, gpa: band.gpa }))
    };
  }

  /** The trace behind one number — read from what was stored, so it cannot drift from what a parent holds. */
  async explain(session: SessionPayload, classId: string, studentId: string, subjectId?: string) {
    const term = await this.term(session.schoolId);
    const arm = await loadArm(session.schoolId, term, classId);
    if (!arm) throw new NotFoundException("That arm is not in this school.");
    const student = arm.students.find((entry) => entry.id === studentId);
    if (!student) throw new NotFoundException("That child is not on this arm's roll.");
    const results = studentResults(arm);
    const mine = results.find((entry) => entry.id === studentId);
    if (!subjectId) {
      const lines = arm.subjects.map((subject) => {
        const row = subject.rows.find((entry) => entry.id === studentId);
        return { name: subject.name, total: row?.total ?? null, counted: subject.counts, why: !subject.counts ? "Does not count to the average — the school's own decision" : row?.total === null || row?.total === undefined ? (row && row.absent ? "Absent for every component — excluded, never scored zero" : "Nothing entered — excluded, never scored zero") : "Counted" };
      });
      const counted = lines.filter((line) => line.counted && line.total !== null);
      return { kind: "result" as const, student, arm: arm.room.name, term: term.name, lines, sum: round2(counted.reduce((total, line) => total + (line.total as number), 0)), count: counted.length, average: mine?.average ?? null, grade: mine?.grade ?? null, pos: mine?.pos ?? null, outOf: results.filter((entry) => entry.average !== null).length, scheme: arm.scheme, bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark })) };
    }
    const subject = arm.subjects.find((entry) => entry.subjectId === subjectId);
    const row = subject?.rows.find((entry) => entry.id === studentId);
    if (!subject || !row) throw new NotFoundException("That subject is not offered to this child.");
    const entries = await prisma.scoreEntry.findMany({ where: { schoolId: session.schoolId, studentId, subjectId, resultSheet: { termId: term.id } }, select: { assessmentComponentId: true, score: true, recordedAt: true, enteredById: true } });
    const people = await loadStaffNames(session.schoolId, [...entries.map((entry) => entry.enteredById), subject.sheet?.decidedById ?? ""]);
    const corrections = await prisma.scoreCorrection.findMany({ where: { schoolId: session.schoolId, studentId, subjectId, termId: term.id }, orderBy: { createdAt: "asc" } });
    const band = gradeOf(arm.bands, row.total);
    const lines = subject.columns.map((column) => {
      const entry = entries.find((value) => value.assessmentComponentId === column.id);
      const absent = row.cells[column.key] === "ABS";
      const fixes = corrections.filter((correction) => correction.componentName === column.name && correction.status === "APPROVED");
      return { name: column.name, max: column.max, weight: column.weight, value: absent ? "Absent" : entry ? String(entry.score) : null, at: entry ? iso(entry.recordedAt) : null, by: entry ? people.get(entry.enteredById) ?? null : null, corrected: fixes.length };
    });
    const levelArms = await loadAll(session.schoolId, term, undefined);
    const levelPos = levelArms.filter((entry) => entry.room.levelId === arm.room.levelId).flatMap((entry) => entry.subjects.filter((value) => value.subjectId === subjectId).flatMap((value) => value.rows.filter((r) => r.total !== null).map((r) => ({ id: r.id, value: r.total as number }))));
    const levelRank = rank(levelPos).get(studentId) ?? null;
    return {
      kind: "subject" as const, student, arm: arm.room.name, term: term.name, subject: subject.name, total: row.total, lines, grade: band ? { label: band.label, remark: band.remark, min: band.min, max: band.max, gpa: band.gpa } : null,
      pos: row.pos, outOf: subject.scored, levelPos: levelRank, levelOutOf: levelPos.length, level: arm.room.levelName, teacher: subject.teacher, state: subject.state,
      approvedBy: subject.sheet?.decidedById ? people.get(subject.sheet.decidedById) ?? null : null, approvedAt: subject.sheet?.decidedAt ? iso(subject.sheet.decidedAt) : null,
      frameworkAt: subject.sheet ? iso(subject.sheet.frameworkAt) : null, corrections: corrections.map((entry) => ({ component: entry.componentName, from: entry.fromScore, to: entry.toScore, status: entry.status, at: iso(entry.createdAt) })),
      rating: ratingOf(row.total, arm.bands, subject.passMark), ordinal: row.pos ? ordinal(row.pos) : null,
    };
  }
}
