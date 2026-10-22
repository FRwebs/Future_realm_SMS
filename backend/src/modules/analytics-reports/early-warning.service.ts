import { Injectable } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { currentTerm } from "../attendance-management/attendance.shared";
import { plansFeatures } from "../plans-features/plans-features.service";
import { loadAll } from "../score-results/arm";

const DAY = 86_400_000;

/**
 * Early warning — the "predictive analytics" a plan can include. It is deliberately not a model: it is four rules a head teacher
 * can read, each firing on a figure the school already holds, and every flagged child shows which rules fired. It says who is
 * likely to fall behind if nothing changes; it cannot say what to do, and it never ranks a child against a hidden score.
 */
@Injectable()
export class EarlyWarningService {
  async overview(session: SessionPayload) {
    const entitled = await plansFeatures.entitled(session.schoolId, "analytics.predictive");
    if (!entitled.allowed) return { entitled: false as const, why: entitled.why };
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    if (!term) return { entitled: true as const, why: entitled.why, term: null, rows: [], counts: { flagged: 0, children: 0 } };
    const arms = await loadAll(schoolId, { id: term.id, name: term.name } as never);
    const recentFrom = new Date(Date.now() - 14 * DAY);
    const marks = await prisma.studentAttendance.findMany({ where: { schoolId, termId: term.id, subjectId: null }, select: { studentId: true, status: true, date: true } });
    const byStudent = new Map<string, { all: number; present: number; recent: number; recentPresent: number; before: number; beforePresent: number }>();
    for (const mark of marks) {
      const entry = byStudent.get(mark.studentId) ?? { all: 0, present: 0, recent: 0, recentPresent: 0, before: 0, beforePresent: 0 };
      const here = mark.status === "PRESENT" || mark.status === "LATE" ? 1 : 0;
      entry.all += 1; entry.present += here;
      if (mark.date >= recentFrom) { entry.recent += 1; entry.recentPresent += here; } else { entry.before += 1; entry.beforePresent += here; }
      byStudent.set(mark.studentId, entry);
    }
    const rows: Array<{ id: string; name: string; adm: string; arm: string; points: number; drivers: string[]; average: number | null; attendance: number | null }> = [];
    let children = 0;
    for (const arm of arms) {
      const students = new Map<string, { name: string; adm: string; totals: number[]; failing: number }>();
      for (const subject of arm.subjects) {
        for (const row of subject.rows) {
          const entry = students.get(row.id) ?? { name: row.name, adm: row.adm, totals: [], failing: 0 };
          if (row.total !== null) { entry.totals.push(row.total); if (row.total < subject.passMark) entry.failing += 1; }
          students.set(row.id, entry);
        }
      }
      const averages = [...students.values()].filter((entry) => entry.totals.length).map((entry) => entry.totals.reduce((sum, value) => sum + value, 0) / entry.totals.length);
      const armAverage = averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null;
      for (const [id, entry] of students) {
        children += 1;
        const average = entry.totals.length ? entry.totals.reduce((sum, value) => sum + value, 0) / entry.totals.length : null;
        const att = byStudent.get(id);
        const rate = att && att.all >= 5 ? (att.present / att.all) * 100 : null;
        const drivers: string[] = [];
        let points = 0;
        if (average !== null && armAverage !== null && armAverage - average >= 12) { points += 2; drivers.push(`Average ${Math.round(average)} is ${Math.round(armAverage - average)} below the class’s ${Math.round(armAverage)}`); }
        if (entry.failing >= 3) { points += 2; drivers.push(`Below the pass mark in ${entry.failing} subjects`); } else if (entry.failing === 2) { points += 1; drivers.push("Below the pass mark in 2 subjects"); }
        if (rate !== null && rate < 85) { points += 2; drivers.push(`Present ${Math.round(rate)}% of days this term`); } else if (rate !== null && rate < 90) { points += 1; drivers.push(`Present ${Math.round(rate)}% of days this term`); }
        if (att && att.recent >= 4 && att.before >= 8) {
          const drop = (att.beforePresent / att.before) * 100 - (att.recentPresent / att.recent) * 100;
          if (drop >= 15) { points += 2; drivers.push(`Attendance fell ${Math.round(drop)} points in the last two weeks`); }
        }
        if (points >= 3) rows.push({ id, name: entry.name, adm: entry.adm, arm: arm.room.name, points, drivers, average: average === null ? null : Math.round(average * 10) / 10, attendance: rate === null ? null : Math.round(rate) });
      }
    }
    rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    return { entitled: true as const, why: entitled.why, term: { name: term.name, session: term.academicSession?.name ?? "" }, counts: { flagged: rows.length, children }, rows: rows.slice(0, 40) };
  }
}
