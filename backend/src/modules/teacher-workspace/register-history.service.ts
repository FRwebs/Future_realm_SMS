import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { add, dayOf, emptyTally, iso, loadPolicy, longDay, rate, schoolDaysBetween, today } from "../attendance-management/attendance.shared";
import { armName } from "../fee-management/fees.shared";
import { PeriodRegistersService } from "./period-registers.service";
import { TeacherWorkspaceService } from "./workspace.service";

/**
 * The register history of a teaching person: the form master's own arm, day by day; and for everyone else, the period registers they
 * took. Read from the registers themselves — an unmarked day is not 0%, it is unknown, and is counted as unknown.
 */
@Injectable()
export class RegisterHistoryService {
  constructor(private readonly workspace: TeacherWorkspaceService, private readonly periods: PeriodRegistersService) {}

  /**
   * Every register this person holds, with what each one is worth so far.
   *
   * The Register tab used to open straight into one arm's history, which is only
   * right for a form master who holds exactly one. A subject teacher holds
   * several period registers and a form master covering for someone holds two
   * daily ones; neither could see the others at all. This is the list those
   * registers were missing, and each row opens the history that already existed.
   */
  async index(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) return { term: null, date: null, schoolDays: 0, markedToday: 0, correctionsPending: 0, registers: [] };
    const schoolId = session.schoolId;
    const term = await prisma.term.findUniqueOrThrow({ where: { id: me.term.id } });
    const now = today();
    // schoolDaysBetween returns the days themselves, not a count.
    const schoolDays = schoolDaysBetween(term, dayOf(term.startDate), now < dayOf(term.endDate) ? now : dayOf(term.endDate)).length;
    const live = await this.periods.today(session, me);

    // One pass for the term's daily marks across every arm in the list, rather
    // than a query per row.
    const classIds = [...new Set(live.registers.map((entry) => entry.classId))];
    const marks = classIds.length
      ? await prisma.studentAttendance.groupBy({
          by: ["classId", "status"],
          where: { schoolId, termId: term.id, subjectId: null, classId: { in: classIds } },
          _count: { _all: true },
        })
      : [];
    const termRate = new Map<string, number | null>();
    for (const id of classIds) {
      const rows = marks.filter((row) => row.classId === id);
      const tally = emptyTally();
      for (const row of rows) for (let i = 0; i < row._count._all; i += 1) add(tally, row.status);
      termRate.set(id, rate(tally));
    }

    const correctionsPending = await prisma.attendanceCorrection.count({
      where: { schoolId, classId: { in: classIds.length ? classIds : ["none"] }, status: "AWAITING" },
    });

    // `me.teaching` already records whether each assignment is substantive or a
    // cover, and when a cover ends — so the reason a register is yours is read
    // from there rather than guessed from the register's kind.
    const coverOf = new Map(
      me.teaching.filter((row) => row.basis === "Cover").map((row) => [row.classId, { until: row.until as string | null }]),
    );
    return {
      term: { id: term.id, name: term.name },
      date: live.date,
      schoolDays,
      markedToday: live.registers.filter((entry) => entry.state === "Marked").length,
      correctionsPending,
      registers: live.registers.map((entry) => {
        const cover = coverOf.get(entry.classId);
        return {
          classId: entry.classId, subjectId: entry.subjectId, periodNumber: entry.periodNumber,
          arm: entry.arm, what: entry.what, kind: entry.kind, roll: entry.roll,
          why: cover ? `Cover${cover.until ? ` · until ${longDay(new Date(cover.until))}` : ""}` : entry.kind === "daily" ? "Form Master" : "Subject teacher",
          today: entry.state,
          termRate: entry.kind === "daily" ? termRate.get(entry.classId) ?? null : null,
        };
      }),
    };
  }

  async history(session: SessionPayload, classId?: string) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no register history to read.");
    const schoolId = session.schoolId;
    const term = await prisma.term.findUniqueOrThrow({ where: { id: me.term.id } });
    const policy = await loadPolicy(schoolId);
    const now = today();
    const arm = me.formArms.find((entry) => entry.id === classId) ?? me.formArms[0] ?? null;

    if (arm) {
      const days = schoolDaysBetween(term, dayOf(term.startDate), now < dayOf(term.endDate) ? now : dayOf(term.endDate));
      const [registers, marks, roster] = await Promise.all([
        prisma.attendanceRegister.findMany({ where: { classId: arm.id, termId: term.id, status: "SUBMITTED" }, select: { date: true, submittedAt: true, late: true, backdated: true, markedById: true, roll: true } }),
        prisma.studentAttendance.findMany({ where: { schoolId, classId: arm.id, termId: term.id, subjectId: null }, select: { studentId: true, status: true, date: true } }),
        prisma.student.findMany({ where: { schoolId, currentClassId: arm.id, status: "ACTIVE" }, select: { id: true } })
      ]);
      const registerOf = new Map(registers.map((entry) => [iso(entry.date), entry]));
      const termTally = emptyTally();
      const byDay = new Map<string, ReturnType<typeof emptyTally>>();
      const byChild = new Map<string, ReturnType<typeof emptyTally>>();
      for (const row of marks) {
        add(termTally, row.status);
        const key = iso(row.date);
        add(byDay.get(key) ?? byDay.set(key, emptyTally()).get(key)!, row.status);
        add(byChild.get(row.studentId) ?? byChild.set(row.studentId, emptyTally()).get(row.studentId)!, row.status);
      }
      const markerIds = [...new Set(registers.map((entry) => entry.markedById))];
      const people = markerIds.length ? await prisma.user.findMany({ where: { id: { in: markerIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
      const nameOf = new Map(people.map((person) => [person.id, person.id === session.userId ? "You" : `${person.firstName} ${person.lastName}`]));
      const recent = days.slice(-8).reverse().map((day) => {
        const register = registerOf.get(iso(day));
        const tally = byDay.get(iso(day)) ?? emptyTally();
        const isToday = day.getTime() === now.getTime();
        return {
          date: iso(day), label: longDay(day), roll: register?.roll ?? roster.length, present: tally.present, absent: tally.absent, late: tally.late, excused: tally.excused,
          state: register ? "Marked" : isToday ? "Not started" : "Not marked", markedBy: register ? nameOf.get(register.markedById) ?? "—" : "—", onTime: register ? !register.late && !register.backdated : null
        };
      });
      const chronic = roster.filter((student) => {
        const value = rate(byChild.get(student.id) ?? emptyTally(), policy.lateCounts);
        return value !== null && value < policy.chronic;
      }).length;
      const marked = days.filter((day) => registerOf.has(iso(day))).length;
      return {
        kind: "arm" as const, arm: { id: arm.id, name: arm.name, roll: roster.length }, term: { name: me.term.name, session: me.term.session }, schoolDays: days.length, target: policy.target,
        rate: rate(termTally, policy.lateCounts), marked, onTime: registers.filter((entry) => registerOf.has(iso(entry.date)) && days.some((day) => iso(day) === iso(entry.date)) && !entry.late && !entry.backdated).length, chronic, today: registerOf.has(iso(now)) ? "Marked" : "Not started", recent, cutoff: policy.markCutoff,
        otherArms: me.formArms.filter((entry) => entry.id !== arm.id).map((entry) => ({ id: entry.id, name: entry.name }))
      };
    }

    /* no arm of their own: the period registers they took */
    const rows = await prisma.periodRegister.findMany({ where: { schoolId, markedById: session.userId, termId: term.id, status: "SUBMITTED" }, orderBy: [{ date: "desc" }, { periodNumber: "desc" }] });
    const classIds = [...new Set(rows.map((row) => row.classId))];
    const [rooms, subjects, marks] = await Promise.all([
      classIds.length ? prisma.classRoom.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, arm: true } }) : [],
      prisma.subject.findMany({ where: { schoolId, id: { in: [...new Set(rows.map((row) => row.subjectId))] } }, select: { id: true, name: true } }),
      rows.length ? prisma.studentAttendance.findMany({ where: { schoolId, markedById: session.userId, subjectId: { not: null }, termId: term.id }, select: { classId: true, subjectId: true, date: true, status: true } }) : []
    ]);
    const roomOf = new Map(rooms.map((room) => [room.id, armName(room)]));
    const subjectOf = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const tally = (row: (typeof rows)[number]) => {
      const t = emptyTally();
      for (const mark of marks) if (mark.classId === row.classId && mark.subjectId === row.subjectId && iso(mark.date) === iso(row.date)) add(t, mark.status);
      return t;
    };
    const assigned = me.teaching.filter((entry) => !entry.assistant).reduce((sum, entry) => sum + entry.periods, 0);
    return {
      kind: "periods" as const, arms: [...new Set(me.teaching.map((entry) => entry.arm))], term: { name: me.term.name, session: me.term.session },
      marked: rows.length, inPeriod: rows.filter((row) => row.inPeriod).length, assigned,
      recent: rows.slice(0, 8).map((row) => {
        const t = tally(row);
        return { date: iso(row.date), label: longDay(row.date), arm: roomOf.get(row.classId) ?? "", classId: row.classId, subjectId: row.subjectId, subject: subjectOf.get(row.subjectId) ?? "", period: row.periodNumber, present: t.present + t.late, absent: t.absent, inPeriod: row.inPeriod };
      })
    };
  }

  /** How long a register takes this person, over the term: the median from opening it to submitting it. */
  async medianSeconds(session: SessionPayload) {
    const term = await prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, select: { id: true } });
    if (!term) return null;
    const [daily, periods] = await Promise.all([
      prisma.attendanceRegister.findMany({ where: { markedById: session.userId, termId: term.id, status: "SUBMITTED", submittedAt: { not: null } }, select: { startedAt: true, submittedAt: true } }),
      prisma.periodRegister.findMany({ where: { markedById: session.userId, termId: term.id, status: "SUBMITTED", submittedAt: { not: null } }, select: { startedAt: true, submittedAt: true } })
    ]);
    const spans = [...daily, ...periods].map((row) => ((row.submittedAt as Date).getTime() - row.startedAt.getTime()) / 1000).filter((seconds) => seconds > 0 && seconds < 3600).sort((a, b) => a - b);
    return spans.length ? Math.round(spans[Math.floor(spans.length / 2)]!) : null;
  }
}
