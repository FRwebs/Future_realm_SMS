import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, choice, fixed, select, text } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * M03 for a teaching person: their own timetable, and what they are assigned to.
 *
 * The timetable is read from the published periods that name them — never the school's — and appears only once the school has
 * published it. "Teaching" is where every sheet and register traces back to: no assignment, no sheet.
 */

type TimetableView = {
  date: string;
  clock: string;
  schoolDay: boolean;
  published: boolean;
  days: string[];
  week: Array<{ n: number; time: string; cells: Array<{ subject: string; short: string; arm: string; room: string | null } | null> }>;
  periods: Array<{ periodNumber: number; from: string; to: string; classId: string; arm: string; subjectId: string; subject: string; room: string; note: string; state: "done" | "now" | "next" | "later" }>;
  weekCount: number;
  teachingPerWeek: number;
};

type TeachingView = {
  persona: string;
  department: { id: string; name: string } | null;
  reportsTo: { name: string; title: string } | null;
  formArms: Array<{ id: string; name: string; roll: number }>;
  assistantArms: Array<{ id: string; name: string; roll: number }>;
  options: { arms: string[]; subjects: string[] };
  assignments: Array<{ classId: string; subjectId: string; subject: string; arm: string; roll: number; perWeek: number; basis: string; assistant: boolean; sheet: string; grants: string }>;
  periodsPerWeek: number;
};

type Question = { id: string; kind: string; title: string; about: string; detail: string; sentAt: string; state: "Sent" | "Answered"; answer: string | null; outcome: string | null; answeredBy: string | null; answeredAt: string | null; urgency: string };

const PRINT = "M7 9V4.5h10V9M7 17.5H5.5v-6h13v6H17M7 14h10v6H7z";
const QUESTION = "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4M12 16.4h.02";
const PLUS = "M12 5.5v13M5.5 12h13";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const CLOCK = "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 7.5V12l3 2";
const BACK = "M15 5l-7 7 7 7";
const QUESTIONS = "/api/v1/teacher-workspace/questions";

const dayWords = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
const stamp = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const sheetTone = (state: string): PanelTone => (state === "Returned" ? "negative" : state === "Not started" ? "attention" : state === "In progress" ? "progress" : state === "Submitted" ? "submitted" : state === "Approved" ? "positive" : "neutral");

export async function teacherTimetableTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  if (tabSlug === "timetable") {
    const [view, school] = await Promise.all([apiGet<TimetableView>("/api/v1/teacher-workspace/timetable"), apiGet<{ schoolName: string }>("/api/v1/dashboard/context").catch(() => ({ schoolName: "" }))]);
    return timetableTab(view, me, school.schoolName, permissions);
  }
  if (tabSlug === "teaching") {
    const [view, questions] = await Promise.all([apiGet<TeachingView>("/api/v1/teacher-workspace/teaching"), apiGet<Question[]>(QUESTIONS)]);
    return teachingTab(view, questions, me);
  }
  return undefined;
}

function timetableTab(v: TimetableView, me: TeacherWorkspaceView, schoolName: string, permissions: string[]): TabContent {
  const held = new Set(permissions);
  const early = me.persona === "early-years";
  if (!v.published) {
    return {
      title: "Timetable", desc: "Your periods, your rooms, your arms.",
      launchers: [{ label: "What I am assigned to", href: "/class-timetable/teaching" }],
      rows: [row("1fr", [{ type: "note", tone: "attention", icon: CLOCK, title: "The school has not published its timetable yet", body: "A period appears here the moment the school publishes the timetable for this term — exactly as it does for a child’s family. Until then there is nothing of yours to show, and nothing is guessed.", acts: [{ label: "What I am assigned to", href: "/class-timetable/teaching" }] }])],
    };
  }
  const teaching = v.periods;
  const next = v.periods.find((period) => period.state === "next");
  const todayRows: TableRow[] = v.periods.map((period) => ({
    cells: [
      cell(`${period.from}–${period.to}`, { mono: true, strong: true, tone: period.state === "done" ? "neutral" : undefined }),
      cell(period.arm, { strong: true }),
      { kind: "name", name: period.subject, sub: period.note || undefined, avatar: false },
      cell(period.room),
      period.state === "next" ? pill("Next", "progress") : period.state === "now" ? pill("Now", "submitted") : period.state === "done" ? cell("Taught", { tone: "neutral" }) : cell("Later today", { tone: "neutral" }),
      period.state !== "done" && held.has("score-entry-results.enter.view") ? { kind: "action", label: "Open the sheet", href: `/score-entry-results/enter/${period.classId}/${period.subjectId}` } : cell(""),
    ] as TableCellKind[],
  }));
  const weekRows: TableRow[] = v.week.map((line) => ({
    cells: [
      cell(String(line.n), { mono: true, tone: "neutral" }),
      cell(line.time, { mono: true }),
      ...line.cells.map((entry): TableCellKind => (entry ? cell(`${entry.short} · ${entry.arm}`, { strong: true }) : cell("—", { tone: "neutral" }))),
    ],
  }));

  const printDrawer: DrawerSpec = {
    mode: "document",
    title: "My timetable",
    doc: {
      heading: "Timetable preview", state: { label: "Published", tone: "positive" }, letterhead: { name: schoolName || "Your school" },
      kicker: "Staff timetable", title: me.person.name, ref: me.person.employeeNo ?? undefined,
      idents: [["Teacher", me.person.name], ["Role", me.personaLabel], ["Department", me.department?.name ?? "—"], ["Term", me.term ? `${me.term.name} ${me.term.session}` : "—"]],
      tables: [{ title: "Week", heads: [{ label: "#" }, { label: "Time" }, ...v.days.map((day) => ({ label: day }))], rows: v.week.map((line) => [String(line.n), line.time, ...line.cells.map((entry) => (entry ? `${entry.short} · ${entry.arm}` : "—"))]) }],
      footNote: "Read from the published timetable. A blank is free — not a period nobody told you about.", acts: [{ label: "Print", print: true, primary: true }],
    },
  };

  return {
    title: "Timetable", desc: early ? "Your sessions, today first." : "Your periods, your rooms, your arms — today first.",
    primary: { label: "Print my timetable", icon: PRINT, drawer: printDrawer },
    launchers: [{ label: "What I am assigned to", href: "/class-timetable/teaching" }],
    rows: [
      row("1fr", [{
        type: "kpi", sub: `${dayWords(v.date)} · your own timetable, never the school’s.`, per: 4,
        cards: [
          { label: early ? "Sessions today" : "Periods today", value: String(teaching.length), sub: v.schoolDay ? (teaching.length ? "All teaching" : "Nothing timetabled for you") : "Today is not a school day" },
          { label: "Next", value: next ? next.from : "—", sub: next ? `${next.subject} · ${next.room}` : "Nothing else today", tone: next ? "progress" : "neutral" },
          { label: "This week", value: String(v.weekCount), unit: early ? "sessions" : "periods", sub: v.teachingPerWeek ? `${v.teachingPerWeek} a week on your assignments` : "Set by the school office", tone: "positive" },
          me.formArms.length
            ? { label: "Form class", value: me.formArms[0].name, sub: `${me.formArms[0].roll} children${me.formArms.length > 1 ? ` · and ${me.formArms.length - 1} more` : ""}`, tone: "neutral" }
            : { label: "Department", value: me.department?.name ?? "None", sub: me.reportsTo ? `${me.reportsTo.name} · ${me.reportsTo.title}` : "", tone: "neutral" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Today", tag: next ? `Next at ${next.from}` : "Done for today", tagTone: "progress",
        sub: "Who you have, and what you teach them, in order.", meta: dayWords(v.date), noun: "period", nounPlural: "periods",
        head: ["Time", "Arm", "What to teach", "Where", "Note", ""], rows: todayRows, noRowOpen: true,
        empty: v.schoolDay ? "No period is timetabled for you today." : "Today is not a school day in this term.",
        foot: "A cover period is marked, and disappears from this page the day the cover ends.",
      }]),
      row("1fr", [{
        type: "table", title: "Your week", sub: "The same five days a wall chart would show.", meta: `${v.weekCount} ${early ? "sessions" : "periods"}`, noun: "period", nounPlural: "periods",
        head: ["#", "Time", ...v.days], rows: weekRows, per: 8, noRowOpen: true,
        empty: "Nothing is timetabled for you this week.",
        foot: "A blank is free — not a period nobody told you about.",
      }]),
    ],
  };
}

/** The four things a teacher can ask the office, each as the form that gets it answered the first time. */
function askDrawer(kind: "missing" | "wrong" | "cover" | "drop", v: TeachingView, me: TeacherWorkspaceView): DrawerSpec {
  const own = v.assignments.map((entry) => `${entry.subject} · ${entry.arm}`);
  const whichOptions = own.length ? own : ["Nothing is listed"];
  const urgency = choice("How soon", ["Before my next period", "This week", "No rush"], { span: 2, value: "This week" });
  const goes = fixed("Goes to", "The academic office", { hint: me.department && me.persona !== "head-of-department" ? `Your head of department is told, so they know` : "The office that sets teaching assignments" });
  const base = { mode: "form" as const, kicker: "Timetable · Teaching", sub: "Say which assignment and what should change. The office sees your name and current assignments with it.", commitDone: "Question sent to the office", commitDoneBody: "You will see the reply here. If the office changes your assignment, your sheets, registers and notes update on their own.", reviewNote: "This is a question, not a change. Nothing about your assignments changes until the office makes it." };
  if (kind === "missing") {
    return { ...base, title: "Ask the office to add an assignment", commitLabel: "Send the question", fields: [
      select("Subject", v.options.subjects, { required: true, hint: "What you are teaching that is not listed" }),
      select("Arm", v.options.arms, { required: true }),
      select("Periods a week", ["1", "2", "3", "4", "5", "6"], { value: "3" }),
      select("Since when", ["Since the start of term", "Since last week", "From this week", "From next week", "From next term"], { value: "Since the start of term", required: true }),
      choice("Basis", ["It is mine", "I am covering for someone"], { span: 2, value: "It is mine" }),
      area("What happened", { span: 2, optional: true, placeholder: "e.g. The Principal asked me to take it at the staff meeting on 1 September." }),
      urgency, goes,
    ], submit: { endpoint: QUESTIONS, method: "POST", body: { kind: "missing" }, map: { Subject: "subject", Arm: "arm", "Periods a week": "periods", "Since when": "since", Basis: "basis", "What happened": "note", "How soon": "urgency" } } };
  }
  if (kind === "wrong") {
    return { ...base, title: "Ask the office to correct an assignment", commitLabel: "Send the question", fields: [
      select("Which assignment", whichOptions, { required: true, span: 2 }),
      select("What is wrong", ["The arm is wrong", "The periods a week are wrong", "It should be cover, not substantive", "It should be substantive, not cover", "The subject name is wrong", "Something else"], { required: true, span: 2 }),
      text("What it should be", { required: true, span: 2, placeholder: "e.g. SSS 2C, not SSS 2B · or 4 periods, not 3" }),
      area("Anything else", { span: 2, optional: true, placeholder: "Optional — what the office needs to know to fix it first time." }),
      urgency, goes,
    ], submit: { endpoint: QUESTIONS, method: "POST", body: { kind: "wrong" }, map: { "Which assignment": "which", "What is wrong": "problem", "What it should be": "shouldBe", "Anything else": "note", "How soon": "urgency" } } };
  }
  if (kind === "cover") {
    return { ...base, title: "Ask the office to change your cover", commitLabel: "Send the question", fields: [
      select("Which cover", whichOptions, { required: true, span: 2 }),
      select("Change", ["Extend the end date", "End it early", "Add score entry as well as the register", "Something else"], { required: true, span: 2 }),
      text("New date", { optional: true, hint: "Only if the dates change", placeholder: "e.g. 3 October" }),
      area("Why", { span: 2, required: true, placeholder: "e.g. Their leave has been extended." }),
      urgency, goes,
    ], submit: { endpoint: QUESTIONS, method: "POST", body: { kind: "cover" }, map: { "Which cover": "which", Change: "change", "New date": "newDate", Why: "why", "How soon": "urgency" } } };
  }
  return { ...base, title: "Ask the office to take an assignment back", commitLabel: "Send the question", fields: [
    select("Which assignment", whichOptions, { required: true, span: 2 }),
    select("Why", ["My load is over the ceiling", "It clashes with another period", "Someone else is teaching it", "I am leaving at the end of term", "Other"], { required: true, span: 2 }),
    select("From", ["The end of this week", "The end of this term"], { value: "The end of this week", required: true }),
    fixed("Your marks and notes", "Stay with the arm", { hint: "Whoever takes it over sees every mark you entered, attributed to you" }),
    area("Handover note", { span: 2, optional: true, placeholder: "Optional — where the class is in the scheme, anything the next teacher should know." }),
    urgency, goes,
  ], submit: { endpoint: QUESTIONS, method: "POST", body: { kind: "drop" }, map: { "Which assignment": "which", Why: "why", From: "from", "Handover note": "note", "How soon": "urgency" } } };
}

function teachingTab(v: TeachingView, questions: Question[], me: TeacherWorkspaceView): TabContent {
  const own = v.assignments;
  const waiting = questions.filter((entry) => entry.state === "Sent").length;
  const kinds: Array<{ kind: "missing" | "wrong" | "cover" | "drop"; label: string; sub: string; icon: string; tone?: PanelTone }> = [
    { kind: "missing", label: "A class or subject is missing", sub: "You teach it, but there is no sheet, register or note for it here.", icon: PLUS, tone: "attention" },
    { kind: "wrong", label: "Something listed is wrong", sub: "The wrong arm, the wrong periods, or cover when it is yours.", icon: WARN, tone: "progress" },
    { kind: "drop", label: "I should no longer hold this", sub: "Hand an assignment back before it is reassigned.", icon: BACK },
  ];

  const ask = { label: "Ask about an assignment", icon: QUESTION, drawer: askDrawer("missing", v, me) };
  const askRows: TableRow[] = questions.map((entry) => ({
    cells: [
      { kind: "name", name: entry.title, sub: entry.detail.split("\n")[0], avatar: false },
      cell(entry.about),
      cell(stamp(entry.sentAt)),
      pill(entry.state, entry.state === "Answered" ? "positive" : "submitted"),
      {
        kind: "action", label: "View",
        drawer: {
          mode: "view", readOnly: true, kicker: "Ask about an assignment", title: entry.title,
          sub: entry.state === "Answered" ? "The office has answered." : "Sent to the office. You will be told here when they reply.",
          facts: [
            ["About", entry.about, ""], ["What you asked", entry.detail, ""], ["Sent", stamp(entry.sentAt), "With your name and current assignments"],
            ["How soon", entry.urgency, ""],
            ["State", entry.state, entry.state === "Answered" ? `${entry.outcome === "APPROVED" ? "Done" : "Declined"}${entry.answeredBy ? ` by ${entry.answeredBy}` : ""}` : "Usually answered within two school days"],
            ...(entry.answer ? ([["The office said", entry.answer, entry.answeredAt ? stamp(entry.answeredAt) : ""]] as Array<[string, string, string]>) : []),
          ],
          readOnlyNote: "A question cannot be edited once it is sent — send a follow-up instead.",
        } as DrawerSpec,
      },
    ] as TableCellKind[],
  }));

  const kpis = [
    { label: "Subject-arms", value: String(own.length), sub: `${own.filter((entry) => !entry.assistant).length} yours · ${own.filter((entry) => entry.assistant).length} assisting` },
    v.formArms.length
      ? { label: me.persona === "early-years" ? "Class" : "Form class", value: v.formArms[0].name, sub: `${v.formArms[0].roll} children${v.formArms.length > 1 ? ` · and ${v.formArms.length - 1} more` : ""}` }
      : { label: "Form class", value: "None", sub: "You mark period registers only" },
    { label: "Teaching periods", value: String(v.periodsPerWeek), unit: "a week", sub: "On your assignments", tone: "positive" as const },
    { label: "Department", value: v.department?.name ?? "None", sub: me.persona === "head-of-department" ? "You head it" : v.reportsTo ? `${v.reportsTo.name} · ${v.reportsTo.title}` : "", tone: me.persona === "head-of-department" ? ("progress" as const) : ("neutral" as const) },
  ];

  const rows: Array<PanelRow | null> = [
    row("1fr", [{ type: "kpi", sub: "Every permission you hold comes from one of these rows.", per: 4, cards: kpis }]),
    row("1fr", [{
      type: "table", title: "Your assignments", sub: "One subject-arm is one score sheet and one scope grant.", meta: `${own.length} subject-arm${own.length === 1 ? "" : "s"}`, noun: "assignment", nounPlural: "assignments",
      head: ["Subject", "Arm", "Roll", "Per wk", "Basis", "Sheet", "What it grants you", ""],
      rows: own.map((entry): TableRow => ({
        cells: [
          cell(entry.subject, { strong: true }), cell(entry.arm), cell(String(entry.roll), { mono: true }), cell(String(entry.perWeek), { mono: true }),
          pill(entry.assistant ? "Assisting" : entry.basis, entry.assistant ? "neutral" : "positive"), pill(entry.sheet, sheetTone(entry.sheet)), cell(entry.grants, { tone: "neutral" }),
          entry.assistant ? cell("") : { kind: "action", label: "Open the sheet", href: `/score-entry-results/enter/${entry.classId}/${entry.subjectId}` },
        ] as TableCellKind[],
      })),
      noRowOpen: true, empty: "Nothing is assigned to you yet. If you teach something, ask the office to add it below.", foot: "No assignment, no sheet.", per: 10,
    }]),
    questions.length
      ? row("1fr", [{
          type: "table", title: "Questions you have asked", tag: `${waiting} waiting`, tagTone: "submitted",
          sub: "The office replies here. When they change an assignment, your sheets, registers and notes follow on their own.", meta: `${questions.length} question${questions.length === 1 ? "" : "s"}`, noun: "question", nounPlural: "questions",
          head: ["Question", "About", "Sent", "State", ""], rows: askRows, noRowOpen: true, foot: "A question changes nothing by itself.",
        }])
      : null,
    row("1fr", [{
      type: "tiles", title: "Something here not right?", sub: "Your assignments are set by the school office. Ask them to fix it at the source — the sheet, register and access change together.", per: 3,
      tiles: kinds.map((entry) => ({ label: entry.label, sub: entry.sub, icon: entry.icon, tone: entry.tone, drawer: askDrawer(entry.kind, v, me) })),
    }]),
    row("1fr", [{ type: "facts", title: "Your responsibilities", per: 2, facts: me.hats.map((hat) => [`${hat.role} · ${hat.scope}`, hat.detail, ""] as [string, string, string]) }]),
  ];

  return {
    title: "Teaching", desc: "What you are assigned to — and why a sheet you expected might be missing.", primary: ask,
    rows: rows.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}
