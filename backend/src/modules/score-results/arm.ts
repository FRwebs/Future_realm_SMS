import type { ScoreSheet } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import {
  ABSENT, type Band, type CellValue, type Column, type Flag, type FlagOutcome, type SectionName, armName, flagsFor, fullName, gradeOf, liveFramework, loadBands, mean, rank, ratingOf, readFramework,
  round1, round2, totalOf, CREDIT_MARK
} from "./scores.shared";

/**
 * One arm, read once: its children, the subjects it offers and who teaches each, every sheet and what
 * is entered on it. Every figure on the Review, Enter and Results pages is derived from this, so a page
 * cannot say something the sheet behind it does not.
 */

export type SheetState = "Not started" | "In progress" | "Submitted" | "Returned" | "Approved" | "Unassigned";

export const STATE_OF: Record<string, SheetState> = { IN_PROGRESS: "In progress", SUBMITTED: "Submitted", RETURNED: "Returned", APPROVED: "Approved" };

export type RowView = {
  id: string;
  name: string;
  adm: string;
  cells: Record<string, CellValue>;
  total: number | null;
  blank: number;
  absent: number;
  complete: boolean;
  grade: string | null;
  rating: string;
  pos: number | null;
  /** Well above, above, around or below the arm's own average for this subject. */
  standing: string;
};

export type SubjectView = {
  csId: string;
  subjectId: string;
  name: string;
  code: string;
  category: string;
  teacherId: string | null;
  teacher: string | null;
  assistantId: string | null;
  passMark: number;
  counts: boolean;
  state: SheetState;
  sheet: ScoreSheet | null;
  columns: Column[];
  pinned: boolean;
  rows: RowView[];
  scored: number;
  roll: number;
  mean: number | null;
  high: { name: string; total: number } | null;
  low: { name: string; total: number } | null;
  passed: number;
  failed: number;
  flags: Flag[];
  outcomes: Record<string, FlagOutcome>;
  openFlags: number;
  entered: Date | null;
  enteredByIds: string[];
};

export type ArmData = {
  room: { id: string; name: string; classTeacherId: string | null; section: SectionName | null; levelId: string; levelName: string };
  students: Array<{ id: string; name: string; adm: string }>;
  subjects: SubjectView[];
  bands: Band[];
  passMark: number;
  scheme: string;
  termId: string;
};

export type Term = { id: string; name: string };

type Entry = { score: number; at: Date; by: string; componentId: string };

/** Everything entered this term, by arm, subject and child — one query for as many arms as are asked for. */
export async function loadEntries(schoolId: string, termId: string, classIds?: string[]) {
  const rows = await prisma.scoreEntry.findMany({
    where: { schoolId, resultSheet: { termId }, ...(classIds ? { student: { currentClassId: { in: classIds } } } : {}) },
    select: { studentId: true, subjectId: true, assessmentComponentId: true, score: true, recordedAt: true, enteredById: true, student: { select: { currentClassId: true } } }
  });
  const byArm = new Map<string, Map<string, Map<string, Entry[]>>>();
  for (const row of rows) {
    const classKey = row.student.currentClassId ?? "";
    const arm = byArm.get(classKey) ?? new Map<string, Map<string, Entry[]>>();
    const subject = arm.get(row.subjectId) ?? new Map<string, Entry[]>();
    const list = subject.get(row.studentId) ?? [];
    list.push({ score: row.score, at: row.recordedAt, by: row.enteredById, componentId: row.assessmentComponentId });
    subject.set(row.studentId, list);
    arm.set(row.subjectId, subject);
    byArm.set(classKey, arm);
  }
  return byArm;
}

export async function loadStaffNames(schoolId: string, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const users = unique.length ? await prisma.user.findMany({ where: { schoolId, id: { in: unique } }, select: { id: true, firstName: true, lastName: true } }) : [];
  return new Map(users.map((user) => [user.id, fullName(user)]));
}

const SECTIONS = new Set(["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"]);

/** An arm's subject views, from what has been loaded. Flags are worked out only for sheets someone has to decide. */
export async function loadArm(schoolId: string, term: Term, classId: string, shared?: { bands: Awaited<ReturnType<typeof loadBands>>; entries: Awaited<ReturnType<typeof loadEntries>>; names: Map<string, string> }): Promise<ArmData | null> {
  const room = await prisma.classRoom.findFirst({ where: { id: classId, schoolId, deletedAt: null }, include: { classLevel: { select: { id: true, name: true, schoolSection: true } } } });
  if (!room) return null;
  const section = room.classLevel.schoolSection && SECTIONS.has(room.classLevel.schoolSection) ? (room.classLevel.schoolSection as SectionName) : null;
  const [students, classSubjects, sheets, bandInfo, entryMap, live] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, currentClassId: classId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, admissionNumber: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.classSubject.findMany({ where: { schoolId, classId, isActive: true, subject: { deletedAt: null, isActive: true } }, include: { subject: { select: { id: true, name: true, code: true, sortOrder: true, subjectCategory: { select: { name: true } }, isCore: true } } } }),
    prisma.scoreSheet.findMany({ where: { schoolId, termId: term.id, classId } }),
    shared?.bands ?? loadBands(schoolId),
    shared?.entries ?? loadEntries(schoolId, term.id, [classId]),
    liveFramework(schoolId, term.id, section)
  ]);
  const names = shared?.names ?? (await loadStaffNames(schoolId, classSubjects.flatMap((entry) => [entry.teacherId ?? "", entry.assistantTeacherId ?? ""])));
  const sheetOf = new Map(sheets.map((sheet) => [sheet.subjectId, sheet]));
  const armEntries = entryMap.get(classId) ?? new Map<string, Map<string, Entry[]>>();
  const roster = students.map((student) => ({ id: student.id, name: fullName(student), adm: student.admissionNumber }));

  const subjects: SubjectView[] = classSubjects
    .slice()
    .sort((a, b) => (a.subject.sortOrder ?? 0) - (b.subject.sortOrder ?? 0) || a.subject.name.localeCompare(b.subject.name))
    .map((entry) => {
      const sheet = sheetOf.get(entry.subjectId) ?? null;
      const pinned = sheet ? readFramework(sheet.framework) : [];
      const columns = pinned.length ? pinned : live;
      const idToKey = new Map(columns.filter((column) => column.id).map((column) => [column.id as string, column.key]));
      const bySubject = armEntries.get(entry.subjectId) ?? new Map<string, Entry[]>();
      const absences = (sheet?.absences ?? {}) as Record<string, string[]>;
      let latest: Date | null = null;
      const rows: RowView[] = roster.map((student) => {
        const cells: Record<string, CellValue> = {};
        for (const column of columns) cells[column.key] = null;
        for (const value of bySubject.get(student.id) ?? []) {
          const key = idToKey.get(value.componentId);
          if (key) {
            cells[key] = value.score;
            if (!latest || value.at > latest) latest = value.at;
          }
        }
        for (const key of absences[student.id] ?? []) if (key in cells) cells[key] = ABSENT;
        const sum = totalOf(columns, cells);
        const band = gradeOf(bandInfo.bands, sum.total);
        return { id: student.id, name: student.name, adm: student.adm, cells, total: sum.total, blank: sum.blank, absent: sum.absent, complete: sum.complete, grade: band?.label ?? null, rating: ratingOf(sum.total, bandInfo.bands, entry.passMark), pos: null, standing: "—" };
      });
      const scoredRows = rows.filter((row) => row.total !== null);
      const average = mean(scoredRows.map((row) => row.total as number));
      const ranks = rank(scoredRows.map((row) => ({ id: row.id, value: row.total as number })));
      for (const row of rows) {
        row.pos = ranks.get(row.id) ?? null;
        row.standing = row.total === null || average === null ? "—" : row.total >= average + 8 ? "Well above the class" : row.total >= average ? "Above the class" : row.total >= average - 8 ? "Around the class" : "Below the class";
      }
      const sorted = scoredRows.slice().sort((a, b) => (b.total as number) - (a.total as number));
      const state: SheetState = !entry.teacherId && !sheet ? "Unassigned" : sheet ? (STATE_OF[sheet.status] ?? "In progress") : "Not started";
      const teacher = entry.teacherId ? names.get(entry.teacherId) ?? null : null;
      return {
        csId: entry.id, subjectId: entry.subjectId, name: entry.subject.name, code: entry.subject.code, category: entry.subject.subjectCategory?.name ?? (entry.subject.isCore ? "Core" : "Elective"),
        teacherId: entry.teacherId, teacher, assistantId: entry.assistantTeacherId, passMark: entry.passMark, counts: entry.countsToAverage, state, sheet, columns, pinned: pinned.length > 0, rows,
        scored: scoredRows.length, roll: rows.length, mean: average === null ? null : round1(average),
        high: sorted[0] ? { name: sorted[0].name, total: sorted[0].total as number } : null,
        low: sorted.length ? { name: sorted[sorted.length - 1].name, total: sorted[sorted.length - 1].total as number } : null,
        passed: scoredRows.filter((row) => (row.total as number) >= CREDIT_MARK).length, failed: scoredRows.filter((row) => (row.total as number) < entry.passMark).length,
        flags: [], outcomes: ((sheet?.flagOutcomes ?? {}) as Record<string, FlagOutcome>), openFlags: 0, entered: latest, enteredByIds: sheet?.enteredByIds ?? []
      };
    });

  /* the anomaly check needs every other subject's total for the same child */
  const totalsByStudent = new Map<string, Array<{ subjectId: string; total: number }>>();
  for (const subject of subjects) for (const row of subject.rows) if (row.total !== null) totalsByStudent.set(row.id, [...(totalsByStudent.get(row.id) ?? []), { subjectId: subject.subjectId, total: row.total }]);
  for (const subject of subjects) {
    if (subject.state !== "Submitted" && subject.state !== "In progress" && subject.state !== "Returned") continue;
    const flagRows = subject.rows.map((row) => {
      const others = (totalsByStudent.get(row.id) ?? []).filter((entry) => entry.subjectId !== subject.subjectId);
      return { id: row.id, name: row.name, cells: row.cells, total: row.total, others: others.length >= 3 ? mean(others.map((entry) => entry.total)) : null };
    });
    subject.flags = flagsFor(subject.columns, flagRows, bandInfo.bands, subject.passMark);
    subject.openFlags = subject.flags.filter((flag) => flag.blocking && !subject.outcomes[flag.key]).length;
  }

  return { room: { id: room.id, name: armName(room), classTeacherId: room.classTeacherId, section, levelId: room.classLevel.id, levelName: room.classLevel.name }, students: roster, subjects, bands: bandInfo.bands, passMark: bandInfo.passMark, scheme: bandInfo.scheme, termId: term.id };
}

/* ───────────────────────── a child's result across the arm ───────────────────────── */

export type StudentResult = {
  id: string;
  name: string;
  adm: string;
  /** The mean of every subject total they have — absences and blanks are not in it. */
  average: number | null;
  scored: number;
  expected: number;
  grade: string | null;
  pos: number | null;
  /** Subjects with no approved total: what a report card is waiting on. */
  blockedBy: string[];
  ready: boolean;
  total: number;
};

export function studentResults(arm: ArmData, approvedOnly = false): StudentResult[] {
  const counted = arm.subjects.filter((subject) => subject.counts);
  const expected = counted.length;
  const out: StudentResult[] = arm.students.map((student) => {
    const totals: number[] = [];
    const blockedBy: string[] = [];
    for (const subject of counted) {
      const row = subject.rows.find((entry) => entry.id === student.id);
      const approved = subject.state === "Approved";
      if (row?.total !== null && row?.total !== undefined && (!approvedOnly || approved)) totals.push(row.total);
      if (!approved) blockedBy.push(`${subject.name} · ${subject.state === "Unassigned" ? "no teacher" : subject.state.toLowerCase()}`);
      else if (!row || row.total === null) blockedBy.push(`${subject.name} · no score for this child`);
    }
    const average = mean(totals);
    return { id: student.id, name: student.name, adm: student.adm, average: average === null ? null : round2(average), scored: totals.length, expected, grade: gradeOf(arm.bands, average)?.label ?? null, pos: null, blockedBy, ready: expected > 0 && blockedBy.length === 0, total: round2(totals.reduce((sum, value) => sum + value, 0)) };
  });
  const ranks = rank(out.filter((entry) => entry.average !== null).map((entry) => ({ id: entry.id, value: entry.average as number })));
  for (const entry of out) entry.pos = ranks.get(entry.id) ?? null;
  return out;
}

/** Every arm that has children and subjects, read together so the school-wide pages cost one pass. */
export async function loadAll(schoolId: string, term: Term, only?: string[]): Promise<ArmData[]> {
  const rooms = await prisma.classRoom.findMany({
    where: { schoolId, deletedAt: null, isActive: true, ...(only ? { id: { in: only } } : {}), students: { some: { status: "ACTIVE" } }, classSubjects: { some: { isActive: true } } },
    select: { id: true, classLevel: { select: { order: true } }, name: true },
    orderBy: [{ classLevel: { order: "asc" } }, { name: "asc" }]
  });
  if (!rooms.length) return [];
  const [bands, entries, subjectStaff] = await Promise.all([
    loadBands(schoolId),
    loadEntries(schoolId, term.id, rooms.map((room) => room.id)),
    prisma.classSubject.findMany({ where: { schoolId, classId: { in: rooms.map((room) => room.id) } }, select: { teacherId: true, assistantTeacherId: true } })
  ]);
  const names = await loadStaffNames(schoolId, subjectStaff.flatMap((entry) => [entry.teacherId ?? "", entry.assistantTeacherId ?? ""]));
  const arms: ArmData[] = [];
  for (const room of rooms) {
    const arm = await loadArm(schoolId, term, room.id, { bands, entries, names });
    if (arm) arms.push(arm);
  }
  return arms;
}
