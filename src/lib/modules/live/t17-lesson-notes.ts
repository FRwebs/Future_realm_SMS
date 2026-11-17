import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { LN_API, type AddOptions, type Letterhead, type NoteData, type Overview, type SchemeData, type Section, type SubjectNotesData, type ThreadEntry } from "@/lib/modules/lesson-notes-types";
import type { DrawerSpec, Panel, PanelRow, PanelTone, TabContent, TableCellKind, TableRow, TrackerRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";
import { formatDay } from "@/lib/date-format";

/**
 * M17 for a teaching person: Lesson Notes. The scheme of work comes first — a term's weeks, each a topic — and a note is written once
 * per topic. A note is the teacher's, and is signed by their head of department (a head of department's own by the academic lead);
 * whoever signs it never edits it. Every page here is drawn fully with nothing behind it: an empty term reads as an invitation, not a fault.
 */

export const API = LN_API;
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const PEN = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";
const NOTE = "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5";
const SEND = "M4.5 12.5 19.5 5l-4 15-4.2-5.3z";

type Page = TabContent & { crumb: { label: string; href: string } };
type Q = Record<string, string | undefined>;

/* ───────────────────────── loaders ───────────────────────── */

const withTerm = (termId?: string) => (termId ? `?termId=${encodeURIComponent(termId)}` : "");
export const loadAddOptions = () => apiGet(`${API}/curriculum/add/options`, observe<AddOptions>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#90a4903f"]));
export const loadSubjectNotes = (subjectId: string, termId?: string) => apiGet(`${API}/notes/subject/${subjectId}${withTerm(termId)}`, observe<SubjectNotesData>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#a74f686b"]));
export const loadNote = (subjectId: string, week: string, termId?: string) => apiGet(`${API}/notes/${subjectId}/${week}${withTerm(termId)}`, observe<NoteData>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#82ea12b6"]));
export const loadHistory = (subjectId: string) => apiGet(`${API}/notes/history/${subjectId}`, observe<History>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#90ccd649"]));
export const loadHistoryNote = (subjectId: string, planId: string) => apiGet(`${API}/notes/history/${subjectId}/${planId}`, observe<HistoryNote>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#9ce7df73"]));
export const loadReviewNote = (planId: string) => apiGet(`${API}/notes/review/${planId}`, observe<ReviewNote>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#ad26c4fc"]));

type Landing = {
  persona: string; term: { id: string; name: string; session: string; current: number | null; weeks: number; phase: string }; terms: Array<{ id: string; name: string }>; signer: { name: string } | null;
  kpis: { toWrite: number; drafts: number; withReviewer: number; signed: number; returned: number };
  rework: Array<{ planId: string; subjectId: string; subject: string; arms: string[]; week: number; topic: string; section: string | null; note: string; at: string; by?: string | null; resubmitted?: boolean }>;
  subjects: Array<{ subjectId: string; subject: string; arms: string[]; readOnly: boolean; earlyYears: boolean; planned: number; due: number; notStarted: number; drafts: number; submitted: number; signed: number; returned: number; thisWeek?: { week: number; topic: string; state: string } | null; next: number | null; state: string }>;
  history: Array<{ subjectId: string; subject: string; arms?: string[]; terms: Array<{ termId: string; term: string; session: string; signed: number }> }>;
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

const DOWNLOAD_ICON = "M12 4v10.5M7.5 10.5 12 15l4.5-4.5M5 19.5h14";

const stamp = (iso: string | null) => (iso ? formatDay(new Date(iso), { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : "—");
const embed = (component: string, props: Record<string, unknown>): PanelRow => row("1fr", [{ type: "embed", component, props }]);
const noTerm = (title: string): TabContent => ({ title, desc: "There is no current term, so nothing can be planned or written.", rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "No term is current", body: "Lesson notes follow the school’s term. When the school office sets the current term in School Configuration, this page fills in." }])] });

/* ───────────────────────── the tabs ───────────────────────── */

export async function teacherLessonNotesTab(tabSlug: string, me: TeacherWorkspaceView | undefined, query: Q = {}): Promise<TabContent | null | undefined> {
  try {
    if (tabSlug === "curriculum" && me) return await curriculumTab(query);
    if (tabSlug === "notes" && me) return notesTab(await apiGet(`${API}/notes${withTerm(query.term)}`, observe<Landing>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#2be3622f"])));
  } catch (error) {
    if (error instanceof Error && /No term is current/i.test(error.message)) return noTerm(tabSlug === "notes" ? "Notes" : "Curriculum");
    throw error;
  }
  if (tabSlug === "review") return reviewTab(await apiGet(`${API}/notes/review`, observe<Review>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#e29a79fe"])));
  if (tabSlug === "coverage") {
    const [coverage, catalogue] = await Promise.all([apiGet(`${API}/notes/coverage`, observe<Coverage>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#80e13549"])), apiGet("/api/v1/curriculum-catalogue", observe<CatalogueRow[]>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#6cbb7076"])).catch(() => [] as CatalogueRow[])]);
    const content = coverageTab(coverage);
    return { ...content, launchers: [...(content.launchers ?? []), { label: "Import a curriculum from Excel", href: "/lesson-notes/coverage/import" }], rows: [...content.rows, catalogueRow(catalogue)] };
  }
  return undefined;
}

/* ───────────────────────── Curriculum ───────────────────────── */

async function curriculumTab(query: Q): Promise<TabContent> {
  const overview = await apiGet(`${API}/curriculum`, observe<Overview>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#0efc2e6b"]));
  const chosen = overview.subjects.find((entry) => entry.subjectId === query.subject) ?? overview.subjects[0];
  const scheme = chosen ? await apiGet(`${API}/curriculum/${chosen.subjectId}${withTerm(query.term)}`, observe<SchemeData>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#65671609"])) : null;
  const week = Number(query.week);
  const opened = Number.isFinite(week) && week > 0;
  const workspace = embed("scheme-workspace", { overview, scheme, initialWeek: opened ? week : undefined });
  // A week that has been opened is the editor on every screen. Until then the phone reads the scheme as a list: one row for each week.
  const phone = opened ? [] : phoneScheme(overview, scheme, chosen, Boolean(query.subject));
  const thisWeek = scheme && !scheme.readOnly && scheme.term.current ? scheme.weeks.find((entry) => entry.week === scheme.term.current && entry.kind !== "free" && entry.kind !== "pre") : undefined;
  // The mockup's Curriculum opens on this week's note, as Notes does, and its word follows where
  // that note stands. "Add a subject" is a launcher beside it, not the thing the page is for.
  const verb = !thisWeek ? "Write"
    : scheme?.readOnly ? "Read"
    : thisWeek.note.state === "Not started" ? "Write"
    : thisWeek.note.state === "Draft" ? "Finish"
    : thisWeek.note.state === "Returned" ? "Correct" : "Open";
  return {
    title: "Curriculum",
    desc: scheme?.readOnly
      ? "The scheme for the arms you cover. Read it to know where each class is, then teach from the note for the week."
      : "Every subject you teach, planned week by week. Change the plan here and your notes, coverage and the week ahead follow it.",
    phoneTitle: "Scheme of work",
    phoneDesc: scheme && (overview.subjects.length === 1 || query.subject)
      ? [scheme.curriculum, scheme.subject, scheme.per ? `${scheme.per} periods a week` : null, scheme.term.current ? `Week ${scheme.term.current} of ${scheme.term.weeks}` : null].filter(Boolean).join(" · ")
      : `${overview.term.name}, ${overview.term.session}. One scheme of work for each subject you teach.`,
    primary: thisWeek && scheme
      ? { label: `${verb} this week’s note`, icon: PEN, href: `/lesson-notes/notes/${scheme.subjectId}/${thisWeek.week}?term=${scheme.term.id}` }
      : overview.canAdd ? { label: "Add a subject", href: "/lesson-notes/curriculum/add" } : undefined,
    launchers: [
      { label: "Every note this term", href: `/lesson-notes/notes${scheme ? `?term=${scheme.term.id}` : ""}` },
      ...(overview.canAdd && thisWeek ? [{ label: "Add a subject", href: "/lesson-notes/curriculum/add" }] : []),
    ],
    phonePrimary: scheme && thisWeek ? { label: "This week’s note", icon: PEN, href: `/lesson-notes/notes/${scheme.subjectId}/${thisWeek.week}?term=${scheme.term.id}` } : undefined,
    rows: phone.length ? [...phone, { ...workspace, show: "desktop" as const }] : [workspace],
  };
}

const WEEK_TONE: Record<string, "positive" | "progress" | "attention" | "neutral" | "submitted"> = { Taught: "positive", "In progress": "progress", "Partly taught": "attention", Postponed: "attention", Planned: "neutral", Revision: "submitted", "Free week": "neutral", "Not planned": "neutral" };

/** The phone's scheme of work: the term's chips, two figures, then the weeks — or, for a teacher with several subjects, the subjects to choose from first. */
export function phoneScheme(overview: Overview, scheme: SchemeData | null, chosen: Overview["subjects"][number] | undefined, subjectNamed: boolean): PanelRow[] {
  if (!scheme || !chosen) return [{ ...row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "No subject on your scheme of work yet", body: "A scheme of work belongs to a subject you teach in an arm. When the school names you on one it appears here — or add a subject yourself." }]), show: "phone" as const }];
  const shown = (panel: Panel): PanelRow => ({ ...row("1fr", [panel]), show: "phone" as const });
  if (overview.subjects.length > 1 && !subjectNamed) {
    return [
      shown({ type: "kpi", bare: true, cards: [
        { label: "Your subjects", value: String(overview.subjects.length), },
        { label: "Topics taught", value: String(overview.subjects.reduce((sum, entry) => sum + entry.taught, 0)), unit: `of ${overview.subjects.reduce((sum, entry) => sum + entry.teachTotal, 0)}`, },
      ] }),
      shown({
        type: "list", title: "Choose a subject", tag: `${overview.subjects.length} subjects`, tagTone: "neutral", sub: "A scheme of work is one subject for one term. Open one to see its weeks.",
        items: overview.subjects.map((entry) => ({
          icon: NOTE, label: entry.subject, pill: entry.status, tone: entry.status === "Behind" ? ("attention" as const) : entry.status === "Not planned" || entry.status === "Read only" ? ("neutral" as const) : ("positive" as const),
          sub: `${entry.arms.join(", ")} · ${entry.planned ? `${entry.taught} of ${entry.teachTotal} topics taught` : "nothing planned yet"}`,
          href: `/lesson-notes/curriculum?subject=${entry.subjectId}&term=${scheme.term.id}`,
        })),
      }),
    ];
  }
  const term = scheme.term;
  const teach = scheme.weeks.filter((entry) => entry.kind === "teach" || entry.kind === "rev");
  const left = term.current ? scheme.weeks.filter((entry) => entry.kind !== "pre" && entry.week > term.current!).length : null;
  const weekHref = (entry: SchemeData["weeks"][number]) => `/lesson-notes/curriculum?subject=${scheme.subjectId}&term=${term.id}&week=${entry.week}`;
  return [
    ...(scheme.terms.length > 1 ? [shown({ type: "embed", component: "phone-chips", props: { chips: scheme.terms.map((entry) => ({ label: entry.name, on: entry.id === term.id, href: `/lesson-notes/curriculum?subject=${scheme.subjectId}&term=${entry.id}` })) } })] : []),
    shown({ type: "kpi", bare: true, cards: [
      { label: "Topics taught", value: String(chosen.taught), unit: `of ${chosen.teachTotal}`, tone: chosen.status === "Behind" ? "attention" : "positive" },
      { label: "Weeks left", value: left === null ? "—" : String(left), },
    ] }),
    shown({
      type: "list", title: `${scheme.subject} · ${term.name.toLowerCase()}`, sub: scheme.readOnly ? "You read this scheme; the subject’s teacher plans it." : "Tap a week to open its note, edit its topic, mark it covered, or push it on.",
      empty: "Nothing is planned for this term yet. Open the scheme on a larger screen, or add the subject from the standard curriculum.",
      items: teach.length || scheme.weeks.some((entry) => entry.kind === "free" && entry.topic)
        ? scheme.weeks.filter((entry) => entry.kind !== "pre" && (entry.kind !== "free" || entry.topic)).map((entry) => {
            const now = term.current === entry.week;
            return {
              lead: { value: `W${entry.week}`, tone: now ? ("progress" as const) : ("neutral" as const) },
              label: entry.topic || "Free week", sub: entry.subtopics.length ? entry.subtopics.join(" · ") : entry.dates,
              pill: now && !entry.status.startsWith("Taught") ? "This week" : entry.status, tone: now ? ("progress" as const) : (WEEK_TONE[entry.status] ?? ("neutral" as const)),
              side: entry.assessment ?? undefined, href: weekHref(entry),
            };
          })
        : [],
    }),
  ];
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

function notesTab(v: Landing): TabContent {
  if (!v.subjects.length && !v.history.length) {
    return {
      title: "Notes", desc: `${v.term.name}, ${v.term.session}. One note for every planned week, signed before you teach it.`,
      rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You have no subject to write notes for yet", body: "A note is written against a week of a scheme of work. When the school names you on a subject — or you add one yourself in Curriculum — its weeks appear here, ready to write." }])],
      primary: { label: "Open Curriculum", href: "/lesson-notes/curriculum" },
    };
  }
  const k = v.kpis;
  const other = v.terms.filter((t) => t.id !== v.term.id);
  const readOnly = v.subjects.length > 0 && v.subjects.every((entry) => entry.readOnly);
  // This week's note, preferring one that still wants work over one already signed.
  const thisWeek = v.subjects.find((entry) => entry.thisWeek && !entry.readOnly && ["Not started", "Draft", "Returned"].includes(entry.thisWeek.state))
    ?? v.subjects.find((entry) => entry.thisWeek) ?? null;
  const thisWeekVerb = !thisWeek ? "Write"
    : thisWeek.readOnly ? "Read"
    : thisWeek.thisWeek!.state === "Not started" ? "Write"
    : thisWeek.thisWeek!.state === "Draft" ? "Finish"
    : thisWeek.thisWeek!.state === "Returned" ? "Correct" : "Open";
  const next = v.subjects.find((entry) => entry.next && !entry.readOnly);
  // The phone's blocks, in the mockup's order: what this week asks for, what came back, two figures, and every subject with where it stands.
  const open = v.subjects.find((entry) => entry.thisWeek && !entry.readOnly && entry.thisWeek.state !== "Approved" && entry.thisWeek.state !== "Submitted") ?? v.subjects.find((entry) => entry.thisWeek) ?? null;
  const dueNow = v.subjects.filter((entry) => entry.thisWeek);
  const doneNow = dueNow.filter((entry) => entry.thisWeek!.state === "Approved" || entry.thisWeek!.state === "Submitted").length;
  const phoneRows: Array<PanelRow | null> = [
    open?.thisWeek
      ? {
          ...row("1fr", [{
            type: "embed", component: "phone-hero",
            props: {
              eyebrow: `This week · ${open.subject} · ${open.arms.join(" · ")}`, icon: PEN, title: open.thisWeek.topic || `Week ${open.thisWeek.week}`,
              sub: `Week ${open.thisWeek.week} · ${open.thisWeek.state === "Not started" ? "not written yet" : open.thisWeek.state === "Approved" ? "signed" : open.thisWeek.state.toLowerCase()}`,
              cta: { label: open.readOnly ? "Read this week’s note" : open.thisWeek.state === "Not started" ? "Write the note" : open.thisWeek.state === "Draft" ? "Continue the note" : "Open the note", href: `/lesson-notes/notes/${open.subjectId}/${open.thisWeek.week}?term=${v.term.id}` },
            },
          }]),
          show: "phone" as const,
        }
      : null,
    v.rework.length
      ? {
          ...row("1fr", [{
            type: "list", title: "Returned to you", tag: `${v.rework.length} ${v.rework.length === 1 ? "note" : "notes"}`, tagTone: "negative", sub: "Corrected and resubmitted from the note itself.",
            items: v.rework.map((entry) => ({ label: `Week ${entry.week} · ${entry.topic}`, sub: `${entry.subject} · ${entry.arms.join(", ")}${v.signer ? ` · ${v.signer.name}` : ""}`, quote: `“${entry.note || "No comment left"}”`, href: `/lesson-notes/notes/${entry.subjectId}/${entry.week}?term=${v.term.id}` })),
          }]),
        }
      : null,
    {
      ...row("1fr", [{
        type: "kpi", bare: true,
        cards: [
          { label: "Signed this term", value: String(k.signed), unit: k.signed === 1 ? "note" : "notes", tone: "positive" },
          { label: "This week", value: String(doneNow), unit: `of ${dueNow.length}`, tone: dueNow.length && doneNow < dueNow.length ? "attention" : "positive" },
        ],
      }]),
    },
    {
      ...row("1fr", [{
        type: "list", title: "Your subjects and classes", tag: `${v.subjects.length} ${v.subjects.length === 1 ? "subject" : "subjects"}`, tagTone: "attention",
        sub: "One note serves every class on a row. Open one for its weeks.", empty: "You are not named on a subject.",
        items: v.subjects.map((entry) => ({
          icon: PEN, tone: entry.returned ? ("negative" as const) : entry.state === "Behind" || entry.state === "Draft open" ? ("attention" as const) : ("positive" as const),
          label: `${entry.subject} · ${entry.arms.join(", ")}`,
          sub: `${entry.thisWeek ? `Week ${entry.thisWeek.week} · ${entry.thisWeek.topic || "no topic"}` : v.term.current ? "Nothing this week" : "The term is not running"} · ${entry.signed} ${entry.signed === 1 ? "note" : "notes"} signed`,
          pill: entry.returned ? `${entry.returned} returned` : entry.thisWeek ? entry.thisWeek.state : entry.state, href: `/lesson-notes/notes/${entry.subjectId}?term=${v.term.id}`,
        })),
      }]),
    },
  ];
  return {
    title: "Notes", phoneTitle: "Your notes this term", phoneDesc: "Plan the term once and teach from it weekly. One note serves every arm that takes the subject.",
    phoneEyebrow: `Lesson Notes${v.term.current ? ` · Week ${v.term.current} of ${v.term.weeks}` : ` · ${v.term.name}`}`,
    desc: readOnly
      ? "Read only. The notes for the arms you cover, subject by subject."
      : "Plan the term once, then teach from it every week. One note serves every arm that takes the subject.",
    // The mockup's primary is always this week's note, and its word changes with where that note
    // stands: a teacher who has started one is not asked to write it again.
    primary: thisWeek
      ? { label: `${thisWeekVerb} this week’s note`, phoneLabel: "Write note", icon: PEN, href: `/lesson-notes/notes/${thisWeek.subjectId}/${thisWeek.thisWeek!.week}?term=${v.term.id}` }
      : next
        ? { label: `Write week ${next.next}`, phoneLabel: "Write note", icon: PEN, href: `/lesson-notes/notes/${next.subjectId}/${next.next}?term=${v.term.id}` }
        : undefined,
    launchers: [
      { label: "Open the scheme of work", href: `/lesson-notes/curriculum?term=${v.term.id}` },
      ...(v.history.length ? [{ label: "Note history", href: "/lesson-notes/notes/history" }] : []),
      ...other.map((t) => ({ label: `Notes for ${t.name}`, href: `/lesson-notes/notes?term=${t.id}` })),
    ],
    // The mockup's own blocks, in its own order: what this week asks for, what came back, the two
    // figures, and every subject with where it stands. The hero is drawn only on a phone, which has
    // no page head of its own to carry this week's note.
    rows: phoneRows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

/* ─────────────────── what was written before — a page of its own ───────────────────
 *
 * Signed notes from earlier terms are read when a teacher wants to teach a topic again, not while
 * they are writing this week's. The mockup's Notes screen does not carry them, and neither does
 * this one: they are reached by name from its head.
 */

export async function notesHistoryPage(): Promise<Page> {
  const v = await apiGet(`${API}/notes`, observe<Landing>(localContracts["src/lib/modules/live/t17-lesson-notes.ts#2be3622f"]));
  // One row per subject, not per term: a teacher who has taught Chemistry for four terms wants
  // the subject once, with the terms behind it, exactly as the mockup draws it.
  const historyNotes = (entry: Landing["history"][number]) => entry.terms.reduce((sum, t) => sum + t.signed, 0);
  const history: TableRow[] = v.history.map((entry) => {
    const href = `/lesson-notes/notes/history/${entry.subjectId}`;
    const recent = entry.terms[0];
    return {
      keywords: `${entry.subject} ${(entry.arms ?? []).join(" ")}`, href,
      cells: [
        { kind: "name", name: entry.subject, sub: `${entry.terms.length} ${entry.terms.length === 1 ? "term" : "terms"} · ${historyNotes(entry)} ${historyNotes(entry) === 1 ? "note" : "notes"}`, avatar: false },
        cell((entry.arms ?? []).join(", ") || "Not recorded", (entry.arms ?? []).length ? undefined : { tone: "neutral" }),
        cell(String(entry.terms.length), { mono: true }),
        cell(String(historyNotes(entry)), { mono: true }),
        cell(recent ? `${recent.term}${recent.session ? `, ${recent.session}` : ""}` : "—"),
        pill("All signed", "positive"),
        { kind: "action", label: "Open", href },
      ] as TableCellKind[],
    };
  });
  const totalHistory = v.history.reduce((sum, entry) => sum + historyNotes(entry), 0);
  const terms = v.history.reduce((sum, entry) => sum + entry.terms.length, 0);
  return {
    crumb: { label: "Back to Notes", href: "/lesson-notes/notes" },
    title: "Note history",
    desc: "Every subject you have written notes for in earlier terms. Open one to read any note exactly as it was signed.",
    rows: [
      row("1fr", [{
        type: "table",
        title: "Signed in earlier terms",
        tag: `${totalHistory} signed ${totalHistory === 1 ? "note" : "notes"}`, tagTone: "positive",
        meta: `${v.history.length} ${v.history.length === 1 ? "subject" : "subjects"} · ${terms} ${terms === 1 ? "term" : "terms"} on file`,
        noun: "subject", nounPlural: "subjects", search: "Find a subject or a class",
        head: ["Subject", "Classes taught", "Terms", "Notes", "Most recent", "Signed", ""], rows: history,
        empty: "No signed note from an earlier term yet.",
        emptyTitle: "No earlier notes yet",
        emptyBody: "When this term ends, every note you wrote moves here, signed and readable.",
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
    title: "Review", desc: "Notes submitted to you. The unit of work is a subject-arm-week.",
    primary: waiting.length ? { label: `Sign the ${waiting.length} waiting`, icon: SEND, drawer: signAll } : undefined,
    rows: [
      row("1fr", [{
        type: "kpi", per: 5, sub: "One row below for every subject, arm and week a note is due — started or not.",
        cards: [
          { label: "Not started", value: String(k.notStarted), tone: k.notStarted ? "attention" : "positive" },
          { label: "In progress", value: String(k.inProgress), tone: "progress" },
          { label: "Waiting for a signature", value: String(k.submitted), tone: k.submitted ? "submitted" : "positive" },
          { label: "Returned", value: String(k.returned), tone: k.returned ? "negative" : "neutral" },
          { label: "Signed", value: String(k.signed), tone: "positive" },
        ],
      }]),
      row("1fr", [{
        type: "tracker",
        title: v.term.current ? `Week ${v.term.current} notes · ${v.scope === "school" ? "every department" : "your department"}` : `Notes · ${v.scope === "school" ? "every department" : "your department"}`,
        sub: "One row per subject-arm-week.",
        meta: `${v.rows.length} subject-arm${v.rows.length === 1 ? "" : "s"} · ${waiting.length} waiting on you`,
        noun: "notes signed",
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
      cell(entry.subject, { strong: true }), cell(entry.arm), { kind: "name", name: entry.teacher, sub: "Subject teacher", avatar: false },
      cell(entry.expected ? String(entry.expected) : "—", { mono: true }), cell(entry.expected ? String(Math.min(entry.reached, entry.expected)) : "—", { mono: true }),
      cell(entry.planned ? String(entry.planned) : "—", { mono: true }),
      pill(entry.state, tone(entry.state)),
    ] as TableCellKind[],
  }));
  const bars = v.rows.filter((entry) => entry.expected > 0).sort((a, b) => Math.min(a.reached, a.expected) / a.expected - Math.min(b.reached, b.expected) / b.expected).slice(0, 12).map((entry) => {
    const pct = Math.round((Math.min(entry.reached, entry.expected) / entry.expected) * 100);
    return { label: `${entry.subject} · ${entry.arm}`, sub: entry.teacher, value: pct, display: `${Math.min(entry.reached, entry.expected)} of ${entry.expected}`, tone: tone(entry.state) };
  });
  return {
    title: "Coverage", desc: "What the scheme says should have been taught by now, against what has been.",
    // Taking the audit away is what this page is for: it is the thing a head is asked for.
    primary: { label: "Export the coverage audit", icon: DOWNLOAD_ICON, href: `${API}/notes/coverage/export` },
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Expected is the weeks of each scheme due by now; reached is what the teacher has ticked off or marked taught — the calendar’s guess does not count.", per: 4,
        cards: [
          { label: "Covered", value: k.covered === null ? "—" : `${k.covered}%`, tone: k.covered !== null && k.covered < 80 ? "attention" : "positive" },
          { label: "On schedule", value: String(k.onSchedule), unit: `of ${k.total}`, tone: "positive", },
          { label: "Behind", value: String(k.behind), tone: k.behind ? "negative" : "positive" },
          { label: "No scheme on file", value: String(k.none), tone: k.none ? "attention" : "positive" },
        ],
      }]),
      row("1.4fr 1fr", [
        {
          type: "table", title: v.scope === "school" ? "Every subject, arm by arm" : "Your department, subject by subject", sub: "Expected unit against the unit actually reached.", meta: v.term.current ? `Week ${v.term.current}` : v.term.name, noun: "subject-arm", nounPlural: "subject-arms", search: "Find a subject or a teacher",
          filters: [{ label: "State", value: "All", options: ["All", "On schedule", "Behind", "No scheme on file"], column: 6 }],
          head: ["Subject", "Arm", "Teacher", "Expected", "Reached", "Planned", "State"], rows, per: 12, noRowOpen: true, acts: [{ label: "Export these rows", export: true }],
          empty: "No class-subject is set up yet.", emptyTitle: "Nothing to measure yet", emptyBody: "Coverage is counted from each subject’s scheme of work. When class subjects are mapped and schemes planned, they appear here.",
        },
        { type: "bars", title: "Furthest behind first", sub: "Share of the weeks due that have been reached.", rows: bars, foot: bars.length ? "Only subjects with weeks due are shown." : "Nothing is due yet, so there is nothing to compare." },
      ]),
    ],
  };
}
