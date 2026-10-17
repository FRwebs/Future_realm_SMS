import { apiGet } from "@/lib/api/server";
import { broadsheetHref, deleteEntryDrawer, gridHref, previewHref, SR, sheetHref, submitDrawer } from "@/lib/modules/live/m5-forms";
import type { BroadsheetEnter, Chooser, Grid, State } from "@/lib/modules/live/m5-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Enter — choosing the sheet, typing into it, previewing all of it, and handing it in. */

export const loadChooser = (query: { level?: string; arm?: string }) => {
  const params = new URLSearchParams();
  if (query.level) params.set("level", query.level);
  if (query.arm) params.set("arm", query.arm);
  return apiGet<Chooser>(`${SR}/enter${params.toString() ? `?${params.toString()}` : ""}`);
};
export const loadGrid = (classId: string, subjectId: string) => apiGet<Grid>(`${SR}/enter/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`);
export const loadBroadsheet = (classId: string) => apiGet<BroadsheetEnter>(`${SR}/enter/${encodeURIComponent(classId)}/broadsheet`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const EYE = "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12";
const LOCK = "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z";

export const STATE_TONE: Record<string, PanelTone> = { "Not started": "neutral", "In progress": "progress", Submitted: "submitted", Returned: "negative", Approved: "positive", Unassigned: "negative", Blocked: "negative", Complete: "positive", Incomplete: "attention", Ready: "positive" };
export const stateTone = (state: string): PanelTone => STATE_TONE[state] ?? "neutral";
export const gradeTone = (grade: string | null): PanelTone => (!grade ? "negative" : /^[AB]/.test(grade) ? "positive" : /^C/.test(grade) ? "submitted" : /^[DE]/.test(grade) ? "attention" : "negative");
export const num = (value: number | null | undefined) => (value === null || value === undefined ? "—" : String(value));
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

export function enterTab(c: Chooser): TabContent {
  const rows: PanelRow[] = [];
  rows.push({ cols: "1fr", panels: [{ type: "note", tone: "progress", icon: WARN, title: "Entering scores is normally the subject teacher's job", body: "This is here for when you have to do it yourself. Everything you enter is logged under your name — and because you entered it, you will not be allowed to approve it.", acts: [{ label: "See who has not submitted", href: "/score-entry-results/review" }] }] });
  if (c.unavailable) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "No arm has subjects to enter scores for yet", body: "A sheet is a subject in an arm. Offer subjects to an arm and name a teacher for each on Class & Timetable, and its sheets appear here.", acts: [{ label: "Open Class & Timetable", href: "/class-timetable/teaching" }] }] });
    return { title: "Enter scores", desc: "Choose the class, the arm, then the subject.", rows };
  }
  const k = c.kpis;
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "Across the school", sub: `${c.term.name} ${c.term.session}`, per: 4,
      cards: [
        { label: "Sheets in", value: String(k.in), unit: `of ${k.expected}`, sub: `${k.outstanding} still outstanding`, tone: k.outstanding ? "attention" : "positive" },
        { label: "Approved", value: String(k.approved), sub: "Cleared for report cards", tone: "positive" },
        { label: "Returned to a teacher", value: String(k.withTeacher), sub: "Sent back and not yet resubmitted", tone: k.withTeacher ? "negative" : "positive" },
        { label: "Impossible to enter", value: String(k.impossible), sub: k.impossible ? `${k.impossibleNames.join(", ")}${k.impossible > 3 ? "…" : ""} have no teacher` : "Every subject has someone to enter it", tone: k.impossible ? "negative" : "positive", link: k.impossible ? "Assign a teacher" : undefined, href: k.impossible ? "/class-timetable/teaching" : undefined },
      ],
    }],
  });
  const armsHere = c.arms.filter((arm) => !c.level || arm.level === c.level);
  rows.push({
    cols: "1fr",
    panels: [{
      type: "days", title: "Choose the class", sub: "Pick a class to narrow the arms below.",
      days: [{ label: "All classes", href: "/score-entry-results/enter", state: c.level ? "plain" : "now" }, ...c.levels.map((level) => ({ label: level, href: `/score-entry-results/enter?level=${encodeURIComponent(level)}`, state: level === c.level ? ("now" as const) : ("plain" as const) }))],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "days", title: "Choose the arm", sub: c.picked ? `${c.picked.name} selected · its subjects are below` : "Choose an arm and its subjects will appear underneath.",
      days: armsHere.map((arm) => ({ label: arm.name, href: `/score-entry-results/enter?${c.level ? `level=${encodeURIComponent(c.level)}&` : ""}arm=${arm.id}`, state: c.picked?.id === arm.id ? ("now" as const) : ("plain" as const) })),
    }],
  });

  const subjectRow = (sheet: Chooser["subjects"][number], showArm: boolean): TableRow => ({
    id: `${sheet.classId}:${sheet.subjectId}`,
    keywords: `${sheet.subject} ${sheet.arm} ${sheet.teacher ?? ""} state:${sheet.state}`,
    cells: [
      text(sheet.subject, { strong: true }),
      ...(showArm ? [text(sheet.arm)] : []),
      sheet.teacher ? nameCell(sheet.teacher, sheet.mine ? "You" : "Subject teacher") : text("Unassigned", { tone: "negative", strong: true }),
      text(sheet.state === "Not started" || sheet.state === "Unassigned" ? `0 of ${sheet.roll}` : `${sheet.entered} of ${sheet.roll}`, { mono: true }),
      pill(sheet.state, stateTone(sheet.state)),
      sheet.state === "Unassigned"
        ? { kind: "action" as const, label: "Assign", href: "/class-timetable/teaching" }
        : { kind: "action" as const, label: sheet.state === "Approved" || sheet.state === "Submitted" ? "Open" : "Enter", href: gridHref(sheet.classId, sheet.subjectId) },
    ],
  });

  if (c.picked) {
    rows.push({
      cols: "1fr",
      panels: [{
        type: "table", title: `Subjects offered to ${c.picked.name}`, tag: plural(c.subjects.length, "subject"), tagTone: "neutral", sub: `Open one and every child in ${c.picked.name} appears, ready to mark.`, meta: `${c.term.name} ${c.term.session}`, search: "Find a subject or a teacher",
        filters: [{ label: "State", value: "All", options: ["All", "Not started", "In progress", "Submitted", "Returned", "Approved", "Unassigned"], match: Object.fromEntries(["Not started", "In progress", "Submitted", "Returned", "Approved", "Unassigned"].map((state) => [state, `state:${state}`])) }],
        acts: [{ label: `Preview ${c.picked.name}'s entire result entry so far`, primary: true, href: broadsheetHref(c.picked.id) }],
        head: ["Subject", "Teacher", "Entered", "State", ""], noun: "sheet", nounPlural: "sheets", per: 12, rows: c.subjects.map((sheet) => subjectRow(sheet, false)),
        foot: `Every child in ${c.picked.name} against every subject they take, in one screen — including the marks nobody has entered yet.`,
      }],
    });
  } else {
    const arms = Array.from(new Set(c.outstanding.map((sheet) => sheet.arm)));
    rows.push({
      cols: "1fr",
      panels: [{
        type: "table", title: "Sheets outstanding across the school", sub: "Or choose an arm above to enter by class instead.", meta: `${c.outstanding.length} of ${k.expected} sheets not yet approved`, search: "Find by subject, arm or teacher",
        filters: [{ label: "Arm", value: "All", options: ["All", ...arms], column: 1 }, { label: "State", value: "All", options: ["All", "Not started", "In progress", "Submitted", "Returned", "Unassigned"], match: Object.fromEntries(["Not started", "In progress", "Submitted", "Returned", "Unassigned"].map((state) => [state, `state:${state}`])) }],
        head: ["Subject", "Arm", "Teacher", "Entered", "State", ""], noun: "sheet", nounPlural: "sheets", per: 10, rows: c.outstanding.map((sheet) => subjectRow(sheet, true)),
        empty: "Every sheet is approved.", foot: "A sheet with no teacher cannot be entered by anyone until someone is named for it.",
      }],
    });
  }
  return { title: "Enter scores", desc: "Choose the class, the arm, then the subject.", primary: { label: "Open the review queue", icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", href: "/score-entry-results/review" }, rows };
}

/* ───────────────────────── the grid ───────────────────────── */

export type Crumb = { crumb: { label: string; href: string } };

export function gridPage(g: Grid): { content: TabContent & Crumb } {
  const rows: PanelRow[] = [];
  if (g.returned) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: "This sheet was sent back", body: `${g.returned.note || "No reason was recorded."} The scores already entered are kept — correct what was named and resubmit.` }] });
  const closed = g.windows.filter((window) => !window.open);
  if (closed.length) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: LOCK, title: `${closed.map((window) => window.component).join(", ")} ${closed.length === 1 ? "is" : "are"} closed to entry`, body: "The entry window for this component has ended and was not reopened. Marks already on the sheet stay; nothing in that column can change until the window is reopened in School Configuration." }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "sheet", classId: g.arm.id, subjectId: g.subject.id, arm: g.arm.name, subject: g.subject.name, columns: g.columns, rows: g.rows.map((row) => ({ id: row.id, name: row.name, adm: row.adm, cells: row.cells, others: row.others })),
      bands: g.bands.map((band) => ({ label: band.label, min: band.min })), passMark: g.passMark, whyNot: g.blocked, status: g.state,
      frameworkLabel: g.pinned ? `Framework pinned to this sheet on ${when(g.frameworkAt)}` : "This sheet will be pinned to the framework in force when you first save it",
      saveEndpoint: `${SR}/enter/${g.arm.id}/${g.subject.id}/save`, previewHref: previewHref(g.arm.id, g.subject.id), backHref: "/score-entry-results/enter", remove: g.editable && g.state !== "Not started" ? deleteEntryDrawer(g) : undefined,
    }],
  });
  return {
    content: {
      crumb: { label: "Back to choosing a sheet", href: `/score-entry-results/enter?arm=${g.arm.id}` },
      title: `Enter scores · ${g.subject.name} ${g.arm.name}`,
      desc: "Absent is not zero, and blank is not zero.",
      primary: { label: "Preview the whole sheet", icon: EYE, href: previewHref(g.arm.id, g.subject.id) },
      launchers: [
        { label: "Preview this arm's whole entry", href: broadsheetHref(g.arm.id) },
        { label: "Choose a different sheet", href: "/score-entry-results/enter" },
      ],
      rows,
    },
  };
}

/* ───────────────────────── the preview ───────────────────────── */

export function previewPage(g: Grid): { content: TabContent & Crumb } {
  const s = g.stats;
  const blanks = s.blanks;
  const ranked = g.rows.slice().sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const maxTotal = g.columns.reduce((sum, column) => sum + column.max, 0);
  const submit = submitDrawer(g);
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "What you are about to submit", sub: "Recomputed from the grid, not typed here.", per: 6,
      cards: [
        { label: "Entered", value: `${s.scored} of ${s.roll}`, sub: blanks ? `${blanks} still blank` : "No blanks", tone: blanks ? "attention" : "positive" },
        { label: "Subject average", value: num(s.mean), unit: `/ ${maxTotal}`, sub: s.armMean === null ? "" : `Arm average ${s.armMean}`, tone: s.mean !== null && s.armMean !== null && s.mean >= s.armMean ? "positive" : "attention" },
        { label: "Highest", value: s.high ? String(s.high.total) : "—", sub: s.high?.name ?? "", tone: "positive" },
        { label: "Lowest", value: s.low ? String(s.low.total) : "—", sub: s.low?.name ?? "", tone: s.low && s.low.total < g.passMark ? "negative" : "attention" },
        { label: "At credit or above", value: String(s.passed), unit: `of ${s.scored}`, sub: "50 and above", tone: "positive" },
        { label: "Below the pass mark", value: String(s.failed), sub: `Under ${g.passMark}`, tone: s.failed ? "negative" : "positive" },
      ],
    }],
  });
  if (blanks) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `${plural(blanks, "child")} ${blanks === 1 ? "has" : "have"} an unfinished row on this sheet`, body: "A blank is not a zero and it is not an absence. Submitting with blanks leaves those children without a total for this subject, and their report cards stay blocked.", acts: [{ label: "Go back and fill them in", href: gridHref(g.arm.id, g.subject.id) }] }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: `Every child in ${g.arm.name}`, tag: "Ranked by total", tagTone: "neutral", sub: g.columns.map((column) => `${column.name} /${column.max}`).join(", ") + ". A dash is blank, not a zero.",
      meta: `${g.subject.name} · ${g.subject.category} · ${g.subject.teacher ?? "no teacher mapped"}${g.pinned ? ` · framework pinned ${when(g.frameworkAt)}` : ""}`, search: "Find a child by name or admission number",
      filters: [
        { label: "Grade", value: "All", options: ["All", ...g.bands.map((band) => band.label)], match: Object.fromEntries(g.bands.map((band) => [band.label, `grade:${band.label}`])) },
        { label: "Standing", value: "All", options: ["All", "Well above the class", "Above the class", "Around the class", "Below the class"] },
      ],
      acts: [{ label: "Keep editing", href: gridHref(g.arm.id, g.subject.id) }, { label: "Submit for approval", primary: true, drawer: submit }],
      head: ["Pos", "Child", "Admission no", ...g.columns.map((column) => column.short), "Total", "Grade", "Rating", "Standing", ""], noun: "child", nounPlural: "children", noRowOpen: true, per: 15,
      rows: ranked.map((row) => ({
        keywords: `${row.name} ${row.adm} grade:${row.grade ?? "None"} ${row.standing}`,
        cells: [
          text(row.pos === null ? "—" : String(row.pos), { mono: true, strong: true }), nameCell(row.name, g.arm.name), text(row.adm, { mono: true }),
          ...g.columns.map((column) => (row.cells[column.key] === "ABS" ? text("ABS", { tone: "withheld", strong: true }) : text(num(row.cells[column.key] as number | null), { mono: true }))),
          text(num(row.total), { mono: true, strong: true }), row.grade ? pill(row.grade, gradeTone(row.grade)) : text("—"), text(row.rating), text(row.standing), { kind: "action" as const, label: "Edit", href: gridHref(g.arm.id, g.subject.id) },
        ],
      })),
      summaryRows: [[text(""), text("Subject average", { strong: true }), text(`${s.scored} scored`), ...g.columns.map(() => text("")), text(num(s.mean), { mono: true, strong: true }), text(""), text(""), text(s.armMean === null ? "" : `Arm average ${s.armMean}`), text("")]],
      foot: "This is the sheet as it will be submitted. After submission you can no longer edit it — a change needs a correction request with a reason.",
    }],
  });
  rows.push({
    cols: "1fr 1fr",
    panels: [
      { type: "bars", title: "Grade spread", sub: "Against this school's own bands.", rows: g.bands.map((band) => { const count = g.rows.filter((row) => row.grade === band.label).length; return { label: `${band.label} · ${band.min}–${Math.floor(band.max)}`, value: Math.round((count / Math.max(1, s.scored)) * 100), display: String(count), tone: gradeTone(band.label) }; }) },
      {
        type: "facts", title: "Checks run on this sheet", per: 1, sub: "Every one of these passes before the Submit button will do anything.",
        facts: [
          ["Marks within their maxima", `Passed · nothing exceeds ${g.columns.map((column) => `${column.short} ${column.max}`).join(", ")}`],
          ["Blanks", blanks ? `${blanks} — they will have no total` : "None"],
          ["Absences", "Excluded from the average, never scored zero"],
          ["Framework", g.pinned ? `Pinned to this sheet on ${when(g.frameworkAt)}` : "Pinned when the first mark is saved"],
          ["Goes to", "The review queue · an Exam Officer"],
          ["After submission", "You cannot edit it — a change needs a correction request"],
          ["Entered by", g.enteredBy.length ? g.enteredBy.join(", ") : "You"],
          ["Because you entered it", "You will not be allowed to approve it"],
        ],
      },
    ],
  });
  return {
    content: {
      crumb: { label: "Back to the entry grid", href: gridHref(g.arm.id, g.subject.id) },
      title: `Preview · ${g.subject.name} · ${g.arm.name}`,
      desc: "Every child, every component, exactly as it will be submitted.",
      primary: g.editable ? { label: "Submit for approval", icon: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15", drawer: submit } : undefined,
      launchers: [
        { label: "Keep editing", href: gridHref(g.arm.id, g.subject.id) },
        ...(g.editable && g.state !== "Not started" ? [{ label: "Delete this entry", drawer: deleteEntryDrawer(g) }] : []),
      ],
      rows,
    },
  };
}

/* ───────────────────────── one arm, every subject ───────────────────────── */

export function broadsheetPage(b: BroadsheetEnter): { content: TabContent & Crumb } {
  const subjects = b.subjects;
  const cells = b.rows.reduce((total, row) => total + row.totals.length, 0);
  const missing = b.rows.reduce((total, row) => total + row.totals.filter((value) => value === null).length, 0);
  const complete = b.rows.filter((row) => row.totals.every((value) => value !== null)).length;
  const withAverage = b.rows.map((row) => ({ ...row, live: row.totals.filter((value): value is number => value !== null) })).map((row) => ({ ...row, avg: row.live.length ? row.live.reduce((a, c) => a + c, 0) / row.live.length : null }));
  const ordered = withAverage.slice().sort((a, c) => (c.avg ?? -1) - (a.avg ?? -1));
  const armAvg = withAverage.filter((row) => row.avg !== null).length ? Math.round((withAverage.reduce((total, row) => total + (row.avg ?? 0), 0) / withAverage.filter((row) => row.avg !== null).length) * 10) / 10 : null;
  const gradeOf = (avg: number) => b.bands.find((band) => avg >= band.min)?.label ?? b.bands[b.bands.length - 1]?.label ?? "—";
  return {
    content: {
      crumb: { label: "Back to choosing a sheet", href: `/score-entry-results/enter?arm=${b.arm.id}` },
      title: `${b.arm.name} · everything entered so far`,
      desc: `Every child in ${b.arm.name} against every subject they take.`,
      primary: { label: "Open the review queue", icon: "M5 12h13M13 6.5l5.5 5.5L13 17.5", href: `/score-entry-results/review/${b.arm.id}` },
      launchers: [{ label: "Choose a different arm", href: "/score-entry-results/enter" }],
      rows: [
        {
          cols: "1fr",
          panels: [{
            type: "kpi", title: "This arm, this term", sub: `${b.term.name} ${b.term.session}`, per: 4,
            cards: [
              { label: "Children complete", value: String(complete), unit: `of ${b.rows.length}`, sub: complete === b.rows.length ? "Every subject in for everyone" : `${b.rows.length - complete} have a subject missing`, tone: complete === b.rows.length ? "positive" : "attention" },
              { label: "Marks missing", value: String(missing), unit: `of ${cells}`, sub: missing ? "Each one blocks a report card" : "Nothing outstanding", tone: missing ? "negative" : "positive" },
              { label: "Subjects", value: String(subjects.length), sub: "What this arm takes", tone: "neutral" },
              { label: "Arm average", value: num(armAvg), unit: "/ 100", sub: "Across every mark entered", tone: "neutral" },
            ],
          }],
        },
        {
          cols: "1fr",
          panels: [{
            type: "table", title: `Broadsheet · ${b.arm.name}`, tag: "Ranked by average", tagTone: "neutral", sub: "A dash is a mark nobody has entered. It is never a zero, and it is not averaged in.",
            meta: `${b.rows.length} children · ${subjects.length} subjects · ${missing} cells still empty`, search: "Find a child by name or admission number",
            filters: [{ label: "Standing", value: "All", options: ["All", "Complete", "Marks missing"], match: { Complete: "standing:Complete", "Marks missing": "standing:Missing" } }],
            acts: [{ label: "Export to Excel", primary: true, export: true }],
            head: ["#", "Child", "Admission no", ...subjects.map((subject) => subject.code), "Avg", "Grade", "Done"], noun: "child", nounPlural: "children", per: 15, noRowOpen: true,
            rows: ordered.map((row, index) => ({
              keywords: `${row.name} ${row.adm} standing:${row.live.length === subjects.length ? "Complete" : "Missing"}`,
              cells: [text(String(index + 1), { mono: true }), nameCell(row.name, b.arm.name), text(row.adm, { mono: true }), ...row.totals.map((value) => text(value === null ? "—" : String(value), { mono: true })), text(row.avg === null ? "—" : String(Math.round(row.avg * 10) / 10), { mono: true, strong: true }), row.avg === null ? text("—") : pill(gradeOf(row.avg), gradeTone(gradeOf(row.avg))), text(`${row.live.length}/${subjects.length}`, { strong: true, tone: row.live.length === subjects.length ? "positive" : "negative" })],
            })),
            foot: "Each column is a subject code. Open the review queue to approve or decline a whole subject at a time.",
          }],
        },
        {
          cols: "1fr",
          panels: [{
            type: "table", title: "Where each subject stands", sub: "The state of every sheet in this arm, and who owns it.", meta: plural(subjects.length, "subject"), head: ["Subject", "Code", "Teacher", "Scored", "Average", "State", ""], noun: "subject", nounPlural: "subjects", noRowOpen: true,
            rows: subjects.map((subject) => ({
              cells: [text(subject.name, { strong: true }), text(subject.code, { mono: true }), subject.teacher ? nameCell(subject.teacher, "Subject teacher") : text("Unassigned", { tone: "negative", strong: true }), text(String(subject.scored), { mono: true }), text(num(subject.mean), { mono: true }), pill(subject.state as State, stateTone(subject.state)), subject.teacher ? { kind: "action" as const, label: "Open", href: gridHref(b.arm.id, subject.subjectId) } : { kind: "action" as const, label: "Assign", href: "/class-timetable/teaching" }],
            })),
            foot: "A subject with no teacher named cannot be entered by anyone — assign one on Class & Timetable first.",
          }],
        },
      ],
    },
  };
}

export { sheetHref };
