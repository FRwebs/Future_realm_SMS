import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, choice, fixed, select, text as field, toggle } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, PanelFact, PanelRow, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";

/**
 * M08 for a teaching person: "My students" — the children they answer for, and nobody else's. A form master sees their class in full; a
 * subject teacher sees only the children they teach. A teacher reports; they never open a file.
 */

type StudentsView = {
  persona: string;
  formArms: Array<{ id: string; name: string; roll: number }>;
  assistantArms: Array<{ id: string; name: string; roll: number }>;
  policy: { chronic: number; target: number };
  rows: Array<{ id: string; roll: number; name: string; adm: string; classId: string | null; arm: string; own: boolean; attendance: number | null; flags: string[]; guardian: { id: string; name: string; relation: string; phone: string | null; portal: string } | null }>;
  kpis: { children: number; belowLine: number; medical: number; support: number; notActivated: number };
};

const API = "/api/v1/teacher-workspace";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));

export async function teacherStudentsTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  if (tabSlug !== "registry") return undefined;
  return studentsTab(await apiGet<StudentsView>(`${API}/students`), me, new Set(permissions));
}

const label = (student: { name: string; adm: string; arm: string }) => `${student.name} · ${student.arm} · ${student.adm}`;

export function incidentDrawer(students: StudentsView["rows"], pre?: { id: string }): DrawerSpec {
  const options = students.map((student) => ({ value: student.id, label: label(student) }));
  const start = options.find((option) => option.value === pre?.id)?.label ?? options[0]?.label;
  return {
    mode: "form", kicker: "My students", title: "Report an incident", sub: "An incident goes to the Deputy — Administration. You report it; you do not read the file.",
    commitLabel: "Send the report", commitDone: "Incident reported", commitDoneBody: "It is with the Deputy — Administration. You will not see the file — that is by design.",
    reviewNote: "A report is a statement of what you saw, in your name. Nothing about the child’s record changes until the school decides it.",
    fields: [
      select("Child", options.map((option) => option.label), { required: true, span: 2, value: start }),
      select("What kind of incident", ["Fighting", "Bullying", "Disrespect to staff", "Damage to property", "Truancy", "Cheating or malpractice", "A safety concern", "Something else"], { required: true }),
      choice("How serious", ["Low", "Medium", "High"], { value: "Low" }),
      area("What happened", { span: 2, required: true, placeholder: "Where, when, who else was there, and what you did about it. Facts, not opinions." }),
      fixed("Goes to", "The Deputy — Administration", { hint: "Not copied to anyone else" }),
    ],
    submit: { endpoint: `${API}/incidents`, method: "POST", map: { Child: "studentId", "What kind of incident": "category", "How serious": "severity", "What happened": "description" }, encode: { Child: pair(options), "How serious": { Low: "LOW", Medium: "MEDIUM", High: "HIGH" } } },
  };
}

export function concernDrawer(students: StudentsView["rows"], pre?: { id: string }): DrawerSpec {
  const options = students.map((student) => ({ value: student.id, label: label(student) }));
  const start = options.find((option) => option.value === pre?.id)?.label ?? options[0]?.label;
  return {
    mode: "form", kicker: "My students", title: "Raise a safeguarding concern", sub: "It goes to the Safeguarding Lead and to nobody else — not the Principal, not this page.",
    commitLabel: "Raise the concern", commitDone: "Concern raised", commitDoneBody: "The Safeguarding Lead has it. It is not on the child’s record you can read, and the lead’s reading of it is on its own audit stream.",
    reviewNote: "Write what you saw or heard, in your own words. Do not question the child, and do not discuss this with anyone else.",
    fields: [
      select("Child", options.map((option) => option.label), { required: true, span: 2, value: start }),
      area("What you saw or heard", { span: 2, required: true, placeholder: "In the child’s own words where you can. When, where, and who else was there." }),
      toggle("Is anyone in immediate danger?", false, "Yes — the lead is told it is urgent", "No", { span: 2 }),
      fixed("Goes to", "The Safeguarding Lead", { hint: "A separate audit stream — nobody else reads it" }),
    ],
    submit: { endpoint: `${API}/concerns`, method: "POST", map: { Child: "studentId", "What you saw or heard": "summary", "Is anyone in immediate danger?": "urgent" }, encode: { Child: pair(options) } },
  };
}

export function changeDrawer(students: StudentsView["rows"], pre?: { id: string }): DrawerSpec {
  const options = students.map((student) => ({ value: student.id, label: label(student) }));
  const start = options.find((option) => option.value === pre?.id)?.label ?? options[0]?.label;
  return {
    mode: "form", kicker: "My students", title: "Request a record change", sub: "A request with a reason. It reaches the Principal; you never edit a record directly.",
    commitLabel: "Send the request", commitDone: "Request sent", commitDoneBody: "The Principal decides it. You will be told here, and the record changes only if they approve.",
    reviewNote: "The record is the school’s, not yours. A change is asked for with a reason, and decided by someone who can see the whole of it.",
    fields: [
      select("Child", options.map((option) => option.label), { required: true, span: 2, value: start }),
      select("What should change", ["Given name", "Surname", "Date of birth", "Gender", "Home address", "Languages at home", "Guardian’s phone number", "Something else"], { required: true }),
      field("What it should become", { required: true, placeholder: "e.g. Adaeze, not Adaeze-Ify" }),
      area("Why", { span: 2, required: true, placeholder: "What you saw — a document, the child, a guardian — that shows the record is wrong." }),
    ],
    submit: { endpoint: `${API}/record-changes`, method: "POST", map: { Child: "studentId", "What should change": "field", "What it should become": "after", Why: "reason" }, encode: { Child: pair(options) } },
  };
}

function studentsTab(v: StudentsView, me: TeacherWorkspaceView, held: Set<string>): TabContent {
  const own = v.formArms[0];
  const early = me.persona === "early-years";
  const word = early ? "class teacher" : "form master";
  if (!v.rows.length) {
    return { title: "My students", desc: "The children you are answerable for.", rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "No child is yours yet", body: "Children appear here when you are named as the form master of an arm, or as the teacher of a subject in one. Ask the office in Timetable → Teaching if one is missing." }])] };
  }
  const many = new Set(v.rows.map((student) => student.arm)).size > 1;
  const tableRows: TableRow[] = v.rows.map((student) => ({
    id: student.id, keywords: `${student.name} ${student.adm} ${student.arm} ${student.flags.join(" ")}`,
    cells: [
      { kind: "name", name: student.name, sub: many ? student.arm : `Roll ${String(student.roll).padStart(2, "0")}` }, text(student.adm, { mono: true }),
      text(student.attendance === null ? "—" : `${student.attendance}%`, { mono: true, strong: student.attendance !== null && student.attendance < v.policy.chronic, tone: student.attendance !== null && student.attendance < v.policy.chronic ? "negative" : undefined }),
      student.flags.length ? pill(student.flags[0]!, student.flags[0] === "Chronic absence" ? "negative" : "withheld") : text("—", { tone: "neutral" }),
      text(student.guardian ? `${student.guardian.name} · ${student.guardian.relation}` : "No guardian on record", { tone: student.guardian ? "neutral" : "negative" }),
      { kind: "action", label: "Open", href: `/student-records/registry/${student.id}?from=my` },
    ] as TableCellKind[],
  }));
  const incident = incidentDrawer(v.rows);
  const concern = concernDrawer(v.rows);
  const change = changeDrawer(v.rows);
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: own ? `Your ${word}’s view. A subject teacher sees only the children they teach.` : "The children you teach — and only them.", per: 5,
      cards: [
        { label: "Children", value: String(v.kpis.children), sub: own ? (v.formArms.length > 1 ? `${v.formArms.map((arm) => arm.name).join(" · ")}` : `${own.name} · one class, one ${word}`) : `${new Set(v.rows.map((student) => student.arm)).size} arm${new Set(v.rows.map((student) => student.arm)).size === 1 ? "" : "s"}` },
        { label: `Below ${v.policy.chronic}% attendance`, value: String(v.kpis.belowLine), sub: v.kpis.belowLine ? "An absence case may be open" : "Nobody below the line", tone: v.kpis.belowLine ? "negative" : "positive" },
        { label: "Medical alerts", value: String(v.kpis.medical), sub: "Flag only — the condition is not yours to read", tone: "withheld" },
        { label: "Learning support plans", value: String(v.kpis.support), sub: "You see the strategies, never the diagnosis", tone: "withheld" },
        { label: "Guardians not activated", value: String(v.kpis.notActivated), sub: "They cannot receive anything in-app", tone: v.kpis.notActivated ? "attention" : "positive" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: own && !many ? own.name : "The children you answer for", sub: "Open a child for the record a parent conversation needs.", meta: `${v.rows.length} children`, noun: "child", nounPlural: "children",
      search: "Find a child by name or admission number", filters: [{ label: "Flag", value: "All", options: ["All", "Medical alert", "Learning support", "Chronic absence"], column: 3 }],
      head: ["Student", "Admission no", "Attend", "Flag", "Guardian", ""], rows: tableRows, per: 10, noRowOpen: true, foot: "A medical alert says contact the office.",
    }]),
    row("1fr 1fr", [
      {
        type: "facts", title: "What this record shows you", sub: "Restricted information is granted to a named person, never inherited from a role.", per: 1,
        facts: [
          ["Overview, academic, attendance, report cards", "Read", own ? "Your class in full" : "The children you teach"],
          ["Wellbeing", "Emergency flag only", "Enough for a child’s safety, not for a staff room"],
          ["Counselling, safeguarding, discipline", "Not visible", "You may report an incident; you never read the file"],
          ["Family", "Contacts and preferences", "Never a fee amount — paid or unpaid is all you see"],
          ["Changing a record", "A request with a reason", "It reaches the Principal; you never edit directly"],
          ["Deleting a record", "No staff role may", "Records are archived, never deleted"],
        ],
      },
      {
        type: "note", tone: "progress", icon: WARN, title: "Worried about a child?",
        body: "An incident goes to the Deputy — Administration. A safeguarding concern goes to the Safeguarding Lead and nobody else — not the Principal, not this page.",
        acts: [{ label: "Report an incident", drawer: incident }, { label: "Raise a safeguarding concern", drawer: concern }],
      },
    ]),
  ];
  return {
    title: "My students", desc: own ? `${own.name}, your class. Nobody else’s.` : "The children you teach. Nobody else’s.",
    primary: { label: "Report an incident", icon: WARN, drawer: incident },
    launchers: [{ label: "Request a record change", drawer: change }, ...(held.has("communication-center.compose.view") && own ? [{ label: "Message these families", href: "/communication-center/compose" }] : [])],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

export type TeacherSupportPlan = { id: string; strategies: Array<{ area: string; strategy: string }>; reviewedOn: string; nextReviewOn: string; overdue: boolean; author: { name: string; title: string } | null } | null;
const shortDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** A child's wellbeing, as a teacher may see it: a flag, the strategies they must apply, and who holds what is behind it. */
export function teacherWellbeing(name: string, arm: string, adm: string, alert: boolean, formWord: string, plan: TeacherSupportPlan = null): TabContent {
  const rows: PanelRow[] = [
    row("1fr", [alert
      ? { type: "note", tone: "withheld", icon: "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z", title: "This child has a medical alert. Contact the office.", body: "Enough for their safety, and deliberately not enough for a staff room conversation. The condition itself is held by the School Nurse." }
      : { type: "note", tone: "neutral", icon: EYE, title: "No alert is held for this child", body: "If you know of something the school should, tell the office — they will decide who needs to." }]),
    plan
      ? row("1fr", [{
          type: "facts", title: "Learning support · strategies you must apply", per: 1, tag: plan.overdue ? "Review overdue" : "Current", tagTone: plan.overdue ? "attention" : "positive",
          sub: `Written${plan.author ? ` by ${plan.author.name}${plan.author.title ? `, ${plan.author.title}` : ""}` : ""} for this child’s teachers. You apply what it says in ordinary lessons; you never see the reasons behind it.`,
          facts: [...plan.strategies.map((entry): PanelFact => [entry.area, entry.strategy, ""]), ["Reviewed", shortDay(plan.reviewedOn), `Next review ${shortDay(plan.nextReviewOn)}`]],
        }])
      : null,
    row("1fr", [{
      type: "facts", title: "What is held about this child, and by whom", per: 2, sub: "A sensitive group is granted to one named person, never inherited from a role.",
      facts: [
        ["Emergency flag", alert ? "Yes · medical alert" : "None", `Visible to you as their ${formWord}`],
        ["The condition", "Not visible to you", "School Nurse, Principal, Proprietor"],
        ["Counselling and guidance", "Not visible to you", "Counsellor only — not the Principal either"],
        ["Disciplinary file", "Not visible to you", "You may report an incident; you do not read the file"],
        ["Safeguarding concerns", "Not visible to you", "Safeguarding Lead only, on a separate audit stream"],
        ["Learning support plan", plan ? "Strategies only" : "None for this child", plan ? "You see what you must apply, never the diagnosis behind it" : "If a child needs one, the school’s learning support lead writes it"],
      ],
    }]),
  ].filter(Boolean) as PanelRow[];
  return { title: name, desc: `${arm} · ${adm} · what you may see is a flag and the strategies — and nothing behind them.`, rows };
}
export type { StudentsView };
export const loadMyStudents = () => apiGet<StudentsView>(`${API}/students`);
