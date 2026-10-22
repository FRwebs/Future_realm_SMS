import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import type { DrawerSpec, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";
import { teacherObservationsTab } from "@/lib/modules/live/t5-observations";

/**
 * M05 for a teaching person: their own sheets (one subject-arm is one sheet), the results those sheets produce, and — for a head of
 * department — the department's sheets, where reviewing is not editing.
 */

type SheetsView = {
  persona: string;
  term: string;
  closes: string | null;
  daysLeft: number | null;
  pending: number;
  rows: Array<{ classId: string; subjectId: string; subject: string; arm: string; state: string; roll: number; entered: number; mean: number | null; blanks: number; returned: string | null; flagged: number }>;
  assigned: number;
  assisting: number;
  kpis: { open: number; sheets: number; entered: number; children: number; returned: number; firstReturned: { classId: string; subjectId: string; subject: string; arm: string } | null; blanks: number };
};

type ResultsView = {
  average: number | null;
  ranked: number;
  children: number;
  below: number;
  approved: number;
  rows: Array<{ classId: string; subjectId: string; subject: string; arm: string; state: string; roll: number; complete: number; ranked: number; mean: number | null; high: number | null; low: number | null; passed: number; failed: number; passRate: number | null }>;
  look: Array<{ classId: string; subjectId: string; child: string; subject: string; arm: string; total: number; grade: string | null; why: string }>;
  formArms: Array<{ id: string; name: string; roll: number }>;
  persona: string;
};

export type SubjectResult = {
  arm: { id: string; name: string };
  subject: { id: string; name: string };
  state: string;
  final: boolean;
  passMark: number;
  creditMark: number;
  columns: Array<{ key: string; name: string; short: string; max: number }>;
  bands: Array<{ label: string; min: number; max: number; remark: string }>;
  stats: { roll: number; complete: number; ranked: number; mean: number | null; high: number | null; low: number | null; passed: number; failed: number; passRate: number | null };
  high: { name: string; total: number } | null;
  low: { name: string; total: number } | null;
  distribution: Array<{ label: string; count: number; range: string }>;
  rows: Array<{ id: string; name: string; adm: string; cells: Record<string, number | "ABS" | null>; total: number | null; grade: string | null; pos: number | null; rating: string; standing: string; blank: number; absent: number; complete: number | boolean }>;
  frameworkPinned: boolean;
};

type OversightView = {
  department: string;
  reportsTo: { name: string; title: string } | null;
  kpis: { submitted: number; sheets: number; withTeacher: number; returnedByMe: number; mineSubmitted: number; mine: number; waitingOnMe: number };
  closes: string | null;
  rows: Array<{ classId: string; subjectId: string; unit: string; sub: string; owner: string; ownerId: string | null; state: string; age: string; overdue: boolean }>;
};

const PEN = "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const SCORE = "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5M9.5 16.5h3";
const SHIELD = "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z";
const API = "/api/v1/teacher-workspace";

const tone = (state: string): PanelTone =>
  state === "Returned" ? "negative" : state === "Not started" ? "attention" : state === "In progress" ? "progress" : state === "Submitted" ? "submitted" : state === "Approved" ? "positive" : "neutral";
const gradeTone = (grade: string | null): PanelTone => {
  const first = (grade ?? "")[0];
  return first === "A" || first === "B" ? "positive" : first === "C" ? "submitted" : first === "D" ? "attention" : !grade ? "neutral" : "negative";
};
const short = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));

export async function teacherScoresTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  void permissions;
  // An early-years teacher describes what they saw; they do not enter scores.
  if (me.persona === "early-years" && (tabSlug === "enter" || tabSlug === "results")) return teacherObservationsTab(tabSlug);
  if (tabSlug === "enter") return enterTab(await apiGet<SheetsView>(`${API}/sheets`), me);
  if (tabSlug === "results") return resultsTab(await apiGet<ResultsView>(`${API}/results`));
  if (tabSlug === "review") return reviewTab(await apiGet<OversightView>(`${API}/oversight`));
  return undefined;
}

function enterTab(v: SheetsView, me: TeacherWorkspaceView): TabContent {
  const open = v.rows.filter((entry) => entry.state !== "Submitted" && entry.state !== "Approved");
  const lead = v.kpis.firstReturned ? v.rows.find((entry) => entry.classId === v.kpis.firstReturned!.classId && entry.subjectId === v.kpis.firstReturned!.subjectId) : open[0];
  const href = (entry: { classId: string; subjectId: string }) => `/score-entry-results/enter/${entry.classId}/${entry.subjectId}`;
  const rows: TableRow[] = v.rows.map((entry) => {
    const locked = entry.state === "Submitted" || entry.state === "Approved";
    return {
      keywords: `${entry.subject} ${entry.arm}`,
      cells: [
        text(entry.subject, { strong: true }), text(entry.arm), text(String(entry.roll), { mono: true }), pill(entry.state, tone(entry.state)),
        { kind: "bar", pct: entry.roll ? Math.round((entry.entered / entry.roll) * 100) : 0, label: `${entry.entered} of ${entry.roll}`, tone: entry.entered === entry.roll ? "positive" : "attention" },
        entry.mean !== null ? text(String(entry.mean), { mono: true }) : text("—", { tone: "neutral" }),
        text(entry.state === "Submitted" ? "Locked to you · with the reviewer" : entry.state === "Approved" ? "Final · feeds the report cards" : entry.returned ? `Returned: ${entry.returned}` : entry.flagged ? `${entry.flagged} mark${entry.flagged === 1 ? "" : "s"} to check` : v.closes ? `Closes ${short(v.closes)}` : "No closing date set", { tone: "neutral" }),
        { kind: "action", label: entry.state === "Not started" ? "Enter" : entry.state === "Returned" ? "Correct and resubmit" : locked ? "View" : "Continue", href: locked ? `${href(entry)}/preview` : href(entry) },
      ] as TableCellKind[],
    };
  });
  const k = v.kpis;
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `${v.term}${v.closes ? ` · the window closes ${short(v.closes)}` : ""}.`, per: 5,
      cards: [
        { label: "Sheets outstanding", value: String(k.open), unit: `of ${k.sheets}`, sub: v.daysLeft !== null ? `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left` : "No closing date set", tone: k.open ? "negative" : "positive" },
        { label: "Children done", value: String(k.entered), unit: `of ${k.children}`, sub: "Across your sheets", tone: k.entered < k.children ? "attention" : "positive" },
        { label: "Returned to you", value: String(k.returned), sub: k.firstReturned ? `${k.firstReturned.subject} ${k.firstReturned.arm} · read the comment` : "Nothing sent back", tone: k.returned ? "negative" : "positive", link: k.firstReturned ? "Open it" : undefined, href: k.firstReturned ? href(k.firstReturned) : undefined },
        { label: "Saved on this device", value: String(v.pending), unit: "queued", sub: v.pending ? "Waiting for a connection" : "Nothing waiting", tone: v.pending ? "offline" : "positive" },
        { label: "Blank is not zero", value: String(k.blanks), unit: "blanks", sub: "A blank leaves a child without a total", tone: k.blanks ? "attention" : "positive" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: "Your sheets", sub: "One subject-arm is one sheet. Open one and every child in that arm is on it.", meta: `${v.assigned} assignment${v.assigned === 1 ? "" : "s"} · ${v.rows.length} with score entry`, noun: "sheet", nounPlural: "sheets",
      search: v.rows.length > 2 ? "Find a subject or an arm" : undefined, head: ["Subject", "Arm", "Roll", "State", "Entered", "Avg", "Note", ""], rows, noRowOpen: true, per: 10,
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
          ["Entered offline", "Provisional, pending sync", "The server value replaces it; any difference is logged"],
        ],
      },
    ]),
  ];
  return {
    title: me.persona === "early-years" ? "Enter observations" : "Enter scores", desc: "Your assigned subject-arms. Nothing else is enterable by you.",
    primary: lead ? { label: `${lead.state === "Returned" ? "Correct " : lead.state === "Not started" ? "Start " : "Continue "}${lead.subject} ${lead.arm}`, icon: PEN, href: href(lead) } : undefined,
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

function resultsTab(r: ResultsView): TabContent {
  const rows: TableRow[] = r.rows.map((entry) => {
    const status = !entry.ranked ? "Not entered" : entry.state === "Approved" ? "Final" : "Provisional";
    return {
      cells: [
        text(entry.subject, { strong: true }), text(entry.arm), text(String(entry.roll), { mono: true }), text(`${entry.complete} of ${entry.roll}`),
        entry.mean !== null && entry.ranked ? text(String(entry.mean), { mono: true }) : text("—", { tone: "neutral" }), entry.passRate !== null ? text(`${entry.passRate}%`) : text("—", { tone: "neutral" }),
        entry.high !== null ? text(String(entry.high), { mono: true }) : text("—", { tone: "neutral" }), pill(status, !entry.ranked ? "attention" : status === "Final" ? "positive" : "progress"),
        { kind: "action", label: entry.ranked ? "Open results" : "Enter", href: entry.ranked ? `/score-entry-results/results/${entry.classId}/subject/${entry.subjectId}` : `/score-entry-results/enter/${entry.classId}/${entry.subjectId}` },
      ] as TableCellKind[],
    };
  });
  const lead = r.rows.find((entry) => entry.ranked);
  const bars = r.rows.map((entry) => ({ label: `${entry.subject} · ${entry.arm}`, value: Math.round(entry.mean ?? 0), display: entry.ranked ? String(entry.mean) : "—", sub: entry.ranked ? `${entry.failed} below the pass mark · highest ${entry.high}` : "Nothing entered yet", tone: (entry.mean ?? 0) >= 60 ? "positive" as const : (entry.mean ?? 0) >= 50 ? "submitted" as const : "attention" as const }));
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", per: 4,
      cards: [
        { label: "Your average", value: r.average === null ? "—" : String(r.average), unit: r.average === null ? undefined : "/ 100", sub: `Across ${r.ranked} ranked ${r.ranked === 1 ? "child" : "children"}`, tone: "positive" },
        { label: "Children", value: String(r.children), sub: `${r.rows.length} subject-arm${r.rows.length === 1 ? "" : "s"}` },
        { label: "Below the pass mark", value: String(r.below), sub: r.below ? "Each one is a conversation" : "Nobody below it", tone: r.below ? "negative" : "positive" },
        { label: "Final", value: String(r.approved), unit: `of ${r.rows.length}`, sub: "Approved sheets · the rest are provisional", tone: r.approved === r.rows.length ? "positive" : "attention" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: "Your subject-arms", sub: "Open one for every child, ranked, with the components behind each total.", noun: "subject-arm", nounPlural: "subject-arms",
      head: ["Subject", "Arm", "Roll", "Entered", "Average", "Pass", "Highest", "State", ""], rows, noRowOpen: true, empty: "No result yet — nothing is assigned to you for score entry.", foot: "Provisional until the sheet is approved.",
    }]),
    r.rows.some((entry) => entry.ranked)
      ? row("1fr 1.15fr", [
          { type: "bars", title: "Average by subject-arm", sub: "Out of 100, over the children ranked so far.", rows: bars },
          {
            type: "list", title: "Children to look at", sub: "Below the pass mark, or close to it.",
            items: r.look.length
              ? r.look.map((entry) => ({ label: `${entry.child} · ${entry.subject} ${entry.arm}`, pill: entry.why, tone: entry.why === "Below the pass mark" ? "negative" as const : "attention" as const, sub: `${entry.total} of 100 · ${entry.grade ?? "no grade"}`, viewLabel: "Open", href: `/score-entry-results/results/${entry.classId}/subject/${entry.subjectId}` }))
              : [{ label: "Nobody is below 45", sub: "Every ranked child is comfortably above the pass mark.", pill: "Clear", tone: "positive" as const }],
          },
        ])
      : null,
    r.formArms.length
      ? row("1fr", [{
          type: "tiles", title: `Your form class · ${r.formArms[0]!.name}`, sub: "Every subject your class takes, not only yours.",
          tiles: [{ label: `${r.formArms[0]!.name} broadsheet`, sub: "Every child against every subject, with positions and the marks still missing", icon: SCORE, href: `/score-entry-results/enter/${r.formArms[0]!.id}/broadsheet` }, { label: "Remarks for the report cards", sub: "Write the paragraph each child's family will read", icon: PEN, href: "/report-cards/remarks" }],
        }])
      : null,
  ];
  return {
    title: "Results", desc: "Your subjects, arm by arm, then any child — and how every number was reached.",
    primary: lead ? { label: `Open ${lead.subject} ${lead.arm}`, icon: ARROW, href: `/score-entry-results/results/${lead.classId}/subject/${lead.subjectId}` } : undefined,
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

function reviewTab(o: OversightView): TabContent {
  const k = o.kpis;
  const rows: TableRow[] = o.rows.map((entry) => ({
    keywords: `${entry.unit} ${entry.owner}`,
    cells: [
      text(entry.unit, { strong: true }), { kind: "name", name: entry.owner, sub: entry.owner === "You" ? `Head of ${o.department} · you` : "Subject teacher" }, pill(entry.state, tone(entry.state)), text(entry.age, { tone: "neutral" }),
      text(entry.owner === "You" ? "You cannot approve your own" : entry.state === "Submitted" ? "Waiting on you" : entry.state === "Not started" ? "Not yet yours to see" : "", { tone: "neutral" }),
      entry.state === "Submitted" && entry.owner !== "You"
        ? { kind: "action", label: "Decide", href: `/score-entry-results/review/${entry.classId}/${entry.subjectId}` }
        : entry.owner === "You" ? { kind: "action", label: "Open mine", href: `/score-entry-results/enter/${entry.classId}/${entry.subjectId}` }
        : entry.state === "Not started" ? text("—", { tone: "neutral" }) : { kind: "action", label: "View", href: `/score-entry-results/review/${entry.classId}/${entry.subjectId}` },
    ] as TableCellKind[],
  }));
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `Department scope: ${o.department}. It gives you nothing at all over any other department.`, per: 4,
      cards: [
        { label: "Waiting on you", value: String(k.waitingOnMe), unit: k.waitingOnMe === 1 ? "sheet" : "sheets", sub: k.waitingOnMe ? "Submitted and not yet decided" : "Nothing waiting for your decision", tone: k.waitingOnMe ? "attention" : "positive" },
        { label: "Still with their teacher", value: String(k.withTeacher), unit: k.withTeacher === 1 ? "sheet" : "sheets", sub: o.closes ? `Window closes ${short(o.closes)}` : "No closing date set", tone: k.withTeacher ? "negative" : "positive" },
        { label: "Submitted", value: String(k.submitted), unit: `of ${k.sheets}`, sub: "Submitted or approved", tone: k.submitted === k.sheets ? "positive" : "attention" },
        { label: "Yours, escalated", value: String(k.mine), sub: k.mine ? `Your own sheets go to ${o.reportsTo?.name ?? "the office"}` : "You teach no sheet of your own", tone: "withheld" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: `${o.department} sheets`, sub: "You can see where a sheet stands. You cannot change a score inside it.", meta: `${o.rows.length} sheets · ${k.waitingOnMe} waiting on you`, noun: "sheet", nounPlural: "sheets",
      search: "Find a subject, arm or teacher", head: ["Subject · arm", "Teacher", "State", "Progress", "Note", ""], rows, noRowOpen: true, per: 10, empty: `${o.department} has no sheet this term.`,
      foot: "Three outcomes only: approve, return for correction, or decline — each with a comment.",
    }]),
    k.mine ? row("1fr", [{ type: "note", tone: "withheld", icon: SHIELD, title: "Nobody approves their own submission", body: `Your own ${k.mine === 1 ? "sheet routes" : `${k.mine} sheets route`} to ${o.reportsTo?.name ?? "the office"}. The item escalates rather than resolving.`, acts: [{ label: "See the route", href: "/approvals-workflow/queue" }] }]) : null,
  ];
  return {
    title: "Review", desc: `${o.department} only. Reviewing is not editing.`,
    primary: k.waitingOnMe ? (() => { const first = o.rows.find((entry) => entry.state === "Submitted" && entry.owner !== "You"); return first ? { label: "Open the sheet waiting on you", icon: ARROW, href: `/score-entry-results/review/${first.classId}/${first.subjectId}` } : undefined; })() : undefined,
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

export const loadSubjectResult = (classId: string, subjectId: string) => apiGet<SubjectResult>(`${API}/results/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`);

/** One subject-arm: every child, ranked, with the components behind each total — and how each total was reached. */
export function subjectResultPage(s: SubjectResult): TabContent & { crumb: { label: string; href: string } } {
  const st = s.stats;
  const explain = (entry: SubjectResult["rows"][number]): DrawerSpec => {
    const band = s.bands.find((candidate) => candidate.label === entry.grade);
    const facts: PanelFact[] = [
      ["Student", entry.name, `${s.arm.name} · ${entry.adm}`],
      ...s.columns.map((column): PanelFact => [column.name, entry.cells[column.key] === "ABS" ? "Absent" : entry.cells[column.key] === null ? "Not entered" : `${entry.cells[column.key]} of ${column.max}`, entry.cells[column.key] === "ABS" ? "Never scored as zero" : ""]),
      ["Total", entry.total === null ? "No total yet" : `${entry.total} of ${s.columns.reduce((sum, column) => sum + column.max, 0)}`, entry.blank ? `${entry.blank} component${entry.blank === 1 ? "" : "s"} still blank, so there is no total` : "Components summed — no weighting at this stage"],
      ["Grade", entry.grade ?? "—", band ? `Band ${band.min}–${band.max} under this school’s scale · ${band.remark}` : ""],
      ["Position", entry.pos ? `${entry.pos}` : "Not ranked", "Ranked on the total; ties share a position"],
      ["Against the class", entry.standing, ""],
      ["Framework", s.frameworkPinned ? "Pinned to this sheet" : "Today’s framework", s.frameworkPinned ? "Fixed when the sheet was first entered against" : "Becomes fixed once a mark is saved"],
    ];
    return { mode: "view", readOnly: true, kicker: "Explain this result", title: `How ${entry.name}’s ${s.subject.name} total was reached`, sub: "The stored trace, not a recalculation. This is what the school would show a parent.", facts };
  };
  const rows: TableRow[] = s.rows.map((entry) => ({
    keywords: `${entry.name} ${entry.adm}`,
    cells: [
      text(entry.pos ? String(entry.pos) : "—", { mono: true, strong: true }), { kind: "name", name: entry.name, sub: entry.adm },
      ...s.columns.map((column): TableCellKind => text(entry.cells[column.key] === "ABS" ? "Abs" : entry.cells[column.key] === null ? "—" : String(entry.cells[column.key]), { mono: true, tone: entry.cells[column.key] === null ? "neutral" : undefined })),
      entry.total === null ? text("—", { tone: "neutral" }) : text(String(entry.total), { mono: true, strong: true }), entry.grade ? pill(entry.grade, gradeTone(entry.grade)) : text("—", { tone: "neutral" }), text(entry.standing, { tone: "neutral" }),
      { kind: "action", label: "Explain", drawer: explain(entry) },
    ] as TableCellKind[],
  }));
  const max = Math.max(1, ...s.distribution.map((entry) => entry.count));
  return {
    crumb: { label: "Back to my results", href: "/score-entry-results/results" },
    title: `${s.subject.name} · ${s.arm.name}`, desc: `${s.final ? "Final — approved." : "Provisional until the sheet is approved."} Every child, ranked, with the components behind each total.`,
    primary: { label: s.final ? "View the sheet" : "Enter or correct scores", icon: PEN, href: `/score-entry-results/enter/${s.arm.id}/${s.subject.id}${s.final ? "/preview" : ""}` },
    rows: [
      row("1fr", [{
        type: "kpi", per: 4, sub: `${st.complete} of ${st.roll} children have every component · pass mark ${s.passMark}.`,
        cards: [
          { label: "Class average", value: st.mean === null ? "—" : String(st.mean), unit: st.mean === null ? undefined : "/ 100", sub: `${st.ranked} ranked`, tone: "positive" },
          { label: "Highest", value: s.high ? String(s.high.total) : "—", sub: s.high?.name ?? "Nobody ranked yet" },
          { label: "Pass rate", value: st.passRate === null ? "—" : `${st.passRate}%`, sub: `${st.passed} of ${st.ranked} at ${s.creditMark} or above`, tone: st.passRate !== null && st.passRate >= 70 ? "positive" : "attention" },
          { label: "Below the pass mark", value: String(st.failed), sub: st.failed ? "Each one is a conversation" : "Nobody", tone: st.failed ? "negative" : "positive" },
        ],
      }]),
      row("1.7fr 1fr", [
        {
          type: "table", title: "Every child, ranked", sub: "Open a child to see how the total was reached.", meta: `${s.rows.length} children`, noun: "child", nounPlural: "children", search: "Find a child",
          head: ["Pos", "Child", ...s.columns.map((column) => column.short), "Total", "Grade", "Against the class", ""], rows, noRowOpen: true, per: 12,
          foot: "An absence is excluded from the average — it is never scored as zero.",
        },
        { type: "bars", title: "Grades", sub: "How many children sit at each grade.", rows: s.distribution.map((entry) => ({ label: `${entry.label} · ${entry.range}`, value: Math.round((entry.count / max) * 100), display: String(entry.count), tone: gradeTone(entry.label) })) },
      ]),
    ],
  };
}
