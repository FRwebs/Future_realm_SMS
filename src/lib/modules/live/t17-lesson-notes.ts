import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, select, text } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * M17 for a teaching person: Lesson Notes. The scheme of work comes first — a term's weeks, each a topic — and a note is written once
 * per topic for every arm that takes it. A note is the teacher's, and is signed by their head of department (a head of department's own
 * by the academic lead); whoever signs it never edits it.
 */

export const API = "/api/v1/teacher-workspace";
const PEN = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";
const PLUS = "M12 5.5v13M5.5 12h13";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const SEND = "M4.5 12.5 19.5 5l-4 15-4.2-5.3z";

type Curriculum = {
  persona: string;
  term: { name: string; session: string; week: number; weeks: number };
  rows: Array<{ subjectId: string; subject: string; arms: string[]; schemes: number; planned: number; weeks: number; reached: number; expected: number; thisWeek: string | null; status: string }>;
};
export type SchemePage = {
  subject: string; subjectId: string; arms: string[]; term: { name: string; session: string; week: number; weeks: number };
  schemeStatus: string; returnReason: string | null;
  weeks: Array<{ week: number; topic: string; planned: boolean; subtopics: string[]; kind: string; status: string; note: string | null }>;
};
type Section = { key: string; label: string; hint: string; placeholder: string; required: boolean };
type NotesList = {
  persona: string; signer: { name: string } | null; term: { week: number; weeks: number; name: string; session: string }; sections: Section[];
  rows: Array<{ subjectId: string; subject: string; arms: string[]; weeks: Array<{ week: number; topic: string; state: string; written: number; planId: string | null; review: string | null; section: string | null; resubmitted: boolean; at: string | null }> }>;
};
export type NotePage = {
  subject: string; subjectId: string; arms: string[]; week: number; weeks: number; term: { name: string; session: string; current: number };
  topic: string; subtopics: string[]; status: string; sections: Section[]; state: string; text: Record<string, string>; planId: string | null;
  returned: { note: string; section: string | null; at: string | null } | null; resubmitReply: string | null; signedBy: string | null; signedAt: string | null;
  signer: { name: string } | null; reuse: { term: string; sections: Record<string, string> } | null;
  previous: { week: number; topic: string } | null; next: { week: number; topic: string } | null; person: string;
};
type Review = {
  scope: "school" | "department"; term: { name: string; session: string; week: number }; waiting: number; signed: number; returned: number;
  rows: Array<{ id: string; week: number; topic: string; subject: string; arms: string[]; teacher: string; role: string; state: string; own: boolean; canSign: boolean; at: string; resubmitted: boolean }>;
};
export type ReviewNote = { id: string; subject: string; topic: string; week: number; arms: string[]; teacher: string; state: string; sections: Section[]; text: Record<string, string>; own: boolean; canSign: boolean };
type Coverage = {
  scope: "school" | "department"; term: { name: string; session: string; week: number };
  rows: Array<{ subject: string; arm: string; teacher: string; expected: number; reached: number; state: string }>;
  kpis: { onSchedule: number; behind: number; none: number; covered: number | null; total: number };
};

const stateTone = (state: string): PanelTone => (state === "Approved" ? "positive" : state === "Submitted" ? "submitted" : state === "Returned" ? "negative" : state === "Draft" ? "progress" : "neutral");
const stateLabel = (state: string) => (state === "Approved" ? "Signed" : state === "Submitted" ? "With the reviewer" : state);
const weekTone = (status: string): PanelTone => (status === "Taught" ? "positive" : status === "Partly taught" || status === "In progress" ? "progress" : status === "Not planned" ? "neutral" : "neutral");
const stamp = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "");
const KINDS: Record<string, string> = { Teaching: "TEACHING", Revision: "REVISION", Exam: "EXAM", Activity: "ACTIVITY", Holiday: "HOLIDAY" };
const kindLabel = (kind: string) => Object.entries(KINDS).find(([, value]) => value === kind)?.[0] ?? "Teaching";

export const noteHref = (subjectId: string, week: number) => `/lesson-notes/notes/${subjectId}/${week}`;
export const schemeHref = (subjectId: string) => `/lesson-notes/curriculum/${subjectId}`;

export async function teacherLessonNotesTab(tabSlug: string, me: TeacherWorkspaceView): Promise<TabContent | null | undefined> {
  if (tabSlug === "curriculum") return curriculumTab(await apiGet<Curriculum>(`${API}/curriculum`));
  if (tabSlug === "notes") return notesTab(await apiGet<NotesList>(`${API}/notes`));
  if (tabSlug === "review") return reviewTab(await apiGet<Review>(`${API}/notes/review`));
  if (tabSlug === "coverage") {
    const [coverage, catalogue] = await Promise.all([apiGet<Coverage>(`${API}/notes/coverage`), apiGet<CatalogueRow[]>("/api/v1/curriculum-catalogue").catch(() => [] as CatalogueRow[])]);
    const content = coverageTab(coverage);
    return { ...content, launchers: [{ label: "Import a curriculum from Excel", href: "/lesson-notes/coverage/import" }], rows: [...content.rows, catalogueRow(catalogue)] };
  }
  void me;
  return undefined;
}

function noSubjects(title: string, desc: string): TabContent {
  return { title, desc, rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You are not named on a subject this term", body: "A scheme of work and its notes belong to the teacher of a subject in an arm. When the school names you on one, it appears here." }])] };
}

export type CatalogueOptions = { subject: string; stages: string[]; term: number | null; termName: string; weeks: number; options: Array<{ id: string; curriculum: string; stage: string; source: string | null; book: string | null; own: boolean; topics: number; preview: string[] }> };
export const loadScheme = (subjectId: string) => apiGet<SchemePage>(`${API}/curriculum/${subjectId}`);
export const loadCatalogueOptions = (subjectId: string) => apiGet<CatalogueOptions>(`${API}/curriculum/${subjectId}/catalogue`).catch(() => null);
export const loadNote = (subjectId: string, week: string) => apiGet<NotePage>(`${API}/notes/${subjectId}/${week}`);
export const loadReviewNote = (planId: string) => apiGet<ReviewNote>(`${API}/notes/review/${planId}`);

/* ───────────────────────── Curriculum ───────────────────────── */

function curriculumTab(v: Curriculum): TabContent {
  if (!v.rows.length) return noSubjects("Curriculum", "One scheme of work for each subject you teach.");
  const planned = v.rows.reduce((sum, entry) => sum + entry.planned, 0);
  const weeks = v.rows.reduce((sum, entry) => sum + entry.weeks, 0);
  const reached = v.rows.reduce((sum, entry) => sum + Math.min(entry.reached, entry.expected), 0);
  const expected = v.rows.reduce((sum, entry) => sum + entry.expected, 0);
  const noScheme = v.rows.filter((entry) => entry.planned === 0).length;
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.subject} ${entry.arms.join(" ")}`, href: schemeHref(entry.subjectId),
    cells: [
      { kind: "name", name: entry.subject, sub: entry.arms.join(", "), avatar: false },
      cell(entry.thisWeek || "Not planned yet", { tone: entry.thisWeek ? undefined : "attention" }),
      cell(`${entry.planned} of ${entry.weeks}`, { mono: true }),
      cell(entry.expected ? `${Math.min(entry.reached, entry.expected)} of ${entry.expected}` : "—", { mono: true, tone: entry.expected && entry.reached < entry.expected ? "negative" : undefined }),
      pill(entry.status, entry.status === "Approved" ? "positive" : entry.status === "Submitted" ? "submitted" : entry.status === "Returned" ? "negative" : entry.status === "No scheme" ? "neutral" : "progress"),
      { kind: "action", label: entry.planned ? "Open" : "Plan it", href: schemeHref(entry.subjectId) },
    ] as TableCellKind[],
  }));
  return {
    title: "Curriculum", desc: `${v.term.name}, ${v.term.session} · week ${v.term.week}. Plan the term once, then teach from it every week.`,
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Counted from your own schemes of work — nothing here is typed in twice.", per: 4,
        cards: [
          { label: "Subjects you teach", value: String(v.rows.length), sub: v.rows.map((entry) => entry.subject).slice(0, 3).join(", ") },
          { label: "Weeks planned", value: String(planned), unit: `of ${weeks}`, sub: noScheme ? `${noScheme} subject${noScheme === 1 ? "" : "s"} with nothing planned` : "Every subject has a plan", tone: noScheme ? "attention" : "positive" },
          { label: "Taught so far", value: String(reached), unit: expected ? `of ${expected}` : undefined, sub: expected ? (reached >= expected ? "On schedule" : `${expected - reached} behind the plan`) : "No week is due yet", tone: expected && reached < expected ? "attention" : "positive" },
          { label: "This week", value: String(v.term.week), unit: `of ${v.term.weeks}`, sub: `${v.term.name}` },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Your schemes of work", sub: "One per subject. Open one to plan its weeks.", meta: `${v.rows.length} subject${v.rows.length === 1 ? "" : "s"}`, noun: "subject", nounPlural: "subjects",
        head: ["Subject", "This week", "Planned", "Taught", "Scheme", ""], rows, per: 10, empty: "Nothing to show.", foot: "A scheme taught across arms is planned once. A week marked taught counts for every arm.",
      }]),
    ],
  };
}

export function schemePage(p: SchemePage, catalogue: CatalogueOptions | null = null): TabContent & { crumb: { label: string; href: string } } {
  const planned = p.weeks.filter((entry) => entry.planned);
  const taught = planned.filter((entry) => entry.status === "Taught" || entry.status === "Partly taught").length;
  const due = planned.filter((entry) => entry.week <= p.term.week).length;
  const planDrawer = (entry: SchemePage["weeks"][number]): DrawerSpec => ({
    mode: "form", kicker: `${p.subject} · week ${entry.week}`, title: entry.planned ? "Edit the week" : "Plan the week",
    sub: `One topic for every arm you take (${p.arms.join(", ")}).`,
    commitLabel: "Save the week", commitDone: "Week saved", commitDoneBody: "A scheme that was signed or submitted goes back to draft so it can be signed again.",
    fields: [
      text("Topic", { value: entry.topic, required: true, span: 2, placeholder: "e.g. Quadratic equations" }),
      area("What is taught", { value: entry.subtopics.join("\n"), span: 2, placeholder: "One sub-topic per line", hint: "These are what a colleague covering your class would teach." }),
      select("Kind of week", Object.keys(KINDS), { value: kindLabel(entry.kind), span: 2 }),
    ] as FormField[],
    submit: { endpoint: `${API}/curriculum/${p.subjectId}/weeks/${entry.week}`, method: "POST", map: { Topic: "topic", "What is taught": "subtopics", "Kind of week": "kind" }, encode: { "Kind of week": KINDS } },
  });
  const taughtDrawer = (entry: SchemePage["weeks"][number], taught: boolean): DrawerSpec => ({
    mode: "commit", kicker: `${p.subject} · week ${entry.week}`, title: taught ? "Mark the week taught" : "Mark the week not yet taught",
    sub: taught ? "It counts as covered for every arm that takes it." : "It goes back to planned, and the coverage figures follow.",
    facts: [["Topic", entry.topic, ""], ["Arms", p.arms.join(", "), "Marked together"]],
    commitLabel: taught ? "Mark taught" : "Undo", commitDone: taught ? "Week marked taught" : "Week reopened", commitDoneBody: "Coverage is counted from this — nobody retypes it.",
    submit: { endpoint: `${API}/curriculum/${p.subjectId}/weeks/${entry.week}/taught`, method: "POST", body: { taught } },
  });
  const rows: TableRow[] = p.weeks.map((entry) => ({
    keywords: `${entry.topic} ${entry.week}`,
    cells: [
      cell(`Week ${entry.week}`, { strong: true, mono: true, tone: entry.week === p.term.week ? "positive" : undefined }),
      cell(entry.topic || "Not planned yet", { tone: entry.planned ? undefined : "attention", strong: entry.planned }),
      cell(entry.subtopics.length ? entry.subtopics.join(" · ") : "—"),
      pill(entry.status, weekTone(entry.status)),
      entry.planned ? pill(entry.note ? stateLabel(stateOf(entry.note)) : "No note", stateTone(entry.note ? stateOf(entry.note) : "None")) : cell("—"),
      { kind: "action", label: entry.planned ? "Edit" : "Plan", drawer: planDrawer(entry) },
      entry.planned ? { kind: "action", label: "Note", href: noteHref(p.subjectId, entry.week) } : cell(""),
      entry.planned ? { kind: "action", label: entry.status === "Taught" ? "Undo" : "Taught", drawer: taughtDrawer(entry, entry.status !== "Taught") } : cell(""),
    ] as TableCellKind[],
  }));
  const submit: DrawerSpec = {
    mode: "commit", kicker: p.subject, title: "Submit the scheme for approval",
    sub: "Your head of department reads it and signs it, or returns it with what to change.",
    facts: [["Subject", p.subject, p.arms.join(", ")], ["Weeks planned", `${planned.length} of ${p.weeks.length}`, "At least 10 are needed"], ["Current state", p.schemeStatus, ""]],
    commitLabel: "Submit the scheme", commitDone: "Scheme submitted", commitDoneBody: "Your head of department has it. You will be told if it comes back.",
    submit: { endpoint: `${API}/curriculum/${p.subjectId}/submit`, method: "POST" },
  };
  const first = p.weeks.find((entry) => !entry.planned);
  const labelOf = (option: CatalogueOptions["options"][number]) => `${option.curriculum} · ${option.stage}${option.own ? " · your school’s" : ""} — ${option.topics} topics (${option.preview.slice(0, 2).join(", ")}…)`;
  const fromCatalogue: DrawerSpec | null = catalogue && catalogue.options.length
    ? {
        mode: "form", kicker: p.subject, title: "Start from a published curriculum", sub: `The outlines for ${catalogue.subject} at ${catalogue.stages.join(" / ")}, ${catalogue.termName}. Weeks you have already planned stay as they are unless you say otherwise.`,
        commitLabel: "Fill the term", commitDone: "Term filled", commitDoneBody: "The weeks are in your scheme. Edit any of them; nothing is submitted.",
        fields: [
          select("Outline", catalogue.options.map(labelOf), { span: 2, required: true }),
          { label: "Replace weeks I have planned", kind: "toggle", on: false, onLabel: "Replace them", offLabel: "Keep what I planned", span: 2 } as FormField,
        ],
        submit: { endpoint: `${API}/curriculum/${p.subjectId}/catalogue/apply`, method: "POST", map: { Outline: "entryId", "Replace weeks I have planned": "replace" }, encode: { Outline: Object.fromEntries(catalogue.options.map((option) => [labelOf(option), option.id])) } },
      }
    : null;
  return {
    crumb: { label: "Back to Curriculum", href: "/lesson-notes/curriculum" },
    title: `${p.subject} · scheme of work`, desc: `${p.arms.join(", ")} · ${p.term.name}, ${p.term.session} · week ${p.term.week} of ${p.term.weeks}.`,
    primary: first ? { label: `Plan week ${first.week}`, icon: PLUS, drawer: planDrawer(first) } : undefined,
    launchers: [...(fromCatalogue ? [{ label: "Start from the catalogue", drawer: fromCatalogue }] : []), { label: "Submit the scheme", drawer: submit }],
    rows: [
      ...(!planned.length && catalogue && !catalogue.options.length ? [row("1fr", [{ type: "note", tone: "neutral" as PanelTone, icon: EYE, title: "No published outline matches this subject yet", body: `Nothing in the catalogue is for ${p.subject} at this stage in ${catalogue.termName}. Your head of department can load your curriculum from Excel, or you can plan the weeks yourself.` }])] : []),
      ...(p.returnReason ? [row("1fr", [{ type: "note", tone: "attention", icon: EYE, title: "Your head of department returned this scheme", body: p.returnReason }])] : []),
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "Weeks planned", value: String(planned.length), unit: `of ${p.weeks.length}`, tone: planned.length >= 10 ? "positive" : "attention", sub: planned.length >= 10 ? "Enough to submit" : `${10 - planned.length} more before it can be submitted` },
          { label: "Taught", value: String(taught), unit: due ? `of ${due} due` : undefined, tone: due && taught < due ? "attention" : "positive", sub: due ? (taught >= due ? "On schedule" : `${due - taught} behind`) : "No week is due yet" },
          { label: "Scheme", value: p.schemeStatus, sub: "Signed by your head of department" },
          { label: "Notes written", value: String(planned.filter((entry) => entry.note).length), unit: `of ${planned.length}`, sub: "One per planned week" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "The term, week by week", sub: "Plan a week once and the note, the coverage and My Day all follow it.", meta: `${planned.length} planned`, noun: "week", nounPlural: "weeks",
        head: ["Week", "Topic", "What is taught", "Status", "Note", "", "", ""], rows, per: 14, noRowOpen: true, empty: "Nothing to show.", foot: "Marking a week taught counts it for every arm you take that subject in.",
      }]),
    ] as PanelRow[],
  };
}

const stateOf = (status: string) => (status === "DRAFT" ? "Draft" : status === "SUBMITTED" ? "Submitted" : status === "APPROVED" ? "Approved" : status === "RETURNED" ? "Returned" : status);

/* ───────────────────────── Notes ───────────────────────── */

function notesTab(v: NotesList): TabContent {
  if (!v.rows.length) return noSubjects("Notes", "A note for every week you teach.");
  const all = v.rows.flatMap((entry) => entry.weeks.map((week) => ({ ...week, subject: entry.subject, subjectId: entry.subjectId, arms: entry.arms })));
  const count = (state: string) => all.filter((entry) => entry.state === state).length;
  const due = all.filter((entry) => entry.week <= v.term.week);
  const owed = due.filter((entry) => entry.state === "Not started" || entry.state === "Draft").length;
  const rows: TableRow[] = all.sort((a, b) => Number(b.week === v.term.week) - Number(a.week === v.term.week) || a.week - b.week || a.subject.localeCompare(b.subject)).map((entry) => ({
    keywords: `${entry.subject} ${entry.topic} ${entry.state}`, href: noteHref(entry.subjectId, entry.week),
    cells: [
      cell(`Week ${entry.week}`, { strong: true, mono: true, tone: entry.week === v.term.week ? "positive" : undefined }),
      { kind: "name", name: entry.topic, sub: `${entry.subject} · ${entry.arms.join(", ")}`, avatar: false },
      cell(entry.state === "Not started" ? "—" : `${entry.written} of 7 sections`, { mono: true }),
      pill(stateLabel(entry.state), stateTone(entry.state)),
      cell(entry.review ? `“${entry.review}”` : entry.resubmitted ? "Resubmitted with a reply" : entry.at ? stamp(entry.at) : "", { tone: entry.review ? "negative" : undefined }),
      { kind: "action", label: entry.state === "Not started" || entry.state === "Draft" ? "Write" : entry.state === "Returned" ? "Revise" : "Open", href: noteHref(entry.subjectId, entry.week) },
    ] as TableCellKind[],
  }));
  const current = all.find((entry) => entry.week === v.term.week && (entry.state === "Not started" || entry.state === "Draft"));
  return {
    title: "Notes", desc: `${v.term.name}, ${v.term.session} · week ${v.term.week}. ${v.signer ? `${v.signer.name} signs them.` : "Nobody is named to sign them yet."}`,
    primary: current ? { label: `Write week ${current.week}’s note`, icon: PEN, href: noteHref(current.subjectId, current.week) } : undefined,
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Counted from your notes. A note is written once per topic and serves every arm that takes it.", per: 4,
        cards: [
          { label: "Owed now", value: String(owed), sub: owed ? "Weeks due without a finished note" : "Every due week has a note", tone: owed ? "attention" : "positive" },
          { label: "With the reviewer", value: String(count("Submitted")), sub: v.signer ? `${v.signer.name} signs them` : "", tone: count("Submitted") ? "progress" : "neutral" },
          { label: "Returned", value: String(count("Returned")), sub: count("Returned") ? "Read what to change" : "Nothing returned", tone: count("Returned") ? "negative" : "positive" },
          { label: "Signed", value: String(count("Approved")), unit: `of ${all.length}`, sub: "Ready to teach from", tone: "positive" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Your notes", sub: "This week first, then in order.", meta: `${all.length} planned week${all.length === 1 ? "" : "s"}`, noun: "note", nounPlural: "notes", search: "Find a note",
        head: ["Week", "Topic", "Written", "State", "", ""], rows, per: 12, empty: "Plan a week in Curriculum first — a note is written against a topic.", foot: "A note can only be written for a week that is planned in the scheme of work.",
      }]),
    ],
  };
}

export function notePage(p: NotePage): TabContent & { crumb: { label: string; href: string } } {
  const editable = p.state === "Not started" || p.state === "Draft" || p.state === "Returned";
  const required = p.sections.filter((section) => section.required);
  const writtenReq = required.filter((section) => (p.text[section.key] ?? "").trim()).length;
  const written = p.sections.filter((section) => (p.text[section.key] ?? "").trim()).length;
  const nest = Object.fromEntries(p.sections.map((section): [string, [string, string]] => [section.label, ["sections", section.key]]));
  const writeDrawer: DrawerSpec = {
    mode: "form", kicker: `${p.subject} · week ${p.week}`, title: p.state === "Not started" ? "Write the note" : "Edit the note", sub: `${p.topic} — for ${p.arms.join(", ")}. Saving keeps it as a draft; nothing goes to the reviewer until you submit.`,
    commitLabel: "Save the draft", commitDone: "Draft saved", commitDoneBody: "Open it again any time; submit it when every required section is written.",
    fields: p.sections.map((section) => area(section.label, { value: p.text[section.key] ?? "", span: 2, required: section.required, placeholder: section.placeholder, hint: `${section.required ? "Required. " : ""}${section.hint}` })),
    submit: { endpoint: `${API}/notes/${p.subjectId}/${p.week}`, method: "POST", nest },
  };
  const returnedFirst = p.state === "Returned";
  const submitDrawer: DrawerSpec = {
    mode: "form", kicker: `${p.subject} · week ${p.week}`, title: returnedFirst ? "Resubmit the note" : "Submit for signing",
    sub: `${p.signer ? `${p.signer.name} reads it and signs it, or sends it back with what to change.` : "No reviewer is named for you — raise it with the office."}`,
    commitLabel: "Submit the note", commitDone: "Note submitted", commitDoneBody: "You cannot edit it while it is with the reviewer, but you can withdraw it.",
    reviewNote: `${writtenReq} of ${required.length} required sections written.`,
    fields: [
      ...(returnedFirst ? [area("What you changed", { span: 2, required: true, placeholder: "Say what you changed, so the reviewer reads the right part." })] : []),
      { label: "Required sections", kind: "static", value: `${writtenReq} of ${required.length} written`, span: 2, hint: required.map((section) => section.label).join(" · ") } as FormField,
    ],
    submit: { endpoint: `${API}/notes/${p.subjectId}/${p.week}/submit`, method: "POST", map: { "What you changed": "reply" } },
  };
  const withdraw: DrawerSpec = {
    mode: "commit", kicker: p.subject, title: "Withdraw the note", sub: "It goes back to a draft so you can edit it.", facts: [["Week", String(p.week), p.topic]],
    commitLabel: "Withdraw it", commitDone: "Note withdrawn", commitDoneBody: "It is a draft again.", submit: { endpoint: `${API}/notes/${p.subjectId}/${p.week}/withdraw`, method: "POST" },
  };
  const revise: DrawerSpec = {
    mode: "commit", kicker: p.subject, title: "Revise a signed note", sub: "It becomes a draft and has to be signed again.", facts: [["Signed by", p.signedBy ?? "—", p.signedAt ? stamp(p.signedAt) : ""]],
    commitLabel: "Start a revision", commitDone: "Note reopened", commitDoneBody: "Edit it, then submit it for signing.", submit: { endpoint: `${API}/notes/${p.subjectId}/${p.week}/revise`, method: "POST" },
  };
  const reuse: DrawerSpec | null = p.reuse && p.state === "Not started" ? {
    mode: "form", kicker: `${p.subject} · week ${p.week}`, title: "Start from last time’s note", sub: "A signed note on the same topic from an earlier term. It becomes a new draft you can change.",
    commitLabel: "Use it as a draft", commitDone: "Draft started", commitDoneBody: "Change what is out of date, then submit it.",
    fields: p.sections.map((section) => area(section.label, { value: p.reuse!.sections[section.key] ?? "", span: 2, placeholder: section.placeholder })),
    submit: { endpoint: `${API}/notes/${p.subjectId}/${p.week}`, method: "POST", nest },
  } : null;
  const hasText = (key: string) => Boolean((p.text[key] ?? "").trim());
  const rows: PanelRow[] = [
    ...(p.returned ? [row("1fr", [{ type: "note", tone: "attention", icon: EYE, title: p.returned.section ? `${p.signer?.name ?? "The reviewer"} asks you to change “${p.sections.find((section) => section.key === p.returned!.section)?.label ?? p.returned.section}”` : `${p.signer?.name ?? "The reviewer"} returned this note`, body: p.returned.note || "No comment was left." }])] : []),
    row("1fr", [{ type: "days", title: "The term’s notes", sub: "Walk the weeks without going back to the list.", days: [
      ...(p.previous ? [{ label: `Week ${p.previous.week}`, href: noteHref(p.subjectId, p.previous.week), state: "plain" as const }] : []),
      { label: `Week ${p.week}`, href: noteHref(p.subjectId, p.week), state: "now" as const },
      ...(p.next ? [{ label: `Week ${p.next.week}`, href: noteHref(p.subjectId, p.next.week), state: "plain" as const }] : []),
    ] }]),
    row("1fr", [{
      type: "kpi", per: 4,
      cards: [
        { label: "Topic", value: p.topic, sub: p.arms.join(", ") },
        { label: "State", value: stateLabel(p.state), sub: p.state === "Approved" ? `${p.signedBy ?? ""}${p.signedAt ? ` · ${stamp(p.signedAt)}` : ""}` : p.signer ? `Signed by ${p.signer.name}` : "No reviewer named", tone: stateTone(p.state) },
        { label: "Sections written", value: String(written), unit: "of 7", sub: `${writtenReq} of ${required.length} required`, tone: writtenReq === required.length ? "positive" : "attention" },
        { label: "Week", value: String(p.week), unit: `of ${p.weeks}`, sub: p.week === p.term.current ? "This week" : p.week < p.term.current ? "Already taught" : "Ahead" },
      ],
    }]),
    ...(p.subtopics.length ? [row("1fr", [{ type: "facts", title: "What the scheme says is taught", sub: "From your scheme of work for this subject.", per: 1, facts: p.subtopics.map((topic, index): PanelFact => [`Part ${index + 1}`, topic, ""]) }])] : []),
    row("1fr", [{
      type: "quotes", title: "The note", sub: editable ? "Seven sections. Required ones must be written before it can be submitted." : p.state === "Submitted" ? "With the reviewer — it cannot be edited unless you withdraw it." : "Signed. Revise it to change it.",
      quotes: p.sections.map((section) => ({ label: `${section.label}${section.required ? " · required" : ""}`, text: p.text[section.key] ?? "", by: p.person, emptyText: section.hint, pill: hasText(section.key) ? "Written" : section.required ? "Required" : "Optional", tone: (hasText(section.key) ? "positive" : section.required ? "attention" : "neutral") as PanelTone, ...(editable ? { act: hasText(section.key) ? "Edit the note" : "Write the note", trigger: { drawer: writeDrawer } } : {}) })),
    }]),
    ...(p.resubmitReply && p.state === "Submitted" ? [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You resubmitted this note", body: p.resubmitReply }])] : []),
  ];
  return {
    crumb: { label: "Back to Notes", href: "/lesson-notes/notes" },
    title: `${p.subject} · week ${p.week}`, desc: `${p.topic} · ${p.arms.join(", ")} · ${p.term.name}, ${p.term.session}.`,
    primary: editable ? { label: p.state === "Not started" ? "Write the note" : "Edit the note", icon: PEN, drawer: writeDrawer } : p.state === "Approved" ? { label: "Revise the note", icon: PEN, drawer: revise } : { label: "Withdraw the note", icon: PEN, drawer: withdraw },
    launchers: [
      ...(editable && p.state !== "Not started" ? [{ label: returnedFirst ? "Resubmit" : "Submit for signing", drawer: submitDrawer }] : []),
      ...(reuse ? [{ label: "Start from last time", drawer: reuse }] : []),
      { label: "Open the scheme", href: schemeHref(p.subjectId) },
    ],
    rows,
  };
}

/* ───────────────────────── Review ───────────────────────── */

function reviewTab(v: Review): TabContent {
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.subject} ${entry.topic} ${entry.teacher} ${entry.state}`, href: `/lesson-notes/review/${entry.id}`,
    cells: [
      { kind: "name", name: entry.topic, sub: `${entry.subject} · ${entry.arms.join(", ")}`, avatar: false },
      cell(`Week ${entry.week}`, { mono: true }), cell(entry.teacher), cell(stamp(entry.at)),
      pill(stateLabel(entry.state), stateTone(entry.state)),
      { kind: "action", label: entry.canSign ? "Read and sign" : "Open", href: `/lesson-notes/review/${entry.id}` },
    ] as TableCellKind[],
  }));
  return {
    title: "Review", desc: `${v.scope === "school" ? "Every department’s" : "Your department’s"} notes, ${v.term.name} · week ${v.term.week}. You never sign your own.`,
    rows: [
      row("1fr", [{
        type: "kpi", per: 3,
        cards: [
          { label: "Waiting for a signature", value: String(v.waiting), sub: v.waiting ? "Oldest first in the list" : "Nothing is waiting", tone: v.waiting ? "attention" : "positive" },
          { label: "Returned", value: String(v.returned), sub: "With the teacher to change", tone: v.returned ? "progress" : "neutral" },
          { label: "Signed", value: String(v.signed), sub: "Ready to teach from", tone: "positive" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Notes in your scope", sub: "Open one to read all seven sections, then sign it or return it with what to change.", meta: `${v.rows.length} note${v.rows.length === 1 ? "" : "s"}`, noun: "note", nounPlural: "notes", search: "Find a note or a teacher",
        filters: [{ label: "State", value: "All", options: ["All", "With the reviewer", "Returned", "Signed", "Draft"], column: 4 }],
        head: ["Note", "Week", "Teacher", "Last change", "State", ""], rows, per: 12, empty: "No note has been written yet.", foot: "A note you wrote goes to the academic lead, not to you.",
      }]),
    ],
  };
}

export function reviewNotePage(p: ReviewNote): TabContent & { crumb: { label: string; href: string } } {
  const sign: DrawerSpec = {
    mode: "commit", kicker: `${p.subject} · week ${p.week}`, title: "Sign the note", sub: `${p.teacher} is told it is signed.`, facts: [["Topic", p.topic, p.arms.join(", ")], ["Teacher", p.teacher, ""]],
    commitLabel: "Sign it", commitDone: "Note signed", commitDoneBody: "It is ready to teach from.", submit: { endpoint: `${API}/notes/review/${p.id}/decide`, method: "POST", body: { decision: "sign" } },
  };
  const send: DrawerSpec = {
    mode: "form", kicker: `${p.subject} · week ${p.week}`, title: "Return the note", sub: `Say what to change — ${p.teacher} sees it beside the section.`,
    commitLabel: "Return it", commitDone: "Note returned", commitDoneBody: "They are told, and can resubmit with a reply.",
    fields: [select("Section to change", ["Not one section", ...p.sections.map((section) => section.label)], { span: 2 }), area("What to change", { span: 2, required: true, placeholder: "Be specific — a return without a comment cannot be acted on." })],
    submit: { endpoint: `${API}/notes/review/${p.id}/decide`, method: "POST", body: { decision: "return" }, map: { "Section to change": "section", "What to change": "note" }, encode: { "Section to change": { "Not one section": "", ...Object.fromEntries(p.sections.map((section) => [section.label, section.key])) } } },
  };
  return {
    crumb: { label: "Back to Review", href: "/lesson-notes/review" },
    title: `${p.topic} · week ${p.week}`, desc: `${p.subject} · ${p.arms.join(", ")} · written by ${p.teacher}.`,
    primary: p.canSign ? { label: "Sign the note", icon: SEND, drawer: sign } : undefined,
    launchers: p.canSign ? [{ label: "Return it", drawer: send }] : [],
    rows: [
      row("1fr", [{ type: "note", tone: p.own ? "attention" : "neutral", icon: EYE, title: p.own ? "You wrote this note" : `State: ${stateLabel(p.state)}`, body: p.own ? "Someone else signs it — it goes to the academic lead." : p.canSign ? "Read all seven sections, then sign it or return it with what to change. You never edit it yourself." : "Only a note that has been submitted can be signed." }]),
      row("1fr", [{ type: "quotes", title: "The note", sub: "Exactly as the teacher wrote it.", quotes: p.sections.map((section) => ({ label: section.label, text: p.text[section.key] ?? "", by: p.teacher, emptyText: section.required ? "Required, and not written." : "Not written.", pill: (p.text[section.key] ?? "").trim() ? "Written" : section.required ? "Missing" : "Blank", tone: ((p.text[section.key] ?? "").trim() ? "positive" : section.required ? "negative" : "neutral") as PanelTone })) }]),
    ],
  };
}

/* ───────────────────────── Coverage ───────────────────────── */

type CatalogueRow = { id: string; curriculum: string; subject: string; stage: string; term: number; source: string | null; book: string | null; topics: number; own: boolean };

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
  return row("1fr", [{ type: "table", title: "Curriculum catalogue", sub: "The outlines a teacher can start a scheme of work from. The platform’s are loaded for every school; load your own from Excel.", meta: `${entries.length} outline${entries.length === 1 ? "" : "s"}`, noun: "outline", nounPlural: "outlines", search: "Find a subject or stage", head: ["Subject", "Topics", "Source", "From", ""], rows, per: 10, noRowOpen: true, empty: "Nothing has been loaded. Import a curriculum from Excel, or ask the platform team to load the national one.", foot: "Nothing here is written by the product — it is exactly what was imported." }]);
}

function coverageTab(v: Coverage): TabContent {
  const k = v.kpis;
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.subject} ${entry.arm} ${entry.teacher} ${entry.state}`,
    cells: [
      { kind: "name", name: entry.subject, sub: entry.arm, avatar: false }, cell(entry.teacher),
      cell(entry.expected ? `${Math.min(entry.reached, entry.expected)} of ${entry.expected}` : "—", { mono: true }),
      pill(entry.state, entry.state === "On schedule" ? "positive" : entry.state === "Behind" ? "negative" : "neutral"),
    ] as TableCellKind[],
  }));
  return {
    title: "Coverage", desc: `${v.scope === "school" ? "Every" : "Your department’s"} subject, against the scheme — ${v.term.name} · week ${v.term.week}.`,
    rows: [
      row("1fr", [{
        type: "kpi", sub: "Expected is the weeks of each scheme due by now; reached is what the teacher has marked taught.", per: 4,
        cards: [
          { label: "Covered", value: k.covered === null ? "—" : `${k.covered}%`, sub: "Of what was due", tone: k.covered !== null && k.covered < 80 ? "attention" : "positive" },
          { label: "On schedule", value: String(k.onSchedule), unit: `of ${k.total}`, tone: "positive", sub: "Subject-arms" },
          { label: "Behind", value: String(k.behind), sub: k.behind ? "Reached less than was due" : "Nobody is behind", tone: k.behind ? "negative" : "positive" },
          { label: "No scheme on file", value: String(k.none), sub: k.none ? "Nothing to measure against" : "Every subject has one", tone: k.none ? "attention" : "positive" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Coverage by subject and arm", sub: "A week counts when the teacher marks it taught in the scheme.", meta: `${v.rows.length} subject-arm${v.rows.length === 1 ? "" : "s"}`, noun: "subject", nounPlural: "subjects", search: "Find a subject or a teacher",
        filters: [{ label: "State", value: "All", options: ["All", "On schedule", "Behind", "No scheme on file"], column: 3 }],
        head: ["Subject", "Teacher", "Taught", "State"], rows, per: 15, noRowOpen: true, empty: "No class-subject is set up yet.",
      }]),
    ],
  };
}
