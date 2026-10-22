import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { isSchoolDay, lagosClock, today } from "../attendance-management/attendance.shared";
import { armName } from "../fee-management/fees.shared";
import { loadAll } from "../score-results/arm";
import { TeacherWorkspaceService } from "./workspace.service";

const DAYS = [1, 2, 3, 4, 5];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** A subject's short form in a week cell: "Further Mathematics" is "FM", "Chemistry" is "Chem" — never an opaque code. */
function short(name: string): string {
  return name
    .split("/")
    .map((part) => {
      const words = part.trim().split(/\s+/).filter((word) => !/^(and|of|the|to|for|&)$/i.test(word));
      return words.length > 1 ? words.map((word) => word[0]!.toUpperCase()).join("") : (words[0] ?? part).slice(0, 5);
    })
    .join("/");
}

/**
 * A teacher's own timetable, read from the published periods that name them — never the school's. A period appears only once the
 * school has published its timetable, exactly as it does for a child's family.
 */
@Injectable()
export class TeacherTimetableService {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  async timetable(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is no timetable to read.");
    const schoolId = session.schoolId;
    const now = new Date();
    const date = today(now);
    const clock = lagosClock(now) ?? "00:00";
    const term = await prisma.term.findUniqueOrThrow({ where: { id: me.term.id } });
    const dow = new Date(date).getUTCDay();

    const [entries, publishedAnywhere] = await Promise.all([
      prisma.timetableEntry.findMany({ where: { schoolId, termId: term.id, teacherId: session.userId, isPublished: true, subjectId: { not: null } }, include: { classRoom: true, subject: true }, orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }] }),
      prisma.timetableEntry.count({ where: { schoolId, termId: term.id, isPublished: true } })
    ]);

    /* the week: one row per period number, five days across */
    const periodNumbers = [...new Set(entries.map((entry) => entry.periodNumber))].sort((a, b) => a - b);
    const week = periodNumbers.map((periodNumber) => {
      const first = entries.find((entry) => entry.periodNumber === periodNumber)!;
      return {
        n: periodNumber, time: `${first.startsAt}–${first.endsAt}`,
        cells: DAYS.map((day) => {
          const entry = entries.find((candidate) => candidate.periodNumber === periodNumber && candidate.dayOfWeek === day);
          return entry ? { subject: entry.subject?.name ?? "", short: short(entry.subject?.name ?? ""), arm: armName(entry.classRoom), room: entry.venue ?? null } : null;
        })
      };
    });

    /* today */
    const schoolDay = isSchoolDay(term, date);
    const todays = schoolDay ? entries.filter((entry) => entry.dayOfWeek === dow) : [];
    const periods = todays.map((entry) => ({
      periodNumber: entry.periodNumber, from: entry.startsAt, to: entry.endsAt, classId: entry.classId, arm: armName(entry.classRoom), subjectId: entry.subjectId, subject: entry.subject?.name ?? "",
      room: entry.venue ?? "—", note: entry.notes ?? "", state: clock >= entry.endsAt ? "done" : clock >= entry.startsAt ? "now" : "later"
    }));
    const next = periods.find((period) => period.state === "later");
    if (next) next.state = "next";
    const weekCount = entries.length;

    return {
      date: date.toISOString().slice(0, 10), clock, schoolDay, weekday: DAY_NAMES[dow - 1] ?? null,
      published: publishedAnywhere > 0, week, periods, weekCount, teachingPerWeek: me.teaching.reduce((sum, row) => sum + row.periods, 0),
      days: DAY_NAMES
    };
  }

  /** What the person is assigned to, and what each assignment gives them — every sheet and register traces to one of these rows. */
  async teaching(session: SessionPayload) {
    const me = await this.workspace.me(session);
    if (!me.term) throw new NotFoundException("No term is current, so there is nothing assigned.");
    const classIds = [...new Set(me.teaching.map((row) => row.classId))];
    const arms = classIds.length ? await loadAll(session.schoolId, { id: me.term.id, name: me.term.name }, classIds) : [];
    const rolls = new Map(arms.map((arm) => [arm.room.id, arm.students.length]));
    const sheetState = new Map<string, string>();
    for (const arm of arms) for (const subject of arm.subjects) sheetState.set(`${arm.room.id}:${subject.subjectId}`, subject.state);
    const formRolls = me.formArms.map((arm) => ({ ...arm }));
    const [armRows, subjectRows] = await Promise.all([
      prisma.classRoom.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null }, select: { name: true, arm: true }, orderBy: { displayOrder: "asc" } }),
      prisma.subject.findMany({ where: { schoolId: session.schoolId, isActive: true, deletedAt: null }, select: { name: true }, orderBy: { name: "asc" } })
    ]);

    const assignments = me.teaching.map((row) => ({
      classId: row.classId, subjectId: row.subjectId, subject: row.subject, arm: row.arm, roll: rolls.get(row.classId) ?? 0, perWeek: row.periods, basis: row.basis,
      assistant: row.assistant, sheet: sheetState.get(`${row.classId}:${row.subjectId}`) ?? "Not started",
      grants: row.assistant ? "Read the results of this subject-arm · you assist, you do not enter its scores" : "Enter and submit scores, read the results"
    }));
    return {
      persona: me.persona, department: me.department, reportsTo: me.reportsTo, formArms: formRolls, assistantArms: me.assistantArms,
      options: { arms: armRows.map((room) => armName(room)), subjects: subjectRows.map((subject) => subject.name) },
      assignments, periodsPerWeek: assignments.reduce((sum, row) => sum + row.perWeek, 0), hats: me.hats
    };
  }
}
