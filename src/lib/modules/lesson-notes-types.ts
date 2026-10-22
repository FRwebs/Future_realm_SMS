/** What the lesson-notes API answers with, as the pages read it. Mirrors backend/src/modules/teacher-workspace/lesson-notes. */

export const LN_API = "/api/v1/teacher-workspace";

export type TermView = { id: string; name: string; session: string; startsOn: string; endsOn: string; weeks: number; current: number | null; phase: "before" | "during" | "after"; isCurrent: boolean; number: number | null };
export type Resource = { kind: string; label: string };
export type WeekKind = "teach" | "rev" | "free" | "pre";

export type SchemeWeek = {
  week: number; dates: string; short: boolean; kind: WeekKind; topic: string; subtopics: string[]; covered: number[]; status: string; auto: string; override: string | null;
  assessment: string | null; periods: number | null; resources: Resource[]; evidence: boolean;
  note: { state: string; done: number; of: number }; locked: boolean;
};

export type SubjectCard = {
  subjectId: string; subject: string; arms: string[]; earlyYears: boolean; readOnly: boolean; custom: boolean;
  per: number | null; lessonMinutes: number; source: string | null; planned: number; weeks: number; taught: number; teachTotal: number; signed: number; toWrite: number; expected: number;
  status: string; awaitingTimetable: boolean; schemeStatus: string;
};

export type Overview = { persona: string; term: TermView; nextTerm: TermView | null; canAdd: boolean; coverOf: boolean; subjects: SubjectCard[] };

export type SchemeData = {
  subjectId: string; subject: string; arms: string[]; earlyYears: boolean; readOnly: boolean; owner: string | null; custom: boolean;
  per: number; lessonMinutes: number; curriculum: string | null; source: string | null; book: string | null;
  term: TermView; terms: TermView[]; schemeStatus: string; returnReason: string | null; updatedAt: number; letterhead: Letterhead; focus: number;
  weeks: SchemeWeek[]; periods: Array<{ arm: string; periods: Array<{ day: string; period: number; time: string; done: boolean }> }>;
  statuses: Array<[string, string]>; assessments: string[]; resourceKinds: string[];
  catalogue: Array<{ id: string; curriculum: string; stage: string; source: string | null; topics: number; own: boolean }>;
};

export type DraftWeek = {
  from: number | null; kind: "teach" | "rev" | "free"; topic: string; subtopics: string[]; covered: number[]; assessment: string | null; periods: number | null; resources: Resource[]; status: string | null;
};

export type Letterhead = { name: string; place?: string; contact?: string };
export type Section = { key: string; label: string; hint: string; placeholder: string; required: boolean; assist?: string; kind?: "week-grid" };
export const GRID_SUFFIX = "__grid";
export type ThreadEntry = { id: string; kind: string; author: string; section: string | null; body: string; at: string };

export type NoteData = {
  subjectId: string; subject: string; arms: string[]; earlyYears: boolean; readOnly: boolean; week: number; dates: string; weeks: number; term: TermView;
  topic: string; subtopics: Array<{ name: string; covered: boolean }>; schemeStatus: string; assessment: string | null; periods: number | null; resources: Resource[];
  taughtTo: Array<{ arm: string; covered: number; of: number; taught: boolean }>;
  sections: Section[]; text: Record<string, string>; planId: string | null; state: string; version: number; thread: ThreadEntry[];
  returned: { note: string; section: string | null; at: string | null } | null; resubmitReply: string | null; signedBy: string | null; signedAt: string | null; submittedAt: string | null; updatedAt: string | null;
  signer: { name: string } | null; reuse: { term: string; session: string; sections: Record<string, string> } | null; draft: Record<string, string>; letterhead: Letterhead;
  previous: { week: number; topic: string } | null; next: { week: number; topic: string } | null; person: string;
};

export type SubjectNotesData = {
  subjectId: string; subject: string; arms: string[]; readOnly: boolean; earlyYears: boolean; term: TermView; terms: TermView[]; focus: number; signer: { name: string } | null; sections: number; letterhead: Letterhead;
  weeks: Array<{ week: number; dates: string; short: boolean; topic: string; kind: string; status: string; subtopics: number; covered: number; state: string; done: number; of: number; planId: string | null; version: number; returnedSection: string | null; reviewNote: string | null; at: string | null; current: boolean }>;
};

export type AddOptions = {
  term: TermView; nextTerm: TermView | null; weeks: number;
  held: Array<{ subjectId: string; subject: string; classIds: string[]; arms: string[] }>;
  subjects: Array<{ id: string; name: string; periodsPerWeek: number; levels: string[]; section: string }>;
  levels: Array<{ id: string; name: string; arms: Array<{ id: string; name: string }> }>;
  catalogue: Array<{ id: string; curriculum: string; subject: string; stage: string; term: number; source: string | null; topics: number }>;
  curricula: string[]; assessments: string[]; defaultLesson: number;
};

export const emptyDraft = (): DraftWeek => ({ from: null, kind: "free", topic: "", subtopics: [], covered: [], assessment: null, periods: null, resources: [], status: null });

export const stateTone = (state: string) =>
  state === "Approved" ? "positive" : state === "Submitted" ? "submitted" : state === "Returned" ? "negative" : state === "Draft" ? "progress" : "neutral";
export const stateLabel = (state: string) => (state === "Approved" ? "Signed" : state === "Submitted" ? "With the reviewer" : state);
