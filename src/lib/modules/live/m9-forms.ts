import { area, checks, choice, fixed, select, text, toggle } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import type { ConsentOverview, ConsentTypeRow, Families, Family, FamilyRow, GuardianOptions, SubmissionItem, SubmissionOptions } from "@/lib/modules/live/m9-types";
import type { DrawerSpec, FormField, PickerOption } from "@/lib/modules/panels";

/** Every modal in Parents & Guardians, as data. */

export const PG = "/api/v1/parents-guardians";

const RELATIONS = ["Mother", "Father", "Grandparent", "Aunt", "Uncle", "Sponsor", "Legal guardian", "Sibling over 18"];
const SEE = ["Results and report cards", "Attendance", "Fee amounts", "Announcements", "Disciplinary and guidance notes"];
const LANGUAGES = ["English", "French", "Arabic", "Swahili", "Portuguese", "Hausa", "Yoruba", "Igbo"];

const picker = (label: string, options: PickerOption[], o: Record<string, unknown> = {}) => ({ label, kind: "picker", options, checked: [], span: 2, ...o }) as FormField;

export const studentOptions = (students: GuardianOptions["students"]): PickerOption[] => students.map((student) => ({ value: student.id, label: student.name, sub: `${student.adm} · ${student.arm}`, group: student.arm.split(" ")[0] }));
export const guardianOptions = (guardians: Array<{ id: string; name: string; phone: string; children: number }>): PickerOption[] => guardians.map((guardian) => ({ value: guardian.id, label: guardian.name, sub: `${guardian.phone} · ${plural(guardian.children, "child", "children")}` }));

/* ───────────────────────── families ───────────────────────── */

export function addGuardianDrawer(o: GuardianOptions): DrawerSpec {
  return {
    mode: "form",
    kicker: "Parents & Guardians",
    title: "Add a guardian",
    sub: "One household, captured once, with the children mapped in the same breath.",
    commitLabel: "Create the guardian",
    commitDone: "Guardian created",
    commitDoneBody: "One account, one login. If you chose to send it, the activation link is queued to their phone and email.",
    reviewNote: "A guardian with four children still gets one account and one set of notifications. Map every child now so they never receive the same message twice.",
    page: {
      reviewDesc: "Everything you entered, and the consent that has to be recorded.",
      confirmBody: "One account is created, every child you chose is mapped to it, and the consent you ticked is recorded.",
      railTitle: "What adding a guardian sets up",
      rail: [["One account", "A single login for the whole household"], ["Every child mapped", "Siblings share it, so nobody is messaged twice"], ["A consent basis", "Without it nothing can be published to this family"]],
      footNote: "A family with one number has a single point of failure — add a second contact.",
      back: { label: "Back to guardians", href: "/parents-guardians/guardians" },
    },
    steps: [
      {
        title: "Guardian",
        hint: "Who they are and how to reach them.",
        fields: [
          fixed("One family, one account", "Map every child in this school to this one guardian", { span: 2, hint: "If this person already exists, link the child from the child's own record — that keeps one login." }),
          text("Full name", { required: true, span: 2, placeholder: "Mrs Ifeoma Adebayo" }),
          select("Relation to the children", RELATIONS, { required: true }),
          select("Contact order", ["Primary contact", "Secondary contact"], { required: true }),
          text("Mobile number", { required: true, placeholder: "08030000000", hint: "Their login, and the number every SMS and the activation link goes to." }),
          text("Email", { optional: true, placeholder: "name@example.com" }),
          text("Second contact name", { optional: true, hint: "A family with one number has a single point of failure." }),
          text("Second contact number", { optional: true }),
          area("Home address", { span: 2, optional: true }),
          text("Occupation", { optional: true }),
          select("Preferred language", LANGUAGES, { value: "English" }),
        ],
      },
      {
        title: "Children",
        hint: "Map every child now — siblings share this one account.",
        fields: [
          picker("Children in this school", studentOptions(o.students), { required: true, placeholder: "Search by name, admission number or arm", noun: "child", nounPlural: "children", groupAll: "All classes", hint: "Map every child now — siblings share this one account." }),
          checks("What they may see", SEE, ["Results and report cards", "Attendance", "Fee amounts", "Announcements"], { span: 2 }),
          toggle("Authorised to collect their children", true, "Yes · photograph required on file", "No", { span: 2 }),
        ],
      },
      {
        title: "Review",
        hint: "Everything you entered, and the consent that has to be recorded.",
        fields: [
          checks("Consent recorded now", o.consents, o.consents.slice(0, 1), { span: 2, hint: "Without core record processing nothing can be published to this family." }),
          toggle("Send the activation link now", true, "SMS and email · valid 7 days", "I will send it later", { span: 2 }),
        ],
      },
    ],
    submit: {
      endpoint: `${PG}/guardians`,
      method: "POST",
      map: { "Full name": "name", "Relation to the children": "relation", "Contact order": "order", "Mobile number": "phone", Email: "email", "Second contact name": "secondName", "Second contact number": "secondPhone", "Home address": "address", Occupation: "occupation", "Preferred language": "language", "Children in this school": "children", "What they may see": "see", "Consent recorded now": "consent", "Authorised to collect their children": "collect", "Send the activation link now": "invite" },
    },
  };
}

export function inviteDrawer(count: number, children: number, ids?: string[]): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Parents & Guardians",
    title: `Resend ${plural(count, "outstanding invite")}`,
    sub: "Every family that has never activated the portal gets a fresh link.",
    facts: [
      ["Families", String(count), "Each has never completed activation"],
      ["Children affected", String(children), "None of them can be reached digitally today"],
      ["Goes to", "Their phone and their email", "Both channels, one link"],
      ["Previous links", "Invalidated", "Only the newest link works"],
      ["Link validity", "7 days", "After that it expires and must be resent"],
      ["Cost", `${count} SMS credits`, "In-app and email cost nothing"],
      ["Families already active", "Skipped", "Nobody is invited twice"],
      ["Phone-only families", "Skipped", "Marked deliberately — never chased"],
    ],
    commitLabel: `Resend all ${count}`,
    commitDone: `${plural(count, "invite")} resent`,
    commitDoneBody: "Each family has a fresh link queued to their phone and their inbox.",
    submit: { endpoint: `${PG}/guardians/invite`, method: "POST", body: ids ? { families: ids } : undefined },
  };
}

export function editContactDrawer(f: Family): DrawerSpec {
  return {
    mode: "form",
    kicker: f.name,
    title: "Edit guardian contact",
    sub: "A wrong digit here silences a family completely.",
    commitLabel: "Save the contact",
    commitDone: "Contact updated",
    commitDoneBody: "Every future message uses the new details. Nothing already sent is changed.",
    reviewNote: "This is the number and address everything the school sends goes to.",
    fields: [
      text("Full name", { required: true, span: 2, value: f.name }),
      select("Relation", RELATIONS.includes(f.relation) ? RELATIONS : [f.relation, ...RELATIONS], { required: true, value: f.relation }),
      select("Contact order", ["Primary contact", "Secondary contact"], { required: true, value: "Primary contact" }),
      text("Mobile number", { required: true, value: f.phone, hint: "Their login and every SMS." }),
      text("Email", { optional: true, value: f.email ?? "" }),
      text("Second contact name", { optional: true, value: f.secondName ?? "" }),
      text("Second contact number", { optional: true, value: f.secondPhone ?? "" }),
      area("Home address", { span: 2, optional: true, value: f.address ?? "" }),
      text("Occupation", { optional: true, value: f.occupation ?? "" }),
      select("Preferred language", LANGUAGES, { value: f.language }),
      toggle("Send them a confirmation", true, "They are told what changed", "Silent update", { span: 2 }),
    ],
    submit: { endpoint: `${PG}/guardians/${f.id}/contact`, method: "POST", map: { "Full name": "name", Relation: "relation", "Contact order": "order", "Mobile number": "phone", Email: "email", "Second contact name": "secondName", "Second contact number": "secondPhone", "Home address": "address", Occupation: "occupation", "Preferred language": "language", "Send them a confirmation": "tell" } },
  };
}

export function mapChildDrawer(f: Pick<Family, "id" | "name" | "children">, students: GuardianOptions["students"]): DrawerSpec {
  const mapped = new Set(f.children.map((child) => child.id));
  return {
    mode: "form",
    kicker: f.name,
    title: "Map a child to this guardian",
    sub: "Mapping adds the child to an account that already exists.",
    commitLabel: "Map the child",
    commitDone: "Child mapped",
    commitDoneBody: "This child now appears on the guardian's account, and everything the school publishes about them reaches this family.",
    reviewNote: "Mapping never creates a second login for the same family.",
    fields: [
      picker("Child", studentOptions(students.filter((student) => !mapped.has(student.id))), { required: true, placeholder: "Search by name, admission number or arm", noun: "child", nounPlural: "children", groupAll: "All classes" }),
      select("Relation to this child", RELATIONS, { required: true }),
      select("Contact order for this child", ["Primary contact", "Secondary contact"], { value: "Primary contact", required: true }),
      checks("What they may see about this child", SEE, ["Results and report cards", "Attendance", "Fee amounts", "Announcements"], { span: 2 }),
      toggle("Authorised to collect this child", true, "Yes · photograph required on file", "No"),
      toggle("Tell the family", true, "They are told the child was added", "No notification"),
    ],
    submit: { endpoint: `${PG}/guardians/${f.id}/children`, method: "POST", map: { Child: "child", "Relation to this child": "relation", "Contact order for this child": "order", "What they may see about this child": "see", "Authorised to collect this child": "collect", "Tell the family": "tell" } },
  };
}

export function phoneOnlyDrawer(rows: Array<Pick<FamilyRow, "id" | "name" | "phone">>, pre?: Pick<FamilyRow, "id" | "name" | "phone">): DrawerSpec {
  return {
    mode: "form",
    kicker: "Parents & Guardians",
    title: pre ? `Mark ${pre.name} phone-only` : "Mark a family phone-only",
    sub: "A family without a smartphone is not a defect to be chased for ever.",
    commitLabel: "Mark them phone-only",
    commitDone: "Marked phone-only",
    commitDoneBody: "They are no longer counted as a failed activation, and every send to them goes by SMS or voice.",
    reviewNote: "Marking them phone-only says so deliberately, and stops them appearing as an unresolved problem.",
    fields: [
      fixed("What this changes", "They stop appearing in the activation backlog", { span: 2, hint: "Report cards are printed for collection instead of published to a portal." }),
      ...(pre ? [] : [picker("Which family", rows.map((row) => ({ value: row.id, label: row.name, sub: row.phone })), { required: true, placeholder: "Search by name or phone number", noun: "family", nounPlural: "families" })]),
      choice("Reason", ["No smartphone", "Poor connectivity where they live", "Prefers not to use the app", "Literacy support needed"], { span: 2, value: "No smartphone" }),
      select("Reach them by", ["SMS only", "SMS and a printed copy", "Voice call and a printed copy", "Printed copy only"], { value: "SMS and a printed copy", required: true, span: 2 }),
      text("Best number to call", { required: true, value: pre?.phone ?? "" }),
      select("Best time to call", ["Morning", "Afternoon", "Evening", "Any time"], { value: "Afternoon" }),
      toggle("Print their report cards automatically", true, "Printed with each publish run", "Print on request", { span: 2 }),
    ],
    submit: pre
      ? { endpoint: `${PG}/guardians/${pre.id}/phone-only`, method: "POST", map: { Reason: "reason", "Reach them by": "reach", "Best number to call": "best", "Best time to call": "time", "Print their report cards automatically": "print" } }
      : { endpoint: `${PG}/guardians/phone-only`, method: "POST", map: { "Which family": "family", Reason: "reason", "Reach them by": "reach", "Best number to call": "best", "Best time to call": "time", "Print their report cards automatically": "print" } },
  };
}

export function mergeDrawer(rows: Array<Pick<FamilyRow, "id" | "name" | "phone" | "children">>, pre?: string[]): DrawerSpec {
  const options: PickerOption[] = rows.map((row) => ({ value: row.id, label: row.name, sub: `${row.phone} · ${plural(row.children.length, "child", "children")}` }));
  return {
    mode: "form",
    kicker: "Parents & Guardians",
    title: "Merge two guardians",
    sub: "Two records that are one family, typed twice.",
    commitLabel: "Merge the records",
    commitDone: "Guardians merged",
    commitDoneBody: "One account now holds every child, and the duplicate is closed with a pointer to the survivor.",
    reviewNote: "A merge closes the duplicate record — nothing is ever deleted, and the closed record points to the survivor.",
    fields: [
      picker("Record to keep", options, { required: true, checked: pre?.[0] ? [pre[0]] : [], placeholder: "Search by name or phone number", hint: "This account survives, with its login and its history.", noun: "family", nounPlural: "families" }),
      picker("Record to merge into it", options, { required: true, checked: pre?.[1] ? [pre[1]] : [], placeholder: "Search by name or phone number", hint: "Its children move across; the account itself is closed.", noun: "family", nounPlural: "families" }),
      choice("If the two disagree, keep", ["The surviving record's details", "The merged record's details"], { span: 2, value: "The surviving record's details" }),
      fixed("What moves across", "Children, consent, messages, submissions and fee conversations", { span: 2, hint: "Nothing is lost — both histories end up on the surviving account." }),
      area("Why these are the same family", { span: 2, required: true }),
      toggle("Tell the family", false, "They are told their records were combined", "Silent merge", { span: 2 }),
    ],
    submit: { endpoint: `${PG}/guardians/merge`, method: "POST", map: { "Record to keep": "keep", "Record to merge into it": "merge", "If the two disagree, keep": "prefer", "Why these are the same family": "reason", "Tell the family": "tell" } },
  };
}

export function duplicateReviewDrawer(item: Families["duplicates"][number], rows: FamilyRow[]): DrawerSpec {
  const members = rows.filter((row) => item.ids.includes(row.id));
  return {
    mode: "view",
    kicker: "Parents & Guardians · duplicates",
    title: item.label,
    sub: item.sub,
    tone: item.same ? "attention" : "neutral",
    facts: members.slice(0, 10).map((row) => [row.name, `${row.phone} · ${plural(row.children.length, "child", "children")}`, row.children.map((child) => `${child.name.split(" ")[0]} · ${child.arm}`).join(", ")] as [string, string, string]),
    readOnly: true,
    readOnlyNote: item.same ? "Same name on every record — almost certainly one family typed more than once. Merge them two at a time." : "Different names on a shared number — likely two genuine records, not a duplicate.",
  };
}

/* ───────────────────────── consent ───────────────────────── */

export function consentTypeDrawer(type?: ConsentTypeRow): DrawerSpec {
  const isNew = !type;
  return {
    mode: "form",
    kicker: "Consent",
    title: isNew ? "Define a consent type" : `Edit · ${type.name}`,
    sub: "What it covers, who must give it, and what a gap blocks.",
    commitLabel: isNew ? "Add this consent type" : "Save it",
    commitDone: isNew ? "Consent type added" : "Consent type saved",
    commitDoneBody: "It is on the register from now on, and families with a gap are chased for it.",
    reviewNote: "A new type starts with nobody having given it — chase it once, not family by family.",
    fields: [
      text("Name", { required: true, span: 2, value: type?.name ?? "", placeholder: "Educational trips and excursions" }),
      text("Short label", { value: type?.short ?? "", placeholder: "Trips", hint: "Used as the column head on the register." }),
      select("Who must give it", ["Every guardian", "Exam candidates", "Boarders only", "New enrolments only", "Where it applies"], { required: true, value: type?.who ?? "Every guardian" }),
      choice("Standing", ["Required", "Optional"], { span: 2, required: true, value: type && !type.required ? "Optional" : "Required", hint: "Required types are chased until they are given." }),
      text("What it covers", { required: true, span: 2, value: type?.covers ?? "", placeholder: "Day trips, inter-school fixtures and transport" }),
      text("What a gap blocks", { required: true, span: 2, value: type?.blocks ?? "", placeholder: "The child cannot be listed on a trip" }),
      ...(isNew ? [toggle("Ask existing families for it now", true, "A request goes out when you save", "Only new families are asked", { span: 2 })] : []),
    ],
    submit: {
      endpoint: isNew ? `${PG}/consent/types` : `${PG}/consent/types/${encodeURIComponent(type.code)}`,
      method: isNew ? "POST" : "PUT",
      map: { Name: "name", "Short label": "short", "Who must give it": "who", Standing: "standing", "What it covers": "covers", "What a gap blocks": "blocks", "Ask existing families for it now": "askNow" },
    },
    ...(isNew ? {} : { remove: { endpoint: `${PG}/consent/types/${encodeURIComponent(type.code)}`, noun: "consent type", warn: "Every family's answer to it is kept, but it stops being counted or chased.", done: "Consent type removed", doneBody: "It is off the register." } }),
  };
}

export function familyConsentDrawer(f: Pick<FamilyRow, "id" | "name" | "relation" | "phone" | "children" | "consents">, types: ConsentTypeRow[]): DrawerSpec {
  const OPTIONS = ["Given · in the portal", "Given · in person", "Given · on paper", "Not given", "Withdrawn"];
  const missing = types.filter((type) => f.consents[type.code] !== "GIVEN");
  return {
    mode: "form",
    kicker: `${f.relation} · ${f.phone}`,
    title: `Consent · ${f.name}`,
    sub: missing.length ? `${missing.length} of ${types.length} still missing.` : "Everything on file.",
    commitLabel: "Save the consent record",
    commitDone: "Consent updated",
    commitDoneBody: "The record shows who changed it, when and by what means.",
    reviewNote: "Recorded against the family, not the child — one answer covers every child they have here.",
    fields: [
      fixed("Children", f.children.map((child) => `${child.name.split(" ")[0]} · ${child.arm}`).join("  ·  "), { span: 2, hint: "One guardian answers once, however many children." }),
      ...types.map((type) => select(type.name, OPTIONS, { required: type.required, value: f.consents[type.code] === "GIVEN" ? "Given · in person" : f.consents[type.code] === "WITHDRAWN" ? "Withdrawn" : "Not given", hint: f.consents[type.code] === "GIVEN" ? "" : type.blocks })),
      text("Date recorded", { type: "date", span: 2, value: new Date().toISOString().slice(0, 10) }),
      toggle("Tell this family in the app", missing.length > 0, "They are told what changed, and asked for anything still missing", "No notification", { span: 2 }),
      area("Note", { span: 2, optional: true, placeholder: "Who handed it in, and how." }),
    ],
    submit: { endpoint: `${PG}/consent/families/${f.id}`, method: "POST", nest: Object.fromEntries(types.map((type) => [type.name, ["answers", type.name] as [string, string]])), map: { "Date recorded": "date", "Tell this family in the app": "tell", Note: "note" } },
  };
}

export function requestConsentDrawer(data: Pick<ConsentOverview, "types" | "totals">): DrawerSpec {
  const labels = data.types.map((type) => `${type.name} · ${type.gaps} missing`);
  const asking = data.types.filter((type) => type.gaps).map((type) => `${type.name} · ${type.gaps} missing`);
  return {
    mode: "form",
    kicker: "Parents & Guardians · consent",
    title: "Request the missing consent",
    sub: "Nobody is asked for consent they have already given.",
    commitLabel: `Send ${data.totals.gaps} requests`,
    commitDone: "Consent requests sent",
    commitDoneBody: "Each family was asked only for what they are actually missing.",
    reviewNote: "Nobody who has deliberately withdrawn a consent is asked for it again unless you include withdrawals.",
    fields: [
      fixed("Who is asked", `${data.totals.gaps} families with at least one gap`, { span: 2, hint: `${data.totals.complete} families are complete and are skipped entirely.` }),
      checks("Ask for", labels, asking, { span: 2, required: true }),
      choice("Ask each family for", ["Only what they are missing", "Everything, so the record is clean"], { span: 2, value: "Only what they are missing", hint: "Asking a family again for something they already gave is how a school teaches them to ignore it." }),
      checks("Channels", ["In-app · free", "SMS with a consent link · 1 credit each", "Email · free", "Printed form for collection"], ["In-app · free", "SMS with a consent link · 1 credit each"], { span: 2, required: true }),
      choice("Families who have never activated the portal", ["Send a printed form", "SMS only", "Skip them for now"], { span: 2, value: "Send a printed form", hint: "An in-app consent request to a family with no portal reaches nobody." }),
      area("Message", { span: 2, value: "Dear parent, the school needs your consent on a small number of items so we can hold and publish your child's records correctly. Please open the link to review and respond." }),
      fixed("Cost", `${data.totals.gaps} SMS credits at most`, { hint: "In-app, email and print cost nothing." }),
      select("Remind those who do not reply", ["No reminder", "After 3 days", "After 7 days", "After 14 days"], { value: "After 7 days" }),
      toggle("Withdrawn consents", false, "Included · they are asked to reconsider", "Excluded · a withdrawal is respected", { span: 2 }),
    ],
    submit: { endpoint: `${PG}/consent/request`, method: "POST", map: { "Ask for": "ask", "Ask each family for": "mode", Channels: "channels", "Families who have never activated the portal": "noPortal", Message: "message", "Remind those who do not reply": "remind", "Withdrawn consents": "withdrawn" } },
  };
}

/* ───────────────────────── submissions ───────────────────────── */

export function logSubmissionDrawer(o: SubmissionOptions): DrawerSpec {
  return {
    mode: "form",
    kicker: "Submissions",
    title: "Log a submission",
    sub: "Something a family told you in person or by phone, so it has an owner and a clock like any other.",
    commitLabel: "Log it",
    commitDone: "Submission logged",
    commitDoneBody: "It has an owner and a service level. The family is not told until it is resolved.",
    reviewNote: "Which submissions this school accepts is set in School Configuration · Policies.",
    fields: [
      picker("Family", o.guardians.map((guardian) => ({ value: guardian.id, label: guardian.name, sub: `${guardian.phone} · ${plural(guardian.children.length, "child", "children")}` })), { required: true, placeholder: "Search by guardian name or phone number", noun: "family", nounPlural: "families" }),
      select("Type", o.types, { required: true }),
      select("Received by", ["In person", "By phone", "On paper", "In the portal"], { value: "In person" }),
      area("What the family said", { span: 2, required: true, placeholder: "As close to their own words as you can." }),
    ],
    submit: { endpoint: `${PG}/submissions`, method: "POST", map: { Family: "guardian", Type: "type", "Received by": "channel", "What the family said": "detail" } },
  };
}

export function resolveDrawer(item: SubmissionItem): DrawerSpec {
  return {
    mode: "form",
    kicker: `${item.type} · ${item.family}`,
    title: item.open ? "Resolve the submission" : "The submission",
    sub: item.child ? `About ${item.child}` : "About the family",
    facts: [
      ["Type", item.type],
      ["From", item.family, item.child ?? ""],
      ["What they wrote", item.detail],
      ["Owner", item.owner, item.ownerRole],
      ["Age", item.age],
      ["State", item.state],
      ...(item.outcome ? ([["Outcome", item.outcome]] as Array<[string, string]>) : []),
    ],
    ...(item.open
      ? {
          commitLabel: "Record the outcome",
          commitDone: "Submission closed",
          commitDoneBody: "It is closed with its outcome, and the family has been told.",
          reviewNote: "An item cannot be closed without an outcome recorded.",
          fields: [choice("Decision", ["Resolved", "Declined", "In progress"], { span: 2, value: "Resolved" }), area("Outcome", { span: 2, required: true, placeholder: "What was done, or why it was declined." }), toggle("Tell the family", true, "They are told the outcome", "No notification", { span: 2 })],
          submit: { endpoint: `${PG}/submissions/${item.id}/resolve`, method: "POST", map: { Decision: "decision", Outcome: "outcome", "Tell the family": "tell" } },
        }
      : { readOnly: true, readOnlyNote: "A closed submission is a record." }),
  };
}

export function viewDrawer(kicker: string, title: string, sub: string, facts: Array<[string, string, string?]>, note?: string): DrawerSpec {
  return { mode: "view", kicker, title, sub, facts, readOnly: true, readOnlyNote: note };
}
