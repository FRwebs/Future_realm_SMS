import { area, checks, choice, fixed, select, toggle } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import type { Compliance, CorrectionRow, ExplanationDetail, Options, StudentCase, TeacherRecord } from "@/lib/modules/live/m4-types";
import type { DrawerSpec, FormField, PanelFact, PickerOption } from "@/lib/modules/panels";

/** Every modal in Attendance, as data. People and arms are chosen by name on screen and travel as ids. */

export const AT = "/api/v1/attendance-management";

export const ABSENCE_REASONS = ["Illness", "Medical appointment", "Family bereavement", "Travel", "Transport failure", "Suspended", "Religious observance", "No reason given", "Other — described below"];
export const CORRECTION_REASONS = ["Marked in error", "Child arrived after the register was taken", "Guardian explanation accepted", "Register taken by the wrong teacher", "School closed that day", "Other — described below"];
const MARKS = ["Present", "Absent", "Late", "Excused"];

const picker = (label: string, options: PickerOption[], o: Record<string, unknown> = {}) => ({ label, kind: "picker", options, checked: [], span: 2, ...o }) as FormField;
const dateField = (label: string, o: Record<string, unknown> = {}) => ({ label, kind: "text", type: "date", value: "", ...o }) as FormField;
const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));

export const studentOptions = (students: Options["students"]): PickerOption[] => students.map((student) => ({ value: student.id, label: student.name, sub: `${student.adm} · ${student.arm}`, group: student.arm }));

/* ───────────────────────── reasons and corrections ───────────────────────── */

export function absenceReasonDrawer(o: { classId: string; arm: string; date: string; label: string; students: Array<{ id: string; name: string; adm: string; mark: string }>; pre?: string[] }): DrawerSpec {
  return {
    mode: "form",
    kicker: `${o.arm} · ${o.label}`,
    title: "Absence reason",
    sub: "It sits with that absence on the register, and a guardian who asks is told the same thing.",
    commitLabel: "Save the reason",
    commitDone: "Reason saved",
    commitDoneBody: "It sits with that absence on the register, and a guardian who asks is told the same thing.",
    reviewNote: "This reason goes onto each child's register entry for the day and is visible to their guardian.",
    fields: [
      picker("Children", o.students.map((student) => ({ value: student.id, label: student.name, sub: `${student.adm} · marked ${student.mark.toLowerCase()}` })), { required: true, checked: o.pre ?? [], placeholder: "Search by name or admission number", noun: "child", nounPlural: "children", hint: "One reason can be recorded for several children at once." }),
      select("Reason", ABSENCE_REASONS, { required: true, span: 2, hint: "Optional by policy for a late, required in practice for an absence" }),
      area("In their own words", { span: 2, optional: true, placeholder: "What the child or guardian actually said. Left blank, only the reason above is recorded." }),
      toggle("Evidence provided", false, "Evidence seen and noted", "No evidence", { span: 2 }),
      toggle("Treat as excused rather than absent", false, "Excused · excluded from the average", "Absent · counts against attendance", { span: 2, hint: "Excusing changes the child's term percentage, so it is logged with your name — and on an earlier day it needs an approver." }),
    ],
    submit: { endpoint: `${AT}/reasons`, method: "POST", body: { classId: o.classId, date: o.date }, map: { Children: "students", Reason: "reason", "In their own words": "explanation", "Evidence provided": "evidence", "Treat as excused rather than absent": "excuse" } },
  };
}

export function correctRegisterDrawer(o: { classId: string; arm: string; date: string; label: string; sameDay: boolean; students: Array<{ id: string; name: string; adm: string; markLabel: string }>; approver: string; pre?: string }): DrawerSpec {
  const labelOf = (student: { name: string; adm: string; markLabel: string }) => `${student.name} · ${student.markLabel}`;
  const options = o.students.map(labelOf);
  const first = o.pre ? o.students.find((student) => student.id === o.pre) : undefined;
  return {
    mode: "form",
    kicker: `${o.arm} · ${o.label}`,
    title: "Correct a register",
    sub: o.sameDay ? "Taken today, so the correction is free — both values are kept." : "An earlier day's register is never silently edited. Both marks, your reason and the approval are kept side by side.",
    commitLabel: o.sameDay ? "Correct the register" : "Request the correction",
    commitDone: o.sameDay ? "Register corrected" : "Correction requested",
    commitDoneBody: o.sameDay ? "The mark has changed and both values are kept, with your name beside them." : "It is with the approver named on your routing. The register is untouched until they decide.",
    reviewNote: "A saved register is never silently edited. A correction keeps the original mark, the new mark, your reason and the approval beside each other.",
    fields: [
      fixed("Register", `${o.arm} · ${o.label}`, { hint: "A correction applies to one register on one day" }),
      select("Child to correct", options, { required: true, span: 2, value: first ? labelOf(first) : options[0], hint: "Correct one child at a time — a blanket correction is what hides a missing register" }),
      {
        label: "Mark as recorded", kind: "static", value: o.students[0] ? o.students[0].markLabel : "—",
        by: { field: "Child to correct", cases: Object.fromEntries(o.students.map((student) => [labelOf(student), { value: student.markLabel }])) },
      } as FormField,
      select("Correct it to", MARKS, { required: true, value: "Present" }),
      select("Reason for the correction", CORRECTION_REASONS, { required: true, span: 2 }),
      area("What happened", { span: 2, required: true, placeholder: "Kept permanently beside both marks, and visible to the guardian if they ask." }),
      toggle("Evidence attached", false, "Evidence seen and filed", "No evidence", { span: 2 }),
      fixed("Effect on the term figure", "Recomputed at once", { hint: "The child's percentage and any chronic-absence case are recomputed, never restated silently" }),
      fixed("Who decides", o.sameDay ? "Nobody — a same-day correction is free" : o.approver, { hint: o.sameDay ? "Logged as an ordinary edit under your name" : "From Approvals · Routing. A teacher cannot approve their own correction." }),
    ],
    submit: {
      endpoint: `${AT}/corrections`, method: "POST", body: { classId: o.classId, date: o.date },
      map: { "Child to correct": "student", "Correct it to": "to", "Reason for the correction": "reason", "What happened": "explanation", "Evidence attached": "evidence" },
      encode: { "Child to correct": pair(o.students.map((student) => ({ value: student.id, label: labelOf(student) }))) },
    },
  };
}

export function decideCorrectionDrawer(row: CorrectionRow): DrawerSpec {
  return {
    mode: "decide",
    kicker: `${row.arm} · ${row.forDate}`,
    title: `${row.student}: ${row.from} → ${row.to}`,
    sub: `Requested by ${row.who} · ${row.reasonCode}`,
    facts: [
      ["Register", `${row.arm} · ${row.forDate}`, row.kind],
      ["Child", row.student, ""],
      ["Change", `${row.from} → ${row.to}`, "Both values are kept, whichever way this goes"],
      ["Reason", row.reasonCode, row.evidence ? "Evidence seen and filed" : "No evidence attached"],
      ["What happened", row.explanation, ""],
      ["Requested by", row.who, row.markedOn],
      ["If approved", "The mark changes and the term figure is recomputed", "Any chronic-absence case is re-read"],
    ],
    fields: [
      choice("Decision", ["Approve the correction", "Decline the correction"], { value: "Approve the correction" }),
      area("Note", { span: 2, optional: true, hint: "Required if you decline — the person who asked is told why." }),
    ],
    commitLabel: "Record the decision",
    commitDone: "Decision recorded",
    commitDoneBody: "It is on the register's history under your name.",
    submit: { endpoint: `${AT}/corrections/${row.id}/decide`, method: "POST", map: { Decision: "decision", Note: "note" } },
  };
}

export function viewCorrectionDrawer(row: CorrectionRow): DrawerSpec {
  return {
    mode: "view",
    kicker: `${row.arm} · ${row.forDate}`,
    title: `${row.student}: ${row.from} → ${row.to}`,
    sub: `${row.kind} · ${row.state}`,
    readOnly: true,
    facts: [
      ["Register", `${row.arm} · ${row.forDate}`, row.kind],
      ["Change", `${row.from} → ${row.to}`, ""],
      ["Reason", row.reasonCode, row.evidence ? "Evidence seen and filed" : "No evidence attached"],
      ["What happened", row.explanation, ""],
      ["Requested by", row.who, row.markedOn],
      ["Decided by", row.decidedBy ?? (row.kind === "Same day" ? "Free for the marker — no decision needed" : "Not yet decided"), row.decidedAt ?? ""],
      ...(row.decisionNote ? ([["Decision note", row.decisionNote, ""]] as PanelFact[]) : []),
      ["State", row.state, ""],
    ],
  };
}

export function decideExplanationDrawer(d: ExplanationDetail): DrawerSpec {
  const days = d.absences.map((absence) => absence.label);
  return {
    mode: "decide",
    kicker: "Guardian explanation",
    title: `${d.child ?? "A child"} · ${d.guardian}`,
    sub: `“${d.detail}”`,
    facts: [
      ["Child", d.child ?? "Not named", `${d.adm ?? ""} · ${d.arm ?? ""}`],
      ["Submitted by", d.guardian, d.relation],
      ["What they wrote", d.detail, ""],
      ["Unexcused absences on record", days.length ? String(days.length) : "None", days.length ? "Choose which days this explanation covers" : "Nothing for this explanation to apply to"],
      ["If accepted", "Absent becomes Excused on the days you choose", "Their term percentage moves with it"],
      ["State", d.state, ""],
    ],
    fields: [
      choice("Decision", ["Accept the explanation", "Decline the explanation"], { value: "Accept the explanation" }),
      checks("Days it covers", days, [], { span: 2, when: { field: "Decision", equals: "Accept the explanation" }, hint: "Only these days change. Everything else on the register is left as it was." }),
      area("Note", { span: 2, optional: true, hint: "Required if you decline — the family is told why." }),
      toggle("Tell the family", true, "They are told what was decided", "Silent", { span: 2 }),
    ],
    commitLabel: "Record the decision",
    commitDone: "Decision recorded",
    commitDoneBody: "The register and the child's term figure have moved with it, and the family has been told.",
    submit: {
      endpoint: `${AT}/explanations/${d.id}/decide`, method: "POST", map: { Decision: "decision", "Days it covers": "dates", Note: "note", "Tell the family": "tell" },
      encode: { "Days it covers": Object.fromEntries(d.absences.map((absence) => [absence.label, absence.date])) },
    },
  };
}

export function viewExplanationDrawer(d: ExplanationDetail): DrawerSpec {
  return {
    mode: "view",
    kicker: "Guardian explanation",
    title: `${d.child ?? "A child"} · ${d.guardian}`,
    sub: `“${d.detail}”`,
    readOnly: true,
    facts: [
      ["Child", d.child ?? "Not named", `${d.adm ?? ""} · ${d.arm ?? ""}`],
      ["Submitted by", d.guardian, d.relation],
      ["What they wrote", d.detail, ""],
      ["Decision", d.outcome ?? d.state, d.decidedAt ? d.decidedAt.slice(0, 10) : ""],
      ["State", d.state, ""],
    ],
  };
}

/* ───────────────────────── cases ───────────────────────── */

export function studentCaseFacts(c: StudentCase): PanelFact[] {
  const range = c.longestStart && c.longestEnd ? (c.longestStart === c.longestEnd ? c.longestStart : `${c.longestStart} to ${c.longestEnd}`) : "";
  return [
    ["Child", c.student.name, `${c.student.adm} · ${c.student.arm}`],
    ["Term attendance", c.rate === null ? "No register on record" : `${c.rate}%`, c.rate !== null && c.rate < c.policy.chronic ? `Below the ${c.policy.chronic}% chronic threshold` : c.rate !== null && c.rate < c.policy.watch ? `Below ${c.policy.watch}% — falling` : c.rate !== null && c.rate < c.policy.target ? `Below the ${c.policy.target}% target — worth watching` : "At or above the school's target"],
    ["School days on record", String(c.days), `${c.term.name}`],
    ["Absent", plural(c.tally.absent, "day"), c.unexplained ? `${c.unexplained} with no explanation` : "Every one has a reason"],
    ["Excused", plural(c.tally.excused, "day"), ""],
    ["Late", plural(c.tally.late, "day"), ""],
    ["Longest run", c.longest ? plural(c.longest, "consecutive day") : "None", range],
    ["Case", c.case ? `${c.case.status} · opened ${c.case.openedAt}` : "None", c.case ? (c.case.automatic ? `Automatically, at ${c.case.openedAtRate}%` : `By hand, at ${c.case.openedAtRate}%`) : "Opens itself below the threshold"],
    ["Guardian contacted", c.contacts.count ? plural(c.contacts.count, "time") : "Never", c.contacts.last ? `Last on ${c.contacts.last}` : c.contacts.hasNumber ? "A number is on file" : "No phone number on file"],
    ["Outcome recorded", c.case?.outcome ?? "None yet", c.case?.status === "Closed" ? `Closed ${c.case.closedAt ?? ""}${c.case.closedBy ? ` by ${c.case.closedBy}` : ""}` : "A case cannot be closed without one"],
    ["State", c.flag, ""],
  ];
}

export function closeCaseDrawer(c: StudentCase): DrawerSpec {
  return {
    mode: "commit",
    kicker: `${c.student.name} · attendance case`,
    title: "Close the case",
    sub: "A case cannot be closed without a recorded outcome.",
    facts: studentCaseFacts(c).slice(0, 8),
    fields: [
      select("Outcome", c.outcomes, { required: true, span: 2 }),
      area("What was done", { span: 2, optional: true, hint: "Required if the outcome is \"Other\"." }),
    ],
    commitLabel: "Close the case",
    commitDone: "Case closed",
    commitDoneBody: "The outcome is on the child's record, under your name.",
    submit: { endpoint: `${AT}/cases/${c.case?.id}/close`, method: "POST", map: { Outcome: "outcome", "What was done": "note" } },
  };
}

export function openCaseDrawer(students: Array<{ id: string; name: string }>): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Attendance",
    title: students.length === 1 ? `Open a case for ${students[0].name}` : `Open a case for ${students.length} children`,
    sub: "A case is the school's record that someone is dealing with the absence.",
    facts: [
      ["Children", String(students.length), students.map((student) => student.name).slice(0, 4).join(", ")],
      ["Opened as", "By hand", "Automatic cases open themselves below the threshold"],
      ["To close it", "A recorded outcome", "Guardian met, medical, transferred, referred…"],
    ],
    commitLabel: "Open the case",
    commitDone: "Case opened",
    commitDoneBody: "It is on the Log and on the child's record.",
    submit: { endpoint: `${AT}/cases`, method: "POST", body: { students: students.map((student) => student.id) } },
  };
}

/* ───────────────────────── output ───────────────────────── */

export function spoolDrawer(o: Options, preset: { for?: string; arm?: string; student?: string; label?: string } = {}): DrawerSpec {
  const armNames = o.arms.map((arm) => arm.name);
  const teachers = Array.from(new Map(o.arms.filter((arm) => arm.master).map((arm) => [arm.master as string, arm.master as string])).values());
  const staff = o.staff.filter((member) => teachers.includes(member.name));
  return {
    mode: "form",
    kicker: preset.label ?? "Attendance · Log",
    title: "Spool attendance record",
    sub: "An official extract — logged with your name and what it contained.",
    commitLabel: "Spool the record",
    commitDone: "Record spooled",
    commitDoneBody: "It is ready, and the spool itself is in the audit log under your name.",
    reviewNote: "A spooled record is an official extract. Every spool is logged with your name and what it contained.",
    fields: [
      choice("Spool for", ["A class arm", "A single student", "A teacher", "The whole school"], { span: 2, value: preset.for ?? "A class arm" }),
      select("Arm", armNames.length ? armNames : ["No arms yet"], { value: preset.arm ?? armNames[0], when: { field: "Spool for", equals: "A class arm" }, hint: "Only used if you chose an arm" }),
      picker("Student", studentOptions(o.students), { checked: preset.student ? [preset.student] : [], when: { field: "Spool for", equals: "A single student" }, placeholder: "Search by name or admission number", noun: "child", nounPlural: "children", hint: "Only used if you chose a single student" }),
      select("Teacher", staff.length ? staff.map((member) => member.name) : ["No form masters"], { when: { field: "Spool for", equals: "A teacher" }, hint: "Their arms are spooled together" }),
      select("Period", ["This term", "This month", "This week", "Last term", "The whole session", "A date range"], { value: "This term", required: true }),
      dateField("From", { when: { field: "Period", equals: "A date range" }, hint: "Only used for a date range" }),
      dateField("To", { when: { field: "Period", equals: "A date range" } }),
      checks("Include", ["Daily marks", "Weekly summary", "Reasons and explanations", "Corrections and backdating", "Guardian contact history"], ["Daily marks", "Weekly summary", "Reasons and explanations"], { required: true, span: 2 }),
      select("Format", ["PDF · for printing and filing", "Excel · for analysis", "CSV · raw"], { value: "PDF · for printing and filing", required: true, hint: "PDF opens a printable page to save as PDF; Excel and CSV download a CSV file." }),
      select("Purpose", ["School records", "Inspection or audit", "Guardian request", "Transfer certificate", "Legal request"], { value: "School records", required: true, hint: "Recorded with the spool" }),
      toggle("Include the school letterhead and stamp", true, "Official copy", "Plain copy", { span: 2 }),
    ],
    submit: {
      endpoint: `${AT}/spool`, method: "POST",
      map: { "Spool for": "for", Arm: "arm", Student: "student", Teacher: "teacher", Period: "period", From: "from", To: "to", Include: "include", Format: "format", Purpose: "purpose", "Include the school letterhead and stamp": "letterhead" },
      encode: { Arm: pair(o.arms.map((arm) => ({ value: arm.id, label: arm.name }))), Teacher: pair(staff.map((member) => ({ value: member.id, label: member.name }))) },
    },
  };
}

export function sendRecordDrawer(students: Array<{ id: string; name: string }>, label = "Attendance"): DrawerSpec {
  return {
    mode: "form",
    kicker: label,
    title: "Send the attendance record to guardians",
    sub: students.length === 1 ? `For ${students[0].name}.` : `For ${plural(students.length, "child", "children")}.`,
    commitLabel: "Send it",
    commitDone: "Attendance record sent",
    commitDoneBody: "It is in the guardian portal now, and on every channel you chose. The send itself is in the audit log.",
    reviewNote: "Guardians see attendance only — no reasons another family gave, and nothing about any other child.",
    fields: [
      select("Period covered", ["This week", "This month", "This term", "Last term", "The whole session", "Every term on record"], { value: "This term", required: true, span: 2, hint: "The family sees the same breakdown you are looking at" }),
      select("Level of detail", ["Summary only · one line per period", "With the day-by-day marks", "With the reasons the school accepted"], { required: true, span: 2 }),
      checks("Send through", ["Guardian app · free", "Email · free", "SMS · 1 credit each", "WhatsApp · 1 credit each", "Printed copy for the child to carry"], ["Guardian app · free", "Email · free"], { required: true, span: 2, hint: "The app copy is always sent — the rest are how you reach a family who does not open it. SMS and WhatsApp are queued, not yet sent." }),
      select("Language", ["Match each guardian’s own preference", "English", "French", "Arabic", "Portuguese", "Kiswahili"], { required: true }),
      select("Who receives it", ["The primary guardian only", "Every guardian on the record", "Primary guardian and the student"], { value: "Every guardian on the record", required: true }),
      area("A note to go with it", { span: 2, optional: true, placeholder: "Optional — one or two lines in your own words. Left blank, the record goes on its own." }),
      toggle("Include the school letterhead", true, "Official copy", "Plain copy", { span: 2 }),
    ],
    submit: {
      endpoint: `${AT}/send`, method: "POST", body: { students: students.map((student) => student.id) },
      map: { "Period covered": "period", "Level of detail": "detail", "Send through": "channels", Language: "language", "Who receives it": "who", "A note to go with it": "note", "Include the school letterhead": "letterhead" },
    },
  };
}

/* ───────────────────────── telling staff ───────────────────────── */

export function notifyPersonDrawer(o: { endpoint?: string; id: string | null; name: string; role?: string; phone?: string | null; email?: string | null; kicker: string; owes: string; items: number; oldest: string; last: string; due?: string; href?: string; school: string }): DrawerSpec {
  const unassigned = !o.id;
  const first = o.name.replace(/^(Mrs|Mr|Miss|Dr|Alhaji|Hajiya)\s+/, "").split(" ")[0];
  const sms = o.phone ? `SMS to ${o.phone}` : "SMS (no number on file)";
  const mail = o.email ? `Email to ${o.email}` : "Email (none on file)";
  return {
    mode: "form",
    kicker: `${o.kicker} · notification`,
    title: `Notify ${o.name}`,
    sub: "A notification never changes a record, a state or a deadline.",
    commitLabel: "Send the notification",
    commitDone: `Notification sent to ${o.name}`,
    commitDoneBody: "It is in their in-app inbox now. Nothing on any record changed.",
    reviewNote: "This is exactly what will be sent, and to whom. Nothing on any record changes.",
    fields: [
      fixed("Who is notified", unassigned ? "No teacher is named — nobody to notify" : o.name, { hint: unassigned ? "Assign a form master first; a notification cannot reach an empty post." : `${o.role ?? "Staff"} · ${o.phone ?? "no phone"} · ${o.email ?? "no email"}` }),
      fixed("What they owe", o.owes, { hint: `${plural(o.items, "item")} · oldest ${o.oldest} · last notified ${o.last}` }),
      checks("Channel", ["In-app inbox", sms, mail], ["In-app inbox"], { span: 2, required: true, hint: "In-app is instant. SMS and email are queued for delivery." }),
      choice("Urgency", ["Reminder", "Firm · names the deadline", "Final · copies their line manager"], { span: 2, value: o.last === "Never" ? "Firm · names the deadline" : "Reminder" }),
      select("Do it by", ["End of today", "Tomorrow, 09:00", "In 2 days", "End of this week"], { required: true, value: o.due ?? "End of today", hint: "Stated in the message. It does not move any deadline on the record." }),
      checks("Copy to", ["Their head of department", "The Principal", "The Exam Officer"], [], {}),
      area("Message", { span: 2, required: true, value: `Dear ${first}, ${o.owes.charAt(0).toLowerCase()}${o.owes.slice(1)} is still outstanding (${o.oldest}). Please complete it by the end of today so records are not held up. — ${o.school}`, hint: "Editable. They see only their own items, never anyone else's." }),
      toggle("Include a direct link to their outstanding items", true, "One tap opens the exact list", "Message only", { span: 2 }),
    ],
    submit: {
      endpoint: o.endpoint ?? `${AT}/notify`, method: "POST", body: { users: o.id ? [o.id] : [], kicker: o.kicker, ...(o.href ? { href: o.href } : {}) },
      map: { Channel: "channels", Urgency: "urgency", "Do it by": "due", "Copy to": "copy", Message: "message", "Include a direct link to their outstanding items": "link" },
    },
  };
}

export function nudgeDrawer(o: { endpoint?: string; people: Array<{ id: string; name: string }>; kicker: string; title?: string; who: string; what: string; extra?: PanelFact[]; href?: string; message: string }): DrawerSpec {
  const n = o.people.length;
  return {
    mode: "commit",
    kicker: o.kicker,
    title: o.title ?? `Notify ${plural(n, "staff member")}`,
    sub: "This sends a notification. It is not an approval, and it changes nothing on any record.",
    facts: [
      ["Who is notified", String(n), `${o.who}${o.people.length ? ` · ${o.people.map((person) => person.name).slice(0, 3).join(", ")}${n > 3 ? "…" : ""}` : ""}`],
      ["Channel", "In-app and email", "In-app is instant; email is queued for delivery"],
      ["What they see", o.what, "Nothing is disclosed about anyone else"],
      ["Changes anything?", "No", "A notification never alters a record, a state or a deadline"],
      ["Recorded as", "A notification in the audit log", "Under your name, with the recipient list"],
      ...(o.extra ?? []),
    ],
    commitLabel: "Send the notification",
    commitNote: "Queued immediately · nothing is approved by this.",
    commitDone: `Notification sent to ${plural(n, "person", "people")}`,
    commitDoneBody: "It is in their inbox now. Each one received only what they personally owe.",
    submit: { endpoint: o.endpoint ?? `${AT}/notify`, method: "POST", body: { users: o.people.map((person) => person.id), channels: ["In-app inbox", "Email"], message: o.message, kicker: o.kicker, urgency: "Reminder", ...(o.href ? { href: o.href } : {}) } },
  };
}

export function reassignDrawer(o: Options, arms: Array<{ id: string; name: string; master: string | null }>, title = "Reassign the arm"): DrawerSpec {
  return {
    mode: "form",
    kicker: "Attendance · Compliance",
    title,
    sub: "Who takes the register is who answers for it.",
    commitLabel: "Reassign",
    commitDone: "Arm reassigned",
    commitDoneBody: "The new form master owns this register from now on, and has been told.",
    reviewNote: "Past registers keep the name of whoever took them. Only the arm's form master changes.",
    fields: [
      checks("Arms", o.arms.map((arm) => arm.name), arms.map((arm) => arm.name), { span: 2, required: true, hint: "Every arm ticked moves to the same person." }),
      select("New form master", o.staff.map((member) => member.name), { required: true, span: 2 }),
      toggle("Tell them", true, "They are notified in-app", "Silent", { span: 2 }),
    ],
    submit: {
      endpoint: `${AT}/arms/reassign`, method: "POST", map: { Arms: "arms", "New form master": "teacher", "Tell them": "tell" },
      encode: { Arms: pair(o.arms.map((arm) => ({ value: arm.id, label: arm.name }))), "New form master": pair(o.staff.map((member) => ({ value: member.id, label: member.name }))) },
    },
  };
}

/* ───────────────────────── readings ───────────────────────── */

export function teacherFacts(t: TeacherRecord): PanelFact[] {
  const row = t.row;
  return [
    ["Teacher", t.name, `Form master${t.dept ? ` · ${t.dept}` : ""}`],
    ["Arms they mark", row ? row.arms.join(", ") : "None", row ? `${row.roll} children in all` : ""],
    ["Marked on the day", row ? `${row.arms.length - row.todayMissing} of ${row.arms.length}` : "—", row && row.todayMissing ? "Past the cutoff" : row ? "All in" : ""],
    ["Missed this week", row ? plural(row.week, "arm-day") : "—", ""],
    ["Missed this term", row ? plural(row.term, "arm-day") : "—", row ? `Of ${row.owed} expected` : ""],
    ["Punctuality", row?.punctuality === null || !row ? "No timed registers" : `${row.punctuality}%`, `Share taken before the ${t.cutoff} cutoff`],
    ["Pattern", row?.pattern ?? "—", row?.pattern === "Repeat" ? "Breached in 3 or more of the last 5 weeks — a conversation, not a notification" : row?.pattern === "Clean" ? "No breaches this term" : ""],
    ["Corrections made", String(t.corrections), "Same-day, prior-day and guardian-led"],
    ["Last notified", t.lastNotified ?? "—", "Duplicates in one day are skipped"],
    ["State", row?.state ?? "—", ""],
  ];
}

export function complianceNudge(c: Compliance, school: string): DrawerSpec {
  const owners = c.tracker.filter((row) => row.overdue && row.ownerId);
  const people = Array.from(new Map(owners.map((row) => [row.ownerId as string, { id: row.ownerId as string, name: row.owner }])).values());
  return nudgeDrawer({
    people, kicker: "Attendance", title: `Notify the ${plural(people.length, "form master")} with an unmarked register`,
    who: "form masters with an unmarked register", what: "Which register is unmarked, and the cutoff it passed",
    extra: [["Unmarked", plural(owners.length, "arm"), `Past the ${c.cutoff} cutoff`]],
    href: "/attendance/mark", message: `Your register for ${c.label} is still unmarked and the ${c.cutoff} cutoff has passed. Please take it now. — ${school}`,
  });
}
