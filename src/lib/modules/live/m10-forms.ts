import { area, checks, choice, fixed, pair, select, text, toggle, withCurrent } from "@/lib/modules/live/m7-forms";
import type {
  CashUpRow,
  Collections,
  FamilyDetail,
  FamilyRow,
  PublishPreview,
  Review,
  RuleRow,
  StructureDetail,
  StructureRow,
  Structures,
} from "@/lib/modules/live/m10-types";
import type { DrawerSpec, FormField, PickerOption } from "@/lib/modules/panels";

/** Every modal in Fee Management, as data. */

export const FEES = "/api/v1/fee-management";

export const naira = (value: number | null | undefined): string => (value === null || value === undefined ? "—" : `₦${Math.round(value).toLocaleString("en-NG")}`);
export const nairaShort = (value: number): string => (Math.abs(value) >= 1_000_000 ? `₦${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : naira(value));

const MODES = ["Bank transfer", "Cash at the bursary", "POS card", "Online card", "USSD transfer", "Mobile money", "Cheque", "Bank draft", "Direct debit"];
const APPROVERS = ["The Proprietor", "The Principal", "The Bursar"];
const KINDS = ["Day", "Boarding supplement", "Concession", "Transport", "One-off"];

/* ───────────────────────── recording money ───────────────────────── */

export function recordPaymentDrawer(data: Collections, pre?: { studentId?: string }): DrawerSpec {
  const options: PickerOption[] = data.payers.map((payer) => ({ value: payer.id, label: payer.name, sub: `${payer.arm} · owes ${naira(payer.owing)} of ${naira(payer.billed)}`, group: payer.arm.split(" ")[0] }));
  return {
    mode: "form",
    kicker: "Collections",
    title: "Record a payment",
    sub: "Who paid, how much, and how. The receipt is ready on save.",
    commitLabel: "Record the payment",
    commitDone: "Payment recorded",
    commitDoneBody: "The receipt is issued, the balance is restated, and the family can see both.",
    reviewNote: "Nothing is written until you confirm. A recorded payment carries its method, its reference and your name permanently, and is reversed — never edited.",
    fields: [
      { label: "Who is paying for", kind: "picker", required: true, span: 2, options, checked: pre?.studentId ? [pre.studentId] : [], placeholder: "Search by name, class or admission number", groupAll: "All classes", noun: "student", nounPlural: "students", hint: "Only students with something outstanding are offered. Their balance is beside their name." } as FormField,
      choice("Paying", ["In full", "Part payment"], { span: 2, required: true, value: "Part payment", hint: "In full must equal what is owed; a part payment leaves a balance on the account." }),
      text("Amount received", { required: true, unit: "₦", placeholder: "150000" }),
      text("Date received", { type: "date", value: new Date().toISOString().slice(0, 10), required: true }),
      select("Payment mode", MODES, { required: true, hint: "Cash and cheque are the two that need a second pair of eyes at cash-up." }),
      text("Bank or channel", { optional: true, placeholder: "GTBank · 0123456789" }),
      text("Reference or teller number", { required: true, placeholder: "GTB/2609/884120", hint: "Checked against every reference already recorded — what the family will quote if they ever dispute this." }),
      text("Payer", { optional: true, hint: "Who handed the money over, if not the guardian on record." }),
      select("Apply to", ["This child only", "Every child in this family", "A specific fee item"], { required: true, span: 2, hint: "A family with several children pays once — apply it across them, oldest balance first." }),
      { ...text("Fee item", { placeholder: "Tuition", span: 2, hint: "The invoice that carries this item is paid first." }), when: { field: "Apply to", equals: "A specific fee item" } } as FormField,
      fixed("Received by", "You — recorded under your name", { hint: "Shown on the receipt and in the audit log." }),
      fixed("Receipt", `${data.receiptPrefix} · next in sequence`, { span: 2, hint: "Sequential and final. A receipt is never edited; a reprint is stamped DUPLICATE." }),
      toggle("Issue the receipt now", true, "Receipt issued and sent to the family", "Record only — issue later", { span: 2 }),
      checks("Send the receipt by", ["In-app", "SMS", "Email", "Print for collection"], ["In-app", "SMS"], { span: 2 }),
      area("Note on the receipt", { span: 2, optional: true, placeholder: "Anything the parent should see printed on their receipt." }),
    ],
    submit: {
      endpoint: `${FEES}/payments`,
      method: "POST",
      map: {
        "Who is paying for": "student",
        Paying: "paying",
        "Amount received": "amount",
        "Date received": "date",
        "Payment mode": "mode",
        "Bank or channel": "channel",
        "Reference or teller number": "reference",
        Payer: "payer",
        "Apply to": "applyTo",
        "Fee item": "item",
        "Issue the receipt now": "issueReceipt",
        "Send the receipt by": "sendBy",
        "Note on the receipt": "note",
      },
    },
  };
}

export function remindersDrawer(o: { count: number; amount: number; selection?: boolean }): DrawerSpec {
  return {
    mode: "form",
    kicker: "Collections",
    title: o.selection ? "Send a reminder" : `Send ${o.count} fee ${o.count === 1 ? "reminder" : "reminders"}`,
    commitLabel: o.selection ? "Send the reminders" : `Send ${o.count} ${o.count === 1 ? "reminder" : "reminders"}`,
    commitDone: "Reminders sent",
    commitDoneBody: "Each family was told their own balance — never anybody else’s.",
    reviewNote: "A reminder states one family’s balance and nothing about any other family. Families past 90 days get a meeting request instead of a third reminder.",
    fields: [
      fixed("Who is reminded", o.selection ? "The families you ticked" : `${o.count} ${o.count === 1 ? "family" : "families"} · ${naira(o.amount)} outstanding`, { span: 2, hint: "Families who have settled, and families on a payment plan, are skipped entirely." }),
      choice("Send to", ["Everyone who owes", "Only past 30 days", "Only past 60 days", "Only past 90 days"], { span: 2, value: "Everyone who owes" }),
      choice("Families past 90 days", ["Request a meeting instead", "Send the same reminder", "Skip them — handle in person"], { span: 2, value: "Request a meeting instead", hint: "A third SMS to a family that has ignored two is not a collection strategy." }),
      checks("Channels", ["In-app · free", "SMS · 1 credit each", "Email · free"], ["In-app · free", "SMS · 1 credit each"], { span: 2, required: true }),
      checks("Include", ["The amount outstanding", "A breakdown by child", "How to pay", "The bank account details", "A payment-plan offer"], ["The amount outstanding", "How to pay"], { span: 2 }),
      area("Message", { span: 2, required: true, value: "Dear parent, our records show an outstanding balance on your account. Please settle it at your earliest convenience, or contact the bursary to agree a payment plan." }),
      select("Remind again if unpaid", ["No follow-up", "After 7 days", "After 14 days", "After 30 days"], { value: "After 14 days" }),
      toggle("Families with no portal and no phone", true, "A printed letter is listed for collection", "Skipped", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/reminders`,
      method: "POST",
      map: { "Send to": "scope", "Families past 90 days": "pastNinety", Channels: "channels", Include: "include", Message: "message", "Remind again if unpaid": "followUp", "Families with no portal and no phone": "printed" },
    },
  };
}

export function meetingDrawer(o: { family?: FamilyRow; selection?: boolean }): DrawerSpec {
  return {
    mode: "form",
    kicker: o.family ? o.family.name : "Collections",
    title: "Request a fee meeting",
    commitLabel: "Request the meeting",
    commitDone: "Meeting requested",
    commitDoneBody: "The family has been invited. The balance stays exactly as it is until you meet.",
    reviewNote: "Requesting a meeting pauses automatic escalation so a family is not chased while they are waiting to be seen.",
    fields: [
      select("Meeting with", ["The Bursar", "The Principal", "The Proprietor", "Bursar and Principal together"], { required: true, span: 2 }),
      text("Proposed date", { type: "date", value: "", required: true }),
      text("Proposed time", { value: "10:00", required: true }),
      select("Where", ["At the school · bursary", "At the school · principal’s office", "By phone", "Video call"], { required: true }),
      select("Purpose", ["Agree a payment plan", "Understand the delay", "Discuss a waiver or concession", "Final notice before escalation"], { required: true, span: 2 }),
      area("Message to the family", { span: 2, placeholder: "Courteous. A family in difficulty reads this more carefully than anything else the school sends." }),
      toggle("Pause reminders until the meeting", true, "No reminder goes out while they wait", "Reminders continue", { span: 2 }),
      checks("Send by", ["In-app", "SMS", "Email"], ["In-app", "SMS"], { span: 2 }),
    ],
    submit: {
      endpoint: o.family ? `${FEES}/families/${o.family.id}/meeting` : `${FEES}/meetings`,
      method: "POST",
      map: { "Meeting with": "with", "Proposed date": "date", "Proposed time": "time", Where: "where", Purpose: "purpose", "Message to the family": "message", "Pause reminders until the meeting": "pause", "Send by": "sendBy" },
    },
  };
}

export function planDrawer(detail: FamilyDetail): DrawerSpec {
  const owing = detail.family.owing;
  return {
    mode: "form",
    kicker: detail.family.name,
    title: "Agree a payment plan",
    commitLabel: "Agree the plan",
    commitDone: "Payment plan agreed",
    commitDoneBody: "The family has the schedule, and each instalment appears on their account as it falls due.",
    reviewNote: "A plan replaces escalation: while a family keeps to it they are not chased, and the moment they miss an instalment you are told.",
    fields: [
      text("Total to spread", { required: true, unit: "₦", value: String(Math.round(owing)), hint: `The family owes ${naira(owing)}.` }),
      select("Number of instalments", ["2", "3", "4", "5", "6"], { value: "3", required: true, hint: "Your policy allows up to 3 within a term." }),
      select("First instalment due", ["Immediately", "In 7 days", "In 14 days", "On a date I choose"], { value: "In 7 days", required: true }),
      text("First due date", { type: "date", value: "", optional: true }),
      select("Then every", ["2 weeks", "Monthly", "At each half-term"], { value: "Monthly", required: true }),
      select("While the plan holds", ["Pause reminders entirely", "Send a courtesy note before each instalment"], { value: "Send a courtesy note before each instalment", span: 2 }),
      select("If an instalment is missed", ["Tell me immediately", "Send one reminder, then tell me", "Resume normal escalation"], { value: "Tell me immediately", required: true, span: 2 }),
      select("Approved by", APPROVERS, { required: true }),
      area("Reason and any conditions", { span: 2, required: true }),
      toggle("Send the schedule to the family", true, "They get every date and amount", "Agree verbally first", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/families/${detail.family.id}/plan`,
      method: "POST",
      map: { "Total to spread": "total", "Number of instalments": "count", "First instalment due": "first", "First due date": "firstDate", "Then every": "every", "While the plan holds": "while", "If an instalment is missed": "missed", "Approved by": "approvedBy", "Reason and any conditions": "reason", "Send the schedule to the family": "send" },
    },
  };
}

export function adjustDrawer(detail: FamilyDetail): DrawerSpec {
  return {
    mode: "form",
    kicker: detail.family.name,
    title: "Apply a fee adjustment",
    commitLabel: "Apply the adjustment",
    commitDone: "Adjustment recorded",
    commitDoneBody: "The invoice has been restated and the family has the new amount — unless it is above the bursary’s limit, in which case it waits for approval in Review.",
    reviewNote: `An adjustment changes what this family owes. It is logged with your name, the amount and the reason. The bursary may adjust up to ${naira(detail.policy.approvalLimit)}; above that the Proprietor or Principal decides.`,
    fields: [
      choice("Adjustment", ["Discount", "Waiver", "Scholarship", "Surcharge"], { span: 2, required: true }),
      select("Applies to", ["The whole invoice", "Tuition only", "A single fee item"], { required: true, value: "The whole invoice", hint: "Recorded on the adjustment; the amount comes off the family’s balance." }),
      text("Fee item", { optional: true, placeholder: "Tuition", hint: "Only used for a single item." }),
      choice("Amount is", ["A percentage", "A fixed amount"], { span: 2 }),
      text("Value", { required: true, placeholder: "10", unit: "% or ₦" }),
      select("For how long", ["This term only", "This session", "Until I remove it"], { value: "This term only", required: true }),
      area("Reason", { span: 2, required: true, placeholder: "Kept on the family’s record and on every fee report." }),
      toggle("Send the restated invoice", true, "The family gets the new amount", "No notification", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/families/${detail.family.id}/adjust`,
      method: "POST",
      map: { Adjustment: "adjustment", "Applies to": "appliesTo", "Fee item": "item", "Amount is": "valueIs", Value: "value", "For how long": "duration", Reason: "reason", "Send the restated invoice": "send" },
    },
  };
}

export function writeOffDrawer(detail: FamilyDetail): DrawerSpec {
  return {
    mode: "form",
    kicker: detail.family.name,
    title: "Write off a balance",
    commitLabel: "Write it off",
    commitDone: "Balance written off",
    commitDoneBody: "It is removed from the debtor list and recorded permanently against the family.",
    reviewNote: "A write-off is permanent and appears in the term’s financial report. It is the Proprietor’s decision alone.",
    fields: [
      choice("Write off", ["The whole balance", "Part of it"], { span: 2 }),
      text("Amount to write off", { required: true, unit: "₦", value: String(Math.round(detail.family.owing)), hint: `The family owes ${naira(detail.family.owing)}. Ignored when you choose the whole balance.` }),
      select("Reason", ["Hardship — verified", "Bereavement in the family", "Scholarship applied late", "Billing error by the school", "Student withdrew mid-term", "Uncollectable after 12 months", "Other — described below"], { required: true, span: 2 }),
      area("Evidence and reasoning", { span: 2, required: true, placeholder: "Shown in the term’s financial report and at every audit." }),
      fixed("Approver", detail.policy.writeOffBy.replace(/ only$/, ""), { hint: "A write-off cannot be approved by the person requesting it, whatever their role." }),
      toggle("Tell the family", false, "They are told the balance is cleared", "Internal only for now", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/families/${detail.family.id}/write-off`,
      method: "POST",
      map: { "Write off": "whole", "Amount to write off": "amount", Reason: "reason", "Evidence and reasoning": "evidence", "Tell the family": "tell" },
    },
  };
}

/* ───────────────────────── structures ───────────────────────── */

const ITEM_COLUMNS = [
  { key: "name", label: "Fee item", w: "1.7fr", placeholder: "Science laboratory" },
  { key: "type", label: "Type", kind: "select" as const, w: "1fr", options: ["Mandatory", "Optional", "Concession"] },
  { key: "freq", label: "Frequency", kind: "select" as const, w: "1fr", options: ["Termly", "Sessional", "Once"] },
  { key: "amt", label: "Amount ₦", w: "0.9fr", num: true, placeholder: "0" },
];

const USUAL = [
  { name: "Tuition", type: "Mandatory", freq: "Termly", amt: "" },
  { name: "Examination fee", type: "Mandatory", freq: "Termly", amt: "" },
  { name: "Books and materials", type: "Mandatory", freq: "Sessional", amt: "" },
  { name: "Laboratory levy", type: "Mandatory", freq: "Termly", amt: "" },
  { name: "Development levy", type: "Mandatory", freq: "Sessional", amt: "" },
];

export function createStructureDrawer(data: Structures, terms: string[]): DrawerSpec {
  return {
    mode: "form",
    kicker: "Structures",
    title: "Create a fee structure",
    commitLabel: "Create the structure",
    commitDone: "Structure created",
    commitDoneBody: "It is a draft. Nothing is billed until you publish it.",
    reviewNote: "A structure charges a group of classes. Creating one never bills anybody — publishing does.",
    fields: [
      text("Structure name", { required: true, span: 2, placeholder: "Junior Secondary · day" }),
      text("Reference", { optional: true, placeholder: "FS-JS-D", hint: "Quoted on every invoice generated from it. Left blank, one is made." }),
      select("Kind", KINDS, { required: true, value: "Day", hint: "A class sits on one structure of each kind: a day structure and a boarding supplement can share a class." }),
      checks("Classes mapped to it", data.levels.map((level) => level.name), [], { required: true, span: 2, hint: "A class can only sit on one structure of this kind at a time — mapping it here removes it from wherever it is now." }),
      {
        label: "Fee items",
        kind: "lines",
        span: 2,
        cols: ITEM_COLUMNS,
        rows: USUAL.slice(0, 3),
        blank: { name: "", type: "Mandatory", freq: "Termly", amt: "" },
        addLabel: "Add a fee item",
        presets: [
          { label: "The usual five", rows: USUAL },
          { label: "Boarding supplement", rows: [{ name: "Boarding and feeding", type: "Mandatory", freq: "Termly", amt: "" }, { name: "Bedding and linen", type: "Mandatory", freq: "Sessional", amt: "" }, { name: "Laundry", type: "Optional", freq: "Termly", amt: "" }] },
          { label: "Start empty", rows: [] },
        ],
        hint: "Edit any line, remove one, or add your own. Nothing here is capped at the items we imagined. Fill in every amount.",
      } as FormField,
      select("Applies from", terms.length ? terms : ["The current term"], { required: true, span: 2 }),
      toggle("Create it as a draft", true, "Draft · nothing is billed", "Publish immediately", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/structures`,
      method: "POST",
      map: { "Structure name": "name", Reference: "ref", Kind: "kind", "Classes mapped to it": "classes", "Fee items": "items", "Applies from": "from", "Create it as a draft": "draft" },
    },
  };
}

export function duplicateDrawer(data: Structures, terms: string[], from?: Pick<StructureRow, "name" | "ref">): DrawerSpec {
  const names = data.structures.map((row) => `${row.name} · ${row.ref}`);
  return {
    mode: "form",
    kicker: "Structures",
    title: "Duplicate a fee structure",
    commitLabel: "Duplicate it",
    commitDone: "Structure duplicated",
    commitDoneBody: "The copy is a draft with the same items. Map its classes when you publish it, so the original is never left unbilled.",
    reviewNote: "Duplicating is how next session’s fees are built — copy, raise, review, then publish.",
    fields: [
      select("Structure to copy", names, { required: true, span: 2, value: from ? `${from.name} · ${from.ref}` : names[0] }),
      text("New name", { required: true, span: 2, placeholder: "Junior Secondary · day · next session" }),
      select("For", terms.length ? terms : ["The current term"], { required: true }),
      text("Raise every amount by", { value: "0", unit: "%", hint: "Leave at 0 to copy the amounts exactly." }),
      checks("Copy across", ["Fee items", "Optional items"], ["Fee items"], { span: 2 }),
      toggle("Create as a draft", true, "Draft · nothing is billed", "Publish immediately", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/structures/duplicate`,
      method: "POST",
      map: { "Structure to copy": "from", "New name": "name", For: "forTerm", "Raise every amount by": "raise", "Copy across": "copy", "Create as a draft": "draft" },
      encode: { "Structure to copy": Object.fromEntries(data.structures.map((row) => [`${row.name} · ${row.ref}`, row.id])) },
    },
  };
}

export function raiseDrawer(data: Structures, one?: Pick<StructureRow, "name" | "ref">): DrawerSpec {
  const names = data.structures.map((row) => `${row.name} · ${row.ref}`);
  return {
    mode: "form",
    kicker: "Structures",
    title: "Raise fees by percentage",
    commitLabel: "Apply the increase",
    commitDone: "Increase applied",
    commitDoneBody: "Every selected amount has moved. Nothing already billed changes; the new amounts apply from the next invoice run.",
    reviewNote: "A fee increase is the single most scrutinised change a school makes. This one states exactly what it touches before it touches it.",
    fields: [
      select("Apply to", ["One structure", "Every published structure", "Tuition across every structure"], { value: one ? "One structure" : "One structure", required: true, span: 2 }),
      select("Structure", names, { span: 2, value: one ? `${one.name} · ${one.ref}` : names[0] }),
      text("Increase by", { required: true, value: "8", unit: "%" }),
      checks("Which items", ["Tuition", "Development levy", "Books and materials", "Examination fee", "Laboratory", "Boarding", "Every item"], ["Tuition"], { required: true, span: 2 }),
      select("Round to", ["The nearest ₦1,000", "The nearest ₦500", "No rounding"], { value: "The nearest ₦1,000" }),
      select("Effective from", ["The next invoice run", "Immediately"], { value: "The next invoice run" }),
      area("Reason for the increase", { span: 2, required: true, placeholder: "Kept on the record and usually quoted to the parent body." }),
      toggle("Notify families in advance", true, "A term’s notice, as your policy requires", "No advance notice", { span: 2 }),
    ],
    submit: {
      endpoint: `${FEES}/structures/raise`,
      method: "POST",
      map: { "Apply to": "scope", Structure: "structure", "Increase by": "percent", "Which items": "items", "Round to": "round", "Effective from": "effective", "Reason for the increase": "reason", "Notify families in advance": "notify" },
      encode: { Structure: Object.fromEntries(data.structures.map((row) => [`${row.name} · ${row.ref}`, row.id])) },
    },
  };
}

export function ruleDrawer(rule?: RuleRow): DrawerSpec {
  return {
    mode: "form",
    kicker: "Structures",
    title: rule ? `Edit ${rule.name}` : "Add an adjustment rule",
    commitLabel: rule ? "Save the rule" : "Add the rule",
    commitDone: rule ? "Rule saved" : "Adjustment rule added",
    commitDoneBody: "It applies at the next publication, as an explicit line on the invoice. Rules that depend on an event — paying early, topping the class — are applied by hand, and say so.",
    reviewNote: "An adjustment is always a visible line on an invoice, never a quietly reduced amount — a family should be able to see what they were given.",
    fields: [
      text("Rule name", { required: true, span: 2, value: rule?.name ?? "", placeholder: "Sibling discount" }),
      select("Applies to", withCurrent(["Second child onward", "Children of staff", "Paid before a date", "Top of the class", "A named list of families", "Every family"], rule?.appliesTo ?? "Second child onward"), { required: true, span: 2, value: rule?.appliesTo ?? "Second child onward", hint: "“Second child onward” and “Every family” are applied automatically at publication; the others are applied by hand." }),
      choice("Value is", ["A percentage", "A fixed amount"], { span: 2, value: rule?.valueIs ?? "A percentage" }),
      text("Value", { required: true, value: rule ? String(rule.value) : "", placeholder: "10", unit: "% or ₦" }),
      checks("Applies to which items", ["Tuition", "Development levy", "Books and materials", "Boarding", "Every item"], rule?.items ?? ["Tuition"], { required: true, span: 2 }),
      select("Stacks with other rules", ["No · the largest applies", "Yes · applied in sequence"], { span: 2, value: rule?.stacks ?? "No · the largest applies" }),
      select("Runs until", ["I remove it", "The end of this session", "A date I choose"], { value: rule?.until ?? "I remove it" }),
      text("End date", { type: "date", value: rule?.endDate ?? "", optional: true }),
      toggle("Show it as a line on the invoice", rule?.visible ?? true, "Visible to the family", "Applied silently — not recommended", { span: 2 }),
    ],
    ...(rule ? { remove: { endpoint: `${FEES}/structures/rules/${rule.code}`, noun: "rule", warn: "Invoices already issued keep the adjustment they were given." } } : {}),
    submit: {
      endpoint: rule ? `${FEES}/structures/rules/${rule.code}` : `${FEES}/structures/rules`,
      method: rule ? "PUT" : "POST",
      map: { "Rule name": "name", "Applies to": "appliesTo", "Value is": "valueIs", Value: "value", "Applies to which items": "items", "Stacks with other rules": "stacks", "Runs until": "until", "End date": "endDate", "Show it as a line on the invoice": "visible" },
    },
  };
}

export function mapClassDrawer(detail: StructureDetail): DrawerSpec {
  return {
    mode: "form",
    kicker: `${detail.name} · ${detail.ref}`,
    title: "Map a class to a structure",
    commitLabel: "Map the class",
    commitDone: "Class mapped",
    commitDoneBody: "Every student in it is billed on this structure from the next invoice run.",
    reviewNote: `A class sits on one ${detail.kind.toLowerCase()} structure. Mapping it here removes it from the one it is on now.`,
    fields: [
      checks("Classes", detail.allLevels.map((level) => level.name), detail.levels.map((level) => level.name), { required: true, span: 2, hint: "The classes already on it are ticked. Untick one and use “Unmap” on its row." }),
      select("From", ["The next invoice run", "Immediately · restate this term’s invoices"], { required: true, value: "The next invoice run" }),
      toggle("Tell the affected families", true, "Told what changed and why", "Silent change", { span: 2 }),
    ],
    submit: { endpoint: `${FEES}/structures/${detail.id}/levels`, method: "POST", map: { Classes: "classes", From: "from", "Tell the affected families": "tell" } },
  };
}

export function unmapDrawer(detail: StructureDetail, level: { id: string; name: string; students: number }): DrawerSpec {
  return {
    mode: "commit",
    kicker: `${detail.name} · ${detail.ref}`,
    title: `Unmap ${level.name}`,
    sub: "The class stops being billed on this structure from the next run.",
    facts: [["Class", level.name], ["Students already billed", String(level.students), "Their invoices are kept"], ["From now on", "Nothing new is billed to them from this structure", "Map them to another structure first so they are not missed"]],
    commitLabel: "Unmap the class",
    commitDone: "Class unmapped",
    submit: { endpoint: `${FEES}/structures/${detail.id}/levels/${level.id}/unmap`, method: "POST", body: {} },
  };
}

export function editItemsDrawer(detail: StructureDetail): DrawerSpec {
  return {
    mode: "form",
    kicker: `${detail.name} · ${detail.ref}`,
    title: `Fee items · ${detail.name}`,
    sub: "Add, edit or remove any line.",
    commitLabel: "Save the fee items",
    commitDone: "Fee items saved",
    commitDoneBody: detail.state === "Published" ? "Invoices already issued are restated only if you chose to. Families are told what changed." : "Nothing is billed — this structure is still a draft.",
    reviewNote: "A change to a published structure can restate invoices. Families see what changed and why.",
    fields: [
      {
        label: "Fee items",
        kind: "lines",
        span: 2,
        cols: ITEM_COLUMNS,
        rows: detail.items.map((item) => ({ name: item.name, type: item.type, freq: item.freq, amt: String(item.amount) })),
        blank: { name: "", type: "Mandatory", freq: "Termly", amt: "" },
        addLabel: "Add a fee item",
      } as FormField,
      select("Takes effect", ["The next invoice run", "Immediately · restate this term’s invoices"], { required: true, span: 2, value: "The next invoice run" }),
      area("Reason for the change", { span: 2, required: detail.state === "Published", placeholder: "Usually quoted to the parent body." }),
      toggle("Tell the affected families", true, "Told what changed and why", "Silent change", { span: 2 }),
    ],
    submit: { endpoint: `${FEES}/structures/${detail.id}/items`, method: "PUT", map: { "Fee items": "items", "Takes effect": "takesEffect", "Reason for the change": "reason", "Tell the affected families": "tell" } },
  };
}

export function deleteStructureDrawer(detail: StructureDetail): DrawerSpec {
  return {
    mode: "commit",
    kicker: `${detail.name} · ${detail.ref}`,
    title: `Delete ${detail.name}?`,
    sub: detail.students ? "Every class on it must be mapped somewhere else first." : "Nothing has ever been billed on it.",
    facts: [
      ["Structure", detail.name, detail.ref],
      ["Classes mapped", String(detail.classes.length), detail.classes.join(", ") || "None"],
      ["Students on it", String(detail.students), detail.students ? "They must be moved to another structure before it can go" : "Nobody"],
      ["What goes", `The structure and its ${detail.items.length} items`, "Receipts and invoices are never deleted"],
    ],
    commitLabel: "Delete the structure",
    commitDone: "Structure deleted",
    commitDoneBody: "It is off the list. Every invoice already raised on it is kept.",
    submit: { endpoint: `${FEES}/structures/${detail.id}/delete`, method: "POST", reasonKey: "reason", reasonRequired: true, reasonLabel: "Why it is being deleted — required" },
  };
}

export function publishDrawer(preview: PublishPreview): DrawerSpec {
  return {
    mode: "form",
    kicker: "Structures",
    title: `Publish ${preview.name}`,
    sub: "A preview of the invoices to be generated and the families affected.",
    commitLabel: "Publish and bill",
    commitDone: "Structure published",
    commitDoneBody: "Invoices have been generated and guardians notified. Anything the adjustment rules could not apply by themselves is listed in the result.",
    reviewNote: "Publishing is the moment a structure becomes money owed. It cannot be undone by deleting — a mistaken invoice is voided, with a reason.",
    steps: [
      {
        title: "Review the structure",
        hint: "Exactly what will happen, before it happens.",
        fields: [
          fixed("Invoices to be generated", preview.mapped ? `${preview.invoices} · ${naira(preview.total)} billed` : "None — no class is mapped to this structure yet", { span: 2, hint: preview.mapped ? `${preview.perStudent ? `${naira(preview.perStudent)} a student` : "No mandatory items"} · ${preview.families} families${preview.alreadyBilled ? ` · ${preview.alreadyBilled} students already have an invoice on it and are left alone` : ""}.` : "Map a class first: publishing bills the classes mapped to it." }),
          ...(preview.concession ? [fixed("A concession", preview.concession, { span: 2 })] : []),
          fixed("Adjustment rules", preview.rules.length ? preview.rules.map((rule) => rule.name).join(" · ") : "None defined", { span: 2 }),
          toggle("Apply adjustment rules automatically", true, "Applied as explicit invoice lines", "Applied by hand", { span: 2 }),
          text("Invoices fall due on", { type: "date", value: "", optional: true, hint: "Left blank, they fall due 14 days after issue." }),
        ],
      },
      {
        title: "Notify",
        hint: "Who is told, and how.",
        fields: [
          checks("Notify guardians by", ["In-app", "SMS", "Email"], ["In-app", "SMS"], { span: 2 }),
          fixed("Families who cannot be reached", preview.noPhone || preview.noGuardian ? `${preview.noPhone} have no phone number that can receive SMS${preview.noGuardian ? `, ${preview.noGuardian} have no guardian on record` : ""}` : "Everyone can be reached", { span: 2, hint: "They will need a printed copy of the invoice." }),
        ],
      },
    ],
    submit: { endpoint: `${FEES}/structures/${preview.id}/publish`, method: "POST", map: { "Apply adjustment rules automatically": "applyRules", "Invoices fall due on": "dueOn", "Notify guardians by": "notify" } },
  };
}

/* ───────────────────────── review ───────────────────────── */

export function countDrawer(day: CashUpRow): DrawerSpec {
  return {
    mode: "form",
    kicker: "Review · cash-up",
    title: `Count ${day.day}`,
    sub: "Count the cash and cheques in the till and say what you found.",
    commitLabel: "Save the count",
    commitDone: "Cash counted",
    commitDoneBody: "The variance is worked out against what was recorded. Closing the day is a separate step, by someone else.",
    reviewNote: "Whoever counts a day cannot close it. A variance has to be explained before the day can be closed.",
    fields: [
      fixed("Recorded for the day", naira(day.recorded), { span: 2, hint: "Cash and cheque payments recorded that day." }),
      text("Counted", { required: true, unit: "₦", value: day.counted === null ? "" : String(day.counted), hint: "What is physically there." }),
      area("Note", { span: 2, optional: true, value: day.note ?? "", placeholder: "A short count, a cheque not yet banked…" }),
    ],
    submit: { endpoint: `${FEES}/review/cash-up/${day.day}/count`, method: "POST", map: { Counted: "counted", Note: "note" } },
  };
}

export function closeDayDrawer(day: CashUpRow): DrawerSpec {
  const variance = day.variance ?? 0;
  return {
    mode: "commit",
    kicker: "Review · cash-up",
    title: `Close ${day.day}`,
    sub: "A closed day is a record, not a draft.",
    facts: [
      ["Recorded", naira(day.recorded)],
      ["Counted", day.counted === null ? "Not counted yet" : naira(day.counted)],
      ["Variance", variance === 0 ? "None" : `${variance < 0 ? "−" : "+"}${naira(Math.abs(variance))}`, variance === 0 ? "Balanced" : variance < 0 ? "Short" : "Over"],
      ["Counted by someone else?", "Required", "Whoever counted the day cannot also close it"],
    ],
    commitLabel: "Close the day",
    commitDone: "Day closed",
    commitDoneBody: "It leaves the unreconciled list and stays on record.",
    submit: { endpoint: `${FEES}/review/cash-up/${day.day}/close`, method: "POST", reasonKey: "note", reasonRequired: variance !== 0, reasonLabel: variance !== 0 ? "What explains the variance — required" : "Note" },
  };
}

export function flagDrawer(flag: Review["flags"][number]): DrawerSpec {
  return {
    mode: "view",
    kicker: "Review · integrity flag",
    title: flag.label,
    sub: flag.found,
    tone: flag.count ? "attention" : "positive",
    facts: flag.items.length ? flag.items.slice(0, 12).map((item) => [item.label, item.sub] as [string, string]) : [["Nothing to review", "The books show nothing under this flag"]],
    readOnly: true,
    readOnlyNote: "A flag is a fact the books show. Open the payment from Collections or History to act on it.",
  };
}

export const applyUnappliedDrawer = (count: number): DrawerSpec => ({
  mode: "commit",
  kicker: "Review",
  title: "Apply the unapplied payments",
  sub: "Allocate each to the invoice it was received against.",
  facts: [["Payments", String(count), "Received, but not allocated to an invoice"], ["What it does", "Allocates each payment to its own invoice", "The balance on the invoice is restated"]],
  commitLabel: "Apply them",
  commitDone: "Payments applied",
  submit: { endpoint: `${FEES}/review/apply-unapplied`, method: "POST" },
});

export function waiverDrawer(row: Review["waivers"][number]): DrawerSpec {
  return {
    mode: "form",
    kicker: "Review · waivers",
    title: `${row.type} · ${row.family}`,
    sub: `${row.child} · ${row.arm} · ${row.invoice}`,
    facts: [
      ["Family", row.family, row.child],
      ["Type", row.type],
      ["Value", naira(row.value)],
      ["Reason", row.reason],
      ["Waiting", `${row.days} ${row.days === 1 ? "day" : "days"}`, `Requested by ${row.by}`],
    ],
    commitLabel: "Record the decision",
    commitDone: "Decision recorded",
    commitDoneBody: "An approved waiver comes off the invoice at once; a refusal tells the bursary why.",
    reviewNote: "Nobody decides their own request.",
    fields: [choice("Your decision", ["Approve", "Decline"], { span: 2, required: true, value: "Approve" }), area("Note", { span: 2, optional: true, placeholder: "Required to decline — the bursary reads it as written." })],
    submit: { endpoint: `${FEES}/review/waivers/${row.id}/decide`, method: "POST", map: { "Your decision": "decision", Note: "note" }, encode: { "Your decision": { Approve: "approve", Decline: "decline" } } },
  };
}

export { pair };
