import { prisma } from "../../../../../src/lib/db/prisma";
import type { SessionPayload } from "../../../../../src/lib/auth/session-core";
import { armName } from "../../fee-management/fees.shared";
import type { TeacherWorkspaceService } from "../workspace.service";

const DAY = 86_400_000;

export const PLACEHOLDER = /topic to be planned$/i;

export type Section = {
  key: string; label: string; hint: string; placeholder: string; required: boolean; assist?: string;
  /** "week-grid": written as a grid of days and activities. The grid is kept beside the text under `${key}__grid`, and the text is composed from it, so every reader sees words. */
  kind?: "week-grid";
};

/** The raw grid rides along with its section; it is never one of the sections a person counts as written. */
export const GRID_SUFFIX = "__grid";
export const countWritten = (sections: unknown) => Object.entries((sections ?? {}) as Record<string, string>).filter(([key, value]) => !key.endsWith(GRID_SUFFIX) && String(value).trim()).length;

/** The school's name, address and contact, for the head of anything printed. */
export async function letterhead(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, address: true, city: true, mainPhone: true, ownerEmail: true } });
  return { name: school?.name ?? "", place: [school?.address, school?.city].filter(Boolean).join(", "), contact: [school?.mainPhone, school?.ownerEmail].filter(Boolean).join(" · ") };
}

/** The seven sections of a note — what a colleague needs to teach from it. Required ones must be written before it can be submitted. */
export const NOTE_SECTIONS: Section[] = [
  { key: "obj", label: "Learning objectives", hint: "What a student will be able to do by the end. Three at most.", placeholder: "By the end of the lesson, students should be able to…", required: true, assist: "Draft from the sub-topics" },
  { key: "prior", label: "Starter and prior knowledge", hint: "What they already know, and the first five minutes.", placeholder: "Recall… then a short starter…", required: false },
  { key: "content", label: "Lesson content", hint: "The explanation itself, step by step — enough for a colleague to teach from it.", placeholder: "1. …", required: true },
  { key: "act", label: "Teaching and learning activities", hint: "What you do, and what the students do.", placeholder: "Teacher: …  Students: …", required: false, assist: "Suggest a pattern" },
  { key: "res", label: "Resources", hint: "Books, pages, materials and anything the room needs ready.", placeholder: "Textbook, chapter…", required: false, assist: "Use the scheme" },
  { key: "eval", label: "Evaluation", hint: "Questions that show whether the lesson landed.", placeholder: "1. …", required: true, assist: "Draft questions" },
  { key: "asg", label: "Assignment", hint: "What they take home, and when it is due.", placeholder: "Exercise…", required: false, assist: "Suggest one" },
];

/** An early-years class plans a week, not a lesson: intentions, the words, the shape of each day, and what to look for. */
export const NOTE_SECTIONS_EY: Section[] = [
  { key: "obj", label: "Learning intentions", hint: "What the children will begin to know or do this week.", placeholder: "Children will begin to…", required: true, assist: "Draft from the sub-topics" },
  { key: "vocab", label: "Key words", hint: "The words you will use again and again this week.", placeholder: "home · nest · burrow…", required: false, assist: "From the sub-topics" },
  { key: "content", label: "Activities across the week", hint: "The shape of each day — circle time, phonics, number, creative and outdoor.", placeholder: "Monday — …", required: true, kind: "week-grid" },
  { key: "res", label: "Resources", hint: "What to have ready.", placeholder: "Puppets, picture books…", required: false, assist: "Use the scheme" },
  { key: "eval", label: "What to look for", hint: "The observations you want to capture this week.", placeholder: "Can name three animals…", required: true, assist: "Draft questions" },
  { key: "home", label: "Learning at home", hint: "One short idea for families.", placeholder: "Ask your child…", required: false, assist: "Suggest one" },
];

export const STATUS_OPTIONS: Array<[string, string]> = [
  ["Planned", "Not taught yet"], ["In progress", "Being taught now"], ["Taught", "Every sub-topic covered"], ["Partly taught", "Some sub-topics still to cover"], ["Postponed", "Moved — not taught when planned"],
];
export const ASSESSMENTS = ["Class exercise", "Quiz", "Practical", "CA test", "Assignment", "Project", "Observation", "None"];
export const RESOURCE_KINDS = ["Textbook", "Worksheet", "Apparatus", "Video or link", "Slides", "Other"];

export const lines = (value: unknown): string[] => (Array.isArray(value) ? value.map(String).map((line) => line.trim()).filter(Boolean) : typeof value === "string" ? value.split(/\r?\n|;/).map((line) => line.trim()).filter(Boolean) : []);

/** The scheme's "kind" as the page draws it: a teaching week, a revision week, or a week nothing is planned for. */
export const uiKind = (weekType: string, topic: string): "teach" | "rev" | "free" => (!topic.trim() || PLACEHOLDER.test(topic) ? "free" : weekType === "REVISION" ? "rev" : "teach");

export type Term = { id: string; name: string; session: string; academicSessionId: string; startsOn: Date; endsOn: Date; weeks: number; isCurrent: boolean; phase: "before" | "during" | "after"; current: number | null; breakStart: Date | null; breakEnd: Date | null };

/** The current term, and the one after it — the two a scheme is planned across. */
export async function termsOf(schoolId: string): Promise<{ current: Term | null; next: Term | null }> {
  const now = Date.now();
  const make = (row: { id: string; name: string; startDate: Date; endDate: Date; isCurrent: boolean; academicSessionId: string; breakStart: Date | null; breakEnd: Date | null; academicSession: { name: string } | null }): Term => {
    const weeks = Math.min(20, Math.max(8, Math.ceil((row.endDate.getTime() - row.startDate.getTime()) / (7 * DAY))));
    const phase = now < row.startDate.getTime() ? "before" : now > row.endDate.getTime() + DAY ? "after" : "during";
    return { id: row.id, name: row.name, session: row.academicSession?.name ?? "", academicSessionId: row.academicSessionId, startsOn: row.startDate, endsOn: row.endDate, weeks, isCurrent: row.isCurrent, phase, current: phase === "during" ? Math.min(weeks, Math.floor((now - row.startDate.getTime()) / (7 * DAY)) + 1) : null, breakStart: row.breakStart, breakEnd: row.breakEnd };
  };
  const select = { id: true, name: true, startDate: true, endDate: true, isCurrent: true, academicSessionId: true, breakStart: true, breakEnd: true, academicSession: { select: { name: true } } } as const;
  const current = await prisma.term.findFirst({ where: { schoolId, isCurrent: true }, select });
  if (!current) return { current: null, next: null };
  const next = await prisma.term.findFirst({ where: { schoolId, startDate: { gt: current.endDate } }, orderBy: { startDate: "asc" }, select });
  return { current: make(current), next: next ? make(next) : null };
}

export const weekRange = (term: Term, week: number) => ({ from: new Date(term.startsOn.getTime() + (week - 1) * 7 * DAY), to: new Date(term.startsOn.getTime() + (week - 1) * 7 * DAY + 4 * DAY) });
export const rangeLabel = (term: Term, week: number) => {
  const { from, to } = weekRange(term, week);
  const f = (date: Date, month: boolean) => date.toLocaleDateString("en-GB", { day: "numeric", ...(month ? { month: "short" } : {}), timeZone: "UTC" });
  return from.getUTCMonth() === to.getUTCMonth() ? `${f(from, false)} – ${f(to, true)}` : `${f(from, true)} – ${f(to, true)}`;
};
/** A week the mid-term break falls inside is a short one. */
export const isShortWeek = (term: Term, week: number) => {
  if (!term.breakStart || !term.breakEnd) return false;
  const { from, to } = weekRange(term, week);
  return term.breakStart <= to && term.breakEnd >= from;
};

/** A week's status: what the teacher set, else what the calendar and the ticks say. */
export function statusOf(term: Term, week: number, topic: { kind: "teach" | "rev" | "free"; override: string | null; subs: number; covered: number; startWeek?: number }): string {
  if ((topic.startWeek ?? 1) > week) return "Not planned";
  if (topic.kind === "free") return "Free week";
  if (topic.override) return topic.override;
  if (topic.subs > 0 && topic.covered >= topic.subs) return "Taught";
  if (term.phase === "after" || (term.current !== null && week < term.current)) return topic.covered > 0 && topic.covered < topic.subs ? "Partly taught" : "Taught";
  if (term.current !== null && week === term.current) return "In progress";
  return topic.kind === "rev" ? "Revision" : "Planned";
}
export const isLive = (status: string) => status === "In progress" || status === "Partly taught";

/** The week a person lands on: this one, or — outside the term — the nearest end of it. */
export const focusWeek = (term: Term) => (term.current ?? (term.phase === "after" ? term.weeks : 1));

export type Group = {
  subjectId: string;
  subject: string;
  classIds: string[];
  arms: Array<{ id: string; name: string }>;
  /** Cover reads the owner's scheme and notes; it never writes them. */
  readOnly: boolean;
  ownerId: string | null;
  custom: boolean;
  earlyYears: boolean;
};

const EY_SUBJECT = { name: "All seven areas", code: "EYFS-ALL" };

/** Held inactive on purpose: it is a home for the weekly plan, not a subject the school lists, teaches or scores. */
export async function earlyYearsSubject(schoolId: string) {
  const found = await prisma.subject.findFirst({ where: { schoolId, code: EY_SUBJECT.code } });
  if (found) return found;
  return prisma.subject.create({ data: { schoolId, name: EY_SUBJECT.name, code: EY_SUBJECT.code, isActive: false, isCore: false, periodsPerWeek: 0, description: "The early-years class's weekly plan, across all seven areas of learning." } });
}

/**
 * The subjects a person plans and writes notes for: the ones they teach; the ones they hold on cover (read only, with the owner's own
 * work); the ones they added themselves while the school had not mapped them; and — for an early-years class teacher — their class's
 * weekly plan across all seven areas.
 */
export async function groupsOf(session: SessionPayload, workspace: TeacherWorkspaceService, terms: { current: Term | null; next: Term | null }): Promise<{ me: Awaited<ReturnType<TeacherWorkspaceService["me"]>>; groups: Group[] }> {
  const me = await workspace.me(session);
  const rooms = await prisma.classRoom.findMany({ where: { schoolId: session.schoolId, deletedAt: null }, select: { id: true, name: true, arm: true } });
  const roomOf = new Map(rooms.map((room) => [room.id, { id: room.id, name: armName(room) }]));
  const map = new Map<string, Group>();
  const add = (key: string, base: Omit<Group, "classIds" | "arms">, classId: string) => {
    const group = map.get(key) ?? { ...base, classIds: [], arms: [] };
    if (!group.classIds.includes(classId)) {
      group.classIds.push(classId);
      group.arms.push(roomOf.get(classId) ?? { id: classId, name: "An arm" });
    }
    map.set(key, group);
  };
  for (const row of me.teaching.filter((entry) => !entry.assistant && entry.basis !== "Cover")) add(`own:${row.subjectId}`, { subjectId: row.subjectId, subject: row.subject, readOnly: false, ownerId: session.userId, custom: false, earlyYears: false }, row.classId);
  for (const row of me.teaching.filter((entry) => entry.basis === "Cover")) {
    const owner = await prisma.classSubject.findFirst({ where: { schoolId: session.schoolId, classId: row.classId, subjectId: row.subjectId }, select: { teacherId: true } });
    add(`cover:${row.subjectId}`, { subjectId: row.subjectId, subject: row.subject, readOnly: true, ownerId: owner?.teacherId ?? null, custom: false, earlyYears: false }, row.classId);
  }
  const termIds = [terms.current?.id, terms.next?.id].filter(Boolean) as string[];
  if (termIds.length) {
    const added = await prisma.schemeOfWork.findMany({ where: { schoolId: session.schoolId, teacherId: session.userId, addedByTeacher: true, termId: { in: termIds } }, include: { subject: { select: { name: true } } } });
    for (const scheme of added) if (!map.has(`own:${scheme.subjectId}`)) add(`custom:${scheme.subjectId}`, { subjectId: scheme.subjectId, subject: scheme.subject.name, readOnly: false, ownerId: session.userId, custom: true, earlyYears: false }, scheme.classId);
  }
  // An early-years class teacher plans the week across all seven areas, whether or not the school has also mapped single subjects to them.
  const eyArms = me.formArms.filter((entry) => entry.earlyYears);
  if (eyArms.length) {
    const subject = await earlyYearsSubject(session.schoolId);
    for (const arm of eyArms) add(`ey:${subject.id}`, { subjectId: subject.id, subject: subject.name, readOnly: false, ownerId: session.userId, custom: false, earlyYears: true }, arm.id);
  }
  return { me, groups: [...map.values()].sort((a, b) => Number(a.readOnly) - Number(b.readOnly) || a.subject.localeCompare(b.subject)) };
}

export const sectionsFor = (group: Pick<Group, "earlyYears">) => (group.earlyYears ? NOTE_SECTIONS_EY : NOTE_SECTIONS);
export const noteState = (status: string | undefined | null, sections: Record<string, string> | null | undefined) =>
  !status ? "Not started" : status === "APPROVED" ? "Approved" : status === "SUBMITTED" ? "Submitted" : status === "RETURNED" ? "Returned" : Object.values(sections ?? {}).some((value) => String(value).trim()) ? "Draft" : "Not started";
