import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { schoolPermissionKey } from "@/lib/modules/school-modules";
import { gridHref, previewHref } from "@/lib/modules/live/m5-forms";
import type { Grid } from "@/lib/modules/live/m5-types";
import { teacherObservationsTab } from "@/lib/modules/live/t5-observations";
import type { DrawerSpec, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M05 for a teaching person, drawn from the teacher mockup: their own sheets (one subject-arm is one sheet), the sheet itself as a
 * table to type into, the results those sheets produce — arm by arm, then child by child, with the comment that prints on the report
 * card — the form class's broadsheet, and, for a head of department, the department's sheets, where reviewing is not editing.
 */

type SheetRow = { classId: string; subjectId: string; subject: string; arm: string; state: string; roll: number; entered: number; mean: number | null; blanks: number; blankMarks?: number; returned: string | null; flagged: number; basis?: string; coverOf?: string | null; until?: string | null; regOnly?: boolean };
type SheetsView = {
  persona: string; term: string; closes: string | null; daysLeft: number | null; pending: number; windowName: string | null;
  rows: SheetRow[];
  restricted: Array<{ classId: string; subjectId: string; subject: string; arm: string; until: string; coverOf: string | null; regOnly: true }>;
  assigned: number; assisting: number;
  kpis: { open: number; sheets: number; entered: number; children: number; returned: number; firstReturned: { classId: string; subjectId: string; subject: string; arm: string } | null; blanks: number };
};

type ResultsView = {
  average: number | null; ranked: number; children: number; below: number; approved: number;
  rows: Array<{ classId: string; subjectId: string; subject: string; arm: string; state: string; roll: number; complete: number; ranked: number; mean: number | null; high: number | null; low: number | null; passed: number; failed: number; pass: number; passRate: number | null }>;
  look: Array<{ classId: string; subjectId: string; studentId: string; child: string; subject: string; arm: string; total: number; grade: string | null; why: string; last: number | null; attendance: number | null }>;
  formArms: Array<{ id: string; name: string; roll: number }>;
  remarks: { written: number; roll: number };
  persona: string;
};

type ResultColumn = { key: string; name: string; short: string; max: number; exam: boolean };
export type SubjectResult = {
  term: { id: string; name: string }; own: boolean;
  arm: { id: string; name: string }; subject: { id: string; name: string }; state: string; final: boolean; passMark: number; creditMark: number;
  columns: ResultColumn[]; bands: Array<{ label: string; min: number; max: number; remark: string }>;
  stats: { roll: number; complete: number; ranked: number; mean: number | null; high: number | null; low: number | null; passed: number; failed: number; pass: number; passRate: number | null; creditRate: number | null; credit: number; comments: number };
  high: { name: string; total: number } | null; low: { name: string; total: number } | null;
  components: Array<{ key: string; name: string; short: string; max: number; exam: boolean; mean: number | null; pct: number | null }>;
  arms: Array<{ id: string; name: string }>; others: Array<{ id: string; name: string; mean: number }>;
  distribution: Array<{ label: string; count: number; range: string }>; hasLast: boolean; letterhead: { name: string; place?: string; contact?: string }; session: string;
  rows: Array<{ id: string; name: string; adm: string; roll: number; cells: Record<string, number | "ABS" | null>; total: number | null; grade: string | null; pos: number | null; rating: string; standing: string; third: string; blank: number; absent: number; complete: boolean; ranked: boolean; last: number | null; since: number | null; attendance: number | null; comment: boolean }>;
  frameworkPinned: boolean;
};

export type StudentResult = {
  term: { id: string; name: string; session: string }; own: boolean; arm: { id: string; name: string }; subject: { id: string; name: string }; isFormArm: boolean;
  student: { id: string; name: string; adm: string; index: number; of: number };
  peers: Array<{ id: string; name: string; adm: string; index: number; written: boolean }>;
  total: number | null; grade: string | null; complete: boolean; absent: number; blank: number; ranked: boolean; pos: number | null; of: number;
  classMean: number | null; last: number | null; since: number | null; attendance: number | null; band: string;
  components: Array<{ key: string; name: string; short: string; max: number; exam: boolean; value: number | "ABS" | null; classMean: number | null; enteredAt: string | null; enteredBy: string | null }>;
  comment: { text: string; updatedAt: string } | null;
  bands: Array<{ label: string; min: number; max: number; remark: string }>;
};

export type FormBroadsheet = {
  term: { id: string; name: string; session: string }; arm: { id: string; name: string }; roll: number;
  subjects: Array<{ subjectId: string; name: string; code: string; teacher: string | null; state: string; entered: number; mean: number | null }>;
  rows: Array<{ id: string; name: string; adm: string; totals: Array<number | null>; average: number | null; complete: boolean; pos: number | null; grade: string | null }>;
  bands: Array<{ label: string; min: number; max: number }>;
  kpis: { complete: number; missing: number; average: number | null; remarks: number };
};

type OversightRow = { classId: string; subjectId: string; unit: string; sub: string; subject: string; arm: string; roll: number; entered: number; mean: number | null; submittedAt: string | null; decidedAt: string | null; owner: string; ownerId: string | null; state: string; age: string; overdue: boolean };
type OversightView = {
  department: string;
  reportsTo: { name: string; title: string } | null;
  kpis: { submitted: number; sheets: number; withTeacher: number; returnedByMe: number; mineSubmitted: number; mine: number; waitingOnMe: number; notStarted: number; approved: number };
  closes: string | null;
  rows: OversightRow[];
};

const PEN = "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const SCORE = "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3";
const SHIELD = "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z";
const EYE = "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const QUESTION = "M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 16.5h.01M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17";
const API = "/api/v1/teacher-workspace";

const tone = (state: string): PanelTone =>
  state === "Returned" ? "negative" : state === "Not started" ? "attention" : state === "In progress" ? "progress" : state === "Submitted" ? "submitted" : state === "Approved" ? "positive" : "neutral";
const gradeTone = (grade: string | null): PanelTone => {
  const first = (grade ?? "")[0];
  return first === "A" || first === "B" ? "positive" : first === "C" ? "submitted" : first === "D" ? "attention" : !grade ? "neutral" : "negative";
};
const short = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
const shortDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(new Date(iso));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th");
const roll = (n: number) => `Roll ${String(n).padStart(2, "0")}`;
const dash = () => text("—", { tone: "neutral" });
const embed = (component: string, props: Record<string, unknown>): PanelRow => row("1fr", [{ type: "embed", component, props }]);
const unique = <T,>(values: T[]) => values.filter((value, index) => values.indexOf(value) === index);

const resultHref = (classId: string, subjectId: string) => `/score-entry-results/results/${classId}/subject/${subjectId}`;
const studentHref = (classId: string, subjectId: string, studentId: string) => `${resultHref(classId, subjectId)}/students/${studentId}`;
const broadsheetHref = (classId: string) => `/score-entry-results/results/${classId}/broadsheet`;

export async function teacherScoresTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  // An early-years teacher describes what they saw; they do not enter scores.
  if (me.persona === "early-years" && (tabSlug === "enter" || tabSlug === "results")) return teacherObservationsTab(tabSlug);
  if (tabSlug === "enter") return enterTab(await apiGet<SheetsView>(`${API}/sheets`), me);
  if (tabSlug === "results") return resultsTab(await apiGet<ResultsView>(`${API}/results`), permissions);
  if (tabSlug === "review") return reviewTab(await apiGet<OversightView>(`${API}/oversight`));
  return undefined;
}

/* ───────────────────────── Enter: your sheets ───────────────────────── */

function coverWhy(entry: { subject: string; arm: string; coverOf: string | null; until: string }): DrawerSpec {
  const ends = shortDay(entry.until);
  const owner = entry.coverOf ?? "the subject teacher";
  return {
    mode: "view", readOnly: true, kicker: "Cover", title: `${entry.subject} · ${entry.arm}`,
    sub: "A cover assignment grants register marking only, or register and score entry. Yours grants the register.",
    facts: [
      ["Cover of", owner, `Until ${ends}`],
      ["You may", "Mark the daily register", `Attributed to you, with ${owner} recorded alongside`],
      ["You may not", "Enter or submit scores", "That was not granted with this cover"],
      ["Who can", `${owner}, or whoever the Principal assigns`, ""],
      ["Ends", ends, "Scope is revoked that day, automatically"],
    ],
  };
}

function enterTab(v: SheetsView, me: TeacherWorkspaceView): TabContent {
  const open = v.rows.filter((entry) => entry.state !== "Submitted" && entry.state !== "Approved");
  const lead = v.kpis.firstReturned ? v.rows.find((entry) => entry.classId === v.kpis.firstReturned!.classId && entry.subjectId === v.kpis.firstReturned!.subjectId) : open[0];
  const locked = (state: string) => state === "Submitted" || state === "Approved";
  const sheets: TableRow[] = v.rows.map((entry) => {
    const lockedNow = locked(entry.state);
    const note = entry.basis === "Cover" && !lockedNow ? `Cover until ${entry.until ? shortDay(entry.until) : "the cover ends"} · attributed to you`
      : entry.state === "Submitted" ? "Locked to you · with the reviewer" : entry.state === "Approved" ? "Final · feeds the report cards"
      : entry.flagged ? `${entry.flagged} mark${entry.flagged === 1 ? " is" : "s are"} above the maximum` : v.closes ? `Closes ${short(v.closes)}` : "No closing date set";
    return {
      keywords: `${entry.subject} ${entry.arm}`,
      cells: [
        text(entry.subject, { strong: true }), text(entry.arm), text(String(entry.roll), { mono: true }), pill(entry.state, tone(entry.state)),
        { kind: "bar", pct: entry.roll ? Math.round((entry.entered / entry.roll) * 100) : 0, label: `${entry.entered} of ${entry.roll}`, tone: entry.entered === entry.roll ? "positive" : "attention" },
        entry.entered > 0 && entry.mean !== null ? text(String(entry.mean), { mono: true }) : dash(),
        text(note, { tone: entry.flagged ? "negative" : "neutral" }),
        { kind: "action", label: entry.state === "Not started" ? "Enter" : entry.state === "Returned" ? "Correct and resubmit" : lockedNow ? "View" : "Continue", href: lockedNow ? previewHref(entry.classId, entry.subjectId) : gridHref(entry.classId, entry.subjectId) },
      ] as TableCellKind[],
    };
  });
  const restricted: TableRow[] = v.restricted.map((entry) => ({
    keywords: `${entry.subject} ${entry.arm} cover`,
    cells: [
      text(entry.subject, { strong: true }), text(entry.arm), dash(), pill("Not granted", "withheld"), dash(), dash(), text("Cover · register only", { tone: "neutral" }),
      { kind: "action", label: "Why not?", drawer: coverWhy(entry) },
    ] as TableCellKind[],
  }));
  const rows = [...sheets, ...restricted];
  const k = v.kpis;
  const subjects = unique(rows.map((entry) => (entry.cells[0] as { text: string }).text));
  const arms = unique(rows.map((entry) => (entry.cells[1] as { text: string }).text));
  const total = v.assigned;
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `${v.windowName ?? "Scores"} · ${v.term}${v.closes ? ` · the window closes ${short(v.closes)}` : ""}.`, per: 5,
      cards: [
        { label: "Sheets outstanding", value: String(k.open), unit: `of ${k.sheets}`, sub: v.daysLeft !== null ? `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left` : "No closing date set", tone: k.open ? "negative" : "positive" },
        { label: "Marks entered", value: String(k.entered), unit: `of ${k.children}`, sub: "Across your sheets", tone: k.entered < k.children ? "attention" : "positive" },
        { label: "Returned to you", value: String(k.returned), sub: k.firstReturned ? `${k.firstReturned.subject} ${k.firstReturned.arm} · read the comment` : "Nothing sent back", tone: k.returned ? "negative" : "positive", link: k.firstReturned ? "Open it" : undefined, href: k.firstReturned ? gridHref(k.firstReturned.classId, k.firstReturned.subjectId) : undefined },
        { label: "Saved on this device", value: String(v.pending), unit: "marks", sub: "Queued, provisional", tone: "offline" },
        { label: "Blank is not zero", value: String(Math.max(0, k.children - k.entered)), unit: "blanks", sub: "A blank leaves a child without a total", tone: k.children - k.entered > 0 ? "attention" : "positive" },
      ],
    }]),
    row("1fr", [{
      type: "table", dense: true, title: "Your sheets", sub: "One subject-arm is one sheet. Open one and every child in that arm is on it.", meta: `${total} assignment${total === 1 ? "" : "s"} · ${v.rows.length} with score entry`, noun: "sheet", nounPlural: "sheets",
      search: total > 2 ? "Find a subject or an arm" : undefined,
      filters: total > 1 ? [{ label: "Subject", value: "All", options: ["All", ...subjects], column: 0 }, { label: "Arm", value: "All", options: ["All", ...arms], column: 1 }, { label: "State", value: "All", options: ["All", "Not started", "In progress", "Submitted", "Returned", "Approved", "Not granted"], column: 3 }] : undefined,
      head: ["Subject", "Arm", "Roll", "State", "Entered", "Avg", "Note", ""], rows, noRowOpen: true, per: 12,
      empty: "Nothing is assigned to you for score entry. If you teach a subject, ask the office to add it in Timetable → Teaching.",
      foot: "Type a mark, Tab moves across, A marks a child absent.",
    }]),
    row("1.1fr 1fr", [
      { type: "steps", title: "Where a sheet of yours can be", steps: [{ label: "Draft · yours alone", state: "current" }, { label: "Submitted · locked to you", state: "todo" }, { label: "Returned or approved", state: "todo" }] },
      {
        type: "facts", title: "What the states mean", per: 1,
        facts: [
          ["Draft", "Editable, saved as you go, visible to nobody else", "Not counted in any review"],
          ["Submitted", "Locked to you, visible to your reviewer", "Online only"],
          ["Returned", "Editable again, with a comment", "The comment is a conversation, not a rejection"],
          ["Approved", "Fully locked, available to report cards", "A change now needs a correction request, with a reason"],
          ["Offline entry", "Provisional, pending sync", "The server value replaces it; any difference is logged"],
        ],
      },
    ]),
  ];
  return {
    title: me.persona === "early-years" ? "Enter observations" : "Enter scores", desc: "Your assigned subject-arms. Nothing else is enterable by you.",
    primary: lead ? { label: `${lead.state === "Returned" ? "Correct " : lead.state === "Not started" ? "Start " : "Continue "}${lead.subject} ${lead.arm}`, icon: PEN, href: locked(lead.state) ? previewHref(lead.classId, lead.subjectId) : gridHref(lead.classId, lead.subjectId) } : undefined,
    launchers: lead && !locked(lead.state) ? [{ label: "Import from the school’s Excel template", href: `${gridHref(lead.classId, lead.subjectId)}/import` }] : [],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

/* ───────────────────────── the sheet itself ───────────────────────── */

type Content = TabContent & { crumb: { label: string; href: string } };

/** The sheet a teacher types into. A sheet that has been submitted or approved is read, not typed. */
export function teacherGridPage(g: Grid, v: SheetsView): Content {
  const mineRows = v.rows;
  const sameSubject = unique(mineRows.filter((entry) => entry.subjectId === g.subject.id).map((entry) => entry.classId));
  const subjects = unique(mineRows.map((entry) => entry.subjectId));
  const label = (entry: SheetRow, by: "arm" | "subject") => (by === "arm" ? entry.arm : entry.subject);
  // One option per subject, opening its first arm. The school lists some subjects once for each stage, so a name is never enough on its own.
  const subjectOptions = unique(mineRows.map((entry) => entry.subjectId)).map((id) => mineRows.find((candidate) => candidate.subjectId === id)!);
  const subjectLabel = (entry: SheetRow) => (subjectOptions.filter((other) => other.subject === entry.subject).length > 1 ? `${entry.subject} · ${entry.arm}` : entry.subject);
  const currentSubject = subjectOptions.find((entry) => entry.subjectId === g.subject.id);
  const switchers = [
    ...(sameSubject.length > 1 ? [{ label: "Arm", value: g.arm.name, options: mineRows.filter((entry) => entry.subjectId === g.subject.id).map((entry) => ({ label: label(entry, "arm"), href: gridHref(entry.classId, entry.subjectId) })) }] : []),
    ...(subjects.length > 1 ? [{ label: "Subject", value: currentSubject ? subjectLabel(currentSubject) : g.subject.name, options: subjectOptions.map((entry) => ({ label: subjectLabel(entry), href: gridHref(entry.classId, entry.subjectId) })) }] : []),
  ];
  const remove = undefined;
  return {
    crumb: { label: "Back to your sheets", href: "/score-entry-results/enter" },
    title: `Enter scores · ${g.subject.name} ${g.arm.name}`, desc: "Absent is not zero, and blank is not zero. Save a draft as you go — nothing leaves you until you submit it.",
    primary: { label: "Preview, then submit", icon: EYE, href: previewHref(g.arm.id, g.subject.id) },
    launchers: [{ label: "Results for this arm", href: resultHref(g.arm.id, g.subject.id) }],
    rows: [embed("teacher-sheet", {
      arm: g.arm.name, subject: g.subject.name, window: (v.windowName ?? "scores").toLowerCase(),
      columns: g.columns.map((column) => ({ key: column.key, id: column.id, name: column.name, short: column.short, max: column.max, weight: column.weight })),
      rows: g.rows.map((entry, index) => ({ id: entry.id, name: entry.name, adm: entry.adm, roll: index + 1, cells: entry.cells })),
      bands: g.bands.map((band) => ({ label: band.label, min: band.min })), passMark: g.passMark, whyNot: g.blocked,
      returned: g.returned ? { note: g.returned.note, by: g.returned.by ? `${g.returned.by}${g.returned.byRole ? `, ${g.returned.byRole.toLowerCase()}` : ""}` : null } : null,
      saveEndpoint: `/api/v1/score-results/enter/${g.arm.id}/${g.subject.id}/save`, previewHref: previewHref(g.arm.id, g.subject.id), importHref: g.editable ? `${gridHref(g.arm.id, g.subject.id)}/import` : null,
      switchers, remove, frameworkLabel: g.pinned ? "Framework pinned to this sheet" : "",
    })],
  };
}

const bandWord = (rating: string, ranked: boolean, absent: boolean) => (!ranked ? (absent ? "Absent" : "Not ranked") : rating);

/** Every child, every component, exactly as it will be submitted — or, once submitted, as it is held. */
export function teacherPreviewPage(g: Grid, v: SheetsView): Content {
  const own = g.mine || v.rows.some((entry) => entry.classId === g.arm.id && entry.subjectId === g.subject.id);
  const state = g.state;
  const locked = !own || state === "Submitted" || state === "Approved";
  const blanks = g.rows.filter((entry) => !entry.complete).length;
  const ranked = g.rows.filter((entry) => entry.total !== null && entry.complete && entry.absent === 0);
  const credit = ranked.filter((entry) => (entry.total as number) >= 50).length;
  const maxTotal = g.columns.reduce((sum, column) => sum + column.max, 0);
  const high = ranked.slice().sort((a, b) => (b.total as number) - (a.total as number))[0];
  const low = ranked.slice().sort((a, b) => (a.total as number) - (b.total as number))[0];
  const meanRanked = ranked.length ? Math.round((ranked.reduce((sum, entry) => sum + (entry.total as number), 0) / ranked.length) * 10) / 10 : null;
  const failed = ranked.filter((entry) => (entry.total as number) < g.passMark).length;
  const absMarks = g.rows.reduce((sum, entry) => sum + entry.absent, 0);
  const back = gridHref(g.arm.id, g.subject.id);
  const submitLabel = state === "Returned" ? "Resubmit for approval" : "Submit for approval";
  const submit: DrawerSpec = {
    mode: "commit", kicker: "Enter scores", title: `Submit ${g.subject.name} · ${g.arm.name} for approval`,
    sub: blanks ? `${plural(blanks, "child has", "children have")} no complete mark. They will have no total for this subject.` : "Every child has a mark.",
    facts: [
      ["Sheet", `${g.subject.name} · ${g.arm.name}`, `${g.term.name} ${g.term.session}`],
      ["Entered", `${g.rows.length - blanks} of ${g.rows.length}`, blanks ? `${blanks} still blank` : "Complete"],
      ["Class average", meanRanked === null ? "—" : String(meanRanked), `${ranked.length - failed} of ${ranked.length} at the pass mark or above`],
      ["Absent", plural(absMarks, "mark"), "Excluded from the average, never zero"],
      ["Goes to", "The review queue", "An Exam Officer, who decides it — because you entered it, you cannot approve it"],
      ["After submission", "Locked to you", "A change needs the reviewer to return it"],
    ],
    commitLabel: submitLabel, commitDone: "Sheet submitted", commitDoneBody: `${g.subject.name} · ${g.arm.name} is in the review queue. You will be told if it comes back.`,
    next: { label: "Back to your sheets", href: "/score-entry-results/enter" },
    submit: { endpoint: `/api/v1/score-results/enter/${g.arm.id}/${g.subject.id}/submit`, method: "POST" },
  };
  const ordered = g.rows.map((entry, index) => ({ entry, index })).sort((a, b) => ((b.entry.complete && b.entry.absent === 0 && b.entry.total !== null ? b.entry.total : -1) - (a.entry.complete && a.entry.absent === 0 && a.entry.total !== null ? a.entry.total : -1)));
  const comp = (value: number | "ABS" | null | undefined): TableCellKind => (value === null || value === undefined ? text("—", { tone: "neutral" }) : value === "ABS" ? pill("ABS", "withheld") : text(String(value), { mono: true }));
  const gradeCounts = g.bands.map((band) => ({ band, count: ranked.filter((entry) => entry.grade === band.label).length }));
  const tableRows: TableRow[] = ordered.map(({ entry, index }) => {
    const isRanked = entry.complete && entry.absent === 0 && entry.total !== null;
    return {
      keywords: `${entry.name} ${roll(index + 1)} grade:${entry.grade ?? "none"}| rating:${bandWord(entry.rating, isRanked, entry.absent > 0)}|`,
      cells: [
        text(isRanked && entry.pos ? String(entry.pos) : "—", { mono: true, strong: true }), { kind: "name", name: entry.name, sub: roll(index + 1) },
        ...g.columns.map((column) => comp(entry.cells[column.key])),
        entry.complete && entry.total !== null ? text(String(entry.total), { mono: true, strong: true }) : text("—", { tone: "neutral" }),
        entry.complete && entry.grade ? pill(entry.grade, gradeTone(entry.grade)) : pill("—", "neutral"), text(bandWord(entry.rating, isRanked, entry.absent > 0)),
        locked ? (own ? { kind: "action", label: "Open", href: studentHref(g.arm.id, g.subject.id, entry.id) } : text("")) : { kind: "action", label: "Edit", href: back },
      ] as TableCellKind[],
    };
  });
  const ratings = unique(ordered.map(({ entry }) => bandWord(entry.rating, entry.complete && entry.absent === 0 && entry.total !== null, entry.absent > 0))).sort();
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", per: 6, title: locked ? "This sheet" : "What you are about to submit",
      cards: [
        { label: "Entered", value: `${g.rows.length - blanks} of ${g.rows.length}`, sub: blanks ? `${blanks} still blank` : "No blanks", tone: blanks ? "attention" : "positive" },
        { label: "Class average", value: meanRanked === null ? "—" : String(meanRanked), unit: ranked.length ? `/ ${maxTotal}` : undefined, sub: `Over ${ranked.length} ranked ${ranked.length === 1 ? "child" : "children"}` },
        { label: "Highest", value: high ? String(high.total) : "—", sub: high ? high.name : "", tone: "positive" },
        { label: "Lowest", value: low ? String(low.total) : "—", sub: low ? low.name : "", tone: low && (low.total as number) < g.passMark ? "negative" : "attention" },
        { label: "At credit or above", value: String(credit), unit: `of ${ranked.length}`, sub: "50 and above", tone: "positive" },
        { label: "Below the pass mark", value: String(failed), sub: `Under ${g.passMark}`, tone: failed ? "negative" : "positive" },
      ],
    }]),
    !locked && blanks ? row("1fr", [{
      type: "note", tone: "attention", icon: WARN, title: `${plural(blanks, "child has", "children have")} no complete mark`,
      body: "A blank is not a zero and it is not an absence. Submitting with blanks leaves those children without a total, and their report cards stay blocked.", acts: [{ label: "Go back and fill them in", href: back }],
    }]) : null,
    row("1fr", [{
      type: "table", dense: true, title: `Every child in ${g.arm.name}`, tag: "Ranked by total", tagTone: "neutral",
      sub: `${g.columns.map((column) => `${column.name} /${column.max}`).join(", ")}. A dash is blank, not a zero.`, meta: `${g.subject.name}${g.pinned ? " · framework pinned" : ""}`,
      search: "Find a child by name or roll number",
      filters: [{ label: "Grade", value: "All", options: ["All", ...g.bands.map((band) => band.label)], match: Object.fromEntries(g.bands.map((band) => [band.label, `grade:${band.label}|`])) }, { label: "Rating", value: "All", options: ["All", ...ratings], match: Object.fromEntries(ratings.map((rating) => [rating, `rating:${rating}|`])) }],
      acts: locked ? [] : [{ label: "Keep editing", href: back }, { label: state === "Returned" ? "Resubmit" : "Submit for approval", primary: true, drawer: submit }],
      head: ["Pos", "Student", ...g.columns.map((column) => column.short), "Total", "Grade", "Rating", ""], rows: tableRows, noun: "child", nounPlural: "children", noRowOpen: true, per: 40,
      foot: locked ? "A submitted sheet is locked to its teacher." : "This is the sheet as it will be submitted.",
    }]),
    row("1fr 1fr", [
      { type: "bars", title: "Grade spread", sub: "Against this school’s own bands.", rows: gradeCounts.map(({ band, count }) => ({ label: `${band.label} · ${band.min}–${band.max}`, value: ranked.length ? Math.round((count / ranked.length) * 100) : 0, display: String(count), tone: gradeTone(band.label) })) },
      {
        type: "facts", title: "Checks on this sheet", per: 1,
        facts: [
          ["Marks within their maxima", "Passed", g.columns.map((column) => `${column.short} ${column.max}`).join(" · ")],
          ["Blanks", blanks ? `${blanks} — they will have no total` : "None", ""],
          ["Absences", plural(absMarks, "mark"), "Excluded from the average, never scored zero"],
          ["Goes to", "The review queue", "An Exam Officer decides it"],
          ["Entered by", g.enteredBy.length ? g.enteredBy.join(", ") : own ? "You" : "Another teacher", own ? "Because you entered it, you cannot approve it" : ""],
        ] as PanelFact[],
      },
    ]),
  ];
  return {
    crumb: locked ? { label: "Back to the sheets", href: "/score-entry-results/enter" } : { label: "Back to the entry grid", href: back },
    title: `${locked ? "" : "Preview · "}${g.subject.name} · ${g.arm.name}`,
    desc: !own ? "Read only · this sheet belongs to another teacher." : state === "Submitted" ? "Submitted · locked to you while the reviewer reads it." : state === "Approved" ? "Approved · final, and feeding the report cards." : "Every child, every component, exactly as it will be submitted.",
    primary: locked ? (own ? { label: "Open the results", icon: ARROW, href: resultHref(g.arm.id, g.subject.id) } : undefined) : { label: submitLabel, icon: "M5 12.5l4.5 4.5 9-10", drawer: submit },
    launchers: locked ? [] : [{ label: "Keep editing", href: back }],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

export const loadSheets = () => apiGet<SheetsView>(`${API}/sheets`);

/* ───────────────────────── Results ───────────────────────── */

function resultsTab(r: ResultsView, permissions: string[]): TabContent {
  const canSee = (slug: string, tab: string) => permissions.includes(schoolPermissionKey(slug, tab, "View"));
  const lead = r.rows.find((entry) => entry.ranked);
  const subjects = unique(r.rows.map((entry) => entry.subject));
  const arms = unique(r.rows.map((entry) => entry.arm));
  const rows: TableRow[] = r.rows.map((entry) => {
    const status = !entry.ranked ? "Not entered" : entry.state === "Approved" ? "Final" : "Provisional";
    return {
      keywords: `${entry.subject} ${entry.arm}`,
      cells: [
        text(entry.subject, { strong: true }), text(entry.arm), text(String(entry.roll), { mono: true }), text(`${entry.complete} of ${entry.roll}`),
        entry.ranked && entry.mean !== null ? text(String(entry.mean), { mono: true }) : dash(), entry.ranked && entry.passRate !== null ? text(`${entry.passRate}%`) : dash(),
        entry.high !== null && entry.ranked ? text(String(entry.high), { mono: true }) : dash(), pill(status, !entry.ranked ? "attention" : status === "Final" ? "positive" : "progress"),
        { kind: "action", label: entry.ranked ? "Open results" : "Enter", href: entry.ranked ? resultHref(entry.classId, entry.subjectId) : gridHref(entry.classId, entry.subjectId) },
      ] as TableCellKind[],
    };
  });
  const bars = r.rows.map((entry) => ({
    label: `${entry.subject} · ${entry.arm}`, value: Math.round(entry.mean ?? 0), display: entry.ranked ? String(entry.mean) : "—",
    sub: entry.ranked ? `${entry.failed} below ${40} · highest ${entry.high}` : "Nothing entered yet", tone: (entry.mean ?? 0) >= 60 ? "positive" as const : (entry.mean ?? 0) >= 50 ? "submitted" as const : "attention" as const,
  }));
  const form = r.formArms[0];
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", per: 4,
      cards: [
        { label: "Your average", value: r.average === null ? "—" : String(r.average), unit: r.average === null ? undefined : "/ 100", sub: `Across ${r.ranked} ranked ${r.ranked === 1 ? "child" : "children"}`, tone: "positive" },
        { label: "Children", value: String(r.children), sub: plural(r.rows.length, "subject-arm") },
        { label: "Below the pass mark", value: String(r.below), sub: r.below ? "Under 40 · each one is a conversation" : "Nobody under 40", tone: r.below ? "negative" : "positive" },
        { label: "Final", value: String(r.approved), unit: `of ${r.rows.length}`, sub: "Approved sheets · the rest are provisional", tone: r.approved === r.rows.length ? "positive" : "attention" },
      ],
    }]),
    row("1fr", [{
      type: "table", dense: true, title: "Your subject-arms", sub: "Open one for every child, ranked, with the components behind each total.", noun: "subject-arm", nounPlural: "subject-arms",
      filters: r.rows.length > 1 ? [{ label: "Subject", value: "All", options: ["All", ...subjects], column: 0 }, { label: "Arm", value: "All", options: ["All", ...arms], column: 1 }, { label: "State", value: "All", options: ["All", "Not entered", "Provisional", "Final"], column: 7 }] : undefined,
      head: ["Subject", "Arm", "Roll", "Entered", "Average", "Pass", "Highest", "State", ""], rows, noRowOpen: true, per: 12, empty: "No result yet — nothing is assigned to you for score entry.", foot: "Provisional until the sheet is approved.",
    }]),
    r.rows.some((entry) => entry.ranked)
      ? row("1fr 1.15fr", [
          { type: "bars", title: "Average by subject-arm", sub: "Out of 100, over the children ranked so far.", rows: bars },
          {
            type: "list", title: "Children to look at", sub: "Below the pass mark, close to it, or falling since last term.",
            items: r.look.length
              ? r.look.map((entry) => ({
                  label: `${entry.child} · ${entry.subject} ${entry.arm}`, pill: entry.why, tone: entry.why === "Below the pass mark" ? "negative" as const : "attention" as const,
                  sub: [`${entry.total} of 100`, entry.grade, entry.last !== null ? `last term ${entry.last}` : null, entry.attendance !== null ? `attendance ${entry.attendance}%` : null].filter(Boolean).join(" · "),
                  viewLabel: "Open", href: studentHref(entry.classId, entry.subjectId, entry.studentId),
                }))
              : [{ label: "Nobody is below 45 or falling", sub: "Every ranked child is comfortably above the pass mark.", pill: "Clear", tone: "positive" as const }],
          },
        ])
      : null,
    form && canSee("report-cards", "remarks")
      ? row("1fr", [{
          type: "tiles", title: `Your form class · ${form.name}`, sub: "Every subject your class takes, not only yours.",
          tiles: [
            { label: `${form.name} broadsheet`, sub: "Every child against every subject, with positions and the marks still missing", icon: SCORE, href: broadsheetHref(form.id) },
            { label: "Remarks for the report cards", sub: `${r.remarks.written} of ${r.remarks.roll} written`, icon: PEN, href: "/report-cards/remarks" },
          ],
        }])
      : null,
  ];
  return {
    title: "Results", desc: "Your subjects, arm by arm, then any child — and how every number was reached.",
    primary: lead ? { label: `Open ${lead.subject} ${lead.arm}`, icon: ARROW, href: resultHref(lead.classId, lead.subjectId) } : undefined,
    launchers: form && canSee("student-records", "registry") ? [{ label: `Your form class broadsheet · ${form.name}`, href: broadsheetHref(form.id) }] : [],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

export const loadSubjectResult = (classId: string, subjectId: string) => apiGet<SubjectResult>(`${API}/results/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`);
export const loadStudentResult = (classId: string, subjectId: string, studentId: string) => apiGet<StudentResult>(`${API}/results/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/students/${encodeURIComponent(studentId)}`);
export const loadFormBroadsheet = (classId: string) => apiGet<FormBroadsheet>(`${API}/broadsheet/${encodeURIComponent(classId)}`);

const cellOf = (value: number | "ABS" | null | undefined): TableCellKind => (value === null || value === undefined ? text("—", { tone: "neutral" }) : value === "ABS" ? pill("ABS", "withheld") : text(String(value), { mono: true }));

/** One subject-arm: every child, ranked, with the components behind each total — and how each stands against last term, the class and its own comment. */
export function subjectResultPage(s: SubjectResult): Content {
  const st = s.stats;
  const back = { label: "Back to your results", href: "/score-entry-results/results" };
  if (!st.ranked) {
    return {
      crumb: back, title: `${s.subject.name} · ${s.arm.name}`, desc: "Nothing has been entered on this sheet yet.",
      primary: s.own ? { label: "Start entering", icon: PEN, href: gridHref(s.arm.id, s.subject.id) } : undefined,
      rows: [row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: "No results yet", body: "A result exists once a child has every component entered. Blank is never treated as zero." }])],
    };
  }
  const n = st.ranked;
  const weak = s.components.filter((component) => component.pct !== null).slice().sort((a, b) => (a.pct as number) - (b.pct as number))[0];
  const firstNo = s.rows.find((entry) => entry.ranked && !entry.comment);
  const order = [...s.rows.filter((entry) => entry.ranked), ...s.rows.filter((entry) => !entry.ranked)];
  const maxTotal = s.columns.reduce((sum, column) => sum + column.max, 0);
  const others = s.others.map((other) => `${other.name} ${other.mean}`).join(" · ");
  const tableRows: TableRow[] = order.map((entry) => {
    const since = entry.since;
    return {
      keywords: `${entry.name} ${roll(entry.roll)} grade:${entry.grade ?? "none"}| standing:${entry.third}| comment:${entry.comment ? "Written" : "Not written"}|`,
      cells: [
        text(entry.pos ? String(entry.pos) : "—", { mono: true, strong: true }), { kind: "name", name: entry.name, sub: roll(entry.roll) },
        ...s.columns.map((column) => cellOf(entry.cells[column.key])),
        entry.complete && entry.total !== null ? text(String(entry.total), { mono: true, strong: true }) : text("—", { tone: "neutral" }),
        entry.complete && entry.grade ? pill(entry.grade, gradeTone(entry.grade)) : pill("—", "neutral"),
        since === null ? text("—", { tone: "neutral" }) : text(`${since > 0 ? "+" : since < 0 ? "−" : ""}${Math.abs(since)}`, { strong: true, tone: since >= 3 ? "positive" : since <= -3 ? "negative" : "neutral" }),
        text(entry.third, { tone: "neutral" }), pill(entry.comment ? "Written" : "Not written", entry.comment ? "positive" : "neutral"),
        { kind: "action", label: "Open", href: studentHref(s.arm.id, s.subject.id, entry.id) },
      ] as TableCellKind[],
    };
  });
  const grades = s.bands.map((band) => ({ band, count: s.rows.filter((entry) => entry.ranked && entry.grade === band.label).length }));
  const filters = [
    ...(s.arms.length > 1 ? [{ label: "Arm", value: s.arm.name, options: s.arms.map((arm) => arm.name), go: Object.fromEntries(s.arms.filter((arm) => arm.id !== s.arm.id).map((arm) => [arm.name, resultHref(arm.id, s.subject.id)])) }] : []),
    { label: "Grade", value: "All", options: ["All", ...s.bands.map((band) => band.label)], match: Object.fromEntries(s.bands.map((band) => [band.label, `grade:${band.label}|`])) },
    { label: "Standing", value: "All", options: ["All", "Top third", "Middle third", "Bottom third", "Not ranked"], match: Object.fromEntries(["Top third", "Middle third", "Bottom third", "Not ranked"].map((value) => [value, `standing:${value}|`])) },
    { label: "Comment", value: "All", options: ["All", "Written", "Not written"], match: { Written: "comment:Written|", "Not written": "comment:Not written|" } },
  ];
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", per: 6,
      cards: [
        { label: "Class average", value: st.mean === null ? "—" : String(st.mean), unit: `/ ${maxTotal}`, sub: others || `Over ${n} children`, tone: s.others.length && s.others[0]!.mean > (st.mean ?? 0) ? "attention" : "positive" },
        { label: "Highest", value: s.high ? String(s.high.total) : "—", sub: s.high?.name ?? "", tone: "positive" },
        { label: "Lowest", value: s.low ? String(s.low.total) : "—", sub: s.low?.name ?? "", tone: s.low && s.low.total < s.passMark ? "negative" : "attention" },
        { label: "Pass rate", value: st.passRate === null ? "—" : `${st.passRate}%`, sub: `${st.pass} of ${n} at ${s.passMark} or above`, tone: st.pass === n ? "positive" : "attention" },
        { label: "Credit or above", value: st.creditRate === null ? "—" : `${st.creditRate}%`, sub: `${st.credit} of ${n} at ${s.creditMark} or above` },
        { label: "Comments written", value: String(st.comments), unit: `of ${st.roll}`, sub: `Print beside the ${s.subject.name} line`, tone: st.comments === st.roll ? "positive" : "attention" },
      ],
    }]),
    weak && (weak.pct as number) < 70
      ? row("1fr", [{
          type: "note", tone: "progress", icon: QUESTION,
          title: `The class lost most marks in ${weak.exam ? "the exam" : weak.name.toLowerCase()} — ${weak.mean} of ${weak.max} on average`,
          body: `That is ${weak.pct}% of the marks available, the weakest of the ${s.components.length} components. ${weak.exam ? "Class work is holding up; the examination is where the gap opens." : "Worth a look before the next assessment."}`,
          acts: s.own && firstNo ? [{ label: "Start the subject comments", href: studentHref(s.arm.id, s.subject.id, firstNo.id) }] : [],
        }])
      : null,
    row("1fr", [{
      type: "table", dense: true, title: `Every child in ${s.arm.name}`, tag: "Ranked by total", tagTone: "neutral",
      sub: s.hasLast ? "Since last term compares this total with the same subject last term." : "Since last term shows once the school has last term’s total for this subject on record.",
      noun: "child", nounPlural: "children", search: "Find a child by name or roll number", filters, selectable: true, bulkActs: [{ label: "Export the selected results", primary: true, export: true }],
      acts: [{ label: "Export these rows", export: true }],
      head: ["Pos", "Student", ...s.columns.map((column) => column.short), "Total", "Grade", "Since last", "Standing", "Comment", ""], rows: tableRows, noRowOpen: true, per: 40,
      foot: "A child with a blank or an absence is listed last and not ranked.",
    }]),
    row("1fr 1fr", [
      { type: "bars", title: "Grade spread", sub: "Against this school’s own bands.", rows: grades.map(({ band, count }) => ({ label: `${band.label} · ${band.min}–${band.max}`, value: Math.round((count / Math.max(1, n)) * 100), display: String(count), tone: gradeTone(band.label) })) },
      {
        type: "bars", title: "Where the marks were won and lost", sub: "The class average on each component, as a share of its maximum.",
        rows: s.components.map((component) => ({ label: `${component.name} · out of ${component.max}`, value: component.pct ?? 0, display: component.mean === null ? "—" : `${component.mean.toFixed(1)} · ${component.pct}%`, tone: (component.pct ?? 0) >= 70 ? "positive" as const : (component.pct ?? 0) >= 55 ? "submitted" as const : "attention" as const })),
      },
    ]),
  ];
  const paper: DrawerSpec = {
    mode: "document", kicker: "Results", title: `Print ${s.subject.name} · ${s.arm.name}`,
    doc: {
      heading: "Class result preview", state: { label: s.final ? "Final" : "Provisional", tone: s.final ? "positive" : "attention" }, meta: `${s.subject.name} · ${s.arm.name} · ${s.term.name}`,
      letterhead: s.letterhead, kicker: "CLASS RESULT", title: `${s.subject.name} · ${s.arm.name}`, ref: `${s.term.name}${s.session ? `, ${s.session}` : ""}`,
      ...(s.final ? {} : { stamp: { text: "PROVISIONAL", tone: "attention" as PanelTone } }),
      idents: [["Subject", s.subject.name], ["Arm", s.arm.name], ["Term", `${s.term.name}${s.session ? ` ${s.session}` : ""}`], ["Children", String(st.roll)]],
      tables: [{
        heads: [{ label: "Pos", align: "center" as const }, { label: "Student", align: "left" as const }, ...s.columns.map((column) => ({ label: `${column.short} /${column.max}`, align: "center" as const })), { label: "Total", align: "center" as const }, { label: "Grade", align: "center" as const }, { label: "Standing", align: "left" as const }],
        rows: order.map((entry) => [entry.pos ? String(entry.pos) : "—", entry.name, ...s.columns.map((column) => (entry.cells[column.key] === null || entry.cells[column.key] === undefined ? "—" : String(entry.cells[column.key]))), { text: entry.complete && entry.total !== null ? String(entry.total) : "—", bold: true }, entry.complete && entry.grade ? entry.grade : "—", entry.third]),
      }],
      totals: [
        { label: "Class average", value: st.mean === null ? "—" : String(st.mean), sub: `Out of ${maxTotal}` },
        { label: "Highest", value: s.high ? String(s.high.total) : "—", sub: s.high?.name },
        { label: "Lowest", value: s.low ? String(s.low.total) : "—", sub: s.low?.name },
        { label: "Pass rate", value: st.passRate === null ? "—" : `${st.passRate}%`, sub: `${st.pass} of ${n} at ${s.passMark} or above` },
      ],
      footNote: s.final ? "Approved and final." : "Provisional until the sheet is approved. A child with a blank or an absence is listed last and not ranked.",
      acts: [{ label: "Print", print: true, primary: true }],
    },
  };
  const finalNote = s.final ? "Final · approved and feeding the report cards." : `Provisional until the sheet is approved · ${st.complete} of ${st.roll} entered.`;
  return {
    crumb: back, title: `${s.subject.name} · ${s.arm.name}`, desc: `${finalNote} Open any child for the trace behind their total.`,
    primary: { label: "Print the class result", icon: "M7 8V4h10v4M6 17H4v-6h16v6h-2M7 14h10v6H7z", drawer: paper },
    launchers: [
      ...(s.own ? [{ label: s.state === "Approved" || s.state === "Submitted" ? "Open the sheet" : "Open the entry grid", href: s.state === "Approved" || s.state === "Submitted" ? previewHref(s.arm.id, s.subject.id) : gridHref(s.arm.id, s.subject.id) }] : []),
      ...(s.own && firstNo ? [{ label: "Write subject comments", href: studentHref(s.arm.id, s.subject.id, firstNo.id) }] : []),
    ],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

/* ───────────────────────── one child ───────────────────────── */

export function suggestionsFor(st: StudentResult): Array<{ text: string; sub: string }> {
  const first = st.student.name.split(" ")[0] ?? st.student.name;
  const subject = st.subject.name;
  if (!st.ranked) return [{ text: `${first} missed part of this term’s assessment. The mark shown is incomplete, and I will review it with the family.`, sub: "Fits an incomplete result" }];
  const total = st.total as number;
  const classwork = st.components.filter((component) => !component.exam && typeof component.value === "number");
  const exam = st.components.find((component) => component.exam && typeof component.value === "number");
  const pct = (value: number, max: number) => (value / max) * 100;
  const examGap = exam && classwork.length ? classwork.reduce((sum, component) => sum + pct(component.value as number, component.max), 0) / classwork.length - pct(exam.value as number, exam.max) > 12 : false;
  const lines = total >= 75
    ? [`${first} has had an excellent term in ${subject} — careful, accurate work throughout. The next step is the harder problems in each topic.`, `Outstanding work. ${first} should keep reading ahead.`]
    : total >= 60
      ? [`${first} understands the main ideas in ${subject}. More practice under timed conditions will lift the examination mark.`, `A good term. ${first} should now aim for full working on every answer.`]
      : total >= 40
        ? [`${first} needs to revise each week rather than just before the examination, and to ask when something is unclear.`, `A fair term in ${subject}. Steady homework will make the difference.`]
        : [`A difficult term in ${subject}. ${first} needs steady support: complete every assignment and come to the weekly clinic.`, `${first} has not yet secured the basics of this term’s topics. I would like to meet the family.`];
  if (examGap) lines.push(`${first} does well in class work but loses marks in the examination. Practising past questions under time will help.`);
  return lines.map((line) => ({ text: line, sub: `Fits a ${st.grade ?? "—"} in ${subject}` }));
}

export function studentWorkingPage(st: StudentResult): Content {
  const first = st.student.name.split(" ")[0] ?? st.student.name;
  const back = { label: `Back to ${st.subject.name} · ${st.arm.name}`, href: resultHref(st.arm.id, st.subject.id) };
  const at = st.student.index;
  const next = st.peers[at + 1];
  const maxTotal = st.components.reduce((sum, component) => sum + component.max, 0);
  const cell = (value: number | "ABS" | null): TableCellKind => (value === null ? text("—", { tone: "neutral" }) : value === "ABS" ? pill("ABS", "withheld") : text(String(value), { mono: true }));
  const when = (iso: string | null) => (iso ? shortDay(iso) : "");
  const components: PanelRow["panels"][number] = {
    type: "table", dense: true, title: "How the total was reached", sub: "The stored components, not a recalculation.", noun: "component", nounPlural: "components", per: 0,
    head: ["Component", "Mark", "Share", "Class average"],
    rows: st.components.map((component) => ({
      cells: [
        { kind: "name", name: component.name, sub: component.value === null ? "Not entered yet" : `Entered by ${component.enteredBy ?? "the subject teacher"}${component.enteredAt ? `, ${when(component.enteredAt)}` : ""}`, avatar: false },
        component.value === null ? text("—", { tone: "neutral" }) : component.value === "ABS" ? pill("ABS", "withheld") : text(`${component.value} of ${component.max}`, { mono: true }),
        typeof component.value === "number" ? text(`${Math.round((component.value / component.max) * 100)}%`) : text("—", { tone: "neutral" }),
        component.classMean === null ? text("—", { tone: "neutral" }) : text(component.classMean.toFixed(1), { mono: true }),
      ] as TableCellKind[],
    })),
    summaryRows: [[{ kind: "name", name: "Total", sub: st.ranked ? `Grade ${st.grade} · position ${st.pos} of ${st.of}` : "Not ranked", avatar: false }, st.complete && st.total !== null ? text(`${st.total} of ${maxTotal}`, { mono: true, strong: true }) : text("—", { tone: "neutral" }), text(""), st.classMean === null ? text("—", { tone: "neutral" }) : text(String(st.classMean), { mono: true })]],
    foot: "An absence is excluded from the average and from positions.",
  };
  void cell;
  const from = Math.max(0, Math.min(at - 4, st.peers.length - 10));
  const window = st.peers.slice(from, from + 10);
  return {
    crumb: back, title: st.student.name, desc: `${st.arm.name} · ${st.student.adm} · ${st.subject.name} · ${st.term.name} ${st.term.session}.`,
    launchers: st.isFormArm ? [{ label: `Open ${first}’s full record`, href: `/student-records/registry/${st.student.id}` }] : [],
    rows: [
      row("1fr", [{
        type: "steps", prevTitle: "Previous student", nextTitle: "Next student", note: `${at + 1} of ${st.student.of} · ${st.subject.name} ${st.arm.name}`,
        prevHref: at > 0 ? studentHref(st.arm.id, st.subject.id, st.peers[at - 1]!.id) : undefined, nextHref: next ? studentHref(st.arm.id, st.subject.id, next.id) : undefined,
        steps: window.map((peer) => { const parts = peer.name.split(" "); return { n: peer.index + 1, label: `${parts[0]}${parts[1] ? ` ${parts[1].slice(0, 1)}.` : ""}`, href: studentHref(st.arm.id, st.subject.id, peer.id), state: peer.id === st.student.id ? ("current" as const) : peer.written ? ("done" as const) : ("todo" as const) }; }),
      }]),
      row("1fr", [{
        type: "kpi", per: 5, title: `This term in ${st.subject.name}`,
        cards: [
          { label: "Total", value: st.complete && st.total !== null ? String(st.total) : "—", unit: st.complete ? `/ ${maxTotal}` : undefined, sub: st.ranked ? `Class average ${st.classMean}` : st.absent ? "An absence — not ranked" : "Not complete yet", tone: !st.ranked ? "attention" : (st.total as number) < 40 ? "negative" : st.classMean !== null && (st.total as number) >= st.classMean ? "positive" : "neutral" },
          { label: "Grade", value: st.grade ?? "—", sub: st.ranked ? st.band : "" },
          { label: "Position", value: st.pos ? `${st.pos}${ordinal(st.pos)}` : "—", unit: st.pos ? `of ${st.of}` : undefined, sub: "Ties share a position" },
          { label: "Since last term", value: st.since === null ? "—" : `${st.since > 0 ? "+" : st.since < 0 ? "−" : ""}${Math.abs(st.since)}`, sub: st.last === null ? "No total from last term on record" : `Last term ${st.last}`, tone: st.since === null ? "neutral" : st.since >= 3 ? "positive" : st.since <= -3 ? "negative" : "neutral" },
          { label: "Attendance", value: st.attendance === null ? "—" : `${st.attendance}%`, sub: "This term", tone: st.attendance !== null && st.attendance < 85 ? "attention" : "positive" },
        ],
      }]),
      embed("student-working", {
        components, endpoint: `${API}/results/${st.arm.id}/${st.subject.id}/students/${st.student.id}/comment`, initial: st.comment?.text ?? "", first, subject: st.subject.name, own: st.own,
        suggestions: st.own ? suggestionsFor(st) : [], nextHref: next ? studentHref(st.arm.id, st.subject.id, next.id) : null, doneHref: resultHref(st.arm.id, st.subject.id),
      }),
    ],
  };
}

/* ───────────────────────── the form class ───────────────────────── */

export function formBroadsheetPage(b: FormBroadsheet): Content {
  const k = b.kpis;
  const rows: TableRow[] = [...b.rows.filter((entry) => entry.complete).sort((a, c) => (a.pos ?? 999) - (c.pos ?? 999)), ...b.rows.filter((entry) => !entry.complete)].map((entry) => ({
    keywords: `${entry.name} ${entry.adm} grade:${entry.grade ?? "none"}| standing:${entry.complete ? "Complete" : "Marks missing"}|`,
    cells: [
      text(entry.pos ? String(entry.pos) : "—", { mono: true, strong: true }), { kind: "name", name: entry.name, sub: entry.adm },
      ...entry.totals.map((value) => (value === null ? text("—", { tone: "neutral" }) : text(String(value), { mono: true }))),
      entry.average === null ? text("—", { tone: "neutral" }) : text(entry.average.toFixed(1), { mono: true, strong: true }),
      entry.grade ? pill(entry.grade, gradeTone(entry.grade)) : pill("—", "neutral"), text(entry.complete ? "Complete" : "Marks missing", { tone: entry.complete ? "neutral" : "attention" }),
      { kind: "action", label: "Open", href: `/student-records/registry/${entry.id}` },
    ] as TableCellKind[],
  }));
  // A column heading is a short word, not the school's internal code: the first letters of the subject's name, made longer until no two agree.
  const heads = new Map<string, string>();
  for (const length of [3, 4, 5, 8, 99]) {
    const taken = new Map<string, number>();
    for (const subject of b.subjects) {
      const head = subject.name.replace(/[^A-Za-z ]/g, "").trim().split(/\s+/)[0]!.slice(0, length);
      taken.set(head, (taken.get(head) ?? 0) + 1);
      heads.set(subject.subjectId, head);
    }
    if ([...taken.values()].every((count) => count === 1)) break;
  }
  const code = (subject: FormBroadsheet["subjects"][number]) => heads.get(subject.subjectId) ?? subject.name.slice(0, 3);
  const standing = b.subjects.map((subject): TableRow => ({
    cells: [
      text(subject.name, { strong: true }), text(subject.code), subject.teacher ? { kind: "name", name: subject.teacher, sub: "Subject teacher", avatar: false } : text("Unassigned", { tone: "negative", strong: true }),
      text(String(subject.entered), { mono: true }), text(String(b.roll - subject.entered), { tone: b.roll - subject.entered ? "negative" : undefined, strong: b.roll - subject.entered > 0 }), subject.mean === null ? text("—", { tone: "neutral" }) : text(String(subject.mean), { mono: true }),
    ] as TableCellKind[],
  }));
  return {
    crumb: { label: "Back to your results", href: "/score-entry-results/results" },
    title: `${b.arm.name} · broadsheet`, desc: "Your form class against every subject it takes. Read only — each sheet belongs to its subject teacher.",
    launchers: [{ label: "Write the remarks", href: "/report-cards/remarks" }],
    rows: [
      row("1fr", [{
        type: "kpi", per: 4,
        cards: [
          { label: "Children complete", value: String(k.complete), unit: `of ${b.roll}`, sub: k.complete === b.roll ? "Every subject in for everyone" : `${b.roll - k.complete} have a subject missing`, tone: k.complete === b.roll ? "positive" : "attention" },
          { label: "Marks missing", value: String(k.missing), sub: k.missing ? "Each one holds back a report card" : "Nothing outstanding", tone: k.missing ? "negative" : "positive" },
          { label: "Class average", value: k.average === null ? "—" : String(k.average), unit: k.average === null ? undefined : "/ 100", sub: "Over the children complete" },
          { label: "Your remarks", value: String(k.remarks), unit: `of ${b.roll}`, sub: "For the report cards", tone: k.remarks === b.roll ? "positive" : "attention" },
        ],
      }]),
      row("1fr", [{
        type: "table", dense: true, title: `Broadsheet · ${b.arm.name}`, tag: "Ranked by average", tagTone: "neutral", noun: "child", nounPlural: "children",
        sub: "A dash is a mark nobody has entered yet. It is never a zero, and it is not averaged in.", search: "Find a child by name or admission number",
        filters: [{ label: "Grade", value: "All", options: ["All", ...b.bands.map((band) => band.label)], match: Object.fromEntries(b.bands.map((band) => [band.label, `grade:${band.label}|`])) }, { label: "Standing", value: "All", options: ["All", "Complete", "Marks missing"], match: { Complete: "standing:Complete|", "Marks missing": "standing:Marks missing|" } }],
        head: ["#", "Student", ...b.subjects.map(code), "Avg", "Grade", "Standing", ""], rows, noRowOpen: true, per: 40, foot: "Each column is a subject, shortened to its first letters.",
      }]),
      row("1fr", [{
        type: "table", dense: true, title: "Where each subject stands", sub: "Who owns each sheet, and how much of it is in.", noun: "subject", nounPlural: "subjects",
        head: ["Subject", "Code", "Teacher", "Entered", "Missing", "Average"], rows: standing, noRowOpen: true, foot: "You see where each sheet stands.",
      }]),
    ],
  };
}

/* ───────────────────────── Review: the department ───────────────────────── */

function reviewTab(o: OversightView): TabContent {
  const k = o.kpis;
  const now = Date.now();
  const days = (iso: string | null) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000)) : 0);
  const waiting = o.rows.find((entry) => entry.state === "Submitted" && entry.owner !== "You");
  const newest = o.rows.filter((entry) => entry.state === "Approved" && entry.decidedAt).sort((a, b) => (b.decidedAt as string).localeCompare(a.decidedAt as string))[0];
  const owing = unique(o.rows.filter((entry) => entry.state === "Not started" && entry.ownerId).map((entry) => `${entry.ownerId}|${entry.owner}`)).map((pair) => { const [id, name] = pair.split("|") as [string, string]; return { id, name }; });
  const nudge: DrawerSpec | null = owing.length
    ? {
        mode: "commit", kicker: `${o.department} · score entry`, title: `Notify ${plural(owing.length, "teacher")}`, sub: "This sends a notification. It is not an approval, and it changes nothing on any record.",
        facts: [["Who is notified", String(owing.length), `Teachers in ${o.department} with an unstarted sheet · ${owing.map((person) => person.name).slice(0, 3).join(", ")}${owing.length > 3 ? "…" : ""}`], ["What they see", "Which sheet is outstanding, and the day the window closes", "Nothing is disclosed about anyone else"], ["Changes anything?", "No", "A notification never alters a record, a state or a deadline"]],
        commitLabel: "Send the notification", commitDone: `Notification sent to ${plural(owing.length, "person", "people")}`, commitDoneBody: "It is in their inbox now. Each one received only what they personally owe.",
        submit: { endpoint: "/api/v1/score-results/notify", method: "POST", body: { users: owing.map((person) => person.id), channels: ["In-app inbox"], message: `Your ${o.department} score sheet is not started yet${o.closes ? ` — the window closes ${short(o.closes)}` : ""}.`, kicker: `${o.department} · score entry`, urgency: "Reminder", href: "/score-entry-results/enter" } },
      }
    : null;
  const teachers = unique(o.rows.map((entry) => entry.owner));
  const arms = unique(o.rows.map((entry) => entry.arm));
  const rows: TableRow[] = o.rows.map((entry) => {
    const noteText = entry.owner === "You" ? "You cannot approve your own" : entry.state === "Submitted" ? "Waiting on you" : entry.state === "Not started" ? "Not yet yours to see" : entry.state === "Approved" ? (entry.decidedAt ? `Approved ${shortDay(entry.decidedAt)}` : "Approved") : entry.age;
    return {
      id: `${entry.classId}:${entry.subjectId}`, keywords: `${entry.unit} ${entry.owner}`,
      cells: [
        text(entry.subject, { strong: true }), text(entry.arm), { kind: "name", name: entry.owner, sub: entry.owner === "You" ? `Head of ${o.department} · you` : "Subject teacher" }, pill(entry.state, tone(entry.state)),
        text(`${entry.entered} of ${entry.roll}`), entry.mean !== null && entry.entered > 0 ? text(String(entry.mean), { mono: true }) : dash(), text(noteText, { tone: "neutral" }),
        entry.state === "Submitted" && entry.owner !== "You"
          ? { kind: "action", label: "Decide", href: `/score-entry-results/review/${entry.classId}/${entry.subjectId}` }
          : entry.owner === "You" ? { kind: "action", label: "Open mine", href: gridHref(entry.classId, entry.subjectId) }
          : entry.state === "Not started" ? dash() : { kind: "action", label: "View", href: `/score-entry-results/review/${entry.classId}/${entry.subjectId}` },
      ] as TableCellKind[],
    };
  });
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `Department scope: ${o.department}. It gives you nothing at all over any other department.`, per: 4,
      cards: [
        { label: "Waiting on you", value: String(k.waitingOnMe), unit: k.waitingOnMe === 1 ? "sheet" : "sheets", sub: waiting ? `${waiting.unit} · ${days(waiting.submittedAt) ? `${days(waiting.submittedAt)} days ago` : "today"}` : "Nothing waiting for your decision", tone: k.waitingOnMe ? "attention" : "positive" },
        { label: "Not started", value: String(k.notStarted), unit: k.notStarted === 1 ? "sheet" : "sheets", sub: o.closes ? `Window closes in ${Math.max(0, Math.ceil((new Date(o.closes).getTime() - now) / 86_400_000))} days` : "No closing date set", tone: k.notStarted ? "negative" : "positive" },
        { label: "Approved", value: String(k.approved), sub: newest ? `${newest.unit} · ${shortDay(newest.decidedAt as string)}` : "None yet", tone: "positive" },
        { label: "Yours, escalated", value: String(k.mine), sub: k.mine ? `Your own sheets go to ${o.reportsTo?.name ?? "the office"}` : "You teach no sheet of your own", tone: "withheld" },
      ],
    }]),
    row("1fr", [{
      type: "table", dense: true, title: `${o.department} sheets`, sub: "You can see where a sheet stands. You cannot change a score inside it.", meta: `${o.rows.length} sheets · ${k.waitingOnMe} waiting on you`, noun: "sheet", nounPlural: "sheets",
      search: "Find a subject, arm or teacher", selectable: true, bulkActs: [{ label: "Export selected", primary: true, export: true }],
      filters: [{ label: "State", value: "All", options: ["All", "Not started", "In progress", "Submitted", "Returned", "Approved"], column: 3 }, { label: "Teacher", value: "All", options: ["All", ...teachers], column: 2 }, { label: "Arm", value: "All", options: ["All", ...arms], column: 1 }],
      head: ["Subject", "Arm", "Teacher", "State", "Entered", "Avg", "Note", ""], rows, noRowOpen: true, per: 8, empty: `${o.department} has no sheet this term.`,
      foot: "Three outcomes only: approve, return for correction, or decline — each with a comment.",
    }]),
    k.mine ? row("1fr", [{ type: "note", tone: "withheld", icon: SHIELD, title: "Nobody approves their own submission", body: `Your own ${k.mine === 1 ? "sheet routes" : `${k.mine} sheets route`} to ${o.reportsTo?.name ?? "the office"}. The item escalates rather than resolving.`, acts: [{ label: "See the route", href: "/approvals-workflow/queue" }] }]) : null,
  ];
  return {
    title: "Review", desc: `${o.department} only. Reviewing is not editing.`,
    primary: waiting ? { label: "Open the sheet waiting on you", icon: ARROW, href: `/score-entry-results/review/${waiting.classId}/${waiting.subjectId}` } : undefined,
    launchers: nudge ? [{ label: `Nudge the ${k.notStarted} not started`, drawer: nudge }] : [],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}
