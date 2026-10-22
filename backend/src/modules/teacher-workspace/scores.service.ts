import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { loadAll, loadArm, type SubjectView } from "../score-results/arm";
import { CREDIT_MARK } from "../score-results/scores.shared";
import { TeacherWorkspaceService } from "./workspace.service";

const DAY = 86_400_000;

const stats = (subject: SubjectView) => {
  const ranked = subject.rows.filter((row) => row.total !== null);
  return { roll: subject.roll, complete: subject.rows.filter((row) => row.complete).length, ranked: ranked.length, mean: subject.mean, high: subject.high?.total ?? null, low: subject.low?.total ?? null, passed: subject.passed, failed: subject.failed };
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
    const closes = windows.map((window) => window.closesAt).filter((at) => at >= now).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const pending = await prisma.syncDraft.count({ where: { schoolId: session.schoolId, userId: session.userId, syncedAt: null, type: "SCORE_ENTRY" } });
    const rows = sheets.map(({ arm, subject }) => {
      const s = stats(subject);
      const blank = subject.rows.reduce((sum, row) => sum + row.blank, 0);
      const over = subject.flags.filter((flag) => flag.kind === "anomaly" && flag.blocking).length;
      return {
        classId: arm.room.id, subjectId: subject.subjectId, subject: subject.name, arm: arm.room.name, state: subject.state, roll: s.roll, entered: s.complete, mean: s.mean, blanks: s.roll - s.complete, blankMarks: blank,
        returned: subject.state === "Returned" ? subject.sheet?.decisionNote ?? "Returned for correction" : null, flagged: over
      };
    });
    const open = rows.filter((row) => row.state !== "Submitted" && row.state !== "Approved");
    return {
      persona: me.persona, term: `${me.term?.name} ${me.term?.session}`, closes: closes?.toISOString() ?? null, daysLeft: closes ? Math.max(0, Math.ceil((closes.getTime() - now.getTime()) / DAY)) : null,
      pending, rows, assigned: me.teaching.length, assisting: me.teaching.filter((row) => row.assistant).length,
      kpis: { open: open.length, sheets: rows.length, entered: rows.reduce((sum, row) => sum + row.entered, 0), children: rows.reduce((sum, row) => sum + row.roll, 0), returned: rows.filter((row) => row.state === "Returned").length, firstReturned: rows.find((row) => row.state === "Returned") ?? null, blanks: rows.reduce((sum, row) => sum + row.blanks, 0) }
    };
  }

  async results(session: SessionPayload) {
    const { me, sheets } = await this.mine(session);
    const rows = sheets.map(({ arm, subject }) => {
      const s = stats(subject);
      return { classId: arm.room.id, subjectId: subject.subjectId, subject: subject.name, arm: arm.room.name, state: subject.state, ...s, passRate: s.ranked ? Math.round((s.passed / s.ranked) * 100) : null };
    });
    const live = rows.filter((row) => row.ranked > 0);
    const ranked = live.reduce((sum, row) => sum + row.ranked, 0);
    const look = sheets.flatMap(({ arm, subject }) =>
      subject.rows.filter((row) => row.total !== null && (row.total as number) < 45).map((row) => ({ classId: arm.room.id, subjectId: subject.subjectId, child: row.name, subject: subject.name, arm: arm.room.name, total: row.total as number, grade: row.grade, why: (row.total as number) < subject.passMark ? "Below the pass mark" : "Close to the line" }))
    ).sort((a, b) => a.total - b.total);
    return {
      average: ranked ? Math.round((live.reduce((sum, row) => sum + (row.mean ?? 0) * row.ranked, 0) / ranked) * 10) / 10 : null, ranked, children: rows.reduce((sum, row) => sum + row.roll, 0),
      below: live.reduce((sum, row) => sum + row.failed, 0), approved: rows.filter((row) => row.state === "Approved").length,
      rows, look: look.slice(0, 8), formArms: me.formArms, persona: me.persona
    };
  }

  /** One subject-arm: every child, ranked, with the components behind each total. */
  async result(session: SessionPayload, classId: string, subjectId: string) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current.");
    const row = me.teaching.find((entry) => entry.classId === classId && entry.subjectId === subjectId);
    if (!row) throw new ForbiddenException("That subject-arm is not one you teach, so its results are not yours to read.");
    const arm = await loadArm(session.schoolId, { id: me.term.id, name: me.term.name }, classId);
    const subject = arm?.subjects.find((entry) => entry.subjectId === subjectId);
    if (!arm || !subject) throw new NotFoundException("That subject-arm has no results yet.");
    const s = stats(subject);
    const grades = new Map<string, number>();
    for (const entry of subject.rows) if (entry.grade) grades.set(entry.grade, (grades.get(entry.grade) ?? 0) + 1);
    return {
      arm: { id: arm.room.id, name: arm.room.name }, subject: { id: subject.subjectId, name: subject.name }, state: subject.state, final: subject.state === "Approved", passMark: subject.passMark, creditMark: CREDIT_MARK,
      columns: subject.columns.map((column) => ({ key: column.key, name: column.name, short: column.short, max: column.max })), bands: arm.bands.map((band) => ({ label: band.label, min: band.min, max: band.max, remark: band.remark })),
      stats: { ...s, passRate: s.ranked ? Math.round((s.passed / s.ranked) * 100) : null }, high: subject.high, low: subject.low,
      distribution: arm.bands.map((band) => ({ label: band.label, count: grades.get(band.label) ?? 0, range: `${band.min}–${band.max}` })),
      rows: subject.rows.slice().sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999)).map((entry) => ({ id: entry.id, name: entry.name, adm: entry.adm, cells: entry.cells, total: entry.total, grade: entry.grade, pos: entry.pos, rating: entry.rating, standing: entry.standing, blank: entry.blank, absent: entry.absent, complete: entry.complete })),
      frameworkPinned: subject.pinned
    };
  }
}
