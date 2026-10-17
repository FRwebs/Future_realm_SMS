import {
  API,
  area,
  checks,
  choice,
  fixed,
  pair,
  select,
  text,
  toggle,
  withCurrent,
} from "@/lib/modules/live/m7-forms";
import type {
  AppraisalOne,
  AppraisalOverview,
  BandDetail,
  BandRow,
  FlowStageView,
  KpiRow,
  LeaveRow,
  LeaveTypeRow,
  Moderation,
  PayRow,
  PayrollSetupView,
} from "@/lib/modules/live/m7-types";
import { PROCESS_FLOWS, flowPlain, type FlowId } from "@/lib/modules/staff-flows";
import { KPI_SOURCES, LEAVE_OPTIONS, PAY_OPTIONS, type KpiSetName } from "@/lib/modules/staff-policy";
import type { DrawerSpec, FlowPanel, FormField, PanelAction, PickerOption } from "@/lib/modules/panels";

/** Naira, written out: ₦1,250,000. */
export const naira = (value: number | null | undefined): string => (value === null || value === undefined ? "Held back" : `₦${Math.round(value).toLocaleString("en-NG")}`);
/** Naira, as a short figure for a card: ₦3.2m. */
export const nairaShort = (value: number | null | undefined): string => (value === null || value === undefined ? "Held back" : Math.abs(value) >= 1_000_000 ? `₦${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : naira(value));

const STAFF_PICK = "Choose a person";

const staffOptions = (rows: Array<{ id: string; name: string; role: string; department?: string }>): PickerOption[] =>
  rows.map((row) => ({ value: row.id, label: row.name, sub: row.role, group: row.department ?? "Staff" }));

/* ───────────────────────── pay bands ───────────────────────── */

const ALLOWANCE_COLUMNS = [
  { key: "name", label: "Allowance", w: "minmax(130px,1.5fr)", placeholder: "Transport" },
  { key: "who", label: "Who draws it", kind: "select" as const, w: "minmax(130px,1.4fr)", options: [...PAY_OPTIONS.who] },
  { key: "basis", label: "Basis", kind: "select" as const, w: "minmax(112px,1.1fr)", options: [...PAY_OPTIONS.basis] },
  { key: "rate", label: "Rate", w: "84px", num: true, placeholder: "18000" },
  { key: "treat", label: "Treatment", kind: "select" as const, w: "minmax(124px,1.2fr)", options: [...PAY_OPTIONS.treatment] },
];

const ALLOWANCE_BLANK = { name: "", who: "Everyone on the band", basis: "Flat monthly", rate: "", treat: "Taxable" };

export function bandDrawer(band?: BandDetail["band"]): DrawerSpec {
  const isNew = !band;
  const rows = (band?.allowances ?? [{ name: "Transport", who: "Everyone on the band", basis: "Flat monthly", rate: 0, treat: "Taxable" }]).map((item) => ({ ...item, rate: String(item.rate) }));
  const fields: FormField[] = [
    text("Band name", { required: true, span: 2, value: band?.name ?? "", placeholder: "Academic · teaching" }),
    text("Short code", { required: true, value: band?.code ?? "", placeholder: "A2", hint: "Shown on every payslip and every pay report" }),
    select("Who it covers", [...PAY_OPTIONS.groups], { required: true, value: band?.coversGroup ?? "Academic · teaching" }),
    area("Which roles sit on it", { required: true, span: 2, value: band?.covers ?? "", placeholder: "Form master, subject teacher… Used to suggest this band when somebody is added." }),
    ...(isNew
      ? [
          select("Steps on the band", ["3", "4", "5", "6", "7", "8"], { required: true, value: "5", hint: "A step is a rung, not a negotiation" }),
          text("Bottom step · monthly gross", { required: true, unit: "₦", placeholder: "186000", hint: "In full naira, per month" }),
          select("Shape of the ladder", PAY_OPTIONS.shapes.filter((item) => item !== "I will set each step myself"), { required: true, hint: "You can type over any rung afterwards on the band’s page" }),
          select("How the steps are named", ["Step 1 to Step N", "Probation, then Step 1 upwards", "Entry, Confirmed, Senior, Lead"]),
        ]
      : [fixed("The ladder", `${band.steps.length} steps · set on the band’s page`, { span: 2, hint: "Type over any rung there, or add one at the top. This form leaves the rungs as they are." })]),
    {
      label: "Allowances on this band",
      kind: "lines",
      span: 2,
      cols: ALLOWANCE_COLUMNS,
      rows,
      blank: ALLOWANCE_BLANK,
      addLabel: "Add an allowance",
      presets: [
        {
          label: "The teaching set",
          rows: [
            { name: "Transport", who: "Everyone on the band", basis: "Flat monthly", rate: "18000", treat: "Taxable" },
            { name: "Form class", who: "Form masters only", basis: "Flat monthly", rate: "12000", treat: "Taxable" },
            { name: "Phone and data", who: "Everyone on the band", basis: "Flat monthly", rate: "5000", treat: "Taxable" },
          ],
        },
        {
          label: "The leadership set",
          rows: [
            { name: "Housing", who: "Everyone on the band", basis: "% of gross", rate: "25", treat: "Taxable" },
            { name: "Responsibility", who: "Post holders only", basis: "% of gross", rate: "10", treat: "Taxable" },
            { name: "Transport", who: "Everyone on the band", basis: "Flat monthly", rate: "18000", treat: "Taxable" },
          ],
        },
      ],
      hint: "A flat rate is naira a month; a percentage is of the rung the person is on. Attached to the band, so two people doing the same job draw the same allowances — and anything above 40% of gross is usually pay wearing a different name.",
    } as FormField,
    text("Employer pension", { value: String(band?.employerPension ?? 10), unit: "%", hint: "An employer cost, never part of pay — counted in the cost of the band, not on the payslip" }),
    text("Next review of this band", { type: "date", value: band?.nextReview ? band.nextReview.slice(0, 10) : "", hint: "A band with no review date drifts behind the market silently" }),
    toggle("Open to new staff", band?.isOpen ?? true, "In the band picker", "Closed · existing staff stay on it", { span: 2 }),
  ];
  return {
    mode: "form",
    kicker: "Payroll · pay structure",
    title: band ? `Edit ${band.code} · ${band.name}` : "Create a band",
    sub: band ? "Who it covers and what it adds." : "The whole structure, before anybody is on it.",
    commitLabel: band ? "Save the band" : "Create the band",
    commitDone: band ? `Band ${band.code} saved` : "Band created",
    commitDoneBody: band ? "The structure applies from the next run. Nobody moves step — they keep the step they are on, at its new value." : "It is in the band picker straight away. Nobody is on it until you map somebody to it.",
    reviewNote: "This is the whole structure: who it covers, what each rung pays, what it adds in allowances and what it costs the school.",
    fields,
    ...(band
      ? {
          remove: {
            endpoint: `${API}/payroll/bands/${band.id}`,
            noun: "band",
            warn: "A band with people on it cannot be deleted. Move them off first, or close it to new staff instead.",
          },
        }
      : {}),
    submit: {
      endpoint: band ? `${API}/payroll/bands/${band.id}` : `${API}/payroll/bands`,
      method: band ? "PUT" : "POST",
      ...(band ? { body: { shape: "I will set each step myself", stepCount: band.steps.length, bottom: band.steps[0]?.gross ?? 1 } } : {}),
      map: {
        "Band name": "name",
        "Short code": "code",
        "Who it covers": "coversGroup",
        "Which roles sit on it": "covers",
        "Steps on the band": "stepCount",
        "Bottom step · monthly gross": "bottom",
        "Shape of the ladder": "shape",
        "How the steps are named": "naming",
        "Allowances on this band": "allowances",
        "Employer pension": "employerPension",
        "Next review of this band": "nextReview",
        "Open to new staff": "isOpen",
      },
    },
  };
}

export function mapStaffDrawer(
  rows: PayRow[],
  bands: BandRow[],
  o: { selection?: boolean; people?: PayRow[]; band?: string; title?: string } = {},
): DrawerSpec {
  const open = bands.filter((band) => band.isOpen);
  const labels = open.map((band) => `${band.code} · ${band.name}`);
  const list = o.people ?? rows;
  const maxSteps = Math.max(1, ...open.map((band) => band.steps));
  const steps = Array.from({ length: maxSteps }, (_, index) => `Step ${index + 1}`);
  const encodeBand = Object.fromEntries(open.map((band) => [`${band.code} · ${band.name}`, band.id]));
  const encodeStep = Object.fromEntries(steps.map((label, index) => [label, String(index + 1)]));
  const start = o.band && labels.includes(o.band) ? o.band : labels[0];
  return {
    mode: "form",
    kicker: "Payroll",
    title: o.title ?? "Map staff to a band",
    commitLabel: "Map them",
    commitDone: "Mapped to a band",
    commitDoneBody: "Their pay comes from the band and step from the next run onwards. No amount was typed.",
    reviewNote: "This is the only way a person gets paid: a band and a step. There is no free-text pay field anywhere in the product, which is how two people on the same job stay on the same money.",
    fields: [
      ...(o.selection
        ? [fixed("Staff", "The people you ticked", { span: 2 })]
        : [{ label: "Staff member", kind: "picker", required: true, span: 2, options: staffOptions(list), checked: [], placeholder: "Search by name or role", groupAll: "All departments", hint: "Choose one or several — each is given the same band and step." } as FormField]),
      labels.length ? select("Band", labels, { required: true, value: start, hint: "A closed band is not offered" }) : fixed("Band", "No band is open — create one first", { required: true }),
      select("Step", steps, { required: true, value: "Step 2", hint: "A step beyond the band’s last rung is refused" }),
      text("Effective from", { type: "date", value: "", hint: "Prorated by working day if it is mid-month" }),
      select("Reason", [...PAY_OPTIONS.reasons], { required: true, span: 2 }),
      area("Note for the record", { span: 2, optional: true, placeholder: "Anyone reviewing pay in two years reads this." }),
      select("Payment method", [...PAY_OPTIONS.methods], { value: "Bank transfer" }),
      toggle("Backdate to the start of the month", false, "Backdated · arrears on the next run", "From the date above", { span: 2 }),
    ],
    submit: {
      endpoint: `${API}/payroll/map`,
      method: "POST",
      map: {
        "Staff member": "staff",
        Band: "band",
        Step: "step",
        "Effective from": "effective",
        Reason: "reason",
        "Note for the record": "note",
        "Payment method": "method",
        "Backdate to the start of the month": "backdate",
      },
      encode: { Band: encodeBand, Step: encodeStep },
    },
  };
}

export function moveStepDrawer(): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Payroll",
    title: "Move these up one step",
    sub: "Each person on a band moves to the next rung, from the next run.",
    facts: [
      ["What changes", "Their step, by one", "Their band stays; their gross becomes the next rung’s"],
      ["Who is skipped", "Anyone at the top of their band, or not on one", "Named in the result"],
      ["Reaches pay", "The next run after the cut-off", "Recorded with your name and the reason"],
    ],
    commitLabel: "Move them up",
    commitDone: "Moved up",
    commitDoneBody: "Their pay follows the new rung from the next run.",
    submit: { endpoint: `${API}/payroll/move-step`, method: "POST", body: { delta: 1 }, reasonKey: "reason", reasonRequired: true, reasonLabel: "Why they are moving" },
  };
}

export function payStatusDrawer(row: PayRow, month: string): DrawerSpec {
  const next = row.state === "Paid" ? "Held" : row.state === "Held" ? "Awaiting approval" : "Paid";
  return {
    mode: "form",
    kicker: `Payroll · ${month}`,
    title: `Payment status · ${row.name}`,
    sub: "What this one payment is doing, and why.",
    commitLabel: "Save the status",
    commitDone: "Payment status changed",
    commitDoneBody: "The line and the run total reflect it immediately, and the change is on the record under your name.",
    reviewNote: "Only this payment changes. The band, the step and every other line on the run are untouched.",
    fields: [
      fixed("This payment", `${naira(row.net)} net · ${row.method}`, { span: 2, hint: `${row.band} · step ${row.step} · gross ${naira(row.gross)} · allowances ${naira(row.allowances)}` }),
      fixed("Status now", row.state, { hint: row.state === "Held" ? "Held out of the run, still counted in the total" : row.statusNote ?? undefined }),
      select("Change it to", [...PAY_OPTIONS.statuses], { required: true, value: next, hint: "Held keeps the person on the run and visible — it never quietly drops them from the total." }),
      area("Why", { required: true, span: 2, placeholder: "A bank receipt, a query on the hours, a handover not confirmed… Whoever reviews pay in two years reads this." }),
      text("Reference", { placeholder: "GTB/2509/771204", optional: true, hint: "The bank or receipt reference — required for a bank payment marked paid" }),
      text("Paid on", { type: "date", value: "", optional: true }),
    ],
    submit: {
      endpoint: `${API}/payroll/status`,
      method: "POST",
      body: { staff: [row.id] },
      map: { "Change it to": "status", Why: "why", Reference: "reference", "Paid on": "paidOn" },
    },
  };
}

export function bulkStatusDrawer(status: "Paid" | "Held" | "Awaiting approval", label: string): DrawerSpec {
  return {
    mode: "form",
    kicker: "Payroll",
    title: label,
    commitLabel: label,
    commitDone: "Payments updated",
    commitDoneBody: "Each line and the run total reflect it immediately, and the change is on the record under your name.",
    reviewNote: "Only the payments you ticked change. Nobody is dropped from the run.",
    fields: [
      fixed("Their status becomes", status, { span: 2 }),
      area("Why", { required: true, span: 2, placeholder: "Whoever reviews pay in two years reads this." }),
      ...(status === "Paid" ? [text("Reference", { optional: true, placeholder: "Batch or bank reference", span: 2 }), text("Paid on", { type: "date", value: "", optional: true })] : []),
    ],
    submit: {
      endpoint: `${API}/payroll/status`,
      method: "POST",
      body: { status },
      map: { Why: "why", Reference: "reference", "Paid on": "paidOn" },
    },
  };
}

export function holdDrawer(rows: PayRow[]): DrawerSpec {
  const mapped = rows.filter((row) => row.state !== "Not mapped" && row.state !== "Paid");
  return {
    mode: "form",
    kicker: "Payroll",
    title: "Hold a payment",
    sub: "It stays on the run and in its total; it just does not pay.",
    commitLabel: "Hold it",
    commitDone: "Payment held",
    commitDoneBody: "It is visible, counted and waiting — never quietly dropped.",
    fields: [
      { label: "Whose payment", kind: "picker", required: true, span: 2, options: staffOptions(mapped), checked: [], placeholder: "Search by name", groupAll: "All departments" } as FormField,
      area("Why", { required: true, span: 2, placeholder: "A query on the hours, a handover not confirmed…" }),
    ],
    submit: { endpoint: `${API}/payroll/status`, method: "POST", body: { status: "Held" }, map: { "Whose payment": "staff", Why: "why" } },
  };
}

export function offCycleDrawer(rows: PayRow[]): DrawerSpec {
  const names = rows.map((row) => `${row.name} · ${row.role}`);
  return {
    mode: "form",
    kicker: "Payroll",
    title: "Record an off-cycle payment",
    commitLabel: "Record the payment",
    commitDone: "Off-cycle payment recorded",
    commitDoneBody: "It sits outside the monthly run, with its reason attached.",
    reviewNote: "An off-cycle payment is how a real error gets fixed. It never edits a run that has been approved — both the error and the correction stay on the record.",
    fields: [
      select("Staff member", names.length ? names : [STAFF_PICK], { required: true, span: 2 }),
      select("Kind", [...PAY_OPTIONS.offCycleKinds], { required: true, span: 2 }),
      text("Amount", { required: true, unit: "₦", placeholder: "26000" }),
      text("Pay on", { type: "date", value: "", required: true }),
      area("Reason — required", { span: 2, required: true, placeholder: "What went wrong or what is owed, and how the figure was arrived at." }),
      select("Recover it later", [...PAY_OPTIONS.recover], { span: 2 }),
      toggle("Deduct statutory on this payment", true, "Treated as pay", "Treated as a reimbursement", { span: 2 }),
    ],
    submit: {
      endpoint: `${API}/payroll/off-cycle`,
      method: "POST",
      map: { "Staff member": "staff", Kind: "kind", Amount: "amount", "Pay on": "payOn", "Reason — required": "reason", "Recover it later": "recover", "Deduct statutory on this payment": "statutory" },
      encode: { "Staff member": Object.fromEntries(rows.map((row) => [`${row.name} · ${row.role}`, row.id])) },
    },
  };
}

export function payrollSetupDrawer(setup: PayrollSetupView): DrawerSpec {
  return {
    mode: "form",
    kicker: "Payroll",
    title: "Edit the payroll setup",
    commitLabel: "Save the setup",
    commitDone: "Payroll setup saved",
    commitDoneBody: "Every future run follows it. The run in progress keeps the figures it was built with.",
    reviewNote: "This is the frame every run is built in: the currency, the calendar and the statutory profile of the country the school is in.",
    fields: [
      select("Currency", withCurrent([...PAY_OPTIONS.currencies], setup.currency), { value: setup.currency, required: true }),
      select("Statutory profile", withCurrent([...PAY_OPTIONS.profiles], setup.profile), { value: setup.profile, required: true, hint: "Deductions are never typed by hand — the rates on this profile calculate them" }),
      select("Cycle", withCurrent([...PAY_OPTIONS.cycles], setup.cycle), { value: setup.cycle, required: true }),
      select("Pay date", withCurrent([...PAY_OPTIONS.payDates], setup.payDate), { value: setup.payDate, required: true }),
      select("Cut-off for variations", withCurrent([...PAY_OPTIONS.cutoffs], setup.cutoff), { value: setup.cutoff, required: true }),
      select("Who approves a run", withCurrent([...PAY_OPTIONS.approvers], setup.approver), { value: setup.approver, required: true, hint: "Whoever prepares a run can never approve it" }),
      select("Payslips", withCurrent([...PAY_OPTIONS.payslips], setup.payslips), { value: setup.payslips, span: 2 }),
      checks("Who may see amounts", [...PAY_OPTIONS.viewers], setup.visibleTo, { span: 2, hint: "Everyone else sees the people and never the figures. The Proprietor always can." }),
      toggle("Round net pay", setup.roundNet, "To the nearest 100", "To the unit — exact", { span: 2 }),
      toggle("Hold final pay until handover is confirmed", setup.holdFinal, "Held until offboarding completes", "Paid on the normal run", { span: 2 }),
    ],
    submit: {
      endpoint: `${API}/payroll/setup`,
      method: "PUT",
      map: {
        Currency: "currency",
        "Statutory profile": "profile",
        Cycle: "cycle",
        "Pay date": "payDate",
        "Cut-off for variations": "cutoff",
        "Who approves a run": "approver",
        Payslips: "payslips",
        "Who may see amounts": "visibleTo",
        "Round net pay": "roundNet",
        "Hold final pay until handover is confirmed": "holdFinal",
      },
    },
  };
}

export function modelIncreaseDrawer(detail: BandDetail, monthly: number): DrawerSpec {
  const code = detail.band.code;
  return {
    mode: "view",
    kicker: "Payroll",
    title: `Model an increase on ${code}`,
    sub: "See the cost before anybody is told about it.",
    facts: [
      ["Band", `${code} · ${detail.band.name}`, `${detail.people.length} people`],
      ["Current monthly cost", nairaShort(monthly), "Gross, allowances and employer pension"],
      ...[5, 10, 15].map((rate) => [`At ${rate}%`, nairaShort(Math.round(monthly * (1 + rate / 100))), `+${naira(Math.round((monthly * rate) / 100))} a month`] as [string, string, string]),
      ["Nothing is applied", "This is a model only", "Applying an increase is a separate decision: type over the rungs on the band’s page"],
    ],
    readOnly: true,
    readOnlyNote: "A model changes nothing. To apply an increase, change the rungs on the ladder and save.",
  };
}

export function closeBandDrawer(band: BandDetail["band"], people: number): DrawerSpec {
  const open = band.isOpen;
  return {
    mode: "commit",
    kicker: "Payroll",
    title: `${open ? "Close" : "Reopen"} ${band.code} ${open ? "to" : "for"} new staff`,
    sub: open ? "Existing staff stay on it; nobody new can be mapped to it." : "It appears in the band picker again.",
    facts: [
      ["People on it", String(people), "Unaffected"],
      ["New mappings", open ? "Refused" : "Allowed", open ? "It disappears from the band picker" : "It returns to the band picker"],
      ["Reversible", "Yes, any time"],
    ],
    commitLabel: open ? "Close the band" : "Reopen the band",
    commitDone: open ? "Band closed to new staff" : "Band reopened",
    submit: { endpoint: `${API}/payroll/bands/${band.id}/open`, method: "POST", body: { open: !open } },
  };
}

export const sendRunDrawer = (o: { people: number; net: string; month: string; variations: number }): DrawerSpec => ({
  mode: "commit",
  kicker: "Payroll",
  title: `Send the ${o.month} run for approval`,
  sub: "It goes to the person who approves a run, with the variations attached.",
  facts: [
    ["People", String(o.people)],
    ["Net to pay", o.net, "What leaves the account"],
    ["Variations", String(o.variations), "Each one named and reasoned"],
    ["Who can approve", "As the payroll setup says", "The person who prepared it can never approve it"],
  ],
  commitLabel: "Send for approval",
  commitDone: "Run sent for approval",
  commitDoneBody: "Every line is now awaiting approval. Nothing pays until it is decided.",
  submit: { endpoint: `${API}/payroll/run/send`, method: "POST" },
});

export const approveRunDrawer = (o: { people: number; net: string; month: string; preparedBy: string | null; variations: number }): DrawerSpec => ({
  mode: "commit",
  kicker: "Payroll",
  title: `The ${o.month} payroll run`,
  sub: `Approving authorises ${o.net} to ${o.people} people.`,
  facts: [
    ["Prepared by", o.preparedBy ?? "The bursary"],
    ["Net to pay", o.net],
    ["Variations", String(o.variations), "All named on the run"],
    ["Segregation of duties", "Enforced", "The preparer cannot approve"],
  ],
  commitLabel: "Approve the run",
  commitDone: "Run approved",
  commitDoneBody: "The run is locked and every line is approved. Mark each line paid against its bank reference as the money leaves.",
  submit: { endpoint: `${API}/payroll/run/approve`, method: "POST" },
});

export const releaseHeldDrawer = (held: number): DrawerSpec => ({
  mode: "commit",
  kicker: "Payroll",
  title: "Release every held payment",
  sub: "They return to waiting for approval.",
  facts: [["Held payments", String(held), held ? "They go back into the run" : "None are held"]],
  commitLabel: "Release them",
  commitDone: "Held payments released",
  submit: { endpoint: `${API}/payroll/run/release-held`, method: "POST" },
});

/* ───────────────────────── process flows ───────────────────────── */

export function flowStageDrawer(id: FlowId, stages: FlowStageView[], index: number | null): DrawerSpec {
  const def = PROCESS_FLOWS[id];
  const isNew = index === null || !stages[index];
  const cur = !isNew && index !== null ? stages[index] : undefined;
  const at = isNew ? stages.length : (index as number);
  return {
    mode: "form",
    kicker: def.plainLabel,
    title: isNew ? "Add a stage" : `Define · ${cur!.name}`,
    sub: "Who acts, what they may do, and how long they have.",
    commitLabel: isNew ? "Add this stage" : "Save this stage",
    commitDone: isNew ? "Stage added" : "Stage saved",
    commitDoneBody: isNew ? "It sits last. Use the arrows on its card to move it." : `Every new ${def.noun} follows the sequence as it now stands.`,
    reviewNote: "Who acts, what they may do, how long they have, and what happens if they do nothing.",
    fields: [
      text("Name this stage", { required: true, span: 2, value: cur?.name ?? "", placeholder: "Cover check", hint: "Two or three words — what staff see when it sits here." }),
      select("Who acts here", withCurrent([...def.whoOpts], cur?.who ?? def.whoOpts[0]), { required: true, span: 2, value: cur?.who ?? def.whoOpts[0], hint: "A role, not a name — names break when somebody leaves." }),
      select("What they may do", withCurrent([...def.doesOpts], cur?.does ?? def.doesOpts[0]), { required: true, span: 2, value: cur?.does ?? def.doesOpts[0], hint: "Confirms a fact, decides, or only is told — a stage that only confirms cannot end the " + def.noun + "." }),
      select("Applies to", withCurrent([...def.scopeOpts], cur?.scope ?? def.scopeOpts[0]), { required: true, span: 2, value: cur?.scope ?? def.scopeOpts[0], hint: "Where it does not apply, it is skipped." }),
      select("They have", withCurrent([...def.winOpts], cur?.win ?? def.winOpts[0]), { required: true, value: cur?.win ?? def.winOpts[0], hint: "Working days" }),
      select("If nobody acts in time", withCurrent([...def.silenceOpts], cur?.silence ?? def.silenceOpts[0]), { required: true, value: cur?.silence ?? def.silenceOpts[0], hint: "This is what decides whether work moves or sits." }),
      checks("Notified when it is reached", ["Nobody", "The requester", "The staff member", "Their line manager", "The Principal", "The Proprietor", "The Bursary", "The Exam Officer", "Everyone in the cycle"], cur?.notify ?? ["Nobody"], { span: 2, addable: true, addPlaceholder: "Somebody else", addLabel: "Add", hint: "Notified is not deciding — they are told, and cannot act." }),
      fixed("Where it sits", isNew ? `Stage ${stages.length + 1} of ${stages.length + 1}` : `Stage ${at + 1} of ${stages.length}`, { span: 2, hint: isNew ? "Added last — movable from its card." : at === 0 ? `First. A ${def.noun} arrives here.` : at === stages.length - 1 ? "Last. Nothing follows it." : `Hands on to stage ${at + 2}.` }),
      area("Why it is changing", { span: 2, required: !isNew, optional: isNew, placeholder: "Kept on the audit record." }),
    ],
    submit: {
      endpoint: isNew ? `${API}/flows/${id}/stages` : `${API}/flows/${id}/stages/${at}`,
      method: isNew ? "POST" : "PUT",
      map: {
        "Name this stage": "name",
        "Who acts here": "who",
        "What they may do": "does",
        "Applies to": "scope",
        "They have": "win",
        "If nobody acts in time": "silence",
        "Notified when it is reached": "notify",
        "Why it is changing": "reason",
      },
    },
  };
}

export function flowPanel(id: FlowId, stages: FlowStageView[], o: { title?: string; sub?: string; tag?: string; tagTone?: FlowPanel["tagTone"]; nowIndex?: number; acts?: PanelAction[] } = {}): FlowPanel {
  const def = PROCESS_FLOWS[id];
  return {
    type: "flow",
    flow: id,
    title: o.title ?? def.plainLabel,
    sub: o.sub ?? "Edit, reorder or remove any stage.",
    tag: o.tag ?? `${stages.length} ${stages.length === 1 ? "stage" : "stages"}`,
    tagTone: o.tagTone ?? "neutral",
    stages,
    nowIndex: o.nowIndex,
    plain: flowPlain(stages),
    presets: def.presets.map((preset) => ({ label: preset.label })),
    rules: def.rules,
    editDrawers: stages.map((_, index) => flowStageDrawer(id, stages, index)),
    addDrawer: flowStageDrawer(id, stages, null),
    endpoint: `${API}/flows/${id}`,
    acts: o.acts,
  };
}

/* ───────────────────────── leave ───────────────────────── */

export function leaveTypeDrawer(type?: LeaveTypeRow): DrawerSpec {
  return {
    mode: "form",
    kicker: "Leave · policy",
    title: type ? `Edit ${type.name}` : "Define a leave type",
    sub: type ? "What the school offers on this type, and on what terms." : "What the school offers, and on what terms.",
    commitLabel: type ? "Save the type" : "Create the type",
    commitDone: type ? `${type.name} saved` : "Leave type created",
    commitDoneBody: type ? "Every new request is measured against these terms. Requests already in flight keep the terms they were made under." : "Staff can request it from their next sign-in, and every request is measured against these terms.",
    reviewNote: "A leave type is a promise to staff and a cost to the school: how much, how it builds up, what it needs in evidence, and what it does to pay.",
    fields: [
      text("Type name", { required: true, span: 2, value: type?.name ?? "", placeholder: "Study leave" }),
      text("Entitlement", { value: type?.entitlement === null || type?.entitlement === undefined ? "" : String(type.entitlement), unit: type?.per ? type.per : "per session", placeholder: "10", optional: true, hint: "Leave it blank for a type with no ceiling, like unpaid leave" }),
      select("Counted in", withCurrent([...LEAVE_OPTIONS.units], type?.unit ?? "Working days"), { required: true, value: type?.unit ?? "Working days" }),
      select("How it builds up", withCurrent([...LEAVE_OPTIONS.accrual], type?.accrual ?? "Accrues monthly"), { required: true, value: type?.accrual ?? "Accrues monthly", hint: "Monthly accrual is what stops a January starter taking a full session’s leave in February" }),
      select("Carry-over", withCurrent([...LEAVE_OPTIONS.carry], type?.carry ?? "None"), { required: true, value: type?.carry ?? "None" }),
      select("Effect on pay", withCurrent([...LEAVE_OPTIONS.pay], type?.pay ?? "Paid in full"), { required: true, span: 2, value: type?.pay ?? "Paid in full", hint: "Unpaid leave is the only type that reaches payroll by itself — as a named variation on the next run" }),
      select("Evidence required", withCurrent([...LEAVE_OPTIONS.evidence], type?.evidence ?? "Not required"), { required: true, span: 2, value: type?.evidence ?? "Not required" }),
      select("Who decides it", withCurrent([...LEAVE_OPTIONS.decides], type?.decides ?? LEAVE_OPTIONS.decides[0]), { required: true, span: 2, value: type?.decides ?? LEAVE_OPTIONS.decides[0], hint: "The stages themselves are edited in the sequence on this tab" }),
      text("Above this many days it goes to the Proprietor", { value: type?.threshold === null || type?.threshold === undefined ? "10" : String(type.threshold), unit: "days", optional: true }),
      select("Notice expected", withCurrent([...LEAVE_OPTIONS.notice], type?.notice ?? "14 days"), { value: type?.notice ?? "14 days" }),
      checks("When it may not be taken", [...LEAVE_OPTIONS.restricted], type?.restricted ?? ["Exam weeks", "Report card week"], { span: 2 }),
      toggle("Cover must exist before it is granted", type?.coverRequired ?? true, "Refused without cover", "Cover is advisory", { span: 2 }),
      toggle("Half days allowed", type?.halfDays ?? false, "Counted as 0.5 of a day", "Whole days only", { span: 2 }),
      toggle("Statutory minimum applies", type?.statutory ?? true, "Whichever is more generous — the school’s or the law’s", "School policy only", { span: 2 }),
      toggle("Visible to staff", type?.visible ?? true, "In the request list from their next sign-in", "Hidden · recorded by an administrator only", { span: 2 }),
    ],
    ...(type
      ? { remove: { endpoint: `${API}/leave/types/${type.code}`, noun: "leave type", warn: type.requests ? `${type.requests} requests were made under it, so it cannot be deleted — hide it from staff instead.` : "Nobody has asked for it, so nothing is lost." } }
      : {}),
    submit: {
      endpoint: type ? `${API}/leave/types/${type.code}` : `${API}/leave/types`,
      method: type ? "PUT" : "POST",
      map: {
        "Type name": "name",
        Entitlement: "entitlement",
        "Counted in": "unit",
        "How it builds up": "accrual",
        "Carry-over": "carry",
        "Effect on pay": "pay",
        "Evidence required": "evidence",
        "Who decides it": "decides",
        "Above this many days it goes to the Proprietor": "threshold",
        "Notice expected": "notice",
        "When it may not be taken": "restricted",
        "Cover must exist before it is granted": "coverRequired",
        "Half days allowed": "halfDays",
        "Statutory minimum applies": "statutory",
        "Visible to staff": "visible",
      },
    },
  };
}

export function recordLeaveDrawer(staff: Array<{ id: string; name: string; role: string }>, types: LeaveTypeRow[]): DrawerSpec {
  const names = staff.map((row) => `${row.name} · ${row.role}`);
  return {
    mode: "form",
    kicker: "Leave",
    title: "Record leave taken",
    commitLabel: "Record it",
    commitDone: "Leave recorded",
    commitDoneBody: "It is on the register and on their balance, marked as recorded after the fact.",
    reviewNote: "Leave that happened without a request still has to be on the register — otherwise the balance is wrong and the next refusal cannot be justified.",
    fields: [
      select("Staff member", names.length ? names : [STAFF_PICK], { required: true, span: 2 }),
      select("Type", types.length ? types.map((type) => type.name) : ["Annual leave"], { required: true }),
      text("First day", { type: "date", value: "", required: true }),
      text("Last day", { type: "date", value: "", required: true }),
      text("Working days", { required: true, placeholder: "3", hint: "Weekends and school holidays are never counted" }),
      area("Why it was not requested first", { span: 2, required: true, placeholder: "A bereavement, an emergency admission… This is the part an auditor reads." }),
      select("Who covered the classes", ["Covered internally", "A named colleague", "Agency cover", "No cover was needed", "Classes were uncovered"], { required: true, span: 2 }),
      toggle("Deduct from their balance", true, "Deducted", "Recorded but not deducted", { span: 2 }),
    ],
    submit: {
      endpoint: `${API}/leave/record`,
      method: "POST",
      map: { "Staff member": "staff", Type: "type", "First day": "first", "Last day": "last", "Working days": "days", "Why it was not requested first": "why", "Who covered the classes": "cover", "Deduct from their balance": "deduct" },
      encode: { "Staff member": Object.fromEntries(staff.map((row) => [`${row.name} · ${row.role}`, row.id])) },
    },
  };
}

export function decideLeaveDrawer(row: LeaveRow, o: { balance?: string; effectOnPay?: string } = {}): DrawerSpec {
  const mine = row.mine;
  const coverStage = /Confirms cover only/.test(row.stageDoes ?? "");
  return {
    mode: "form",
    kicker: `Leave · ${row.sequence}`,
    title: `${row.type} · ${row.name}`,
    sub: mine ? "Decide it, send it back for cover, or decline with a reason." : row.status === "Waiting" || row.status === "In sequence" ? `Waiting on ${row.stageWho?.toLowerCase() ?? "the next stage"}.` : `Decided: ${row.status.toLowerCase()}.`,
    facts: [
      ["Staff member", row.name, `${row.role} · ${row.department}`],
      ["Type", row.type, row.pay],
      ["Dates", row.dates, `${row.days} working days`],
      ...(o.balance ? ([["Balance after this", o.balance]] as Array<[string, string]>) : []),
      ["Cover", row.cover, row.coverState === "Not arranged" ? "Granting this leaves classes uncovered" : undefined] as [string, string, string | undefined],
      ["Effect on pay", o.effectOnPay ?? (/Unpaid/.test(row.pay) ? "Prorated by working day on the next run" : /Half/.test(row.pay) ? "Half pay" : "None — paid leave")],
      ["Why they asked", row.reason || "No reason recorded"],
      ["At this stage", row.stage ?? "—", row.stageWho ? `${row.stageWho} · ${row.stageDoes}` : undefined] as [string, string, string | undefined],
      ...(row.decisionNote ? ([["Last note", row.decisionNote]] as Array<[string, string]>) : []),
    ].map((fact) => (fact[2] === undefined ? [fact[0], fact[1]] : fact)) as Array<[string, string, string?]>,
    ...(mine
      ? {
          commitLabel: "Record the decision",
          commitDone: "Decision recorded",
          commitDoneBody: "The request moves on, or ends, and the person is told what you wrote.",
          reviewNote: "Nobody approves their own leave at any stage. A refusal or a return carries a reason the requester reads verbatim.",
          fields: [
            choice("Your decision", ["Approve", "Return for cover", "Decline"], { span: 2, required: true }),
            area(coverStage ? "Who covers the classes" : "Note", { span: 2, optional: true, placeholder: coverStage ? "Mrs Amaka Eze takes 7B and 7C. Naming the cover is what confirms it." : "Required to decline or return — the requester reads it as written.", hint: coverStage ? "A cover check confirms a fact: name who covers and the request moves on." : undefined }),
          ],
          submit: { endpoint: `${API}/leave/${row.id}/decide`, method: "POST" as const, map: { "Your decision": "decision", Note: "note", "Who covers the classes": "note" }, encode: { "Your decision": { Approve: "approve", "Return for cover": "return", Decline: "decline" } } },
        }
      : { readOnly: true, readOnlyNote: "A request is never deleted. It stays in the register with its reason." }),
  };
}

export const approveManyDrawer = (): DrawerSpec => ({
  mode: "commit",
  kicker: "Leave",
  title: "Approve these requests",
  sub: "Each is decided at the stage you hold.",
  facts: [
    ["What happens", "Each moves to its next stage, or is granted if yours is the last"],
    ["Refused automatically", "Your own leave, and any request whose cover is required and not arranged", "Named in the result"],
  ],
  commitLabel: "Approve them",
  commitDone: "Requests decided",
  submit: { endpoint: `${API}/leave/decide-many`, method: "POST", body: { decision: "approve" } },
});

export const returnManyDrawer = (): DrawerSpec => ({
  mode: "form",
  kicker: "Leave",
  title: "Return these for cover",
  commitLabel: "Return them",
  commitDone: "Returned for cover",
  commitDoneBody: "Each goes back to the start of the sequence with your note.",
  fields: [area("Note", { required: true, span: 2, placeholder: "Who covers 7B on Tuesday?" })],
  submit: { endpoint: `${API}/leave/decide-many`, method: "POST", body: { decision: "return" }, map: { Note: "note" } },
});

/* ───────────────────────── appraisal ───────────────────────── */

export function kpiDrawer(set: KpiSetName, kpi?: KpiRow, index?: number): DrawerSpec {
  const editing = kpi !== undefined && index !== undefined;
  const source = kpi?.source ?? "Manager rating";
  return {
    mode: "form",
    kicker: `Appraisal · ${set} set`,
    title: editing ? `Edit ${kpi.name}` : "Define a KPI",
    sub: editing ? "What it measures, where the number comes from, and what it is worth." : "One thing, measurable, with a target and a weight.",
    commitLabel: editing ? "Save the KPI" : "Create the KPI",
    commitDone: editing ? `${kpi.name} saved` : "KPI created",
    commitDoneBody: editing ? "The set reflects it immediately. If the weights no longer total 100 the set cannot publish until they do." : "It is on this set. Give it a weight so the set totals 100 and it can be published.",
    reviewNote: "A KPI the school cannot measure is a hope, not a measure. Either it reads a figure the product already holds, or a named person rates it against stated evidence.",
    fields: [
      text("What is being measured", { required: true, span: 2, value: kpi?.name ?? "", placeholder: "Registers marked before the daily cut-off" }),
      area("How it is measured", { required: true, span: 2, value: kpi?.measure ?? "", placeholder: "One sentence the staff member will read. If you cannot write it, the KPI is not ready.", hint: "This is the line shown to them when the cycle is published" }),
      select("Where the number comes from", withCurrent([...KPI_SOURCES], source), { required: true, span: 2, value: source, hint: "An automatic KPI is not open to either party’s opinion — which is what makes it survive moderation. Where the product holds no figure yet it says so, and the manager rates it." }),
      text("Target", { required: true, value: kpi?.target ?? "", placeholder: "95% of school days" }),
      text("Weight", { required: true, value: kpi ? String(kpi.weight) : "", unit: "%", hint: "The set must total 100 before it can be published" }),
      select("Scale", ["1 to 5", "Met or not met", "Percentage against target"], { required: true, value: kpi?.scale ?? "1 to 5" }),
      select("If the figure cannot be produced", ["Excluded, and the weight is redistributed", "Rated by the manager instead", "Counted as not met"], { span: 2, value: kpi?.ifMissing ?? "Excluded, and the weight is redistributed", hint: "A teacher with no form class cannot be measured on remarks — this says what happens then" }),
      toggle("Show the running figure to staff", kpi?.runningFigure ?? true, "Visible all term · no surprises at review", "Shown at review only", { span: 2 }),
      toggle("Counts towards a step increase", kpi?.countsToPay ?? true, "Part of the rating that reaches Payroll", "Developmental only · no pay effect", { span: 2 }),
    ],
    ...(editing ? { remove: { endpoint: `${API}/appraisal/sets/${set}/kpis/${index}`, noun: "KPI", warn: "It leaves this set. Weights will no longer total 100, so the set cannot publish until you fix them." } } : {}),
    submit: {
      endpoint: editing ? `${API}/appraisal/sets/${set}/kpis/${index}` : `${API}/appraisal/sets/${set}/kpis`,
      method: editing ? "PUT" : "POST",
      map: {
        "What is being measured": "name",
        "How it is measured": "measure",
        "Where the number comes from": "source",
        Target: "target",
        Weight: "weight",
        Scale: "scale",
        "If the figure cannot be produced": "ifMissing",
        "Show the running figure to staff": "runningFigure",
        "Counts towards a step increase": "countsToPay",
      },
    },
  };
}

export function publishCycleDrawer(overview: AppraisalOverview): DrawerSpec {
  const sets = Object.entries(overview.sets);
  const label = (name: string) => `${name.charAt(0).toUpperCase()}${name.slice(1)} set · ${overview.roles.filter((role) => role.set === name).reduce((sum, role) => sum + role.people, 0)} people`;
  const options = sets.map(([name]) => label(name));
  const bad = sets.filter(([, value]) => Math.round(value.kpis.reduce((sum, item) => sum + item.weight, 0)) !== 100).map(([name]) => name);
  return {
    mode: "form",
    kicker: "Appraisal",
    title: overview.cycle.published ? `Publish to anyone still missing · ${overview.cycle.name}` : `Publish the ${overview.cycle.name} cycle`,
    sub: "Everyone on the sets you choose sees their KPIs and can start their self-assessment.",
    commitLabel: "Publish the cycle",
    commitDone: "Cycle published",
    commitDoneBody: "Each person now has an appraisal against their role’s KPIs. Their automatic figures are read from the product as of today.",
    reviewNote: "A set whose weights do not total 100 cannot be published. Anyone already published to is left as they are.",
    fields: [
      fixed("The cycle", overview.cycle.name, { span: 2, hint: overview.cycle.published ? `Published ${overview.cycle.publishedAt ? new Date(overview.cycle.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""} by ${overview.cycle.publishedBy ?? "someone"}` : "The current term" }),
      checks("Publish to", options, options.filter((_, index) => !bad.includes(sets[index][0])), { required: true, span: 2, hint: bad.length ? `Not publishable yet: ${bad.join(", ")} — weights do not total 100.` : "Every set totals 100." }),
      text("Staff complete theirs by", { type: "date", value: overview.cycle.deadline ? overview.cycle.deadline.slice(0, 10) : "", required: true }),
      area("A note to staff", { span: 2, optional: true, placeholder: "Anything you want them to read before they begin." }),
      toggle("Tell them", true, "Everyone is told in-app, and reminded", "Silent — they find it when they sign in", { span: 2 }),
    ],
    submit: {
      endpoint: `${API}/appraisal/publish`,
      method: "POST",
      map: { "Publish to": "sets", "Staff complete theirs by": "deadline", "A note to staff": "note", "Tell them": "tell" },
      encode: { "Publish to": Object.fromEntries(sets.map(([name]) => [label(name), name])) },
    },
  };
}

export const deadlineDrawer = (current: string | null): DrawerSpec => ({
  mode: "form",
  kicker: "Appraisal",
  title: "Extend the deadline",
  commitLabel: "Extend it",
  commitDone: "Deadline extended",
  fields: [text("New deadline", { type: "date", value: current ? current.slice(0, 10) : "", required: true, span: 2 })],
  submit: { endpoint: `${API}/appraisal/deadline`, method: "POST", map: { "New deadline": "deadline" } },
});

export const remindDrawer = (): DrawerSpec => ({
  mode: "form",
  kicker: "Appraisal",
  title: "Send a reminder",
  sub: "An in-app notice goes to staff, naming who is still open.",
  commitLabel: "Send it",
  commitDone: "Reminder sent",
  commitDoneBody: "It is on the staff notice board. Nothing is sent by SMS or email from here.",
  fields: [area("Message", { span: 2, optional: true, placeholder: "Your appraisal is still open. Please complete it this week." })],
  submit: { endpoint: `${API}/appraisal/remind`, method: "POST", map: { Message: "note" } },
});

export function moderationDrawer(data: Moderation): DrawerSpec {
  const rows = (items: Moderation["departments"]) => items.map((item) => `${item.name} ${item.average.toFixed(1)}`).join(" · ") || "No review is complete yet";
  const widest = data.departments.length > 1 ? `${data.departments[0].name} ${data.departments[0].average.toFixed(1)} · ${data.departments[data.departments.length - 1].name} ${data.departments[data.departments.length - 1].average.toFixed(1)}` : "Not enough reviews to compare";
  return {
    mode: "view",
    kicker: "Appraisal",
    title: "Moderate this cycle",
    sub: "Compare every manager’s ratings before any outcome is published.",
    facts: [
      ["Reviews complete", `${data.reviewed} of ${data.of}`],
      ["By department", rows(data.departments)],
      ["By manager", rows(data.managers)],
      ["Widest spread between departments", widest, "Same roles, same KPIs"],
      ["What moderation does", "Flags outliers for a conversation", "It never silently changes a rating"],
    ],
    readOnly: true,
    readOnlyNote: "Read from the reviews as they stand. An outlier is a conversation between you and the manager — change a rating by returning the review.",
  };
}

export function reviewDrawer(one: AppraisalOne): DrawerSpec {
  const options = ["Not rated", "1", "2", "3", "4", "5"];
  const nest: Record<string, [string, string]> = {};
  const fields: FormField[] = one.kpis.map((kpi) => {
    const label = `${kpi.name}`;
    nest[label] = ["scores", kpi.name];
    return select(label, options, { span: 2, value: kpi.mine ? String(kpi.mine) : "Not rated", hint: `${kpi.weight}% · ${kpi.target}${kpi.auto !== null ? ` · the product says ${kpi.auto.toFixed(1)}` : /automatic/i.test(kpi.source) ? " · the product holds no figure for this yet" : ""}${kpi.self ? ` · they said ${kpi.self}` : ""}` });
  });
  return {
    mode: "form",
    kicker: `Appraisal · ${one.cycle}`,
    title: `Your review · ${one.name}`,
    sub: "Rate each KPI against the evidence, then say what you saw.",
    commitLabel: "Save your review",
    commitDone: "Review saved",
    commitDoneBody: "It is kept as a draft. Complete it from the appraisal page when every KPI has a rating or a figure behind it.",
    reviewNote: "A silent disagreement is not a review: where you differ from what they said or from what the product holds, say why in your comment.",
    steps: [
      { title: "Rate each KPI", hint: "1 is well below target; 5 is well above. Leave a KPI unrated only where the product holds the figure.", fields },
      {
        title: "Say what you saw",
        fields: [
          area("What they do well", { span: 2, value: one.strengths ?? "", optional: true }),
          area("What would help them", { span: 2, value: one.improvements && !/^Returned for evidence/.test(one.improvements) ? one.improvements : "", optional: true }),
          area("Your review", { span: 2, required: true, value: one.reviewerComment ?? "", placeholder: "The summary they will read first." }),
        ],
      },
    ],
    submit: {
      endpoint: `${API}/appraisal/people/${one.id}`,
      method: "PATCH",
      map: { "What they do well": "strengths", "What would help them": "improvements", "Your review": "reviewerComment" },
      nest,
      encode: Object.fromEntries(Object.keys(nest).map((label) => [label, { "Not rated": "0" }])),
    },
  };
}

export const completeReviewDrawer = (one: AppraisalOne): DrawerSpec => ({
  mode: "decide",
  kicker: "Appraisal",
  title: `Complete the review · ${one.name}`,
  sub: "It becomes visible to them, and the outcome is theirs to read.",
  facts: [
    ["Staff member", one.name, `${one.role} · ${one.department}`],
    ["Overall", one.overall ? `${one.overall.toFixed(1)} of 5` : "Worked out when you complete it", "Weighted by each KPI’s share"],
    ["What they see", "Their ratings, your review and the evidence", "Never anybody else’s"],
    ["After this", "Moderation, then any step increase reaches Payroll", "As a named variation on the next run"],
  ],
  commitLabel: "Complete the review",
  commitDone: "Review completed",
  commitDoneBody: "The outcome is shared. It is theirs permanently, and quoted at the next cycle.",
  submit: { endpoint: `${API}/appraisal/people/${one.id}/complete`, method: "POST" },
});

export const returnReviewDrawer = (one: AppraisalOne): DrawerSpec => ({
  mode: "form",
  kicker: "Appraisal",
  title: `Return for evidence · ${one.name}`,
  commitLabel: "Return it",
  commitDone: "Returned for evidence",
  fields: [area("What evidence is missing", { required: true, span: 2, placeholder: "Two observations are on record; the third lesson observation is not." })],
  submit: { endpoint: `${API}/appraisal/people/${one.id}/return`, method: "POST", map: { "What evidence is missing": "note" } },
});

export const copySetDrawer = (from: KpiSetName): DrawerSpec => ({
  mode: "form",
  kicker: "Appraisal",
  title: "Copy this set to another",
  sub: "It replaces the target set’s KPIs.",
  commitLabel: "Copy it",
  commitDone: "Set copied",
  fields: [select("Copy to", (["teaching", "leadership", "support"] as KpiSetName[]).filter((name) => name !== from), { required: true, span: 2 })],
  submit: { endpoint: `${API}/appraisal/sets/${from}/copy`, method: "POST", map: { "Copy to": "to" } },
});

export const resetSetDrawer = (set: KpiSetName): DrawerSpec => ({
  mode: "commit",
  kicker: "Appraisal",
  title: `Reset the ${set} set to the standard`,
  facts: [["What changes", "Every KPI and weight returns to the standard set"], ["Already published appraisals", "Keep the KPIs they were published with"]],
  commitLabel: "Reset it",
  commitDone: "Set reset",
  submit: { endpoint: `${API}/appraisal/sets/${set}/reset`, method: "POST" },
});

export { pair };

/** Defining a KPI from anywhere: the form says which set it goes on. */
export function defineKpiDrawer(): DrawerSpec {
  const base = kpiDrawer("teaching");
  const sets = ["teaching", "leadership", "support"];
  const label = (name: string) => `${name.charAt(0).toUpperCase()}${name.slice(1)} set`;
  return {
    ...base,
    kicker: "Appraisal",
    fields: [select("Add it to", sets.map(label), { required: true, span: 2, hint: "A person is appraised against their role’s set — never against a set written for somebody else" }), ...(base.fields ?? [])],
    submit: {
      ...base.submit!,
      endpoint: `${API}/appraisal/kpis`,
      method: "POST",
      map: { ...base.submit!.map, "Add it to": "set" },
      encode: { "Add it to": Object.fromEntries(sets.map((name) => [label(name), name])) },
    },
  };
}
