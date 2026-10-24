import { apiGet } from "@/lib/api/server";
import { SW } from "@/lib/api/student-workspace";
import type { DrawerSpec, FormField, PanelTone, TabContent } from "@/lib/modules/panels";

export type Me = {
  id: string; name: string; first: string; admissionNumber: string; arm: string; classId: string | null; level: string; category: string | null; stream: string | null; room: string | null;
  gender: string; dateOfBirth: string; enrolled: string; email: string | null; formMaster: { id: string; name: string } | null;
  guardian: { name: string; relationship: string | null; phone: string | null } | null; school: string;
  term: { id: string; name: string; session: string; start: string | null; end: string | null; week: number; weeks: number; onBreak: boolean } | null;
  today: string; now: string;
};
export type Slot = { day: number; n: number; from: string; to: string; kind: "lesson" | "break" | "free"; subject: string; teacher: string; venue: string; lab: boolean };
export type Timetable = {
  slots: Slot[]; periods: Array<{ n: number; from: string; to: string; kind: string }>; published: boolean;
  exams: Array<{ id: string; subject: string; date: string; from: string; to: string; venue: string }>;
  components: Array<{ code: string; name: string; weight: number; max: number }>;
};
export type Part = { code: string; name: string; max: number; score: number | null };
export type SubjectRow = { id: string; name: string; code: string; core: boolean; teacher: string; periods: number; labs: number; topic: string | null; open: number; nextDue: string | null; late: number; released: boolean; parts: Part[] };
export type Subjects = { components: Array<{ id: string; code: string; name: string; weight: number; max: number }>; subjects: SubjectRow[] };
export type Work = {
  id: string; title: string; description: string; subject: string; subjectId: string; teacher: string; teacherId: string; set: string; due: string; dueAt: string; state: "todo" | "overdue" | "handed" | "marked";
  attachmentUrl: string | null; handedAt: string | null; late: boolean; comment: string | null; score: number | null; feedback: string | null; markedAt: string | null;
};
export type Assignments = { items: Work[] };
export type AttendanceData = {
  current: string | null;
  terms: Array<{ id: string; name: string; session: string; start: string; end: string; arm: string; days: string[] }>;
  records: Array<{ date: string; status: string; term: string; reason: string | null; code: string | null; by: string; at: string | null }>;
  closed: Array<{ from: string; to: string; title: string }>;
};
export type CalEvent = { id: string; date: string; end: string; title: string; cat: string; time: string; where: string; note: string };
export type Message = { id: string; cat: "From teachers" | "School" | "Sent"; from: string; fromId: string; role: string; title: string; body: string[]; at: string; read: boolean; to: string };
export type Card = {
  id: string; term: string; session: string; arm: string; average: number; grade: string; position: number | null; size: number; published: string; teacherComment: string; principalComment: string;
  attendance: { present: number; days: number };
  subjects: Array<{ id: string; name: string; total: number; grade: string; position: number | null; of: number; classAverage: number | null; parts: Array<{ code: string; name: string; max: number; score: number }> }>;
};
export type Askable = { people: Array<{ id: string; name: string; role: string }> };

export const loadMe = () => apiGet<Me>(`${SW}/me`);
export const loadTimetable = () => apiGet<Timetable>(`${SW}/timetable`);
export const loadSubjects = () => apiGet<Subjects>(`${SW}/subjects`);
export const loadAssignments = () => apiGet<Assignments>(`${SW}/assignments`);
export const loadAttendance = () => apiGet<AttendanceData>(`${SW}/attendance`);
export const loadCalendar = () => apiGet<{ events: CalEvent[] }>(`${SW}/calendar`);
export const loadMessages = () => apiGet<{ formMaster: { id: string; name: string } | null; items: Message[] }>(`${SW}/messages`);
export const loadCards = () => apiGet<{ cards: Card[] }>(`${SW}/cards`);
export const loadAskable = () => apiGet<Askable>(`${SW}/askable`);
export const loadPrefs = () => apiGet<{ matrix: Record<string, boolean>; quiet: string; remind: string }>(`${SW}/prefs`);

/** What a page hands the shell: the tab content plus the strip of tabs inside the page. */
export type StudentContent = TabContent & { eyebrow?: string; tabs?: Array<{ label: string; count?: number }>; tab?: string };

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MON3 = MONTHS.map((month) => month.slice(0, 3));
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(dayOf(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((dayOf(to).getTime() - dayOf(from).getTime()) / 86_400_000);
export const dShort = (iso: string) => `${dayOf(iso).getUTCDate()} ${MON3[dayOf(iso).getUTCMonth()]}`;
export const dLong = (iso: string) => `${dayOf(iso).getUTCDate()} ${MONTHS[dayOf(iso).getUTCMonth()]} ${dayOf(iso).getUTCFullYear()}`;
/** "Tue 20 Oct" */
export const dDow = (iso: string) => `${WEEKDAYS[dayOf(iso).getUTCDay()]!.slice(0, 3)} ${dShort(iso)}`;
export const dFull = (iso: string) => `${WEEKDAYS[dayOf(iso).getUTCDay()]} ${dShort(iso)}`;
export const monday = (iso: string) => addDays(iso, -((dayOf(iso).getUTCDay() + 6) % 7));
export const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
export const num = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
export const pctText = (value: number | null) => (value === null ? "—" : `${Math.round(value * 10) / 10}%`);
export const attTone = (pct: number | null): PanelTone => (pct === null ? "neutral" : pct >= 92 ? "positive" : pct >= 85 ? "attention" : "negative");

/** "Due today", "Due tomorrow", "Due Fri 23 Oct", "3 days late". */
export function dueText(work: Pick<Work, "due" | "state">, today: string): string {
  const gap = daysBetween(today, work.due);
  if (work.state === "overdue" || gap < 0) return `${-gap} ${-gap === 1 ? "day" : "days"} late`;
  if (gap === 0) return "Today";
  if (gap === 1) return "Tomorrow";
  return dDow(work.due);
}
export function workPill(work: Work, today: string): [string, PanelTone] {
  if (work.state === "marked") return [work.score === null ? "Marked" : `${num(work.score)}%`, work.score !== null && work.score >= 75 ? "positive" : "progress"];
  if (work.state === "handed") return [work.late ? "Handed in late" : "Handed in", "submitted"];
  if (work.state === "overdue") return [dueText(work, today), "negative"];
  const gap = daysBetween(today, work.due);
  return gap <= 1 ? [gap === 0 ? "Due today" : "Due tomorrow", "attention"] : ["To do", "neutral"];
}

/* ───────── the two drawers a student opens from anywhere: ask a teacher, and hand work in ───────── */

export function askDrawer(people: Askable["people"], preset: { to?: string; topic?: string; text?: string } = {}): DrawerSpec {
  const names = people.map((person) => (person.role ? `${person.name} · ${person.role}` : person.name));
  const chosen = people.find((person) => person.id === preset.to);
  const fields: FormField[] = [
    { kind: "select", label: "Who do you want to ask?", options: names, value: chosen ? (chosen.role ? `${chosen.name} · ${chosen.role}` : chosen.name) : names[0], required: true },
    { kind: "text", label: "About", placeholder: "e.g. A question about work", value: preset.topic ?? "", required: true },
    { kind: "area", label: "Your question", placeholder: "Say it the way you would say it to them.", value: preset.text ?? "", required: true, span: 2 },
  ];
  return {
    kicker: "Messages", title: "Ask a teacher", sub: "It goes to them as an in-app message, and their answer arrives in your Messages.", mode: "form", fields,
    commitLabel: "Send the question", commitDone: "Question sent", commitDoneBody: "You will see the answer in Messages.", next: { label: "Open Messages", href: "/portals/student/messages" },
    submit: { endpoint: `${SW}/ask`, method: "POST", map: { "Who do you want to ask?": "to", About: "topic", "Your question": "text" }, encode: { "Who do you want to ask?": Object.fromEntries(names.map((label, index) => [label, people[index]!.id])) } },
  };
}

export function handInDrawer(work: Work): DrawerSpec {
  return {
    kicker: work.subject, title: `Hand in · ${work.title}`, mode: "form", sub: `Set by ${work.teacher}. ${work.state === "overdue" ? "It is late — hand it in anyway; your teacher is told it is late." : "Your teacher is told as soon as you hand it in."}`,
    fields: [
      { kind: "area", label: "A note for your teacher", placeholder: "What you did, or anything they should know.", value: "", span: 2, optional: true },
      { kind: "text", label: "Link to your work", placeholder: "A shared document or photo link, if you have one", value: "", span: 2, optional: true },
    ],
    commitLabel: "Hand it in", commitDone: "Handed in", commitDoneBody: "Your teacher can see it now. You are told when it is marked.",
    submit: { endpoint: `${SW}/assignments/${work.id}/hand-in`, method: "POST", map: { "A note for your teacher": "comment", "Link to your work": "fileUrl" } },
  };
}

export function greeting(clock: string) {
  const hour = Number(clock.slice(0, 2));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
