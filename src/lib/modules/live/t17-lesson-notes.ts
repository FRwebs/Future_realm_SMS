import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { LN_API, type AddOptions, type Letterhead, type NoteData, type Overview, type SchemeData, type Section, type SubjectNotesData, type ThreadEntry } from "@/lib/modules/lesson-notes-types";
import type { DrawerSpec, PanelRow, PanelTone, TabContent, TableCellKind, TableRow, TrackerRow } from "@/lib/modules/panels";
import { bar, pill, row, text as cell } from "@/lib/modules/panels";

/**
 * M17 for a teaching person: Lesson Notes. The scheme of work comes first — a term's weeks, each a topic — and a note is written once
 * per topic. A note is the teacher's, and is signed by their head of department (a head of department's own by the academic lead);
 * whoever signs it never edits it. Every page here is drawn fully with nothing behind it: an empty term reads as an invitation, not a fault.
 */

export const API = LN_API;
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const PEN = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";
const SEND = "M4.5 12.5 19.5 5l-4 15-4.2-5.3z";

type Page = TabContent & { crumb: { label: string; href: string } };
type Q = Record<string, string | undefined>;

/* ───────────────────────── loaders ───────────────────────── */

const withTerm = (termId?: string) => (termId ? `?termId=${encodeURIComponent(termId)}` : "");
export const loadAddOptions = () => apiGet<AddOptions>(`${API}/curriculum/add/options`);
export const loadSubjectNotes = (subjectId: string, termId?: string) => apiGet<SubjectNotesData>(`${API}/notes/subject/${subjectId}${withTerm(termId)}`);
export const loadNote = (subjectId: string, week: string, termId?: string) => apiGet<NoteData>(`${API}/notes/${subjectId}/${week}${withTerm(termId)}`);
export const loadHistory = (subjectId: string) => apiGet<History>(`${API}/notes/history/${subjectId}`);
export const loadHistoryNote = (subjectId: string, planId: string) => apiGet<HistoryNote>(`${API}/notes/history/${subjectId}/${planId}`);
export const loadReviewNote = (planId: string) => apiGet<ReviewNote>(`${API}/notes/review/${planId}`);

type Landing = {
  persona: string; term: { id: string; name: string; session: string; current: number | null; weeks: number; phase: string }; terms: Array<{ id: string; name: string }>; signer: { name: string } | null;
  kpis: { toWrite: number; drafts: number; withReviewer: number; signed: number; returned: number };
  rework: Array<{ planId: string; subjectId: string; subject: string; arms: string[]; week: number; topic: string; section: string | null; note: string; at: string }>;
  subjects: Array<{ subjectId: string; subject: string; arms: string[]; readOnly: boolean; earlyYears: boolean; planned: number; due: number; notStarted: number; drafts: number; submitted: number; signed: number; returned: number; thisWeek?: { week: number; topic: string; state: string } | null; next: number | null; state: string }>;
  history: Array<{ subjectId: string; subject: string; terms: Array<{ termId: string; term: string; session: string; signed: number }> }>;
};
type History = { subjectId: string; subject: string; terms: Array<{ termId: string; term: string; session: string; notes: Array<{ planId: string; week: number; topic: string; signedAt: string | null; signedBy: string | null; version: number }> }> };
type HistoryNote = { letterhead: Letterhead; id: string; subjectId: string; subject: string; topic: string; week: number; arms: string[]; term: string; session: string; version: number; sections: Section[]; text: Record<string, string>; signedBy: string | null; signedAt: string | null; thread: ThreadEntry[] };
export type ReviewNote = { letterhead: Letterhead; id: string; subject: string; topic: string; week: number; term: string; version: number; arms: string[]; teacher: string; state: string; sections: Section[]; text: Record<string, string>; own: boolean; canSign: boolean; resubmitReply: string | null; thread: ThreadEntry[] };
type Review = {
  scope: "school" | "department"; term: { name: string; session: string; current: number | null; phase: string };
  kpis: { notStarted: number; inProgress: number; submitted: number; signed: number; returned: number; signable: number };
  rows: Array<{ id: string; planId: string | null; teacher: string; subject: string; arms: string[]; week: number; topic: string; state: string; own: boolean; canSign: boolean; routedTo: string | null; age: number; at: string | null; resubmitted: boolean }>;
};
type Coverage = {
  scope: "school" | "department"; term: { name: string; session: string; current: number | null; phase: string };
  rows: Array<{ subject: string; arm: string; teacher: string; planned: number; expected: number; reached: number; state: string }>;
  kpis: { onSchedule: number; behind: number; none: number; covered: number | null; total: number };
};
type CatalogueRow = { id: string; curriculum: string; subject: string; stage: string; term: number; source: string | null; book: string | null; topics: number; own: boolean };

const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : "—");
const embed = (component: string, props: Record<string, unknown>): PanelRow => row("1fr", [{ type: "embed", component, props }]);
const noTerm = (title: string): TabContent => ({ title, desc: "There is no current term, so nothing can be planned or written.", rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "No term is current", body: "Lesson notes follow the school’s term. When the school office sets the current term in School Configuration, this page fills in." }])] });

/* ───────────────────────── the tabs ───────────────────────── */

export async function teacherLessonNotesTab(tabSlug: string, me: TeacherWorkspaceView | undefined, query: Q = {}): Promise<TabContent | null | undefined> {
  try {
    if (tabSlug === "curriculum" && me) return await curriculumTab(query);
    if (tabSlug === "notes" && me) return notesTab(await apiGet<Landing>(`${API}/notes${withTerm(query.term)}`), query);
  } catch (error) {
    if (error instanceof Error && /No term is current/i.test(error.message)) return noTerm(tabSlug === "notes" ? "Notes" : "Curriculum");
    throw error;
  }
  if (tabSlug === "review") return reviewTab(await apiGet<Review>(`${API}/notes/review`));
  if (tabSlug === "coverage") {
    const [coverage, catalogue] = await Promise.all([apiGet<Coverage>(`${API}/notes/coverage`), apiGet<CatalogueRow[]>("/api/v1/curriculum-catalogue").catch(() => [] as CatalogueRow[])]);
    const content = coverageTab(coverage);
    return { ...content, launchers: [...(content.launchers ?? []), { label: "Import a curriculum from Excel", href: "/lesson-notes/coverage/import" }], rows: [...content.rows, catalogueRow(catalogue)] };
  }
  return undefined;
}

/* ───────────────────────── Curriculum ───────────────────────── */

async function curriculumTab(query: Q): Promise<TabContent> {
  const overview = await apiGet<Overview>(`${API}/curriculum`);
  const chosen = overview.subjects.find((entry) => entry.subjectId === query.subject) ?? overview.subjects[0];
  const scheme = chosen ? await apiGet<SchemeData>(`${API}/curriculum/${chosen.subjectId}${withTerm(query.term)}`) : null;
  const week = Number(query.week);
  return {
    title: "Curriculum",
    desc: scheme
      ? `${scheme.term.name}, ${scheme.term.session}. Plan the term once, then teach from it every week.`
      : `${overview.term.name}, ${overview.term.session}. One scheme of work for each subject you teach.`,
    primary: overview.canAdd ? { label: "Add a subject", href: "/lesson-notes/curriculum/add" } : undefined,
    rows: [embed("scheme-workspace", { overview, scheme, initialWeek: Number.isFinite(week) && week > 0 ? week : undefined })],
  };
}

export async function addSubjectPage(): Promise<Page> {
  const options = await loadAddOptions();
  return {
    crumb: { label: "Back to Curriculum", href: "/lesson-notes/curriculum" },
    title: "Add a subject", desc: "Plan a subject the school has not given you. The school office is told, so it can go on the timetable.",
    rows: [embed("add-subject", { options })],
  };
}

/* ───────────────────────── Notes ───────────────────────── */

function notesTab(v: Landing, query: Q): TabContent {
  if (!v.subjects.length && !v.history.length) {
    return {
      title: "Notes", desc: `${v.term.name}, ${v.term.session}. One note for every planned week, signed before you teach it.`,
      rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You have no subject to write notes for yet", body: "A note is written against a week of a scheme of work. When the school names you on a subject — or you add one yourself in Curriculum — its weeks appear here, ready to write." }])],
      primary: { label: "Open Curriculum", href: "/lesson-notes/curriculum" },
    };
  }
  const k = v.kpis;
  const totalPlanned = v.subjects.reduce((sum, entry) => sum + entry.planned, 0);
  const totalWritten = v.subjects.reduce((sum, entry) => sum + entry.drafts + entry.submitted + entry.signed + entry.returned, 0);
  const rework: TableRow[] = v.rework.map((entry) => ({
    keywords: `${entry.subject} ${entry.topic}`, href: `/lesson-notes/notes/${entry.subjectId}/${entry.week}?term=${v.term.id}`,
    cells: [
      { kind: "name", name: entry.topic, sub: `${entry.subject} · ${entry.arms.join(", ")} · week ${entry.week}`, avatar: false },
      cell(entry.note || "No comment left", { tone: "negative" }), cell(stamp(entry.at)),
      { kind: "action", label: "Rework it", href: `/lesson-notes/notes/${entry.subjectId}/${entry.week}?term=${v.term.id}` },
    ] as TableCellKind[],
  }));
  const subjects: TableRow[] = v.subjects.map((entry) => {
    // What this subject still wants from the teacher, said once rather than spread
    // across four count columns they would have to add up themselves.
    const needs = [
      entry.returned ? `${entry.returned} returned` : "",
      entry.notStarted ? `${entry.notStarted} not written` : "",
      entry.drafts ? `${entry.drafts} ${entry.drafts === 1 ? "draft" : "drafts"}` : "",
      entry.submitted ? `${entry.submitted} with the reviewer` : "",
    ].filter(Boolean).join(" · ") || "Nothing";
    // Every planned week whose note has been started. Derived rather than sent, so the
    // count can never disagree with the four state counts beside it.
    const written = entry.drafts + entry.submitted + entry.signed + entry.returned;
    const week = entry.thisWeek ?? null;
    return {
      keywords: `${entry.subject} ${entry.arms.join(" ")} ${entry.state} ${week?.topic ?? ""}`, href: `/lesson-notes/notes/${entry.subjectId}?term=${v.term.id}`,
      cells: [
        { kind: "name", name: entry.subject, sub: entry.arms.join(", "), avatar: false },
        cell(entry.arms.join(", ")),
        week
          ? { kind: "name", name: week.topic || `Week ${week.week}`, sub: `Week ${week.week} · ${week.state === "Not started" ? "not written" : week.state === "Approved" ? "signed" : week.state.toLowerCase()}`, avatar: false } as TableCellKind
          : cell(v.term.current ? "Nothing this week" : "The term is not running", { tone: "neutral" }),
        entry.planned
          ? bar(Math.round((written / entry.planned) * 100), `${written}/${entry.planned}`, written === entry.planned ? "positive" : "progress")
          : cell("—"),
        cell(entry.planned ? `${entry.signed} of ${entry.planned}` : "—", { mono: true }),
        cell(needs),
        pill(entry.state, entry.state === "Returned" ? "negative" : entry.state === "Behind" ? "attention" : entry.state === "Draft open" ? "progress" : entry.state === "On track" ? "positive" : "neutral"),
        { kind: "action", label: entry.readOnly ? "Read" : "Open", href: `/lesson-notes/notes/${entry.subjectId}?term=${v.term.id}` },
      ] as TableCellKind[],
    };
  });
  const history: TableRow[] = v.history.flatMap((entry) => entry.terms.map((t) => ({
    keywords: `${entry.subject} ${t.term}`, href: `/lesson-notes/notes/history/${entry.subjectId}`,
    cells: [{ kind: "name", name: entry.subject, sub: `${t.term}${t.session ? `, ${t.session}` : ""}`, avatar: false }, cell(`${t.signed} signed note${t.signed === 1 ? "" : "s"}`, { mono: true }), { kind: "action", label: "Read them", href: `/lesson-notes/notes/history/${entry.subjectId}` }] as TableCellKind[],
  })));
  const other = v.terms.filter((t) => t.id !== v.term.id);
  const next = v.subjects.find((entry) => entry.next && !entry.readOnly);
  return {
    title: "Notes", desc: `${v.term.name}, ${v.term.session}${v.term.current ? ` · week ${v.term.current} of ${v.term.weeks}` : ""}. ${v.signer ? `${v.signer.name} signs your notes.` : "No one is named to sign your notes yet."}`,
    primary: next ? { label: `Write week ${next.next}`, icon: PEN, href: `/lesson-notes/notes/${next.subjectId}/${next.next}?term=${v.term.id}` } : undefined,
    launchers: other.map((t) => ({ label: `Notes for ${t.name}`, href: `/lesson-notes/notes?term=${t.id}` })),
    rows: [
      row("1fr", [{
        type: "kpi", per: 5, sub: query.term ? undefined : "Counted from your own notes — nothing here is typed in twice.",
        cards: [
          { label: "Subjects", value: String(v.subjects.length), sub: v.subjects.map((entry) => entry.subject).join(" · ") || "None yet" },
          { label: "Notes written", value: String(totalWritten), unit: `of ${totalPlanned}`, sub: k.toWrite ? `${k.toWrite} not written for weeks already reached` : "Up to date for every week reached", tone: k.toWrite ? "attention" : "positive" },
          { label: "Signed this term", value: String(k.signed), unit: `of ${totalPlanned}`, sub: v.signer ? `By ${v.signer.name}` : "No one is named to sign them yet", tone: "positive" },
          { label: "With the reviewer", value: String(k.withReviewer), sub: k.withReviewer ? "Waiting to be signed" : "Nothing waiting", tone: k.withReviewer ? "submitted" : "neutral" },
          { label: "Returned for rework", value: String(k.returned), sub: k.returned ? `${v.rework[0]?.topic ?? "A note"} · read the comment` : "Nothing sent back", tone: k.returned ? "negative" : "positive" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Sent back for rework", sub: "A reviewer returned these with what to change. Open one, change it, and say what you changed.", meta: `${v.rework.length} returned`, noun: "note", nounPlural: "notes",
        head: ["Note", "What to change", "Returned", ""], rows: rework, noRowOpen: false, empty: "Nothing has been sent back.",
        emptyTitle: "Nothing has been sent back", emptyBody: "When a reviewer returns a note, it lands here with their comment beside the section to change.",
      }]),
      row("1fr", [{
        type: "table", title: "Every note this term", sub: "One row per subject. Open one to see its topics week by week, and write the note for any of them.",
        meta: `${v.subjects.length} subject${v.subjects.length === 1 ? "" : "s"} · ${totalPlanned} note${totalPlanned === 1 ? "" : "s"} · ${v.term.name}`, noun: "subject", nounPlural: "subjects",
        search: "Find a subject, a class or this week’s topic",
        filters: [{ label: "State", value: "All", options: ["All", "Returned", "Behind", "Draft open", "On track"] }],
        head: ["Subject", "Classes", "This week", "Written", "Signed", "Needs you", "State", ""], rows: subjects, empty: "You are not named on a subject.",
        emptyTitle: "No subjects to write for", emptyBody: "Your subjects come from the school admin, or from Add a subject in Curriculum.",
      }]),
      row("1fr", [{
        type: "table", title: "Note history", sub: "Signed notes from earlier terms stay here to teach from again.", meta: `${history.length} term${history.length === 1 ? "" : "s"}`, noun: "term", nounPlural: "terms",
        head: ["Subject and term", "Signed notes", ""], rows: history, empty: "No signed note from an earlier term yet.",
        emptyTitle: "Nothing from earlier terms yet", emptyBody: "Once a note is signed and the term has passed, it is kept here. When the topic comes round again you can start from it.",
      }]),
    ],
  };
}

export async function subjectNotesPage(subjectId: string, termId?: string): Promise<Page> {
  const data = await loadSubjectNotes(subjectId, termId);
  return {
    crumb: { label: "Back to Notes", href: "/lesson-notes/notes" },
    title: `${data.subject} · notes`, desc: `${data.arms.join(", ")} · ${data.term.name}, ${data.term.session}.`,
    launchers: data.readOnly ? [] : [{ label: "Open the scheme", href: `/lesson-notes/curriculum?subject=${data.subjectId}&term=${data.term.id}` }, { label: "Note history", href: `/lesson-notes/notes/history/${data.subjectId}` }],
    rows: [embed("subject-notes", { data })],
  };
}

export async function notePage(subjectId: string, week: string, termId?: string): Promise<Page> {
  const data = await loadNote(subjectId, week, termId);
  return {
    crumb: { label: `Back to ${data.subject} notes`, href: `/lesson-notes/notes/${data.subjectId}?term=${data.term.id}` },
    title: data.earlyYears ? `${data.subject} · week ${data.week} plan` : `${data.subject} · week ${data.week}`, desc: `${data.topic} · ${data.arms.join(", ")} · ${data.term.name}, ${data.term.session}.`,
    rows: [embed("note-document", { data })],
  };
}

export async function historyPage(subjectId: string): Promise<Page> {
  const data = await loadHistory(subjectId);
  const tables = data.terms.map((term): PanelRow => {
    const rows: TableRow[] = term.notes.map((note) => ({
      keywords: note.topic, href: `/lesson-notes/notes/history/${subjectId}/${note.planId}`,
      cells: [cell(`Week ${note.week}`, { mono: true, strong: true }), { kind: "name", name: note.topic, sub: note.version > 1 ? `Version ${note.version}` : undefined, avatar: false }, cell(note.signedBy ?? "—"), cell(stamp(note.signedAt)), { kind: "action", label: "Read", href: `/lesson-notes/notes/history/${subjectId}/${note.planId}` }] as TableCellKind[],
    }));
    return row("1fr", [{ type: "table", title: `${term.term}${term.session ? `, ${term.session}` : ""}`, sub: "Signed notes — read-only.", meta: `${rows.length} signed`, noun: "note", nounPlural: "notes", head: ["Week", "Topic", "Signed by", "Signed", ""], rows, empty: "None." }]);
  });
  return {
    crumb: { label: "Back to Notes", href: "/lesson-notes/notes" },
    title: `${data.subject} · note history`, desc: "Every note of yours that was signed, term by term. Read one to teach from it again.",
    rows: tables.length ? tables : [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: `No signed ${data.subject} note yet`, body: "Once a note is signed it is kept here, term by term, so you can start from it when the topic comes round again." }])],
  };
}

export async function historyNotePage(subjectId: string, planId: string): Promise<Page> {
  const note = await loadHistoryNote(subjectId, planId);
  return {
    crumb: { label: `Back to ${note.subject} history`, href: `/lesson-notes/notes/history/${subjectId}` },
    title: `${note.topic} · week ${note.week}`, desc: `${note.subject} · ${note.arms.join(", ")} · ${note.term}${note.session ? `, ${note.session}` : ""}.`,
    rows: [embed("note-reader", { data: { id: note.id, subject: note.subject, topic: note.topic, week: note.week, term: note.term, version: note.version, arms: note.arms, signedBy: note.signedBy, signedAt: note.signedAt, state: "Approved", sections: note.sections, text: note.text, thread: note.thread, letterhead: note.letterhead, back: { label: "History", href: `/lesson-notes/notes/history/${subjectId}` } } })],
  };
}

/* ───────────────────────── Review ───────────────────────── */

function reviewTab(v: Review): TabContent {
  const k = v.kpis;
  const trackerRows: TrackerRow[] = v.rows.map((entry) => ({
    unit: entry.topic, sub: `${entry.subject} · ${entry.arms.join(", ") || "no arm named"} · week ${entry.week}${entry.resubmitted ? " · resubmitted" : ""}`,
    owner: entry.teacher, role: entry.routedTo ? `Goes to ${entry.routedTo}` : "Teacher", state: entry.state === "Approved" ? "Signed" : entry.state === "Submitted" ? "With the reviewer" : entry.state,
    age: entry.state === "Submitted" ? (entry.age === 0 ? "Today" : `${entry.age} day${entry.age === 1 ? "" : "s"}`) : entry.at ? stamp(entry.at) : "—", overdue: entry.state === "Submitted" && entry.age >= 3,
    href: entry.planId ? `/lesson-notes/review/${entry.planId}` : undefined, act: entry.canSign ? "Read and sign" : entry.planId ? "Read" : undefined,
  }));
  const order = ["Returned", "With the reviewer", "Draft", "Not started", "Signed"];
  const by = (sort: (a: TrackerRow, b: TrackerRow) => number) => [...trackerRows].sort(sort);
  const waiting = v.rows.filter((entry) => entry.canSign);
  const signAll: DrawerSpec = {
    mode: "commit", kicker: "Review", title: `Sign the ${waiting.length} waiting`, sub: "Each is signed on its own, and each teacher is told. You cannot sign your own.",
    facts: waiting.slice(0, 6).map((entry): [string, string, string] => [entry.teacher, entry.topic, `${entry.subject} · week ${entry.week}`]),
    commitLabel: `Sign ${waiting.length}`, commitDone: "Signed", commitDoneBody: "The teachers are told. Open any to see the signature in its thread.",
    submit: { endpoint: `${API}/notes/review/sign`, method: "POST", body: { planIds: waiting.map((entry) => entry.planId) } },
  };
  return {
    title: "Review", desc: `${v.scope === "school" ? "Every department’s" : "Your department’s"} notes, ${v.term.name}${v.term.current ? ` · week ${v.term.current}` : ""}. You never sign your own.`,
    primary: waiting.length ? { label: `Sign the ${waiting.length} waiting`, icon: SEND, drawer: signAll } : undefined,
    rows: [
      row("1fr", [{
        type: "kpi", per: 5, sub: "One row below for every subject, arm and week a note is due — started or not.",
        cards: [
          { label: "Not started", value: String(k.notStarted), sub: "Due, with no note", tone: k.notStarted ? "attention" : "positive" },
          { label: "In progress", value: String(k.inProgress), sub: "Drafts", tone: "progress" },
          { label: "Waiting for a signature", value: String(k.submitted), sub: k.submitted ? "Oldest first in the list" : "Nothing is waiting", tone: k.submitted ? "submitted" : "positive" },
          { label: "Returned", value: String(k.returned), sub: "With the teacher to change", tone: k.returned ? "negative" : "neutral" },
          { label: "Signed", value: String(k.signed), sub: "Ready to teach from", tone: "positive" },
        ],
      }]),
      row("1fr", [{
        type: "tracker", title: "Notes due", sub: "Open a note to read all its sections, then sign it or return it with what to change.", noun: "notes signed",
        groups: ["By state", "By teacher", "By subject", "By age"],
        rows: by((a, b) => order.indexOf(a.state) - order.indexOf(b.state)),
        groupRows: {
          "By state": by((a, b) => order.indexOf(a.state) - order.indexOf(b.state)),
          "By teacher": by((a, b) => a.owner.localeCompare(b.owner)),
          "By subject": by((a, b) => (a.sub ?? "").localeCompare(b.sub ?? "")),
          "By age": by((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || parseInt(b.age) - parseInt(a.age) || 0),
        },
        clear: { title: "No note is due yet", body: "Notes appear here once a scheme of work has weeks that have come round. Nothing has been planned for the term so far." },
      }]),
    ],
  };
}

export async function reviewNotePage(planId: string, from?: string): Promise<Page> {
  const note = await loadReviewNote(planId);
  return {
    crumb: from === "class-timetable" ? { label: "Back to Lesson notes", href: "/class-timetable/lesson-notes" } : { label: "Back to Review", href: "/lesson-notes/review" },
    title: `${note.topic} · week ${note.week}`, desc: `${note.subject} · ${note.arms.join(", ")} · written by ${note.teacher}.`,
    rows: [embed("note-reader", { data: { id: note.id, subject: note.subject, topic: note.topic, week: note.week, term: note.term, version: note.version, arms: note.arms, teacher: note.teacher, state: note.state, sections: note.sections, text: note.text, thread: note.thread, letterhead: note.letterhead, review: { own: note.own, canSign: note.canSign, resubmitReply: note.resubmitReply }, back: { label: "Review", href: "/lesson-notes/review" } } })],
  };
}

/* ───────────────────────── Coverage ───────────────────────── */

/** The outlines a teacher can start a scheme from: the platform's, and the school's own. */
function catalogueRow(entries: CatalogueRow[]): PanelRow {
  const remove = (entry: CatalogueRow): DrawerSpec => ({
    mode: "commit", kicker: "Curriculum catalogue", title: `Remove ${entry.subject} · ${entry.stage}`, sub: "Schemes already started from it are not changed.", facts: [["Outline", `${entry.curriculum} · ${entry.subject} · ${entry.stage}`, `Term ${entry.term} · ${entry.topics} topics`]],
    commitLabel: "Remove it", commitDone: "Outline removed", commitDoneBody: "Teachers can no longer start from it.", submit: { endpoint: `/api/v1/curriculum-catalogue/${entry.id}`, method: "DELETE" },
  });
  const rows: TableRow[] = entries.map((entry) => ({
    keywords: `${entry.curriculum} ${entry.subject} ${entry.stage}`,
    cells: [{ kind: "name", name: entry.subject, sub: `${entry.curriculum} · ${entry.stage} · term ${entry.term}`, avatar: false }, cell(String(entry.topics), { mono: true }), cell(entry.source ?? "—"), pill(entry.own ? "Your school’s" : "Platform", entry.own ? "progress" : "neutral"), entry.own ? { kind: "action", label: "Remove", drawer: remove(entry) } : cell("")] as TableCellKind[],
  }));
  return row("1fr", [{
    type: "table", title: "Curriculum catalogue", sub: "The outlines a teacher can start a scheme of work from. The platform’s are loaded for every school; load your own from Excel.", meta: `${entries.length} outline${entries.length === 1 ? "" : "s"}`, noun: "outline", nounPlural: "outlines",
    head: ["Subject", "Topics", "Source", "From", ""], rows, per: 8, search: "Find an outline", noRowOpen: true, empty: "No outline has been loaded.",
    emptyTitle: "No outline has been loaded", emptyBody: "Load the national or your own curriculum from Excel, and teachers can start a scheme from it instead of a blank page.",
  }]);
}

function coverageTab(v: Coverage): TabContent {
  const k = v.kpis;
  const tone = (state: string): PanelTone => (state === "On schedule" ? "positive" : state === "Behind" ? "negative" : "neutral");
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.subject} ${entry.arm} ${entry.teacher} ${entry.state}`,
    cells: [
      { kind: "name", name: entry.subject, sub: entry.arm, avatar: false }, cell(entry.teacher),
      cell(entry.planned ? String(entry.planned) : "—", { mono: true }), cell(entry.expected ? String(entry.expected) : "—", { mono: true }), cell(entry.expected ? String(Math.min(entry.reached, entry.expected)) : "—", { mono: true }),
      pill(entry.state, tone(entry.state)),
    ] as TableCellKind[],
  }));
  const bars = v.rows.filter((entry) => entry.expected > 0).sort((a, b) => Math.min(a.reached, a.expected) / a.expected - Math.min(b.reached, b.expected) / b.expected).slice(0, 12).map((entry) => {
    const pct = Math.round((Math.min(entry.reached, entry.expected) / entry.expected) * 100);
    return { label: `${entry.subject} · ${entry.arm}`, value: pct, display: `${Math.min(entry.reached, entry.expected)} of ${entry.expected}`, sub: entry.teacher, tone: tone(entry.state) };
  });
  return {
    title: "Coverage", desc: `${v.scope === "school" ? "Every" : "Your department’s"} subject, against the scheme — ${v.term.name}${v.term.current ? ` · week ${v.term.current}` : v.term.phase === "after" ? " · the term has ended" : ""}.`,
    launchers: [{ label: "Export the audit (CSV)", href: `${API}/notes/coverage/export` }],
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Expected is the weeks of each scheme due by now; reached is what the teacher has ticked off or marked taught — the calendar’s guess does not count.", per: 4,
        cards: [
          { label: "Covered", value: k.covered === null ? "—" : `${k.covered}%`, sub: k.covered === null ? "Nothing is due yet" : "Of what was due", tone: k.covered !== null && k.covered < 80 ? "attention" : "positive" },
          { label: "On schedule", value: String(k.onSchedule), unit: `of ${k.total}`, tone: "positive", sub: "Subject-arms" },
          { label: "Behind", value: String(k.behind), sub: k.behind ? "Reached less than was due" : "Nobody is behind", tone: k.behind ? "negative" : "positive" },
          { label: "No scheme on file", value: String(k.none), sub: k.none ? "Nothing to measure against" : "Every subject has one", tone: k.none ? "attention" : "positive" },
        ],
      }]),
      row("1.4fr 1fr", [
        {
          type: "table", title: "Coverage by subject and arm", sub: "Expected against reached, for every subject in your scope.", meta: `${v.rows.length} subject-arm${v.rows.length === 1 ? "" : "s"}`, noun: "subject", nounPlural: "subjects", search: "Find a subject or a teacher",
          filters: [{ label: "State", value: "All", options: ["All", "On schedule", "Behind", "No scheme on file"], column: 5 }],
          head: ["Subject", "Teacher", "Planned", "Expected", "Reached", "State"], rows, per: 12, noRowOpen: true, acts: [{ label: "Export these rows", export: true }],
          empty: "No class-subject is set up yet.", emptyTitle: "Nothing to measure yet", emptyBody: "Coverage is counted from each subject’s scheme of work. When class subjects are mapped and schemes planned, they appear here.",
        },
        { type: "bars", title: "Furthest behind first", sub: "Share of the weeks due that have been reached.", rows: bars, foot: bars.length ? "Only subjects with weeks due are shown." : "Nothing is due yet, so there is nothing to compare." },
      ]),
    ],
  };
}
