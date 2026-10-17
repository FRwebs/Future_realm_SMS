import { apiGet } from "@/lib/api/server";
import {
  AT, absenceReasonDrawer, correctRegisterDrawer, complianceNudge, nudgeDrawer, reassignDrawer, sendRecordDrawer, spoolDrawer
} from "@/lib/modules/live/m4-forms";
import type { Day, DayStudent, Options, Overview, CorrectionOptions } from "@/lib/modules/live/m4-types";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type DrawerSpec, type KpiCard, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";
import type { Compliance } from "@/lib/modules/live/m4-types";

/** The Register tab — the whole school's day — and one arm's day behind it. */

export const loadOverview = (date?: string) => apiGet<Overview>(`${AT}/register${date ? `?date=${encodeURIComponent(date)}` : ""}`);
export const loadDay = (classId: string, date?: string) => apiGet<Day>(`${AT}/register/${encodeURIComponent(classId)}/day${date ? `?date=${encodeURIComponent(date)}` : ""}`);
export const loadOptions = () => apiGet<Options>(`${AT}/options`);
export const loadCorrectionOptions = () => apiGet<CorrectionOptions>(`${AT}/corrections/options`);

export const dayHref = (classId: string, date?: string) => `/attendance/register/${encodeURIComponent(classId)}${date ? `?date=${date}` : ""}`;
export const markHref = (classId: string, date?: string) => `/attendance/mark/${encodeURIComponent(classId)}${date ? `?date=${date}` : ""}`;
export const trendHref = (classId: string) => `/attendance/log/${encodeURIComponent(classId)}`;
export const weekHref = (classId: string, start?: string) => `/attendance/log/${encodeURIComponent(classId)}/week${start ? `?start=${start}` : ""}`;
export const studentRecordHref = (id: string) => `/student-records/registry/${encodeURIComponent(id)}`;
export const staffRecordHref = (id: string) => `/staff-access/directory/${encodeURIComponent(id)}`;

export const rateTone = (value: number | null, policy: { target: number; chronic: number }): PanelTone =>
  value === null ? "neutral" : value >= policy.target ? "positive" : value >= policy.chronic ? "attention" : "negative";

export const pct = (value: number | null) => (value === null ? "—" : `${value}%`);
export const STATE_TONE: Record<string, PanelTone> = { Marked: "positive", "In progress": "progress", Unmarked: "negative", "Not started": "negative", Present: "positive", Absent: "negative", Late: "attention", Excused: "submitted", Chronic: "negative", Falling: "attention", Watch: "attention", "No concern": "positive", Open: "negative", Closed: "positive", Awaiting: "attention", Approved: "positive", Declined: "neutral", "Same day": "neutral", Backdated: "attention", Resolved: "positive", New: "attention" };
export const tone = (state: string): PanelTone => STATE_TONE[state] ?? "neutral";

const CHECK = "M5 12.5l4.5 4.5 9-10";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const LONG_DATE = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** A strip of days that can be walked: each is a link to the same page on another date. */
export function dayStrip(days: string[], current: string, href: (iso: string) => string, title = "Choose another day", states?: Record<string, string>): PanelRow {
  const ordered = (days.includes(current) ? days : [current, ...days]).slice().sort();
  return {
    cols: "1fr",
    panels: [
      {
        type: "days", title, sub: `${ordered.length} school days on record — walk back through the term without leaving the page.`,
        days: ordered.map((iso) => {
          const state = states?.[iso];
          return { label: LONG_DATE(iso), sub: iso === current ? "Showing" : state, href: href(iso), state: iso === current ? ("now" as const) : state === "No register" ? ("missing" as const) : state === "Marked" ? ("done" as const) : ("plain" as const) };
        }),
      },
    ],
  };
}

export function registerTab(o: Overview, options: Options): TabContent {
  const d = o.day;
  const unmarked = o.arms.filter((arm) => arm.state !== "Marked");
  const pastCutoff = o.arms.filter((arm) => arm.pastCutoff);
  const owners = Array.from(new Map(pastCutoff.filter((arm) => arm.masterId).map((arm) => [arm.masterId as string, { id: arm.masterId as string, name: arm.master as string }])).values());
  const school = options.school || "the school";
  const nudge = nudgeDrawer({
    people: owners, kicker: "Attendance", who: "form masters with an unmarked register", what: "Which register is unmarked, and the cutoff it passed",
    href: "/attendance/mark", message: `Your register for ${o.label} is still unmarked and the ${o.policy.markCutoff} cutoff has passed. Please take it now. — ${school}`,
  });

  const cards: KpiCard[] = [
    { label: "Attendance", value: pct(d.rate), unit: `of ${d.accounted} marked`, sub: `${d.present} present · school target is ${o.policy.target}%`, tone: rateTone(d.rate, o.policy) },
    { label: "Registers in", value: String(d.marked), unit: `of ${d.arms} arms`, sub: pastCutoff.length ? `${plural(pastCutoff.length, "arm")} past the ${o.policy.markCutoff} cutoff` : unmarked.length ? "Still inside the cutoff" : "Every register is in", tone: pastCutoff.length ? "attention" : "positive", link: pastCutoff.length ? `See the ${pastCutoff.length}` : undefined, href: pastCutoff.length ? "/attendance/compliance" : undefined },
    { label: "Absent", value: String(d.absent), sub: "Across the arms marked so far", tone: d.absent ? "attention" : "positive" },
    { label: "Late", value: String(d.late), sub: `After the ${o.policy.bell} bell`, tone: d.late ? "attention" : "positive" },
    { label: "Chronic absence cases", value: String(o.chronic), sub: `Below ${o.policy.chronic}% this term`, tone: o.chronic ? "negative" : "positive", link: o.chronic ? "Open the cases" : undefined, href: o.chronic ? "/attendance/log" : undefined },
  ];

  const armRows: TableRow[] = o.arms
    .slice()
    .sort((a, b) => Number(a.state === "Marked") - Number(b.state === "Marked"))
    .map((arm) => ({
      id: arm.id,
      keywords: `${arm.name} ${arm.master ?? ""} ${arm.dept ?? ""}`,
      cells: [
        text(arm.name, { strong: true }),
        arm.master ? nameCell(arm.master, "Form master") : text("Nobody named", { tone: "negative", strong: true }),
        text(String(arm.roll), { mono: true }),
        arm.state === "Marked" ? text(String(arm.present + arm.late), { mono: true }) : text("—"),
        arm.state === "Marked" ? text(String(arm.absent), { mono: true, tone: arm.absent > 1 ? "negative" : undefined, strong: arm.absent > 1 }) : text("—"),
        arm.state === "Marked" ? text(pct(arm.rate), { strong: true, tone: rateTone(arm.rate, o.policy) }) : text("—"),
        pill(arm.state, tone(arm.state)),
        { kind: "action" as const, label: arm.state === "Marked" ? "Open" : arm.state === "In progress" ? "Continue" : "Mark", href: arm.state === "Marked" ? dayHref(arm.id, o.date) : markHref(arm.id, o.date) },
      ],
    }));

  const teacherRows: TableRow[] = o.teachers
    .slice()
    .sort((a, b) => (a.punctuality ?? 101) - (b.punctuality ?? 101))
    .map((teacher) => ({
      id: teacher.id,
      keywords: `${teacher.name} ${teacher.arms.join(" ")} dept:${teacher.dept ?? "None"}`,
      cells: [
        nameCell(teacher.name, `Form master${teacher.dept ? ` · ${teacher.dept}` : ""}`),
        text(teacher.arms.join(", ")),
        text(String(teacher.roll), { mono: true }),
        text(`${teacher.marked} of ${teacher.total}`, { strong: true, tone: teacher.marked === 0 ? "negative" : teacher.marked < teacher.total ? "attention" : "positive" }),
        text(teacher.punctuality === null ? "—" : `${teacher.punctuality}%`, { strong: true, tone: teacher.punctuality === null ? undefined : teacher.punctuality < 72 ? "negative" : teacher.punctuality < 90 ? "attention" : "positive" }),
        { kind: "action" as const, label: "Open", drawer: { mode: "view", kicker: "Attendance · by teacher", title: teacher.name, sub: "Everything this teacher answers for, and how they are doing it.", readOnly: true, load: `/attendance/drawers/teacher/${teacher.id}` } },
      ],
    }));
  const depts = Array.from(new Set(o.teachers.map((teacher) => teacher.dept ?? "None")));

  const explanationItems = o.explanations.slice(0, 6).map((entry) => ({
    label: `${entry.child ?? "A child"}${entry.arm ? ` · ${entry.arm}` : ""}`,
    sub: `${entry.guardian}: “${entry.detail.length > 90 ? `${entry.detail.slice(0, 90)}…` : entry.detail}”`,
    pill: entry.state,
    tone: tone(entry.state),
    viewLabel: entry.open ? "Decide" : "View",
    drawer: { mode: entry.open ? ("decide" as const) : ("view" as const), kicker: "Guardian explanation", title: `${entry.child ?? "A child"} · ${entry.guardian}`, readOnly: !entry.open, load: `/attendance/drawers/explanation/${entry.id}` },
  }));

  const rows: PanelRow[] = [];
  if (o.note) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "progress", icon: WARN, title: "Showing an earlier day", body: o.note }] });
  if (o.unassigned.length) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `${plural(o.unassigned.length, "arm")} ${o.unassigned.length === 1 ? "has" : "have"} no form master`, body: `${o.unassigned.slice(0, 6).join(", ")}${o.unassigned.length > 6 ? "…" : ""}. Nobody owns these registers, so nobody is held to account for them.`, acts: [{ label: "Name a form master", drawer: reassignDrawer(options, options.arms.filter((arm) => o.unassigned.includes(arm.name))) }] }] });
  }
  rows.push({ cols: "1fr", panels: [{ type: "kpi", title: o.label, sub: `The school's own attendance ${o.today ? "for today" : "on this day"}, recomputed as registers come in.`, per: 5, cards }] });
  rows.push({
    cols: "1fr",
    panels: [
      {
        type: "table",
        title: o.today ? "Every arm, today" : "Every arm on this day",
        tag: unmarked.length ? `${unmarked.length} unmarked` : "All marked",
        tagTone: unmarked.length ? "attention" : "positive",
        sub: "Open an arm for its student list, or open the teacher to see everything they are responsible for.",
        meta: `${d.arms} arms · ${d.roll.toLocaleString()} children${o.since ? ` · registers counted from ${LONG_DATE(o.since)}` : ""}`,
        search: "Find an arm, a form master or a class",
        filters: [
          { label: "Arm", value: "All", options: ["All", ...o.arms.map((arm) => arm.name)], column: 0 },
          { label: "State", value: "All", options: ["All", "Marked", "In progress", "Unmarked"], column: 6 },
        ],
        acts: [
          ...(owners.length ? [{ label: `Notify the ${owners.length} unmarked`, drawer: nudge }] : []),
          { label: "Export the day", primary: true, export: true },
        ],
        head: ["Arm", "Form master", "Roll", "Pres", "Abs", "Rate", "State", ""],
        noun: "arm", nounPlural: "arms", selectable: true, per: 10,
        bulkActs: [
          { label: "Notify the form masters", drawer: nudgeDrawer({ people: [], kicker: "Attendance", title: "Notify the form masters of the selected arms", who: "the form masters of the arms you selected", what: "Which register is unmarked, and the cutoff it passed", href: "/attendance/mark", message: `Your register for ${o.label} is unmarked. Please take it now. — ${school}` }), selection: { key: "arms", noun: "arm" } },
          { label: "Reassign the arm", drawer: reassignDrawer(options, [], "Reassign the selected arms"), selection: { key: "arms", noun: "arm" } },
          { label: "Export selected", primary: true, export: true },
        ],
        rows: armRows,
        foot: "Rate is present (and late) against everyone counted that day; excused children are left out. An unmarked arm is not 0% — it is unknown, and counted as unknown.",
      },
    ],
  });
  rows.push({
    cols: "1.15fr 1fr",
    panels: [
      {
        type: "table", title: "By teacher", sub: "Every form master, and the arms they answer for.",
        meta: `${o.teachers.length} form masters · ${o.teachers.filter((teacher) => teacher.marked === 0).length} have not marked anything`,
        search: "Find a teacher or an arm",
        filters: depts.length > 1 ? [{ label: "Department", value: "All", options: ["All", ...depts], match: Object.fromEntries(depts.map((dept) => [dept, `dept:${dept}`])) }] : undefined,
        head: ["Teacher", "Arms", "Roll", "Marked", "Punctuality", ""],
        noun: "teacher", nounPlural: "teachers", per: 8, rows: teacherRows,
        foot: "Punctuality is the share of the term's registers taken before the cutoff. Open a teacher to see their record, and to move an arm to someone else.",
      },
      {
        type: "list", title: "Guardian explanations", sub: "A guardian submits; the school decides.",
        meta: `${o.explanations.filter((entry) => entry.open).length} waiting`,
        acts: [{ label: "Open all submissions", href: "/parents-guardians/submissions" }],
        items: explanationItems,
        foot: o.explanations.length ? undefined : "No guardian has sent an absence explanation yet.",
      },
    ],
  });
  rows.push(dayStrip(o.days, o.date, (iso) => `/attendance/register?date=${iso}`, "Another day", {}));

  return {
    title: "Register",
    desc: "The whole school's day, arm by arm.",
    primary: { label: "Export the day", icon: "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15", drawer: spoolDrawer(options, { for: "The whole school", label: "Attendance · Register" }) },
    launchers: [
      { label: "Mark a register", href: "/attendance/mark" },
      { label: "See who has not marked", href: "/attendance/compliance" },
    ],
    rows,
  };
}

/* ───────────────────────── one arm, one day ───────────────────────── */

export type DayPage = { content: TabContent & { crumb: { label: string; href: string } } };

export function dayPage(d: Day, options: Options, correction: CorrectionOptions): DayPage {
  const markedStudents = d.students.filter((student) => student.mark !== "NONE").map((student) => ({ id: student.id, name: student.name, adm: student.adm, mark: student.markLabel, markLabel: student.markLabel }));
  const sameDay = d.isToday;
  const correct = (pre?: string): DrawerSpec => correctRegisterDrawer({ classId: d.arm.id, arm: d.arm.name, date: d.date, label: d.label, sameDay, students: markedStudents, approver: correction.approver, pre });
  const reasonFor = (pre?: string[]): DrawerSpec => absenceReasonDrawer({ classId: d.arm.id, arm: d.arm.name, date: d.date, label: d.label, students: d.students.filter((student) => student.mark !== "PRESENT" && student.mark !== "NONE").map((student) => ({ id: student.id, name: student.name, adm: student.adm, mark: student.markLabel })), pre });
  const c = d.counts;
  const policy = d.policy;

  const cell = (student: DayStudent) =>
    student.mark === "PRESENT" || student.mark === "NONE"
      ? text("—")
      : student.mark === "LATE"
        ? text(student.reason ?? student.reasonCode ?? "—")
        : ({ kind: "action" as const, label: student.explained ? (student.reason ?? student.reasonCode ?? "Recorded") : "No reason recorded — required by policy", drawer: reasonFor([student.id]) });

  const studentRows: TableRow[] = d.students.map((student) => ({
    id: student.id,
    keywords: `${student.name} ${student.adm} roll ${student.roll} mark:${student.markLabel} reason:${student.mark === "PRESENT" || student.explained ? "Recorded" : "Missing"} term:${student.termRate === null ? "None" : student.termRate < policy.chronic ? "Below" : student.termRate < policy.target ? "Between" : "Above"}`,
    cells: [
      text(String(student.roll).padStart(2, "0"), { mono: true }),
      nameCell(student.name, student.case ? "Open attendance case" : d.arm.name),
      text(student.adm, { mono: true }),
      pill(student.markLabel, tone(student.markLabel)),
      text(student.markedAt ?? "—", { mono: true }),
      cell(student),
      text(pct(student.termRate), { mono: true, strong: true, tone: rateTone(student.termRate, policy) }),
      student.guardian ? nameCell(student.guardian.name, student.guardian.phone ?? "No phone", { avatar: false }) : text("No guardian linked", { tone: "attention" }),
      { kind: "action" as const, label: "Open", href: studentRecordHref(student.id) },
    ],
  }));

  const bulkCorrect: DrawerSpec = {
    mode: "form", kicker: `${d.arm.name} · ${d.label}`, title: "Correct the selected children",
    sub: sameDay ? "A same-day correction is free; both values are kept." : "Each correction goes to the approver with the reason you give.",
    commitLabel: "Apply the correction", commitDone: "Corrections recorded", commitDoneBody: "Each one keeps the original mark, the new mark and your reason.",
    fields: [
      { label: "Correct them to", kind: "select", options: ["Present", "Absent", "Late", "Excused"], value: "Present", required: true },
      { label: "Reason", kind: "select", options: correction.reasons, value: correction.reasons[0], required: true },
      { label: "What happened", kind: "area", span: 2, required: true, placeholder: "Kept beside every mark you change." },
    ],
    submit: { endpoint: `${AT}/corrections/bulk`, method: "POST", body: { classId: d.arm.id, date: d.date }, map: { "Correct them to": "to", Reason: "reason", "What happened": "explanation" } },
  };

  const rows: PanelRow[] = [];
  rows.push(dayStrip(d.days.map((entry) => entry.date), d.date, (iso) => dayHref(d.arm.id, iso), "Pick another day", Object.fromEntries(d.days.map((entry) => [entry.date, entry.state === "MISSING" ? "No register" : entry.state === "DRAFT" ? "Draft" : "Marked"]))));
  if (!d.taken) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "negative", icon: WARN, title: `No register was taken for ${d.arm.name} on this day`, body: "That day is unknown, not present. Nothing below is a mark anyone gave.", acts: [{ label: "Mark it now", href: markHref(d.arm.id, d.date) }] }] });
  } else if (c.unexplained) {
    rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: `${plural(c.unexplained, "absence")} on this day ${c.unexplained === 1 ? "has" : "have"} no reason`, body: "The school's policy asks for a reason on an absence. Until one is recorded the day counts against the child with nothing to explain it, and a guardian who asks is told nothing.", acts: [{ label: "Record the reasons", drawer: reasonFor() }, { label: "Ask the guardians", href: "/parents-guardians/submissions" }] }] });
  }
  if (d.taken) {
    rows.push({
      cols: "1fr",
      panels: [{
        type: "kpi", title: "This day", per: 6,
        cards: [
          { label: "Present", value: String(c.present), unit: `of ${c.roll}`, sub: `${pct(d.rate)} including late`, tone: "positive" },
          { label: "Absent", value: String(c.absent), sub: c.absent ? `${c.unexplained} without a reason` : "Nobody absent", tone: c.absent ? "negative" : "positive" },
          { label: "Late", value: String(c.late), sub: c.late ? `After the ${policy.bell} bell` : "Nobody late", tone: c.late ? "attention" : "positive" },
          { label: "Excused", value: String(c.excused), sub: "Not counted against them", tone: "neutral" },
          { label: "Marked at", value: d.register.markedAt ?? "—", sub: d.register.markedAt ? (d.register.markedAt > policy.markCutoff ? `After the ${policy.markCutoff} cutoff` : `Before the ${policy.markCutoff} cutoff`) : "The clock time was not recorded", tone: d.register.markedAt ? (d.register.markedAt > policy.markCutoff ? "attention" : "positive") : "neutral" },
          { label: "Marked by", value: (d.register.by ?? "Unknown").split(" ").slice(-1)[0], sub: d.arm.master ? `Form master ${d.arm.master}` : "No form master named", tone: d.register.by ? "neutral" : "attention", link: d.arm.masterId ? "Open them" : undefined, href: d.arm.masterId ? staffRecordHref(d.arm.masterId) : undefined },
        ],
      }],
    });
    rows.push({
      cols: "1fr",
      panels: [{
        type: "table", title: "The register", tag: `${c.roll} on the roll`, tagTone: "neutral",
        sub: "Every child, exactly as the mark was given. Open any one of them for their full record.",
        meta: `${d.label} · ${c.present} present · ${c.absent} absent · ${c.late} late · ${c.excused} excused`,
        search: "Find a child by name, roll or admission number",
        filters: [
          { label: "Mark", value: "All", options: ["All", "Present", "Absent", "Late", "Excused"], match: { Present: "mark:Present", Absent: "mark:Absent", Late: "mark:Late", Excused: "mark:Excused" } },
          { label: "Reason", value: "All", options: ["All", "Recorded", "Missing"], match: { Recorded: "reason:Recorded", Missing: "reason:Missing" } },
          { label: "Term attendance", value: "All", options: ["All", "Below 75%", "75–92%", "Above 92%"], match: { "Below 75%": "term:Below", "75–92%": "term:Between", "Above 92%": "term:Above" } },
        ],
        acts: [
          { label: "Print the register", href: `/attendance/spool?for=A+class+arm&arm=${d.arm.id}&period=A+date+range&from=${d.date}&to=${d.date}&include=Daily+marks&include=Reasons+and+explanations&format=PDF&purpose=School+records&letterhead=true` },
          { label: "Correct this register", primary: true, drawer: correct() },
        ],
        head: ["Roll", "Child", "Admission no", "Mark", "Taken", "Reason recorded", "Term %", "Guardian", ""],
        noun: "child", nounPlural: "children", per: 14, selectable: true, noRowOpen: true,
        bulkActs: [
          { label: "Correct the selected", drawer: bulkCorrect, selection: { key: "students", noun: "child" } },
          { label: "Record one reason for all", drawer: reasonFor(), selection: { key: "students", noun: "child" } },
          { label: "Message their guardians", drawer: sendRecordDrawer([], `${d.arm.name} · ${d.label}`), selection: { key: "students", noun: "child" } },
          { label: "Export selected", primary: true, export: true },
        ],
        rows: studentRows,
        foot: "An excused day is excluded from the child's percentage; a late day is not. A child with an open attendance case is marked under their name.",
      }],
    });
  }
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      {
        type: "table", title: "This arm's recent days", sub: "The last ten school days, so one bad day can be read in context.",
        meta: `Term average ${pct(d.termRate)} · school target ${policy.target}%`,
        acts: [{ label: "Open the whole term", href: trendHref(d.arm.id) }],
        head: ["Date", "Present", "Absent", "Late", "Exc", "Rate", "Marked at", ""],
        noun: "day", nounPlural: "days", per: 10, noRowOpen: true,
        rows: d.recent.map((entry) => ({
          cells: [
            text(entry.label, { strong: entry.date === d.date, tone: entry.date === d.date ? "positive" : undefined }),
            text(String(entry.present), { mono: true }), text(String(entry.absent), { mono: true }), text(String(entry.late), { mono: true }), text(String(entry.excused), { mono: true }),
            text(pct(entry.rate), { strong: true, tone: rateTone(entry.rate, policy) }),
            text(entry.markedAt ?? "—", { mono: true }),
            { kind: "action" as const, label: entry.date === d.date ? "Showing" : "Open", href: dayHref(d.arm.id, entry.date) },
          ],
        })),
      },
      {
        type: "facts", title: "Who marks this register", tag: d.arm.master ? "Form master" : "Unassigned", tagTone: d.arm.master ? "positive" : "negative",
        sub: `Responsible for taking it before the ${policy.markCutoff} cutoff every school day.`,
        meta: d.arm.staffNo ? `Staff number ${d.arm.staffNo}` : undefined,
        acts: [
          ...(d.arm.masterId ? [{ label: "Open their record", primary: true, href: staffRecordHref(d.arm.masterId) }] : [{ label: "Name a form master", primary: true, drawer: reassignDrawer(options, [{ id: d.arm.id, name: d.arm.name, master: null }]) }]),
        ],
        per: 1,
        facts: [
          ["Form master", d.arm.master ?? "Nobody named", d.arm.master ? (d.arm.dept ?? "") : "This register has nobody taking it"],
          ["Phone", d.arm.phone ?? "—"],
          ["Registers this term", d.record.registers, "Registers on record against the days the school kept them"],
          ["Punctuality", d.record.punctuality === null ? "No timed registers" : `${d.record.punctuality}%`, `Share taken before ${policy.markCutoff}`],
          ["Corrections requested", String(d.record.corrections), "Same-day, prior-day and guardian-led"],
          ["Other arms", d.arm.others.length ? d.arm.others.join(", ") : "This arm only"],
        ],
      },
    ],
  });

  return {
    content: {
      crumb: { label: "Back to the whole school", href: `/attendance/register?date=${d.date}` },
      title: `${d.arm.name} · ${d.label}`,
      desc: d.taken ? `The register as ${d.register.by ?? d.arm.master ?? "the form master"} marked it${d.register.markedAt ? ` at ${d.register.markedAt}` : ""}.` : "No register was taken on this day.",
      primary: d.taken ? { label: "Correct this register", icon: "M4 20h4L19 9l-4-4L4 16zM14.5 5.5l4 4", drawer: correct() } : { label: "Mark this register", icon: CHECK, href: markHref(d.arm.id, d.date) },
      launchers: [
        { label: "This arm's whole term", href: trendHref(d.arm.id) },
        { label: "Open the arm", href: `/class-timetable/classes/${d.arm.id}` },
      ],
      rows,
    },
  };
}

export { complianceNudge };
export type { Compliance };
