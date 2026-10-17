import { area, checks, choice, fixed, select, text, toggle } from "@/lib/modules/live/m7-forms";
import { dayLong, plural } from "@/lib/modules/live/m7-format";
import type { Applicant, AdmissionOptions, AttendanceSession, ChangeItem, Changes, Dossier, EnrolOptions, Registry } from "@/lib/modules/live/m8-types";
import type { DrawerSpec, FormField, PickerOption } from "@/lib/modules/panels";

/** Every modal in Student Records, as data. */

export const SR = "/api/v1/student-records";

const RELATIONS = ["Mother", "Father", "Grandparent", "Aunt", "Uncle", "Sponsor", "Legal guardian", "Sibling over 18"];
const SEE = ["Results and report cards", "Attendance", "Fee amounts", "Announcements", "Disciplinary and guidance notes"];
const CONSENTS = ["Core record processing", "Health and welfare", "Photography and image use", "Trips and off-site activity"];

const picker = (label: string, options: PickerOption[], o: Record<string, unknown> = {}) => ({ label, kind: "picker", options, checked: [], span: 2, ...o }) as FormField;
const when = (field: FormField, w: FormField["when"]): FormField => ({ ...field, when: w }) as FormField;

/* ───────────────────────── the registry ───────────────────────── */

export function enrolDrawer(data: EnrolOptions): DrawerSpec {
  const guardianOptions: PickerOption[] = data.guardians.map((guardian) => ({ value: guardian.id, label: guardian.name, sub: `${guardian.phone} · ${plural(guardian.children, "child", "children")}` }));
  return {
    mode: "form",
    kicker: "Registry",
    title: "Enrol a student",
    sub: "The child goes onto the register and into the arm you choose.",
    commitLabel: "Enrol the student",
    commitDone: "Student enrolled",
    commitDoneBody: "The student is on the register, in the arm you chose, and visible to every module that needs them.",
    reviewNote: "Core record processing cannot be waived — it is the basis for holding the record.",
    steps: [
      {
        title: "Student",
        hint: "Who this child is.",
        fields: [
          text("Full name", { required: true, span: 2, placeholder: "Ada Chinelo Okonkwo" }),
          text("Date of birth", { type: "date", required: true }),
          choice("Gender", ["Female", "Male"], { required: true }),
          text("Admission number", { value: data.admissionNumber, hint: "Generated — change it if your school numbers differently." }),
          select("Nationality", ["Nigerian", "Ghanaian", "Kenyan", "South African", "British", "Other"]),
        ],
      },
      {
        title: "Academic",
        hint: "Where this child sits from day one.",
        fields: [
          select("Level", data.levels, { required: true }),
          select("Class arm", ["Any arm with space", ...data.arms.map((arm) => arm.name)], { required: true, hint: "Choose an arm that belongs to the level. “Any arm with space” fills the emptiest one." }),
          select("Entry term", data.terms, { required: true }),
          choice("Boarding", ["Day", "Boarding"], { hint: "A boarder is placed in a hostel room from the hostel desk; until then they are enrolled as a day student." }),
          text("Previous school", { optional: true, span: 2, placeholder: "St Peter's Primary, Abuja" }),
        ],
      },
      {
        title: "Family",
        hint: "One guardian is enough to enrol; add the rest later.",
        fields: [
          choice("Guardian", ["Link an existing guardian", "Add a new guardian"], { span: 2, value: "Add a new guardian" }),
          when(picker("Existing guardian", guardianOptions, { placeholder: "Search a guardian by name or phone number", noun: "guardian", nounPlural: "guardians", hint: "Siblings share one account." }), { field: "Guardian", equals: "Link an existing guardian" }),
          when(text("Guardian name", { required: true, placeholder: "Mrs Ada Okonkwo", span: 2 }), { field: "Guardian", equals: "Add a new guardian" }),
          select("Relationship", RELATIONS, { required: true }),
          when(text("Phone", { required: true, placeholder: "08030000000", hint: "Becomes their portal login." }), { field: "Guardian", equals: "Add a new guardian" }),
          when(text("Email", { optional: true, placeholder: "ada@example.com" }), { field: "Guardian", equals: "Add a new guardian" }),
        ],
      },
      {
        title: "Review",
        hint: "Everything you entered, and the consent that has to be recorded.",
        fields: [checks("Consent recorded", CONSENTS, ["Core record processing"], { required: true, span: 2, hint: "Core record processing cannot be waived." })],
      },
    ],
    submit: {
      endpoint: `${SR}/registry/enrol`,
      method: "POST",
      map: {
        "Full name": "name",
        "Date of birth": "dob",
        Gender: "gender",
        "Admission number": "adm",
        Nationality: "nationality",
        Level: "level",
        "Class arm": "arm",
        "Entry term": "term",
        Boarding: "boarding",
        "Previous school": "previousSchool",
        Guardian: "guardianMode",
        "Existing guardian": "guardianId",
        "Guardian name": "guardianName",
        Relationship: "relation",
        Phone: "phone",
        Email: "email",
        "Consent recorded": "consent",
      },
    },
  };
}

export function moveDrawer(rooms: Array<{ id: string; name: string; level: string; seats: number }>): DrawerSpec {
  return {
    mode: "form",
    kicker: "Registry",
    title: "Move to another arm",
    sub: "Every ticked student moves; each arm's seats are checked first.",
    commitLabel: "Move them",
    commitDone: "Students moved",
    commitDoneBody: "Their registers, score sheets and timetable follow them from the next school day.",
    reviewNote: "A move is recorded against every child, with your reason, and cannot exceed an arm's capacity.",
    fields: [
      select("Move to", rooms.map((room) => `${room.name} · ${room.seats} seats`), { required: true, span: 2 }),
      area("Why", { span: 2, required: true, placeholder: "Kept on every record it touches." }),
      toggle("Tell their guardians", true, "Told in-app and by SMS", "Silent move", { span: 2 }),
    ],
    submit: {
      endpoint: `${SR}/registry/move`,
      method: "POST",
      map: { "Move to": "arm", Why: "reason", "Tell their guardians": "tell" },
      encode: { "Move to": Object.fromEntries(rooms.map((room) => [`${room.name} · ${room.seats} seats`, room.id])) },
    },
  };
}

export function resendDrawer(count: number, children: number): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Registry",
    title: `Resend ${plural(count, "outstanding invite")}`,
    sub: "Every family that has never activated the portal gets a fresh link.",
    facts: [
      ["Families", String(count), "Each has never completed activation"],
      ["Children affected", String(children), "None of them can be reached digitally today"],
      ["Goes to", "Their phone and their email", "Both channels, one link"],
      ["Previous links", "Invalidated", "Only the newest link works"],
      ["Link validity", "7 days", "After that it expires and must be resent"],
      ["Families already active", "Skipped", "Nobody is invited twice"],
    ],
    commitLabel: `Resend all ${count}`,
    commitDone: `${plural(count, "invite")} resent`,
    commitDoneBody: "Each family has a fresh link queued to their phone and their inbox.",
    submit: { endpoint: `${SR}/registry/resend`, method: "POST" },
  };
}

/* ───────────────────────── one child ───────────────────────── */

export function requestChangeDrawer(fields: string[], students: Registry["rows"], pre?: { id: string; name: string }): DrawerSpec {
  const options: PickerOption[] = students.map((student) => ({ value: student.id, label: student.name, sub: `${student.adm} · ${student.arm}`, group: student.arm.split(" ")[0] }));
  return {
    mode: "form",
    kicker: "Changes",
    title: pre ? `Request a change · ${pre.name}` : "Request a record change",
    sub: "What is wrong, the correct value, evidence, and why it matters.",
    commitLabel: "Send for a decision",
    commitDone: "Change requested",
    commitDoneBody: "It is waiting for a decision from someone other than you. Nothing on the record has changed yet.",
    reviewNote: "A change to a student's record is never made quietly: it is asked for with the before and the after, and decided by someone who did not ask.",
    fields: [
      picker("Student", options, { required: true, checked: pre ? [pre.id] : [], placeholder: "Search by name, admission number or arm", noun: "student", nounPlural: "students", groupAll: "All classes" }),
      select("What is wrong", fields, { required: true, span: 2 }),
      text("The correct value", { required: true, span: 2, placeholder: "As it should read — a date as 2012-03-14" }),
      area("Why it matters", { span: 2, required: true, placeholder: "What goes wrong if it stays as it is." }),
      text("Evidence", { optional: true, span: 2, placeholder: "Birth certificate, transfer letter, a guardian's note…" }),
    ],
    submit: { endpoint: `${SR}/changes`, method: "POST", map: { Student: "student", "What is wrong": "field", "The correct value": "after", "Why it matters": "reason", Evidence: "evidence" } },
  };
}

export function decideChangeDrawer(item: ChangeItem): DrawerSpec {
  const facts: Array<[string, string, string?]> = [
    ["Student", item.student, item.adm],
    ["What is wrong", item.field],
    ["Before", item.before],
    ["After", item.after],
    ["Requested by", item.by.name, item.by.role],
    ["Waiting", item.age ? plural(item.age, "day") : `${item.hours} ${item.hours === 1 ? "hour" : "hours"}`],
    ["Why", item.reason ?? "—"],
    ["Evidence", item.evidence ?? "None attached"],
  ];
  if (item.ownRequest) {
    return { mode: "view", kicker: "Changes · yours", title: `${item.field} · ${item.student}`, sub: "You asked for this, so someone else has to decide it.", tone: "attention", facts, readOnly: true, readOnlyNote: "Whoever asked for a change cannot also decide it — the Proprietor or another approver will." };
  }
  return {
    mode: "form",
    kicker: "Changes · decision",
    title: `${item.field} · ${item.student}`,
    sub: `${item.before} → ${item.after}`,
    facts,
    commitLabel: "Record the decision",
    commitDone: "Decision recorded",
    commitDoneBody: "An approved change is on the record now, with the before and the after kept; a refusal tells them why.",
    reviewNote: "Approving writes the change onto the student's record at once.",
    fields: [choice("Your decision", ["Approve", "Decline"], { span: 2, required: true, value: "Approve" }), area("Note", { span: 2, optional: true, placeholder: "Required to decline — whoever asked reads it as written." })],
    submit: { endpoint: `${SR}/changes/${item.id}/decide`, method: "POST", map: { "Your decision": "decision", Note: "note" }, encode: { "Your decision": { Approve: "approve", Decline: "decline" } } },
  };
}

export function listDrawer(kicker: string, title: string, sub: string, items: Array<{ label: string; sub: string }>, note?: string): DrawerSpec {
  return {
    mode: "view",
    kicker,
    title,
    sub,
    facts: items.length ? items.map((item) => [item.label, item.sub] as [string, string]) : [["Nothing to list", "Every record is complete"]],
    readOnly: true,
    readOnlyNote: note ?? "Open a student from the registry to fix any of these.",
  };
}

export function noteDrawer(d: Pick<Dossier, "id" | "name">): DrawerSpec {
  return {
    mode: "form",
    kicker: d.name,
    title: "Record a guidance note",
    sub: "Visible to the form master, the counsellor and school leadership — never to a subject teacher.",
    commitLabel: "Save the note",
    commitDone: "Guidance note saved",
    commitDoneBody: "It is on the student's wellbeing tab, visible to the form master, the counsellor and school leadership.",
    reviewNote: "A guidance note is never visible to a subject teacher, and never printed on a report card.",
    fields: [
      select("Kind", ["Guidance", "Conduct", "Commendation", "Health", "Safeguarding concern"], { required: true }),
      text("Date", { type: "date", required: true, value: new Date().toISOString().slice(0, 10) }),
      area("What happened, in plain language", { span: 2, required: true, placeholder: "Factual. The next person to open this record reads exactly this." }),
      area("Action taken", { span: 2, optional: true }),
      select("Outcome", ["Closed", "Resolved", "Monitoring", "Escalated"], { required: true }),
      select("Visible to", ["Form master, counsellor and leadership", "Leadership only", "Counsellor only"], { required: true }),
      toggle("Tell the guardian", false, "The guardian is informed", "Internal only", { span: 2 }),
    ],
    submit: { endpoint: `${SR}/students/${d.id}/notes`, method: "POST", map: { Kind: "kind", Date: "date", "What happened, in plain language": "entry", "Action taken": "action", Outcome: "outcome", "Visible to": "visible", "Tell the guardian": "tell" } },
  };
}

export function collectorDrawer(d: Pick<Dossier, "id" | "name">): DrawerSpec {
  return {
    mode: "form",
    kicker: d.name,
    title: "Add an authorised collector",
    sub: "A collector with no photograph on file cannot collect, whatever is recorded here.",
    commitLabel: "Add the collector",
    commitDone: "Collector added",
    commitDoneBody: "They may collect this child. The gate staff see the name and the photograph.",
    reviewNote: "The gate checks the face, not the name.",
    fields: [
      text("Full name", { required: true, span: 2 }),
      select("Relation to the child", ["Mother", "Father", "Grandparent", "Aunt", "Uncle", "Driver", "Family friend", "Sibling over 18"], { required: true }),
      text("Mobile number", { required: true, placeholder: "08030000000" }),
      text("Photograph file", { required: true, placeholder: "collector-photo.jpg", hint: "Required — the gate checks the face, not the name." }),
      select("Applies to", ["This child only", "Every child in this family"], { required: true, span: 2 }),
      text("Authorised until", { type: "date", optional: true, hint: "Leave blank for no end date." }),
      toggle("Notify the guardian", true, "The guardian is told who was added", "No notification"),
    ],
    submit: { endpoint: `${SR}/students/${d.id}/collectors`, method: "POST", map: { "Full name": "name", "Relation to the child": "relation", "Mobile number": "phone", "Photograph file": "photo", "Applies to": "applies", "Authorised until": "until", "Notify the guardian": "notify" } },
  };
}

export function documentDrawer(d: Pick<Dossier, "id" | "name">, type?: string): DrawerSpec {
  return {
    mode: "form",
    kicker: d.name,
    title: type ? `Record · ${type}` : "Upload a document",
    sub: "The document's details go on the record; the audit log carries your name.",
    commitLabel: "Record it",
    commitDone: "Document recorded",
    commitDoneBody: "It is on the student's record and in the audit log under your name.",
    reviewNote: "This records that the document exists and who checked it. The file itself is held by the school office until document storage is switched on.",
    fields: [
      select("Document type", ["Birth certificate", "Passport photograph", "Previous school report", "Immunisation record", "Transfer certificate", "Medical report", "Proof of address", "Other"], { required: true, span: 2, value: type }),
      text("File name", { required: true, span: 2, placeholder: "birth-certificate.pdf" }),
      text("Date on the document", { type: "date", optional: true }),
      select("Verified by", ["Not verified yet", "Verified by me"], { value: "Not verified yet" }),
      area("Note", { span: 2, optional: true }),
    ],
    submit: { endpoint: `${SR}/students/${d.id}/documents`, method: "POST", map: { "Document type": "type", "File name": "file", "Date on the document": "date", "Verified by": "verifiedBy", Note: "note" } },
  };
}

export function mapGuardianDrawer(d: Pick<Dossier, "id" | "name">, existing: boolean, guardians: Array<{ id: string; name: string; phone: string; children: number }>): DrawerSpec {
  const kid = d.name.split(" ")[0];
  const options: PickerOption[] = guardians.map((guardian) => ({ value: guardian.id, label: guardian.name, sub: `${guardian.phone} · ${plural(guardian.children, "child", "children")}` }));
  return {
    mode: "form",
    kicker: "Student record · family",
    title: existing ? "Link an existing guardian" : `Map a guardian to ${kid}`,
    sub: "Nothing can be published to a family that does not exist on the record.",
    commitLabel: existing ? "Link this guardian" : "Map this guardian",
    commitDone: existing ? "Guardian linked" : "Guardian mapped",
    commitDoneBody: "They are on the child's record now, and everything the school publishes reaches them.",
    reviewNote: "One guardian, one login — linking adds this child to the account they already have.",
    fields: existing
      ? [
          picker("Guardian already in the school", options, { required: true, placeholder: "Search by name or phone number", noun: "guardian", nounPlural: "guardians" }),
          select(`Relation to ${kid}`, RELATIONS, { required: true }),
          choice("Contact order", ["Primary contact", "Secondary contact"], { span: 2, value: "Primary contact" }),
          checks("What they may see about this child", SEE, ["Results and report cards", "Attendance", "Fee amounts", "Announcements"], { span: 2 }),
          toggle("Authorised to collect this child", true, "Yes · photograph required on file", "No", { span: 2 }),
        ]
      : [
          text("Full name", { required: true, span: 2, placeholder: "Mrs Ifeoma Adebayo" }),
          select(`Relation to ${kid}`, RELATIONS, { required: true }),
          select("Contact order", ["Primary contact", "Secondary contact"], { required: true }),
          text("Mobile number", { required: true, placeholder: "08030000000", hint: "The number the portal invite and every SMS goes to." }),
          text("Email", { optional: true }),
          area("Home address", { span: 2, optional: true }),
          text("Occupation", { optional: true }),
          select("Preferred language", ["English", "Hausa", "Yoruba", "Igbo", "French", "Arabic"]),
          checks("What they may see about this child", SEE, ["Results and report cards", "Attendance", "Fee amounts", "Announcements"], { span: 2 }),
          toggle("Authorised to collect this child", true, "Yes · photograph required on file", "No", { span: 2 }),
          toggle("Send the portal invite now", true, "Activation link by SMS and email", "I will send it later", { span: 2 }),
        ],
    submit: {
      endpoint: `${SR}/students/${d.id}/guardians`,
      method: "POST",
      map: existing
        ? { "Guardian already in the school": "guardian", [`Relation to ${kid}`]: "relation", "Contact order": "order", "What they may see about this child": "see", "Authorised to collect this child": "collect" }
        : { "Full name": "name", [`Relation to ${kid}`]: "relation", "Contact order": "order", "Mobile number": "phone", Email: "email", "Home address": "address", Occupation: "occupation", "Preferred language": "language", "What they may see about this child": "see", "Authorised to collect this child": "collect", "Send the portal invite now": "invite" },
    },
  };
}

export function sensitiveDrawer(d: Pick<Dossier, "id" | "name">): DrawerSpec {
  return {
    mode: "commit",
    kicker: `${d.name} · sensitive`,
    title: "Reveal the full health and welfare record",
    sub: "Your name and the time are written to the audit log at the moment you continue — not when you close it.",
    facts: [
      ["What opens", "Blood group, genotype, conditions, allergies and notes"],
      ["Who is told", "Nobody — it is logged, not announced"],
      ["Logged as", "Your name, the time, and the reason you give"],
    ],
    commitLabel: "Reveal it, and log that I did",
    commitDone: "Record revealed",
    commitDoneBody: "This is the record. Closing this window does not undo the log entry.",
    submit: { endpoint: `${SR}/students/${d.id}/reveal`, method: "POST", reasonKey: "reason", reasonLabel: "Why you need it", reasonRequired: true },
  };
}

export function attendanceSessionDrawer(d: Pick<Dossier, "name"> & { arm: string }, s: AttendanceSession): DrawerSpec {
  const TARGET = 92;
  const pc = (t: AttendanceSession["terms"][number]) => (t.days ? `${((t.present / t.days) * 100).toFixed(1)}%` : "—");
  return {
    mode: "info",
    kicker: `${d.name} · ${d.arm}`,
    title: `Attendance · ${s.session}`,
    sub: "Every term in this session, as marked.",
    facts: [
      ...s.terms.map((t) => [t.term, t.days ? `${pc(t)} · ${t.present} of ${t.days} days` : "Not started", t.days ? `${t.absent} absent · ${t.late} late · ${t.excused} excused` : "No register yet"] as [string, string, string]),
      ["Session total", s.pct === null ? "—" : `${s.pct}% · ${s.present} of ${s.days} days`, `${s.absent} absent · ${s.late} late · ${s.excused} excused`],
      ["Against the target", s.pct === null ? "Nothing marked" : s.pct >= TARGET ? `At or above ${TARGET}%` : `${(TARGET - s.pct).toFixed(1)} below ${TARGET}%`, s.pct !== null && s.pct < 75 ? "Below the 75% chronic threshold" : "Above the chronic threshold"],
    ],
    readOnly: true,
    readOnlyNote: "Percentages are of days actually marked, never of days on the calendar.",
  };
}

export function printDrawer(title: string, kicker: string, facts: Array<[string, string, string?]>): DrawerSpec {
  return { mode: "output", kicker, title, facts, readOnly: true, readOnlyNote: "A printed document carries the school's letterhead and is never editable." };
}

export function migrationDrawer(m: NonNullable<Changes["migration"]>): DrawerSpec {
  return {
    mode: "view",
    kicker: "Registry · migration",
    title: "Migration state",
    sub: "The reconciliation report is a customer-facing document, not a log file.",
    facts: [
      ["Job", m.job],
      ["Records presented", m.presented === null ? "Not recorded" : m.presented.toLocaleString("en-NG")],
      ["Signed off by", m.signedOffBy ?? "—", m.signedOffOn ?? undefined],
      ["Rollback", m.rolledBack ? "Rolled back" : "No longer available — sign-off completed"],
      ["Committed and rejected counts", "Not recorded on the job", "Ask the migration specialist for the reconciliation file"],
    ],
    readOnly: true,
  };
}

/* ───────────────────────── admissions ───────────────────────── */

export function addApplicationDrawer(o: AdmissionOptions): DrawerSpec {
  return {
    mode: "form",
    kicker: "Admissions",
    title: "Add application",
    sub: "This creates an application, not a student.",
    commitLabel: "Create the application",
    commitDone: "Application created",
    commitDoneBody: "It is in the pipeline at Enquiry, and the family has been acknowledged.",
    reviewNote: "This creates an application, not a student. Nothing reaches the registry until you convert it.",
    fields: [
      text("Child's full name", { required: true, span: 2 }),
      select("Gender", ["Female", "Male"], { required: true }),
      text("Date of birth", { type: "date", required: true }),
      select("Applying for", o.levels, { required: true }),
      select("Entry term", o.terms, { required: true }),
      text("Previous school", { optional: true, span: 2 }),
      fixed("Guardian details", "Required — an application with no contact cannot be progressed", { hint: "This becomes the guardian record if the application converts.", span: 2 }),
      text("Guardian full name", { required: true, span: 2 }),
      select("Relation to the child", ["Mother", "Father", "Grandparent", "Aunt", "Uncle", "Sponsor", "Legal guardian"], { required: true }),
      text("Mobile number", { required: true, placeholder: "08030000000", hint: "Every letter and SMS about this application goes here." }),
      text("Email", { optional: true, placeholder: "name@example.com" }),
      text("Second contact name", { optional: true }),
      text("Second contact number", { optional: true }),
      area("Home address", { span: 2, optional: true }),
      select("How they found us", ["Website", "Walk-in", "Referral", "Agent", "Sibling already here", "Advertisement"]),
      select("Sibling already in the school", ["No", "Yes — one", "Yes — two or more"], { hint: "Decides the sibling discount on conversion." }),
      toggle("Send the application form now", true, "Noted as sent to the guardian", "I will send it later", { span: 2 }),
    ],
    submit: {
      endpoint: `${SR}/admissions`,
      method: "POST",
      map: { "Child's full name": "name", Gender: "gender", "Date of birth": "dob", "Applying for": "applyingFor", "Entry term": "entryTerm", "Previous school": "previousSchool", "Guardian full name": "guardianName", "Relation to the child": "relation", "Mobile number": "phone", Email: "email", "Second contact name": "secondName", "Second contact number": "secondPhone", "Home address": "address", "How they found us": "source", "Sibling already in the school": "sibling", "Send the application form now": "sendForm" },
    },
  };
}

export function scheduleDrawer(o: AdmissionOptions, applicants: Array<{ id: string; name: string; ref: string; forClass: string }>, pre?: string): DrawerSpec {
  const labels = o.sessions.map((s) => `${new Date(`${s.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${s.start}${s.seats ? ` · ${Math.max(0, s.seats - s.booked)} seats left` : ` · ${s.booked} booked`}`);
  const NEW = "A new session — set below";
  return {
    mode: "form",
    kicker: "Admissions",
    title: "Schedule an assessment",
    sub: "Booking a seat sends the family a confirmation.",
    commitLabel: "Book the seats",
    commitDone: "Screening scheduled",
    commitDoneBody: "Everyone who was ready has a seat. Anyone who was not is listed with the reason.",
    reviewNote: "An applicant must have been reviewed and have their application fee cleared before a seat can be held — the workflow will not skip that.",
    fields: [
      choice("Schedule for", ["One applicant", "Everyone without a date", "A selected group"], { span: 2, value: pre ? "One applicant" : "One applicant" }),
      when(picker("Applicants", applicants.map((a) => ({ value: a.id, label: a.name, sub: `${a.ref} · ${a.forClass}` })), { checked: pre ? [pre] : [], placeholder: "Search by name or reference", noun: "applicant", nounPlural: "applicants" }), { field: "Schedule for", excludes: "Everyone without a date" }),
      select("Session", [...labels, NEW], { required: true, span: 2 }),
      when(text("New session date", { type: "date" }), { field: "Session", equals: NEW }),
      when(text("Start time", { value: "09:00" }), { field: "Session", equals: NEW }),
      when(text("Venue", { value: "Main hall" }), { field: "Session", equals: NEW }),
      select("Assessment type", ["Written entrance assessment", "Interview only", "Written assessment and interview", "Readiness observation"], { required: true }),
      select("Invigilator", o.staff.length ? o.staff : ["To be named"], { required: true }),
    ],
    submit: {
      endpoint: `${SR}/admissions/schedule`,
      method: "POST",
      map: { "Schedule for": "who", Applicants: "applicants", Session: "session", "New session date": "date", "Start time": "start", Venue: "venue", "Assessment type": "type", Invigilator: "invigilator" },
      encode: { Session: Object.fromEntries([...o.sessions.map((s, i) => [labels[i], s.id]), [NEW, NEW]]) },
    },
  };
}

export function addSessionDrawer(o: AdmissionOptions): DrawerSpec {
  return {
    mode: "form",
    kicker: "Admissions",
    title: "Schedule a session",
    sub: "Sessions this school has scheduled, and how full each one is.",
    commitLabel: "Put it in the diary",
    commitDone: "Session scheduled",
    commitDoneBody: "It is in the diary. Booking a seat sends the family the date, the time and where to go.",
    fields: [
      text("Date", { type: "date", required: true }),
      text("Start time", { value: "09:00", required: true }),
      text("End time", { value: "11:00" }),
      select("For", ["All classes", ...o.levels], { required: true }),
      text("Seats", { value: "30", required: true }),
      select("Invigilator", o.staff.length ? o.staff : ["To be named"]),
      text("Venue", { value: "Main hall" }),
      select("Assessment type", ["Written entrance assessment", "Interview only", "Written assessment and interview", "Readiness observation"]),
    ],
    submit: { endpoint: `${SR}/admissions/sessions`, method: "POST", map: { Date: "date", "Start time": "start", "End time": "end", For: "forLabel", Seats: "seats", Invigilator: "invigilator", Venue: "venue", "Assessment type": "type" } },
  };
}

/** The next real step the workflow wants for this application, with only the questions that step asks. */
export function advanceDrawer(a: Applicant, arms: Array<{ name: string }>): DrawerSpec | null {
  if (!a.next) return null;
  const base = { mode: "form" as const, kicker: `${a.name} · ${a.ref}`, title: a.next.label, commitDone: "Application moved on", commitDoneBody: "The family has been told what happens next.", reviewNote: "A stage cannot be skipped. Each step is recorded with your name." };
  const post = (map: Record<string, string>, encode?: Record<string, Record<string, string>>) => ({ endpoint: `${SR}/admissions/${a.id}/advance`, method: "POST" as const, body: { step: a.next?.step }, map, encode });
  switch (a.next.step) {
    case "submit":
      return { ...base, sub: "This sends the application form and puts them at Applied.", commitLabel: "Send the form", fields: [fixed("What happens", "The application moves from Enquiry to Applied", { span: 2 })], submit: post({}) };
    case "review":
      return { ...base, sub: "Say what you found. Whoever opens the application next reads exactly this.", commitLabel: "Record the review", fields: [area("Review notes", { span: 2, required: true, placeholder: "Documents seen, anything missing, any concern." })], submit: post({ "Review notes": "note" }) };
    case "fee":
      return { ...base, sub: "An application whose fee is neither verified nor waived has not really entered the pipeline.", commitLabel: "Record the fee", fields: [choice("The application fee", ["Verified", "Waived"], { span: 2, value: "Verified" }), text("Amount paid", { unit: "₦", value: "0" }), text("Reference", { placeholder: "Bank or teller reference" }), area("Note", { span: 2, optional: true })], submit: post({ "The application fee": "waived", "Amount paid": "amount", Reference: "reference", Note: "note" }, { "The application fee": { Verified: "false", Waived: "true" } }) };
    case "schedule":
      return { ...base, sub: "Book the entrance assessment. The family is told the date and where to go.", commitLabel: "Book the seat", fields: [text("Date", { type: "date", required: true }), text("Start time", { value: "09:00", required: true }), text("Venue", { value: "Main hall" }), area("Note", { span: 2, optional: true })], submit: post({ Date: "date", "Start time": "time", Venue: "venue", Note: "note" }) };
    case "result":
      return { ...base, sub: "What they scored, and what the assessor makes of it.", commitLabel: "Record the result", fields: [text("Score out of 100", { required: true }), select("Result", ["PASS", "BORDERLINE", "FAIL"], { required: true }), text("Recommendation", { span: 2, placeholder: "Offer a place in JSS 1" }), area("Remarks", { span: 2, required: true })], submit: post({ "Score out of 100": "score", Result: "result", Recommendation: "recommendation", Remarks: "note" }) };
    case "recommend":
      return { ...base, sub: "Put the screening result forward for a decision.", commitLabel: "Recommend it", fields: [area("Why", { span: 2, required: true })], submit: post({ Why: "note" }) };
    case "decide":
      return { ...base, sub: "The decision is the principal's, and is recorded with the reason.", commitLabel: "Record the decision", fields: [choice("Decision", ["Approve", "Approve with conditions", "Decline", "Waitlist"], { span: 2, value: "Approve" }), area("Notes", { span: 2, required: true }), text("Conditions", { span: 2, optional: true })], submit: post({ Decision: "decision", Notes: "note", Conditions: "conditions" }, { Decision: { Approve: "APPROVED", "Approve with conditions": "CONDITIONALLY_APPROVED", Decline: "REJECTED", Waitlist: "WAITLISTED" } }) };
    case "offer":
      return { ...base, sub: "The offer letter is issued and the family is told.", commitLabel: "Issue the offer", fields: [text("Valid for", { unit: "days", value: "14" }), area("Conditions", { span: 2, optional: true })], submit: post({ "Valid for": "expiryDays", Conditions: "conditions" }) };
    case "accept":
      return { ...base, sub: "Record the family's answer to the offer.", commitLabel: "Record the answer", fields: [choice("The family has", ["Accepted", "Declined"], { span: 2, value: "Accepted" }), area("Note", { span: 2, optional: true })], submit: post({ "The family has": "answer", Note: "note" }, { "The family has": { Accepted: "accept", Declined: "decline" } }) };
    case "clear":
      return { ...base, sub: "Confirm the deposit before the child can be enrolled.", commitLabel: "Clear the deposit", fields: [choice("The deposit", ["Verified", "Waived"], { span: 2, value: "Verified" }), text("Amount", { unit: "₦", value: "0" }), text("Reference", { placeholder: "Bank or teller reference" }), area("Note", { span: 2, optional: true })], submit: post({ "The deposit": "waived", Amount: "amount", Reference: "reference", Note: "note" }, { "The deposit": { Verified: "false", Waived: "true" } }) };
    case "enrol":
      return { ...base, sub: "This creates the student record and the guardian, and puts the child in an arm.", commitLabel: "Convert to a student record", commitDone: "Student enrolled", commitDoneBody: "They are on the registry and in their arm. The application is closed as Enrolled.", fields: [select("Place them in", arms.map((arm) => arm.name), { required: true, span: 2 }), select("Guardian's relation", ["Mother", "Father", "Parent", "Guardian", "Sponsor"]), text("Admission number", { optional: true, hint: "Leave blank to generate the next one." })], submit: post({ "Place them in": "className", "Guardian's relation": "relation", "Admission number": "admission" }) };
    default:
      return null;
  }
}

export function declineDrawer(a: Pick<Applicant, "id" | "name" | "ref">): DrawerSpec {
  return {
    mode: "form",
    kicker: `${a.name} · ${a.ref}`,
    title: "Decline an application",
    sub: "A declined application is never deleted.",
    commitLabel: "Decline it",
    commitDone: "Application closed",
    commitDoneBody: "It is closed with the reason on the record, and appears in the cycle report.",
    reviewNote: "The reason stays on the record and appears in the cycle report.",
    fields: [
      choice("Declined by", ["The school", "The family"], { span: 2, value: "The school" }),
      select("Reason", ["Below the assessment threshold", "No places left in that class", "Age outside the range for that class", "Required documents never provided", "Family accepted elsewhere", "Family relocating", "Fees beyond the family's means", "Other — described below"], { required: true, span: 2 }),
      area("In their own words or yours", { span: 2, optional: true }),
      toggle("Offer a place on the waitlist", false, "Waitlisted · contacted if a place opens", "Closed", { span: 2 }),
      toggle("Send the letter", true, "A courteous decline letter", "No letter", { span: 2 }),
    ],
    submit: { endpoint: `${SR}/admissions/${a.id}/decline`, method: "POST", map: { "Declined by": "by", Reason: "reason", "In their own words or yours": "words", "Offer a place on the waitlist": "waitlist", "Send the letter": "letter" } },
  };
}

export function bulkOfferDrawer(): DrawerSpec {
  return {
    mode: "form",
    kicker: "Admissions",
    title: "Issue offer letters",
    sub: "An offer can only be issued once an application is approved.",
    commitLabel: "Issue the offers",
    commitDone: "Offers issued",
    commitDoneBody: "Everyone who was approved has an offer. Anyone who was not is listed with where they are.",
    reviewNote: "The workflow decides who is ready; this never skips a stage.",
    fields: [text("Valid for", { unit: "days", value: "14" }), area("Conditions", { span: 2, optional: true })],
    submit: { endpoint: `${SR}/admissions/bulk`, method: "POST", body: { action: "offer" }, map: { "Valid for": "expiryDays", Conditions: "conditions" } },
  };
}

export function bulkDeclineDrawer(): DrawerSpec {
  return {
    mode: "form",
    kicker: "Admissions",
    title: "Decline with a reason",
    sub: "A declined application is never deleted.",
    commitLabel: "Decline them",
    commitDone: "Applications closed",
    commitDoneBody: "Each carries the reason, and appears in the cycle report.",
    fields: [
      choice("Declined by", ["The school", "The family"], { span: 2, value: "The school" }),
      select("Reason", ["Below the assessment threshold", "No places left in that class", "Age outside the range for that class", "Required documents never provided", "Family accepted elsewhere", "Family relocating", "Other — described below"], { required: true, span: 2 }),
      area("In their own words or yours", { span: 2, optional: true }),
    ],
    submit: { endpoint: `${SR}/admissions/bulk`, method: "POST", body: { action: "decline" }, map: { "Declined by": "by", Reason: "reason", "In their own words or yours": "words" } },
  };
}

export function reopenDrawer(a: Pick<Applicant, "id" | "name" | "ref">): DrawerSpec {
  return {
    mode: "form",
    kicker: `${a.name} · ${a.ref}`,
    title: "Reopen an application",
    sub: "Reopening restores the application to a stage it had reached.",
    commitLabel: "Reopen it",
    commitDone: "Application reopened",
    commitDoneBody: "It is back in the pipeline at the stage you chose.",
    fields: [select("Reopen at", ["Enquiry", "Applied", "Assessed", "Offered"], { required: true, span: 2 }), area("Why it is being reopened", { required: true, span: 2 })],
    submit: { endpoint: `${SR}/admissions/${a.id}/reopen`, method: "POST", map: { "Reopen at": "at", "Why it is being reopened": "reason" } },
  };
}

export function applicantContactDrawer(a: Applicant): DrawerSpec {
  return {
    mode: "form",
    kicker: `${a.name} · ${a.ref}`,
    title: "Edit applicant contact",
    sub: "This is the contact everything about the application goes to, and it becomes the guardian record on conversion.",
    commitLabel: "Save the contact",
    commitDone: "Contact updated",
    commitDoneBody: "Everything about this application now goes to the new details.",
    fields: [
      text("Guardian full name", { required: true, span: 2, value: a.guardian.name }),
      text("Mobile number", { required: true, value: a.guardian.phone }),
      text("Email", { optional: true, value: a.guardian.email ?? "" }),
      text("Second contact name", { optional: true, value: a.guardian.secondName ?? "" }),
      text("Second contact number", { optional: true, value: a.guardian.secondPhone ?? "" }),
      area("Home address", { span: 2, optional: true, value: a.guardian.address ?? "" }),
    ],
    submit: { endpoint: `${SR}/admissions/${a.id}/contact`, method: "POST", map: { "Guardian full name": "name", "Mobile number": "phone", Email: "email", "Second contact name": "secondName", "Second contact number": "secondPhone", "Home address": "address" } },
  };
}

export function requestDocumentsDrawer(a: Pick<Applicant, "id" | "name" | "ref" | "missingDocuments">): DrawerSpec {
  return {
    mode: "form",
    kicker: `${a.name} · ${a.ref}`,
    title: "Request a document",
    sub: "The family is told exactly what is still owed.",
    commitLabel: "Send the request",
    commitDone: "Document requested",
    commitDoneBody: "The family has been asked, and the request is on the application.",
    fields: [
      checks("Documents needed", ["Birth certificate", "Passport photograph", "Previous school report", "Immunisation record", "Transfer certificate", "Proof of address"], a.missingDocuments.filter((label) => ["Birth certificate", "Passport photograph", "Previous school report", "Immunisation record", "Transfer certificate", "Proof of address"].includes(label)), { required: true, span: 2 }),
      select("Due by", ["In 3 days", "In 7 days", "Before the screening date", "Before the offer expires"], { value: "In 7 days", required: true }),
      area("Message to the family", { span: 2, optional: true }),
    ],
    submit: { endpoint: `${SR}/admissions/${a.id}/documents`, method: "POST", map: { "Documents needed": "documents", "Due by": "due", "Message to the family": "message" } },
  };
}

export const dayOf = dayLong;
