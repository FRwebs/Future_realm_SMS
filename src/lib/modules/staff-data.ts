/**
 * Staff, access, pay, leave and appraisal.
 *
 * One staff list, read by the directory, permissions, payroll, leave and
 * appraisal alike — a school that sees two different staff counts stops
 * trusting both. Everything on M07 derives from `people` below.
 */

export type AccountState = "Active" | "Dormant" | "Not activated" | "Suspended";

export type Person = {
  name: string;
  role: string;
  dept: string;
  /** How far their data reaches. */
  scope: string;
  fees: "Full amounts" | "Status only" | "None";
  approve: string;
  /** Sensitive groups held. Never inherited from a role. */
  sensitive: string[];
  portal: AccountState;
  /** What they hold beyond their role template, if anything. */
  above: string;
};

export const people: Person[] = [
  { name: "Dr Emmanuel Nwosu", role: "Proprietor", dept: "Leadership", scope: "The whole school, every campus", fees: "Full amounts", approve: "Everything", sensitive: ["Safeguarding", "Health", "Salary", "Export"], portal: "Active", above: "" },
  { name: "Adaeze Nwosu", role: "Principal", dept: "Leadership · you", scope: "The whole school", fees: "Full amounts", approve: "Everything", sensitive: ["Safeguarding", "Health", "Counselling"], portal: "Active", above: "" },
  { name: "Mrs Folake Adeniyi", role: "Exam Officer", dept: "Languages", scope: "Every arm, results only", fees: "None", approve: "Score sheets, cards", sensitive: [], portal: "Active", above: "Sciences approval" },
  { name: "Mr Samuel Adeyemi", role: "Exam Officer", dept: "Sciences", scope: "Every arm, results only", fees: "None", approve: "Score sheets", sensitive: [], portal: "Active", above: "" },
  { name: "Mr Tunde Bakare", role: "Bursar", dept: "Bursary", scope: "The whole school, money only", fees: "Full amounts", approve: "Payments", sensitive: [], portal: "Active", above: "" },
  { name: "Mrs Chinelo Obi", role: "Bursar", dept: "Bursary", scope: "The whole school, money only", fees: "Full amounts", approve: "Waivers to ₦50,000", sensitive: ["Health"], portal: "Active", above: "Waiver limit" },
  { name: "Miss Grace Etim", role: "Registrar", dept: "Registry", scope: "Every student record", fees: "Status only", approve: "Record changes", sensitive: [], portal: "Active", above: "" },
  { name: "Mr Ibrahim Danladi", role: "Head of Department", dept: "Mathematics", scope: "His department, plus his own arms", fees: "Status only", approve: "Score sheets", sensitive: [], portal: "Active", above: "" },
  { name: "Mr Chidi Okeke", role: "Head of Department", dept: "Sciences", scope: "His department", fees: "Status only", approve: "Score sheets", sensitive: [], portal: "Not activated", above: "" },
  { name: "Mrs Ngozi Eze", role: "Form Master", dept: "Languages", scope: "Her form class and her subject-arms", fees: "Status only", approve: "Nothing", sensitive: [], portal: "Active", above: "" },
  { name: "Mr Peter Obi", role: "Form Master", dept: "Sciences", scope: "His form class and his subject-arms", fees: "Status only", approve: "Nothing", sensitive: [], portal: "Dormant", above: "" },
  { name: "Mrs Blessing Uche", role: "Form Master", dept: "Commerce", scope: "Her form class and her subject-arms", fees: "Status only", approve: "Nothing", sensitive: [], portal: "Active", above: "" },
  { name: "Mrs Amaka Eze", role: "Form Master", dept: "Creative Arts", scope: "Her form class and her subject-arms", fees: "Status only", approve: "Nothing", sensitive: [], portal: "Active", above: "" },
  { name: "Mr Sule Bature", role: "Subject Teacher", dept: "Sciences", scope: "His own subject-arms only", fees: "None", approve: "Nothing", sensitive: [], portal: "Active", above: "" },
  { name: "Mrs Chioma Obi", role: "Subject Teacher", dept: "Commerce", scope: "Her own subject-arms only", fees: "None", approve: "Nothing", sensitive: [], portal: "Active", above: "" },
  { name: "Nurse Comfort Eze", role: "School Nurse", dept: "Health and Welfare", scope: "Every student, health records only", fees: "None", approve: "Nothing", sensitive: ["Health"], portal: "Active", above: "" },
  { name: "Mrs Chinelo Obi · Counsellor", role: "Counsellor", dept: "Health and Welfare", scope: "Every student, guidance only", fees: "None", approve: "Nothing", sensitive: ["Counselling"], portal: "Active", above: "" },
  { name: "Miss Blessing Nnaji", role: "Subject Teacher", dept: "Languages", scope: "Her own subject-arms only", fees: "None", approve: "Nothing", sensitive: [], portal: "Not activated", above: "" },
  { name: "Mr Yemi Alade", role: "ICT Officer", dept: "ICT", scope: "No student data at all", fees: "None", approve: "Nothing", sensitive: [], portal: "Active", above: "" },
];

export function staffCounts() {
  const count = (state: AccountState) => people.filter((person) => person.portal === state).length;

  return {
    total: people.length,
    active: count("Active"),
    dormant: count("Dormant"),
    never: count("Not activated"),
    depts: new Set(people.map((person) => person.dept)).size,
    above: people.filter((person) => person.above).length,
    sensitiveHolders: people.filter((person) => person.sensitive.length).length,
  };
}

/* ------------------------------------------------------------------ Payroll */

export type PayBand = {
  code: string;
  name: string;
  covers: string;
  /** Monthly gross per step, in thousands of naira. */
  steps: number[];
  stepNames: string[];
  allowances: string[];
};

export const payBands: PayBand[] = [
  { code: "L1", name: "Leadership", covers: "Proprietor · Principal · Vice Principal", steps: [780, 900, 1040, 1250], stepNames: ["Entry", "Confirmed", "Senior", "Principal"], allowances: ["Housing", "Transport", "Duty", "Phone"] },
  { code: "A1", name: "Academic · senior", covers: "Head of Department · Exam Officer · Registrar", steps: [320, 352, 388, 427, 470], stepNames: ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"], allowances: ["Transport", "Responsibility"] },
  { code: "A2", name: "Academic · teaching", covers: "Form master · Subject teacher", steps: [186, 201, 217, 234, 253, 273], stepNames: ["Probation", "Step 1", "Step 2", "Step 3", "Step 4", "Step 5"], allowances: ["Transport", "Form class"] },
  { code: "S1", name: "Administration", covers: "Bursary · ICT · Front office", steps: [168, 185, 203, 224, 246], stepNames: ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"], allowances: ["Transport"] },
  { code: "N1", name: "Support", covers: "Nurse · Drivers · Caretaking · Kitchen", steps: [96, 104, 113, 122], stepNames: ["Step 1", "Step 2", "Step 3", "Step 4"], allowances: ["Transport", "Uniform"] },
];

function bandForRole(role: string): [string, number] {
  if (/Proprietor|Principal/.test(role)) return ["L1", 3];
  if (/Head of Department|Exam Officer|Registrar/.test(role)) return ["A1", 2];
  if (/Form Master|Subject Teacher/.test(role)) return ["A2", 2];
  if (/Bursar|ICT/.test(role)) return ["S1", 2];
  return ["N1", 2];
}

export function bandOf(code: string): PayBand {
  return payBands.find((band) => band.code === code) ?? payBands[2]!;
}

export type PayState = "Paid" | "Awaiting approval" | "Held" | "Not mapped";

export type PayRow = {
  person: Person;
  band: PayBand;
  step: number;
  /** All money in thousands of naira, as the bands are stated. */
  gross: number;
  allowances: number;
  deductions: number;
  net: number;
  state: PayState;
  /** Employed, and on the directory, but on no band — so there is no number to pay. */
  unmapped: boolean;
  method: "Bank transfer" | "Cash · collected";
};

/**
 * One row per person, derived from the same directory the rest of the product
 * uses. Deductions are 15.5% of taxable pay — PAYE, the employee's 8% pension
 * and NHF together, per the Nigeria profile. Deliberately not equal to any
 * allowance rate: a payroll where net and gross print the same figure is a
 * payroll nobody checks.
 */
export function payRows(): PayRow[] {
  return people.map((person, index) => {
    const [code, baseStep] = bandForRole(person.role);
    const band = bandOf(code);
    const step = Math.min(band.steps.length, baseStep + (index % 3));
    const gross = band.steps[step - 1]!;
    const allowances = Math.round(gross * (code === "L1" ? 0.34 : code === "A1" ? 0.22 : 0.16));
    const deductions = Math.round((gross + allowances) * 0.155);
    const unmapped = person.portal === "Not activated";
    const state: PayState = unmapped
      ? "Not mapped"
      : index === 10
        ? "Held"
        : index % 6 === 1
          ? "Awaiting approval"
          : "Paid";

    return {
      person,
      band,
      step,
      gross,
      allowances,
      deductions,
      net: gross + allowances - deductions,
      state,
      unmapped,
      method: /Nurse|Support/.test(person.role) ? "Cash · collected" : "Bank transfer",
    };
  });
}

export function payTotals() {
  const rows = payRows();
  const mapped = rows.filter((entry) => !entry.unmapped);
  const sum = (field: "gross" | "allowances" | "deductions" | "net") =>
    mapped.reduce((total, entry) => total + entry[field], 0);

  return {
    n: mapped.length,
    gross: sum("gross"),
    allowances: sum("allowances"),
    deductions: sum("deductions"),
    net: sum("net"),
    cost: sum("gross") + sum("allowances"),
    unmapped: rows.length - mapped.length,
  };
}

/** The bands are stated in thousands, so a figure has to be scaled to read as money. */
export function nairaK(thousands: number): string {
  return `₦${Math.round(thousands * 1000).toLocaleString("en-NG")}`;
}

export function nairaM(thousands: number): string {
  return `₦${(thousands / 1000).toFixed(1)}m`;
}

/* -------------------------------------------------------------------- Leave */

export type LeaveType = {
  name: string;
  entitlement: string;
  accrual: string;
  carryOver: string;
  evidence: string;
  pay: string;
  /** Days taken across the session, school-wide. */
  taken: number;
};

export const leaveTypes: LeaveType[] = [
  { name: "Annual leave", entitlement: "24 working days a session", accrual: "Accrues monthly", carryOver: "5 days, expire 31 December", evidence: "Not required", pay: "Paid", taken: 143 },
  { name: "Sick leave", entitlement: "12 working days a session", accrual: "Full on day one", carryOver: "None", evidence: "Medical note after 2 days", pay: "Paid", taken: 61 },
  { name: "Maternity leave", entitlement: "16 weeks", accrual: "Full on day one", carryOver: "Not applicable", evidence: "Medical certificate", pay: "Paid in full", taken: 78 },
  { name: "Paternity leave", entitlement: "10 working days", accrual: "Full on day one", carryOver: "Not applicable", evidence: "Birth certificate", pay: "Paid", taken: 14 },
  { name: "Compassionate leave", entitlement: "5 working days an event", accrual: "Per event", carryOver: "Not applicable", evidence: "Not required", pay: "Paid", taken: 9 },
  { name: "Study leave", entitlement: "10 working days a session", accrual: "Case by case", carryOver: "Not applicable", evidence: "Course letter", pay: "Half pay", taken: 20 },
  { name: "Religious observance", entitlement: "10 working days, once in service", accrual: "Once in service", carryOver: "Not applicable", evidence: "Confirmed booking", pay: "Unpaid", taken: 0 },
  { name: "Unpaid leave", entitlement: "No ceiling", accrual: "Not applicable", carryOver: "Not applicable", evidence: "Written request", pay: "Unpaid · prorated", taken: 12 },
];

export type LeaveStatus = "Waiting" | "In sequence" | "Taken" | "Declined";

export type LeaveRequest = {
  name: string;
  role: string;
  type: string;
  dates: string;
  days: string;
  cover: string;
  sequence: string;
  status: LeaveStatus;
};

const leaveSeed: Array<[string, string, string, string, string, string, string, LeaveStatus]> = [
  ["Mrs Ngozi Eze", "Form Master · Languages", "Annual leave", "12–16 Oct 2026", "5", "Mrs Amaka Eze · arranged", "With you", "Waiting"],
  ["Mr Sule Bature", "Subject Teacher · Sciences", "Unpaid leave", "21–23 Sep 2026", "3", "Not arranged", "With you", "Waiting"],
  ["Nurse Comfort Eze", "School Nurse", "Annual leave", "5–9 Oct 2026", "5", "Agency nurse · arranged", "With you", "Waiting"],
  ["Mr Peter Obi", "Form Master · Sciences", "Sick leave", "14–18 Sep 2026", "5", "Not arranged", "With you", "Waiting"],
  ["Mrs Amaka Eze", "Form Master · Creative Arts", "Maternity leave", "2 Nov – 22 Feb", "78", "Mrs Chioma Obi · arranged", "With the Proprietor", "In sequence"],
  ["Mr Samuel Adeyemi", "Exam Officer · Sciences", "Annual leave", "1–5 Sep 2026", "5", "Mrs Folake Adeniyi · arranged", "Complete", "Taken"],
  ["Miss Grace Etim", "Registrar", "Compassionate leave", "24–26 Aug 2026", "3", "Front office · arranged", "Complete", "Taken"],
  ["Mr Tunde Bakare", "Bursar", "Annual leave", "10–14 Aug 2026", "5", "Mrs Chinelo Obi · arranged", "Complete", "Taken"],
  ["Mrs Chioma Obi", "Subject Teacher · Commerce", "Study leave", "15–19 Jun 2026", "5", "Not arranged", "Complete", "Declined"],
  ["Mr Ibrahim Danladi", "Form Master · Mathematics", "Annual leave", "6–10 Jul 2026", "5", "Mr Chidi Okeke · arranged", "Complete", "Taken"],
  ["Mrs Blessing Uche", "Form Master · Commerce", "Sick leave", "3 Jul 2026", "1", "Covered internally", "Complete", "Taken"],
  ["Mr Yemi Alade", "ICT Officer", "Annual leave", "20–24 Apr 2026", "5", "No cover needed", "Complete", "Taken"],
];

export const leaveRequests: LeaveRequest[] = leaveSeed.map(
  ([name, role, type, dates, days, cover, sequence, status]) => ({
    name, role, type, dates, days, cover, sequence, status,
  }),
);

/** Annual days taken, sick days, and unpaid days, per person. */
export const leaveBalances = people.slice(0, 12).map((person, index) => {
  const taken = [13, 5, 9, 18, 24, 2, 11, 6, 0, 8, 15, 4][index]!;

  return {
    person,
    taken,
    sick: [2, 0, 1, 5, 0, 3, 0, 0, 0, 5, 1, 0][index]!,
    unpaid: index === 3 ? 3 : 0,
    other: index === 4 ? "Maternity · 78 days" : index === 8 ? "—" : "None",
    nextBooked:
      index === 0
        ? "6–10 Oct · approved"
        : index === 1
          ? "12–16 Oct · waiting"
          : "Nothing booked",
    left: 24 - taken,
  };
});

/* ---------------------------------------------------------------- Appraisal */

export type Kpi = {
  name: string;
  detail: string;
  source: string;
  weight: number;
  target: string;
};

export const kpiSets: Record<"teaching" | "leadership" | "support", Kpi[]> = {
  teaching: [
    { name: "Register punctuality", detail: "Registers marked before the daily cut-off", source: "Attendance · automatic", weight: 20, target: "95% of school days" },
    { name: "Score submission", detail: "Score sheets in by the deadline, first time", source: "Scores · automatic", weight: 20, target: "100%, none returned" },
    { name: "Report card remarks", detail: "Remarks written before the window closes", source: "Report Cards · automatic", weight: 15, target: "100%" },
    { name: "Class performance", detail: "Class average against the subject average", source: "Results · automatic", weight: 15, target: "At or above the subject average" },
    { name: "Guardian engagement", detail: "Queries answered within 2 working days", source: "Parents · automatic", weight: 10, target: "90%" },
    { name: "Lesson observation", detail: "Two observations a term by the head of department", source: "Manager rating", weight: 15, target: "3.5 of 5" },
    { name: "Professional conduct", detail: "Punctuality, duty rota, dress", source: "Manager rating", weight: 5, target: "Met" },
  ],
  leadership: [
    { name: "Results delivered", detail: "Whole-school pass rate against the target", source: "Results · automatic", weight: 25, target: "At or above target" },
    { name: "Submission discipline", detail: "Score sheets and remarks in on time across the school", source: "Scores · automatic", weight: 20, target: "95%" },
    { name: "Collection rate", detail: "Fees collected against fees invoiced", source: "Fee Management · automatic", weight: 20, target: "92%" },
    { name: "Compliance returns", detail: "Statutory returns filed by their deadline", source: "Compliance · automatic", weight: 15, target: "All, on time" },
    { name: "Staff development", detail: "Appraisals completed and observations done", source: "Appraisal · automatic", weight: 20, target: "100% of their people" },
  ],
  support: [
    { name: "Service level", detail: "Requests closed within the agreed time", source: "Automatic where measured", weight: 30, target: "90%" },
    { name: "Record accuracy", detail: "Errors found in their records on audit", source: "Records · automatic", weight: 25, target: "Fewer than 5 a term" },
    { name: "Response time", detail: "First response to a request", source: "Automatic where measured", weight: 20, target: "Same working day" },
    { name: "Compliance", detail: "Checks, licences and certificates current", source: "Compliance · automatic", weight: 15, target: "All current" },
    { name: "Professional conduct", detail: "Punctuality, conduct, teamwork", source: "Manager rating", weight: 10, target: "Met" },
  ],
};

export function kpiSetFor(role: string): keyof typeof kpiSets {
  if (/Proprietor|Principal|Head of Department|Exam Officer/.test(role)) return "leadership";
  if (/Form Master|Subject Teacher/.test(role)) return "teaching";
  return "support";
}

export type AppraisalStage = "Not started" | "Self-assessment" | "With you" | "Complete";

export type AppraisalRow = {
  person: Person;
  stage: AppraisalStage;
  selfScore: number;
  /** The manager's score, which exists only once the review is complete. */
  mine: number;
  evidence: number;
  set: keyof typeof kpiSets;
};

export function appraisalRows(): AppraisalRow[] {
  const stages: AppraisalStage[] = [
    "With you", "With you", "With you", "With you", "With you", "With you",
    "Self-assessment", "Self-assessment", "Self-assessment", "Complete", "Complete", "Not started",
  ];

  return people.slice(0, 12).map((person, index) => {
    const stage = stages[index]!;

    return {
      person,
      stage,
      selfScore: [4.2, 4.6, 3.8, 4.4, 4.0, 3.6, 0, 0, 0, 4.1, 3.9, 0][index]!,
      mine: stage === "Complete" ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.8, 3.7, 0][index]! : 0,
      evidence: [6, 4, 3, 7, 2, 1, 0, 0, 0, 5, 4, 0][index]!,
      set: kpiSetFor(person.role),
    };
  });
}

/** Sensitive groups. Never inherited from a role; every reveal is logged. */
export const sensitiveGroups: Array<{ name: string; holders: string; note: string; count: number }> = [
  { name: "Student safeguarding and disciplinary records", holders: "Adaeze Nwosu · Dr Emmanuel Nwosu", note: "every reveal is written to the audit log", count: 2 },
  { name: "Student health and welfare notes", holders: "Adaeze Nwosu · Nurse Comfort Eze · Mrs Chinelo Obi", note: "every reveal is logged", count: 3 },
  { name: "Counselling and guidance notes", holders: "Mrs Chinelo Obi · Adaeze Nwosu", note: "never visible to a subject teacher", count: 2 },
  { name: "Staff salary band and next of kin", holders: "Dr Emmanuel Nwosu only", note: "", count: 1 },
  { name: "Full-school data export", holders: "Dr Emmanuel Nwosu only", note: "requires re-authentication and a code to his phone", count: 1 },
];
