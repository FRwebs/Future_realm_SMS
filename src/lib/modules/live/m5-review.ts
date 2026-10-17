import { apiGet } from "@/lib/api/server";
import { nudgeDrawer } from "@/lib/modules/live/m4-forms";
import { armReviewHref, approveArmsDrawer, approveReadyDrawer, decisionDrawer, flagOutcomeDrawer, gridHref, reverseDrawer, reviewStudentHref, SR, sheetHref } from "@/lib/modules/live/m5-forms";
import { type Crumb, gradeTone, num, stateTone, when } from "@/lib/modules/live/m5-enter";
import type { ArmReview, ReviewOverview, SheetPage } from "@/lib/modules/live/m5-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type DrawerSpec, type PanelRow, type PanelTone, type TabContent, type TableRow, type TrackerRow } from "@/lib/modules/panels";

/** Review — which arms are done, and who is holding the rest up. Decisions are taken on the sheet itself. */

export const loadReview = () => apiGet<ReviewOverview>(`${SR}/review`);
export const loadArmReview = (classId: string) => apiGet<ArmReview>(`${SR}/review/${encodeURIComponent(classId)}`);
export const loadSheet = (classId: string, subjectId: string) => apiGet<SheetPage>(`${SR}/review/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const CHECK = "M5 12.5l4.5 4.5 9-10";
const BELL = "M12 3.5A5.5 5.5 0 0 0 6.5 9v3.2L5 15.5h14l-1.5-3.3V9A5.5 5.5 0 0 0 12 3.5z";
const LOCK = "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z";

const notify = (people: Array<{ id: string; name: string }>, o: { title: string; who: string; what: string; message: string }, school: string): DrawerSpec =>
  nudgeDrawer({ endpoint: `${SR}/notify`, people, kicker: "Score review", title: o.title, who: o.who, what: o.what, href: "/score-entry-results/enter", message: `${o.message} — ${school || "the school"}` });

const uniquePeople = (rows: Array<{ ownerId?: string | null; owner?: string; teacherId?: string | null; teacher?: string | null }>) =>
  Array.from(new Map(rows.flatMap((row) => { const id = row.ownerId ?? row.teacherId; const name = row.owner ?? row.teacher; return id && name ? [[id, { id, name }] as const] : []; })).values());

export function reviewTab(o: ReviewOverview): TabContent {
  const k = o.kpis;
  const school = o.school;
  const owing = uniquePeople(o.tracker.filter((row) => row.ownerId && row.state !== "Submitted"));
  const returnedPeople = uniquePeople(o.returned);
  const ready = approveReadyDrawer(o.readySheets, "");
  const notifyOutstanding = notify(owing, { title: `Notify the ${plural(owing.length, "teacher")} owing a sheet`, who: "teachers owing a score sheet", what: "Which sheets they owe and the arm each one blocks", message: "You still owe a score sheet this term. Please open Enter scores and complete it so report cards are not held up." }, school);
  const notifyReturned = notify(returnedPeople, { title: `Notify the ${plural(returnedPeople.length, "teacher")} holding a returned sheet`, who: "teachers with a returned sheet", what: "What was wrong with their sheet and what to correct", message: "A score sheet of yours was sent back and is waiting on you. Please correct it and resubmit." }, school);

  const armRows: TableRow[] = o.arms.map((arm) => ({
    id: arm.id,
    keywords: `${arm.name} ${arm.level} ${arm.master ?? ""} state:${arm.state}`,
    cells: [
      text(arm.name, { strong: true }),
      arm.master ? nameCell(arm.master, "Form master") : text("Nobody named", { tone: "attention" }),
      text(`${arm.in} of ${arm.sheets}`, { strong: true, tone: arm.in === arm.sheets ? "positive" : arm.state === "Blocked" ? "negative" : "attention" }),
      text(String(arm.approved), { mono: true }),
      text(String(arm.flags), { mono: true, strong: arm.flags > 0, tone: arm.flags ? "negative" : undefined }),
      text(String(arm.roll), { mono: true }),
      arm.pending.length && arm.state !== "Approved" ? text(arm.pending.join(", "), { tone: arm.state === "Blocked" ? "negative" : "attention", strong: arm.state === "Blocked" }) : text("—"),
      pill(arm.state, stateTone(arm.state)),
      { kind: "action" as const, label: "Open", href: armReviewHref(arm.id) },
    ],
  }));
  const incomplete = o.arms.filter((arm) => arm.state !== "Approved");

  const tracker: TrackerRow[] = o.tracker.map((row) => ({ unit: row.unit, sub: row.sub, owner: row.owner, role: row.ownerId ? "Subject teacher" : "Name a teacher", state: row.state, age: row.age, overdue: row.overdue, href: row.state === "Unassigned" ? "/class-timetable/teaching" : row.state === "Submitted" ? sheetHref(row.classId, row.subjectId) : gridHref(row.classId, row.subjectId), act: row.state === "Unassigned" ? "Assign" : row.state === "Submitted" ? "Review" : "Open" }));

  const rows: PanelRow[] = [];
  if (o.unavailable) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "No arm has subjects to review yet", body: "A sheet is a subject in an arm. Offer subjects to an arm and name a teacher for each on Class & Timetable, and its sheets appear here.", acts: [{ label: "Open Class & Timetable", href: "/class-timetable/teaching" }] }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: `${o.term.name} ${o.term.session}`, sub: o.windows.length ? `Entry ${o.closedDays !== null ? `closed ${plural(o.closedDays, "day")} ago` : `closes ${when(o.closes)}`}. ${k.expected} subject-arm sheets are expected.` : `${k.expected} subject-arm sheets are expected. No entry window is set, so none is overdue by the calendar.`, per: 5,
      cards: [
        { label: "Sheets in", value: String(k.in), unit: `of ${k.expected}`, sub: `${k.outstanding} outstanding`, tone: k.outstanding ? "attention" : "positive" },
        { label: "Approved", value: String(k.approved), sub: "Cleared for report cards", tone: "positive" },
        { label: "Ready to approve", value: String(k.ready), sub: "Submitted, no open flags", tone: "submitted", link: k.ready ? "Approve them" : undefined, drawer: k.ready ? ready : undefined },
        { label: "Returned to a teacher", value: String(k.returned), sub: k.returned ? `Oldest sitting ${plural(k.oldestReturned, "day")}` : "Nothing is waiting on a teacher", tone: k.returned ? "negative" : "positive", link: k.returned ? `Notify all ${k.returned}` : undefined, drawer: k.returned ? notifyReturned : undefined },
        { label: "Impossible to enter", value: String(k.impossible), sub: k.impossible ? `${k.impossibleNames.join(", ")}${k.impossible > 3 ? "…" : ""} have no teacher` : "Every subject has a teacher", tone: k.impossible ? "negative" : "positive", link: k.impossible ? "Assign" : undefined, href: k.impossible ? "/class-timetable/teaching" : undefined },
      ],
    }],
  });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "By arm", tag: incomplete.length ? `${plural(incomplete.length, "arm")} incomplete` : "Every arm approved", tagTone: incomplete.length ? "attention" : "positive", sub: "Every arm, what is in, and who still owes a sheet.", meta: `${o.arms.length} arms · ${k.expected} sheets · ${k.in} in`, search: "Find an arm, a class or a form master",
      filters: [{ label: "Arm", value: "All", options: ["All", ...o.arms.map((arm) => arm.name)], column: 0 }, { label: "State", value: "All", options: ["All", "Blocked", "Returned", "In progress", "Submitted", "Approved", "Not started"], column: 7 }],
      acts: [...(owing.length ? [{ label: "Notify the outstanding", drawer: notifyOutstanding }] : []), ...(k.ready ? [{ label: `Approve the ${k.ready} ready`, primary: true, drawer: ready }] : [])],
      head: ["Arm", "Form master", "Sheets in", "Approved", "Flags", "Roll", "Pending from", "State", ""], noun: "arm", nounPlural: "arms", selectable: true, per: 10,
      bulkActs: [
        { label: "Approve everything ready", drawer: approveArmsDrawer(), selection: { key: "arms", noun: "arm" } },
        { label: "Export selected", primary: true, export: true },
      ],
      rows: armRows, empty: "No arm has sheets yet.", foot: "Blocked means a sheet cannot exist yet — nobody teaches that subject in that arm.",
    }],
  });
  if (k.returned) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `${plural(k.returned, "sheet")} ${k.returned === 1 ? "is" : "are"} returned and waiting on a teacher`, body: "A returned sheet is doubly blocking: the teacher often has not noticed, and a whole class's report cards are waiting on it.", acts: [{ label: `Notify all ${k.returned}`, drawer: notifyReturned }] }] });
  }
  rows.push({
    cols: "1fr",
    panels: [{ type: "tracker", title: "Submission tracker", sub: "Every sheet that is not yet approved, with the person it sits with.", meta: o.windows.length ? `${o.closedDays !== null ? `Entry closed ${plural(o.closedDays, "day")} ago` : "Entry is open"} · ${k.past} past due` : `${k.past} blocked or returned`, noun: "sheets approved", groups: ["By teacher", "By state"], clear: { title: "Every sheet is approved", body: `All ${k.expected} subject-arm sheets are in and approved.` }, rows: tracker }],
  });
  rows.push({
    cols: "1.2fr 1fr",
    panels: [
      {
        type: "table", title: "Verification", meta: `${o.verification.reduce((total, row) => total + row.count, 0)} findings across sheets awaiting a decision`,
        head: ["Check", "What was found", "Count"], noun: "check", nounPlural: "checks", noRowOpen: true,
        rows: o.verification.map((row) => ({ cells: [nameCell(row.title, row.what, { avatar: false }), text(row.count ? row.found : "Nothing found", { tone: row.count ? undefined : "positive" }), text(String(row.count), { mono: true, strong: row.count > 0 })] })),
        foot: "Anomalies, copied rows and columns of zeros need an outcome recorded on the sheet before it can be approved.",
      },
      o.mine.length
        ? { type: "note", tone: "withheld", icon: LOCK, title: `You entered ${o.mine[0].name}${o.mine.length > 1 ? ` and ${o.mine.length - 1} more` : ""}, so you cannot approve ${o.mine.length > 1 ? "them" : "it"}`, body: "Segregation of duties is enforced at the moment of approval, not flagged afterwards. Someone else with the right to approve must decide it." }
        : { type: "note", tone: "withheld", icon: LOCK, title: "Whoever enters a sheet cannot approve it", body: "Segregation of duties is enforced at the moment of approval, not flagged afterwards. Anything you enter or submit yourself is left out of every approval you give." },
    ],
  });
  return { title: "Review", desc: "Where every arm stands, and what needs your approval.", primary: k.ready ? { label: `Approve the ${k.ready} ready`, icon: CHECK, drawer: ready } : undefined, launchers: [...(owing.length ? [{ label: `Notify the ${owing.length} outstanding`, drawer: notifyOutstanding }] : []), { label: "Enter a sheet myself", href: "/score-entry-results/enter" }], rows };
}

/* ───────────────────────── one arm ───────────────────────── */

export function armReviewPage(a: ArmReview): { content: TabContent & Crumb } {
  const k = a.kpis;
  const readyDrawer = approveReadyDrawer(a.ready.map((sheet) => ({ classId: a.arm.id, subjectId: sheet.subjectId, name: `${sheet.name} · ${a.arm.name}`, roll: sheet.roll })), `in ${a.arm.name}`, [a.arm.id]);
  const stateCount = (state: string) => a.subjects.filter((subject) => subject.state === state).length;
  return {
    content: {
      crumb: { label: "Back to all arms", href: "/score-entry-results/review" },
      title: `${a.arm.name} · score review`, desc: `${plural(a.subjects.length, "sheet")}, ${plural(a.roll, "child", "children")}. Approve, decline or send back.`,
      primary: a.ready.length ? { label: `Approve the ${a.ready.length} ready`, icon: CHECK, drawer: readyDrawer } : { label: k.approved === k.sheets && k.sheets ? "Everything here is approved" : "Nothing is ready to approve", icon: CHECK },
      launchers: [{ label: "Preview the broadsheet", href: `/score-entry-results/enter/${a.arm.id}/broadsheet` }, { label: "Open the results", href: `/score-entry-results/results/${a.arm.id}` }],
      rows: [
        ...(a.excluded.length ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, icon: WARN, title: `${plural(a.excluded.length, "submitted sheet")} left out of a bulk approval`, body: `${a.excluded.join(" · ")}. Anything flagged, or entered by you, is never bulk-approved.` }] }] : []),
        {
          cols: "1fr",
          panels: [{
            type: "kpi", title: "Where this arm stands", sub: `${a.term.name} ${a.term.session}`, per: 5,
            cards: [
              { label: "Sheets approved", value: String(k.approved), unit: `of ${k.sheets}`, sub: "Cleared for report cards", tone: k.approved === k.sheets ? "positive" : "attention" },
              { label: "Awaiting your decision", value: String(k.awaiting), sub: "Submitted", tone: k.awaiting ? "submitted" : "neutral" },
              { label: "Returned to a teacher", value: String(k.returned), sub: k.returned ? "Waiting on the teacher" : "Nothing returned", tone: k.returned ? "negative" : "positive" },
              { label: "Open flags", value: String(k.flags), sub: "Each needs an outcome recorded", tone: k.flags ? "attention" : "positive" },
              { label: "Cards blocked", value: String(k.blocked), sub: "Until every sheet is approved", tone: k.blocked ? "negative" : "positive", link: k.blocked ? "See the blockers" : undefined, href: k.blocked ? "/report-cards/completion" : undefined },
            ],
          }],
        },
        {
          cols: "1fr",
          panels: [{
            type: "table", title: "By subject", tag: plural(a.subjects.length, "sheet"), tagTone: "neutral", sub: "Every sheet for this arm. Approve it, decline it, or send it back for rework.", meta: `${a.subjects.length} subjects · ${a.roll} children each`, search: "Find a subject or a teacher",
            filters: [{ label: "State", value: "All", options: ["All", "Approved", "Submitted", "Returned", "In progress", "Not started", "Unassigned"], column: 3 }, { label: "Flags", value: "All", options: ["All", "Flagged", "Clean"], match: { Flagged: "flag:Flagged", Clean: "flag:Clean" } }],
            head: ["Subject", "Teacher", "Entered", "State", "Avg", "Flags", ""], noun: "sheet", nounPlural: "sheets", per: 12, noRowOpen: true,
            rows: a.subjects.map((subject) => ({
              keywords: `${subject.name} ${subject.teacher ?? ""} flag:${subject.flags ? "Flagged" : "Clean"}`,
              cells: [text(subject.name, { strong: true }), subject.teacher ? nameCell(subject.teacher, subject.mine ? "You entered it" : "Subject teacher") : text("Unassigned", { tone: "negative", strong: true }), text(subject.entered, { mono: true }), pill(subject.state, stateTone(subject.state)), text(num(subject.mean), { mono: true }), subject.flags ? text(String(subject.flags), { tone: "negative", strong: true }) : text("—"), { kind: "action" as const, label: subject.state === "Submitted" ? "Review the sheet" : "Open the sheet", href: sheetHref(a.arm.id, subject.subjectId) }],
            })),
            foot: `${stateCount("Approved")} approved · ${stateCount("Submitted")} submitted · ${stateCount("Returned")} returned. Opening a sheet shows every child with every component, and the decision you can make about it.`,
          }],
        },
        {
          cols: "1fr",
          panels: [{
            type: "table", title: "By student", tag: plural(a.students.length, "child", "children"), tagTone: "neutral", sub: "The same sheets read per child. Open one for their whole result.", meta: `Positions are provisional until every sheet is approved${a.armMean === null ? "" : ` · arm average ${a.armMean}`}`, search: "Find a child by name or admission number",
            filters: [{ label: "Result", value: "All", options: ["All", "Ready", "Blocked"], match: { Ready: "result:Ready", Blocked: "result:Blocked" } }],
            head: ["Child", "Admission no", "Subjects", "Average", "Pos", "Grade", "State", ""], noun: "child", nounPlural: "children", per: 12, noRowOpen: true,
            rows: a.students.map((student) => ({
              keywords: `${student.name} ${student.adm} result:${student.ready ? "Ready" : "Blocked"}`,
              cells: [nameCell(student.name, student.absences ? `${plural(student.absences, "absence")} · excluded, never zero` : a.arm.name), text(student.adm, { mono: true }), text(`${student.scored} of ${student.expected}`, { mono: true }), text(num(student.average), { mono: true, strong: true }), text(student.pos === null ? "—" : String(student.pos), { mono: true }), student.grade ? pill(student.grade, gradeTone(student.grade)) : text("—"), student.ready ? text("Every sheet in · card can generate", { tone: "positive" }) : text(student.blockedBy.length ? `Blocked — ${student.blockedBy[0]}` : "Blocked", { tone: "attention" }), { kind: "action" as const, label: "Open", href: reviewStudentHref(a.arm.id, student.id) }],
            })),
            foot: "An average is computed over the subjects a child actually sat. An absence is excluded, never scored zero.",
          }],
        },
      ],
    },
  };
}

/* ───────────────────────── one sheet ───────────────────────── */

export function sheetPage(s: SheetPage, school: string): { content: TabContent & Crumb } {
  const st = s.stats;
  const owner = s.teacher;
  const decided = s.state === "Approved";
  const approve = decisionDrawer(s, "approve");
  const rework = decisionDrawer(s, "rework");
  const decline = decisionDrawer(s, "decline");
  const maxTotal = s.columns.reduce((total, column) => total + column.max, 0);
  const notifyTeacher = owner?.id ? notify([{ id: owner.id, name: owner.name }], { title: `Notify ${owner.name}`, who: owner.name, what: `That ${s.subject.name} ${s.arm.name} is still with them`, message: `${s.subject.name} · ${s.arm.name} is still with you. Please complete it so report cards are not held up.` }, school) : undefined;

  const primary = s.state === "Returned"
    ? notifyTeacher ? { label: `Notify ${owner?.name ?? "the teacher"}`, icon: BELL, drawer: notifyTeacher } : undefined
    : decided
      ? s.reversible ? { label: "Take the approval back", icon: CHECK, drawer: reverseDrawer(s) } : { label: "Approved", icon: CHECK }
      : s.canDecide ? { label: "Approve this subject", icon: CHECK, drawer: approve } : { label: s.state === "Submitted" ? "You entered this sheet" : s.state === "Not started" ? "Not started" : "With the teacher", icon: LOCK };

  const rows: PanelRow[] = [];
  if (!owner) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: `No teacher is mapped to ${s.subject.name} in ${s.arm.name}`, body: "Nobody can enter a score for a subject nobody teaches, so every report card in this arm is blocked until someone is named.", acts: [{ label: "Assign a teacher", href: "/class-timetable/teaching" }] }] });
  if (s.mine && s.state === "Submitted") rows.push({ cols: "1fr", panels: [{ type: "note", tone: "withheld", icon: LOCK, title: "You entered this sheet, so you cannot approve it", body: "Segregation of duties is enforced at the moment of approval. Route it to another approver — an Exam Officer or Vice-Principal." }] });
  if (s.state === "Submitted" && s.openFlags) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `${plural(s.openFlags, "verification flag")} ${s.openFlags === 1 ? "needs" : "need"} an outcome before this can be approved`, body: "Record what was found for each one below. The sheet cannot be approved with a flag nobody has answered." }] });
  if (s.decision.note && s.state === "Returned") rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: "Sent back for rework", body: s.decision.note }] });
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "This sheet", per: 6,
      cards: [
        { label: "Entered", value: `${st.scored} of ${st.roll}`, sub: st.scored === st.roll ? "Complete" : "A fraction, never a percentage", tone: st.scored === st.roll ? "positive" : "attention" },
        { label: "Subject average", value: num(st.mean), unit: `/ ${maxTotal}`, sub: st.armMean === null ? "" : `Arm average ${st.armMean}`, tone: st.mean !== null && st.armMean !== null && st.mean >= st.armMean ? "positive" : "attention" },
        { label: "Highest", value: st.high ? String(st.high.total) : "—", sub: st.high?.name ?? "", tone: "positive" },
        { label: "Lowest", value: st.low ? String(st.low.total) : "—", sub: st.low?.name ?? "", tone: st.low && st.low.total < s.subject.passMark ? "negative" : "attention" },
        { label: "At credit or above", value: String(st.passed), unit: `of ${st.scored}`, sub: "50 and above", tone: "positive" },
        { label: "Below the pass mark", value: String(st.failed), sub: `Under ${s.subject.passMark}`, tone: st.failed ? "negative" : "positive" },
      ],
    }],
  });
  const ranked = s.rows.slice().sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: `Every child in ${s.arm.name}`, tag: "Ranked by total", tagTone: "neutral", sub: s.columns.map((column) => `${column.name} /${column.max}`).join(", ") + ".",
      meta: `${s.subject.name} · ${s.subject.category} · ${owner?.name ?? "no teacher mapped"}${s.frameworkAt ? ` · framework pinned ${when(s.frameworkAt)}` : ""}`, search: "Find a child by name or admission number",
      filters: [
        { label: "Grade", value: "All", options: ["All", ...s.distribution.map((band) => band.label)], match: Object.fromEntries(s.distribution.map((band) => [band.label, `grade:${band.label}`])) },
        { label: "Standing", value: "All", options: ["All", "Well above the class", "Above the class", "Around the class", "Below the class"] },
      ],
      acts: [{ label: "Export to Excel", primary: true, href: `${sheetHref(s.arm.id, s.subject.id)}/export` }, ...(s.state !== "Approved" && s.state !== "Submitted" ? [{ label: "Enter or correct scores", href: gridHref(s.arm.id, s.subject.id) }] : [])],
      head: ["Pos", "Child", "Admission no", ...s.columns.map((column) => column.short), "Total", "Grade", "Rating", "Standing", ""], noun: "child", nounPlural: "children", per: 12, selectable: true,
      bulkActs: [{ label: "Export selected", primary: true, export: true }],
      rows: ranked.map((row) => ({
        id: row.id, keywords: `${row.name} ${row.adm} grade:${row.grade ?? "None"} ${row.standing}`,
        cells: [
          text(row.pos === null ? "—" : String(row.pos), { mono: true, strong: true, tone: row.pos === 1 ? "positive" : undefined }), nameCell(row.name, row.absent ? `${plural(row.absent, "absence")} · never a zero` : s.arm.name), text(row.adm, { mono: true }),
          ...s.columns.map((column) => (row.cells[column.key] === "ABS" ? text("ABS", { tone: "withheld", strong: true }) : text(num(row.cells[column.key] as number | null), { mono: true }))),
          text(num(row.total), { mono: true, strong: true }), row.grade ? pill(row.grade, gradeTone(row.grade)) : text("—"), text(row.rating, { tone: row.total === null ? "negative" : row.total >= 65 ? "positive" : row.total >= s.subject.passMark ? "attention" : "negative" }), text(row.standing), { kind: "action" as const, label: "Open", href: reviewStudentHref(s.arm.id, row.id) },
        ],
      })),
      foot: "Position is within this subject, in this arm. A dash is a component nobody has entered — it is never a zero.",
    }],
  });
  if (s.flags.length) {
    rows.push({
      cols: "1fr",
      panels: [{
        type: "table", title: "Verification on this sheet", tag: s.openFlags ? `${s.openFlags} open` : "All answered", tagTone: s.openFlags ? "negative" : "positive", sub: "What the system asked of these numbers, and what the answer was.",
        head: ["Check", "What was found", "Outcome", ""], noun: "flag", nounPlural: "flags", noRowOpen: true,
        rows: s.flags.map((flag) => ({ cells: [nameCell(flag.title, flag.blocking ? "Needs an outcome" : "For information", { avatar: false }), text(flag.detail), flag.outcome ? text(`${flag.outcome.outcome}${flag.outcome.note ? ` · ${flag.outcome.note}` : ""}`, { tone: "positive" }) : text(flag.blocking ? "No outcome yet" : "—", { tone: flag.blocking ? "negative" : undefined, strong: flag.blocking }), flag.blocking ? { kind: "action" as const, label: flag.outcome ? "Change" : "Record outcome", drawer: flagOutcomeDrawer(s, flag) } : text("")] })),
      }],
    });
  }
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      { type: "bars", title: "Grade distribution", sub: "Where the class actually landed.", rows: s.distribution.filter((band) => band.count).map((band) => ({ label: `${band.label} · ${band.min}–${Math.floor(band.max)}`, value: Math.round((band.count / Math.max(1, st.scored)) * 100), display: `${band.count} ${band.count === 1 ? "child" : "children"}`, tone: gradeTone(band.label) })) },
      {
        type: "facts", title: "Who teaches this subject here", tag: owner ? owner.role.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "Unassigned", tagTone: owner ? "positive" : "negative", sub: "The only person who can enter a score against these children.", meta: owner ? `${owner.staffNo ? `Staff number ${owner.staffNo}` : "Staff"}${owner.dept ? ` · ${owner.dept}` : ""}` : "Nobody mapped", per: 1,
        acts: owner?.id ? [{ label: "Notify them", drawer: notifyTeacher }, { label: "Open their record", primary: true, href: `/staff-access/directory/${owner.id}` }] : [{ label: "Assign a teacher", primary: true, href: "/class-timetable/teaching" }],
        facts: [
          ["Teacher", owner?.name ?? "Nobody named", owner ? (owner.role.replace(/_/g, " ").toLowerCase()) : "No scores can exist for this subject"],
          ["Phone", owner?.phone ?? "—"],
          ["Sheet state", s.state, s.state === "Returned" ? `Sent back ${when(s.decision.returnedAt)} and not resubmitted` : s.state === "Submitted" ? "Awaiting a decision" : ""],
          ["Submitted on", s.decision.submittedAt ? when(s.decision.submittedAt) : "—", s.decision.submittedBy ?? ""],
          ["Decided by", s.decision.decidedBy ?? "Not yet decided", s.decision.decidedAt ? when(s.decision.decidedAt) : ""],
          ["Corrections on this sheet", s.corrections.all ? `${s.corrections.all} requested${s.corrections.open ? ` · ${s.corrections.open} open` : ""}` : "None"],
        ],
      },
    ],
  });
  return {
    content: {
      crumb: { label: `Back to ${s.arm.name}`, href: armReviewHref(s.arm.id) },
      title: `${s.subject.name} · ${s.arm.name}`, desc: `Every child in ${s.arm.name}, component by component. State: ${s.state}.`, primary,
      launchers: [
        ...(s.canDecide ? [{ label: "Send back for rework", drawer: rework }, { label: "Decline this subject", drawer: decline }] : []),
        ...(s.state !== "Approved" && s.state !== "Submitted" ? [{ label: "Enter or correct scores", href: gridHref(s.arm.id, s.subject.id) }] : []),
        { label: "Export this sheet", href: `${sheetHref(s.arm.id, s.subject.id)}/export` },
      ],
      rows,
    },
  };
}
