import { cardDrawer } from "@/lib/modules/live/m6-forms";
import { apiGet } from "@/lib/api/server";
import { type Crumb, gradeTone, num, stateTone, when } from "@/lib/modules/live/m5-enter";
import { armReviewHref, correctionLabel, correctionTone, decideCorrectionDrawer, requestCorrectionDrawer, resultArmHref, resultStudentHref, SR, viewCorrectionDrawer } from "@/lib/modules/live/m5-forms";
import type { ArmBroadsheet, Correction, CorrectionOptions, ResultsOverview, StudentPage } from "@/lib/modules/live/m5-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type DrawerSpec, type ListItem, type PanelRow, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Results begin at the school, then any arm's broadsheet, then any child — read from approved sheets only. */

export const loadResults = () => apiGet<ResultsOverview>(`${SR}/results`);
export const loadArmResult = (classId: string) => apiGet<ArmBroadsheet>(`${SR}/results/${encodeURIComponent(classId)}`);
export const loadStudent = (classId: string, studentId: string) => apiGet<StudentPage>(`${SR}/results/${encodeURIComponent(classId)}/${encodeURIComponent(studentId)}`);
export const loadCorrections = (classId?: string) => apiGet<{ rows: Correction[] }>(`${SR}/corrections${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`);
export const loadCorrectionOptions = () => apiGet<CorrectionOptions>(`${SR}/corrections/options`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";

const correctionItems = (rows: Correction[]): ListItem[] =>
  rows.slice(0, 8).map((row) => ({
    label: `${row.subject} ${row.arm} · ${row.student}, ${row.from ?? "blank"} → ${row.to < 0 ? "absent" : row.to}`,
    sub: `${row.requestedBy} · ${row.reason}${row.evidence ? " · evidence described" : ""}${row.reachedParent ? " · already reached a family" : ""}`,
    pill: correctionLabel(row.status), tone: correctionTone(row.status), viewLabel: row.open ? "Decide" : "View", drawer: row.open ? decideCorrectionDrawer(row) : viewCorrectionDrawer(row),
  }));

export function resultsTab(r: ResultsOverview, corrections: Correction[], options: CorrectionOptions): TabContent {
  const k = r.kpis;
  const request = requestCorrectionDrawer(options);
  const openCount = corrections.filter((entry) => entry.open).length;
  const blocked = k.total - k.computed;
  const rows: PanelRow[] = [];
  if (!r.arms.length) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "No arm has results to read yet", body: "Results come from approved score sheets. Offer subjects to an arm on Class & Timetable, enter and approve its sheets, and its broadsheet appears here.", acts: [{ label: "Open the review queue", href: "/score-entry-results/review" }] }] });
  }
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "The school this term", sub: `${r.term.name} ${r.term.session} · recomputed as each sheet is approved.`, per: 6,
      cards: [
        { label: "Students computed", value: String(k.computed), unit: `of ${k.total}`, sub: blocked ? `${blocked} blocked on a missing or unapproved score` : "Every student computed", tone: blocked ? "attention" : "positive" },
        { label: "School average", value: num(k.average), sub: `Across ${plural(r.arms.length, "arm")}` },
        { label: "Pass rate", value: k.pass === null ? "—" : `${k.pass}%`, sub: `Pass mark ${r.passMark}`, tone: "positive" },
        { label: "Credit rate", value: k.credit === null ? "—" : `${k.credit}%`, sub: "Credit threshold 50" },
        { label: "Best arm", value: num(k.best?.average), sub: k.best ? `${k.best.name}${k.best.master ? ` · ${k.best.master}` : ""}` : "—", tone: "positive" },
        { label: "Weakest arm", value: num(k.weakest?.average), sub: k.weakest ? `${k.weakest.name}${k.weakest.master ? ` · ${k.weakest.master}` : ""}` : "—", tone: "attention" },
      ],
    }],
  });
  if (blocked) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `${plural(blocked, "student")} cannot be computed yet`, body: `They sit in ${r.blockedArms.join(", ")}, where a subject sheet is still outstanding. None of them is being given a zero — they are simply excluded from positions until the score arrives.`, acts: [{ label: "Open the review queue", href: "/score-entry-results/review" }, { label: "See what is blocking", href: "/report-cards/completion" }] }] });
  if (r.withoutSubjects) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "neutral", icon: WARN, title: `${plural(r.withoutSubjects, "arm")} with children ${r.withoutSubjects === 1 ? "has" : "have"} no subjects offered`, body: "They have nothing to be scored on, so they are not in this table. Offer subjects on Class & Timetable.", acts: [{ label: "Open Class & Timetable", href: "/class-timetable/teaching" }] }] });
  const armRows: TableRow[] = r.arms.map((arm) => ({
    id: arm.id,
    keywords: `${arm.name} ${arm.level} ${arm.master ?? ""} state:${arm.incomplete ? "Incomplete" : "Complete"}`,
    cells: [
      text(arm.name, { strong: true }), arm.master ? nameCell(arm.master, "Form master") : text("Nobody named", { tone: "attention" }), text(String(arm.roll), { mono: true }),
      text(`${arm.computed} of ${arm.roll}`, { strong: arm.incomplete, tone: arm.incomplete ? "attention" : undefined }),
      text(num(arm.average), { strong: true, tone: arm.average !== null && arm.average < 65 ? "attention" : arm.average !== null && arm.average >= 72 ? "positive" : undefined }),
      text(arm.pass === null ? "—" : `${arm.pass}%`), arm.top ? text(arm.top.grade ?? "—", { strong: true, tone: "positive" }) : text("—"),
      pill(arm.incomplete ? "Incomplete" : "Complete", stateTone(arm.incomplete ? "Incomplete" : "Complete")), { kind: "action" as const, label: "Open", href: resultArmHref(arm.id) },
    ],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Every arm", tag: plural(r.arms.length, "arm"), tagTone: "neutral", sub: "How each arm performed. Open one for its broadsheet, then any child for their full result.",
      meta: `${k.total} students · ${k.incomplete} arms incomplete · school average ${num(k.average)}`, search: "Find an arm, a class or a form master",
      filters: [{ label: "Arm", value: "All", options: ["All", ...r.arms.map((arm) => arm.name)], column: 0 }, { label: "State", value: "All", options: ["All", "Complete", "Incomplete"], match: { Complete: "state:Complete", Incomplete: "state:Incomplete" } }],
      acts: [{ label: "Export the school broadsheet", primary: true, href: "/score-entry-results/results/export" }],
      head: ["Arm", "Form master", "Roll", "Computed", "Average", "Pass", "Top", "State", ""], noun: "arm", nounPlural: "arms", per: 10, selectable: true,
      bulkActs: [{ label: "Export selected", primary: true, export: true }], rows: armRows,
      foot: "Computed counts the students whose every subject is in and approved. An arm is Incomplete while any sheet is outstanding — its average is still true for the students who are complete.",
    }],
  });
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      {
        type: "table", title: "By subject, across the school", sub: "Where the school is strong, and where it is not.", meta: `${r.subjects.length} subjects · approved sheets only`, head: ["Subject", "Average", "Pass", "Credit", "Highest", "Weakest arm"], noun: "subject", nounPlural: "subjects", per: 10, noRowOpen: true,
        rows: r.subjects.map((subject) => ({ cells: [text(subject.name, { strong: true }), text(String(subject.average), { strong: subject.average >= 70, tone: subject.average >= 70 ? "positive" : subject.average < 55 ? "attention" : undefined }), text(`${subject.pass}%`), text(`${subject.credit}%`), text(String(subject.high), { mono: true }), text(subject.weakest)] })),
        empty: "No sheet has been approved yet.", foot: "A subject below 65 across the school is usually a teaching question, not a cohort question.",
      },
      {
        type: "list", title: "Corrections on approved scores", sub: "A score that has reached a family can only change through here.", meta: openCount ? `${openCount} in flight · ${corrections.filter((entry) => entry.status === "APPROVED").length} approved` : `${corrections.length} on record`,
        acts: [{ label: "Request a correction", primary: true, drawer: request }], items: correctionItems(corrections),
        foot: corrections.length ? undefined : "No approved score has been corrected this term.",
      },
    ],
  });
  return { title: "Results", desc: "The whole school, then any arm, then any child.", primary: { label: "Export the school broadsheet", icon: DOWNLOAD, href: "/score-entry-results/results/export" }, launchers: [{ label: "Request a correction", drawer: request }, { label: "Open the review queue", href: "/score-entry-results/review" }], rows };
}

/* ───────────────────────── one arm ───────────────────────── */

export function armResultPage(a: ArmBroadsheet, corrections: Correction[], options: CorrectionOptions): { content: TabContent & Crumb } {
  const s = a.summary;
  const subjects = a.subjects;
  const request = requestCorrectionDrawer(options, { arm: a.arm.name, label: a.arm.name });
  const passRates = subjects.map((subject) => (subject.pass === null ? "—" : `${subject.pass}%`));
  return {
    content: {
      crumb: { label: "Back to the whole school", href: "/score-entry-results/results" },
      title: `${a.arm.name} · broadsheet`, desc: "Every child against every subject, with totals and positions.",
      primary: { label: "Export to Excel", icon: DOWNLOAD, href: `${resultArmHref(a.arm.id)}/export` },
      launchers: [{ label: "Request a correction", drawer: request }, { label: "Open the review queue", href: armReviewHref(a.arm.id) }],
      rows: [
        {
          cols: "1fr",
          panels: [{
            type: "kpi", title: "This arm", sub: `${a.arm.master ?? "No form master"} · ${a.term.name} ${a.term.session} · ${a.scheme}`, per: 5,
            cards: [
              { label: "Students computed", value: String(s.computed), unit: `of ${s.roll}`, sub: s.blocked ? `${s.blocked} blocked on a missing or unapproved score` : "Every student computed", tone: s.blocked ? "attention" : "positive" },
              { label: "Arm average", value: num(s.average), sub: `Across ${plural(subjects.length, "subject")}` },
              { label: "Pass rate", value: s.pass === null ? "—" : `${s.pass}%`, sub: `Pass mark ${a.passMark}`, tone: "positive" },
              { label: "Credit rate", value: s.credit === null ? "—" : `${s.credit}%`, sub: "Credit threshold 50" },
              { label: "Top grade", value: s.top?.grade ?? "—", sub: s.top?.name ?? "", tone: "positive" },
            ],
          }],
        },
        {
          cols: "1fr",
          panels: [{
            type: "table", title: `Broadsheet · ${a.arm.name}`, tag: s.incomplete ? "Not every sheet is approved" : "Every sheet approved", tagTone: s.incomplete ? "attention" : "positive",
            sub: "Children against subjects. Open a child to see every component behind their average.", meta: `${s.roll} children · ${subjects.length} subjects · arm average ${num(s.average)}`, search: "Find a child by name or admission number",
            filters: [{ label: "Result", value: "All", options: ["All", "Computed", "Blocked"], match: { Computed: "result:Computed", Blocked: "result:Blocked" } }],
            acts: [{ label: "Export to Excel", primary: true, export: true }],
            head: ["Child", ...subjects.map((subject) => subject.code), "Total", "Average", "Pos", ""], noun: "child", nounPlural: "children", per: 15, noRowOpen: true,
            rows: a.students.map((student) => ({
              keywords: `${student.name} ${student.adm} result:${student.ready ? "Computed" : "Blocked"}`,
              cells: student.ready
                ? [nameCell(student.name, student.adm), ...student.totals.map((value) => text(num(value), { mono: true })), text(String(student.total), { mono: true, strong: true }), text(num(student.average), { mono: true, strong: true }), text(student.pos === null ? "—" : String(student.pos), { mono: true }), { kind: "action" as const, label: "Open", href: resultStudentHref(a.arm.id, student.id) }]
                : [nameCell(student.name, student.blockedBy[0] ?? "Blocked"), ...student.totals.map((value) => text(num(value), { mono: true })), text("—"), text("—"), text("—"), { kind: "action" as const, label: "Blocked", href: armReviewHref(a.arm.id) }],
            })),
            summaryRows: [
              [text("Subject average", { strong: true }), ...subjects.map((subject) => text(num(subject.mean), { mono: true })), text(""), text(num(s.average), { mono: true, strong: true }), text(""), text("")],
              [text("Pass rate", { strong: true }), ...passRates.map((value) => text(value, { mono: true })), text(""), text(s.pass === null ? "—" : `${s.pass}%`, { mono: true, strong: true }), text(""), text("")],
            ],
            foot: "A blocked row is a child with a score still missing or unapproved — they are excluded from positions until it arrives, never given a zero.",
          }],
        },
        {
          cols: "1fr",
          panels: [{ type: "list", title: "Corrections on approved scores in this arm", sub: "A score that has already reached a family can only change through here.", meta: `${corrections.filter((entry) => entry.open).length} in flight`, items: correctionItems(corrections), acts: [{ label: "Request a correction", drawer: request }], foot: corrections.length ? undefined : "Nothing in this arm has been corrected." }],
        },
      ],
    },
  };
}

/* ───────────────────────── one child ───────────────────────── */

export function studentResultPage(p: StudentPage, from: "review" | "results", options: CorrectionOptions): { content: TabContent & Crumb } {
  const sm = p.summary;
  const back = from === "review" ? { label: `Back to ${p.arm.name}`, href: armReviewHref(p.arm.id) } : { label: `Back to ${p.arm.name}`, href: resultArmHref(p.arm.id) };
  const explain: DrawerSpec = { mode: "view", kicker: "Explain this result", title: `${p.student.name} · ${sm.average ?? "—"} average`, readOnly: true, load: `/score-entry-results/drawers/result/${p.arm.id}/${p.student.id}` };
  const keys = Array.from(new Map(p.subjects.flatMap((subject) => subject.columns).map((column) => [column.key, column])).values());
  const approvedOnly = p.subjects.filter((subject) => subject.state === "Approved");
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "This term", sub: `${p.term.name} ${p.term.session} · ${p.scheme}`, per: 6,
      cards: [
        { label: "Average", value: sm.average === null ? "—" : `${sm.average}%`, sub: `Across ${sm.scored} of ${sm.expected} subjects`, tone: sm.average !== null && sm.average < p.passMark ? "negative" : sm.average !== null && sm.average >= 70 ? "positive" : "neutral" },
        { label: "Position in arm", value: sm.pos === null ? "—" : String(sm.pos), unit: `of ${sm.outOf}`, sub: p.arm.name },
        { label: "Overall grade", value: sm.grade ?? "—", sub: p.scheme },
        { label: "Position in class", value: sm.levelPos === null ? "—" : String(sm.levelPos), unit: sm.levelPos === null ? undefined : `of ${sm.levelOutOf}`, sub: sm.levelPos === null ? "Once every sheet is approved" : sm.level },
        { label: "Subjects passed", value: String(sm.passed), unit: `of ${sm.expected}`, sub: `Pass mark ${p.passMark}`, tone: sm.passed === sm.expected && sm.expected ? "positive" : "attention" },
        { label: "Credits", value: String(sm.credits), unit: `of ${sm.expected}`, sub: "Credit threshold 50", tone: sm.credits >= Math.ceil(sm.expected * 0.6) ? "positive" : "attention" },
      ],
    }],
  });
  if (p.absences.length) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `Absent from part of ${p.absences.join(", ")}`, body: "An absence is never scored zero. It is excluded from the total, so this child's average is computed over what they actually sat — and the report card says so in as many words.", acts: [{ label: "Explain this result", drawer: explain }] }] });
  if (!sm.ready) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "neutral", icon: WARN, title: "This child's report card is blocked", body: `${sm.blockedBy.slice(0, 4).join(" · ")}${sm.blockedBy.length > 4 ? ` · and ${sm.blockedBy.length - 4} more` : ""}. The average above reads what has been entered so far.`, acts: [{ label: "Open the review queue", href: armReviewHref(p.arm.id) }] }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Every subject, every component", sub: "The components are shown separately so a parent can see how each total was reached.", meta: `${p.subjects.length} subjects · ${keys.map((column) => `${column.short} ${column.max}`).join(", ")}`, search: "Find a subject",
      filters: [{ label: "Grade", value: "All", options: ["All", ...p.bands.map((band) => band.label)], match: Object.fromEntries(p.bands.map((band) => [band.label, `grade:${band.label}`])) }],
      acts: [{ label: "Print this result", drawer: cardDrawer(p.student.id, p.term.id, p.student.name) }, { label: "Explain this result", primary: true, drawer: explain }],
      head: ["Subject", ...keys.map((column) => column.short), "Total", "Grade", "Pos", "Teacher", ""], noun: "subject", nounPlural: "subjects", noRowOpen: true,
      rows: p.subjects.map((subject) => ({
        keywords: `${subject.name} grade:${subject.grade ?? "None"}`,
        cells: [
          text(subject.name, { strong: true }),
          ...keys.map((column) => { const value = subject.cells[column.key]; return value === "ABS" ? text("ABS", { tone: "withheld", strong: true }) : text(value === undefined || value === null ? "—" : String(value), { mono: true }); }),
          text(num(subject.total), { mono: true, strong: true }), subject.grade ? pill(subject.grade, gradeTone(subject.grade)) : text("—"), text(subject.pos === null ? "—" : String(subject.pos), { mono: true }),
          subject.teacher ? nameCell(subject.teacher, "Subject teacher") : text("—"),
          { kind: "action" as const, label: "Trace", drawer: { mode: "view", kicker: "Score trace", title: `${subject.name} · ${p.student.name}`, readOnly: true, load: `/score-entry-results/drawers/subject/${p.arm.id}/${p.student.id}/${subject.subjectId}` } },
        ],
      })),
      foot: "A blank is not a zero and an absence is not a zero — both are excluded from the average, and the report card says which.",
    }],
  });
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      {
        type: "facts", title: "Across the session", sub: "How this term sits against the others.", per: 2,
        facts: [
          ...p.session.terms.filter((term) => !term.current && term.average > 0).map((term): [string, string, string] => [`${term.name} average`, String(term.average), term.position ? `Position ${term.position}` : "Not ranked"]),
          [`${p.term.name} average`, sm.average === null ? "—" : String(sm.average), sm.pos ? `Position ${sm.pos} of ${sm.outOf}` : ""],
          ["Session average", p.session.average === null ? "—" : String(p.session.average), "Terms weighted equally"],
          ["Direction", p.session.direction === null ? "No earlier term" : p.session.direction > 0 ? "Improving" : p.session.direction < 0 ? "Slipping" : "Steady", p.session.direction === null ? "" : `${p.session.direction > 0 ? "Up" : "Down"} ${Math.abs(p.session.direction)} points on last term`],
          ["Attendance", p.attendance ? `${p.attendance.pct}%` : "No register", "Counted into nothing — shown for context"],
          ["Report card", p.card ? (p.card.published ? `Published ${when(p.card.published)}` : p.card.status.charAt(0) + p.card.status.slice(1).toLowerCase()) : "Not yet generated", approvedOnly.length === p.subjects.length ? "Every sheet is approved" : `${p.subjects.length - approvedOnly.length} sheets not yet approved`],
        ],
      },
      {
        type: "facts", title: "How this was computed", tuck: "How this was computed", sub: "The same explanation a family can ask for.", per: 1, acts: [{ label: "Explain this result", drawer: explain }],
        facts: [
          ["Framework", keys.map((column) => `${column.name} ${column.weight}%`).join(" · "), "The components pinned to each sheet when it was begun"],
          ["Aggregation", "Sum across the components of a subject", "Then the mean across subjects that count"],
          ["Absence handling", "Excluded from the average", "Never scored zero"],
          ["Grading", p.scheme, p.bands.map((band) => `${band.label} ${band.min}–${Math.floor(band.max)}`).join(" · ")],
          ["Position", "By arm and by class", "Ties share the position"],
          ["Corrections", p.corrections.length ? `${p.corrections.length} on this child's scores` : "None", "A published result is revised, not replaced"],
        ],
      },
    ],
  });
  return {
    content: {
      crumb: back, title: p.student.name, desc: `${p.arm.name} · ${p.student.adm} · every subject, every component, and how each number was reached.`,
      primary: { label: "Explain this result", icon: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 8h.02M11.4 11.5h1.2v5h-1.2z", drawer: explain },
      launchers: [
        { label: "Request a correction", drawer: requestCorrectionDrawer(options, { student: p.student.id, arm: p.arm.name, label: p.student.name }) },
        { label: "Open the full student record", href: `/student-records/registry/${p.student.id}/academic?term=${p.term.id}` },
        { label: "Print this result", drawer: cardDrawer(p.student.id, p.term.id, p.student.name) },
      ],
      rows,
    },
  };
}
