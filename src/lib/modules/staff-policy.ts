/**
 * What a school writes down about its staff, once, so every run, request and review follows
 * it: how leave is earned, how pay is calculated, what a role is appraised on. These are the
 * starting positions a new school begins from; each is stored per school and edited there.
 */

/* ───────────────────────── leave ───────────────────────── */

export type LeaveTypePolicy = {
  name: string;
  /** Null for a type with no ceiling. */
  entitlement: number | null;
  unit: "Working days" | "Calendar days" | "Weeks" | "Months" | "No ceiling";
  per: string;
  accrual: string;
  carry: string;
  pay: "Paid in full" | "Half pay" | "Unpaid · prorated by working day";
  evidence: string;
  decides: string;
  threshold: number | null;
  notice: string;
  restricted: string[];
  coverRequired: boolean;
  halfDays: boolean;
  statutory: boolean;
  visible: boolean;
};

const leaveType = (name: string, entitlement: number | null, unit: LeaveTypePolicy["unit"], per: string, accrual: string, carry: string, pay: LeaveTypePolicy["pay"], evidence: string, extra: Partial<LeaveTypePolicy> = {}): LeaveTypePolicy => ({
  name,
  entitlement,
  unit,
  per,
  accrual,
  carry,
  pay,
  evidence,
  decides: "The school default · cover, Principal, Proprietor",
  threshold: 10,
  notice: "14 days",
  restricted: ["Exam weeks", "Report card week"],
  coverRequired: true,
  halfDays: false,
  statutory: true,
  visible: true,
  ...extra,
});

export const LEAVE_TYPE_DEFAULTS: LeaveTypePolicy[] = [
  leaveType("Annual leave", 24, "Working days", "a session", "Accrues monthly", "Up to 5 days, expiring 31 December", "Paid in full", "Not required", { halfDays: true }),
  leaveType("Sick leave", 12, "Working days", "a session", "Full entitlement on day one", "None", "Paid in full", "Medical note after 2 days", { restricted: ["Never restricted"], notice: "None", coverRequired: false, halfDays: true }),
  leaveType("Maternity leave", 16, "Weeks", "", "Full entitlement on day one", "Not applicable", "Paid in full", "Medical certificate", { restricted: ["Never restricted"], notice: "A full term" }),
  leaveType("Paternity leave", 10, "Working days", "", "Full entitlement on day one", "Not applicable", "Paid in full", "Birth certificate", { restricted: ["Never restricted"], notice: "None" }),
  leaveType("Compassionate leave", 5, "Working days", "an event", "Per event", "Not applicable", "Paid in full", "Not required", { restricted: ["Never restricted"], notice: "None", coverRequired: false }),
  leaveType("Study leave", 10, "Working days", "a session", "Case by case", "Not applicable", "Half pay", "Course letter"),
  leaveType("Religious observance", 10, "Working days", "once in service", "Once in service", "Not applicable", "Unpaid · prorated by working day", "Confirmed booking"),
  leaveType("Unpaid leave", null, "No ceiling", "", "Not applicable", "Not applicable", "Unpaid · prorated by working day", "Written request"),
];

export const LEAVE_OPTIONS = {
  units: ["Working days", "Calendar days", "Weeks", "Months", "No ceiling"],
  accrual: ["Full entitlement on day one", "Accrues monthly", "Per event", "Once in service", "Case by case", "Not applicable"],
  carry: ["None", "Up to 5 days, expiring 31 December", "Up to 10 days", "Unlimited", "Not applicable"],
  pay: ["Paid in full", "Half pay", "Unpaid · prorated by working day"],
  evidence: ["Not required", "Medical note after 2 days", "Medical certificate", "Birth certificate", "Course letter", "Confirmed booking", "Written request"],
  decides: ["The school default · cover, Principal, Proprietor", "Principal only", "Proprietor only", "Head of department only", "A sequence I set separately"],
  notice: ["None", "3 days", "7 days", "14 days", "A full term"],
  restricted: ["Exam weeks", "The first week of term", "The last week of term", "Report card week", "Never restricted"],
} as const;

/* ───────────────────────── payroll ───────────────────────── */

export type TaxBand = { upTo: number | null; rate: number };

export type PayrollSetup = {
  currency: string;
  profile: string;
  cycle: string;
  payDate: string;
  cutoff: string;
  approver: string;
  payslips: string;
  visibleTo: string[];
  roundNet: boolean;
  holdFinal: boolean;
  pensionRate: number;
  nhfRate: number;
  /** Annual, in naira. The first band is the tax-free slice. */
  taxBands: TaxBand[];
};

export const PAYROLL_SETUP_DEFAULT: PayrollSetup = {
  currency: "₦ Nigerian naira",
  profile: "Nigeria · PAYE, pension 8%, NHF 2.5%",
  cycle: "Monthly",
  payDate: "25th",
  cutoff: "The 20th",
  approver: "The Proprietor only",
  payslips: "Portal and email",
  visibleTo: ["Proprietor", "Bursar"],
  roundNet: false,
  holdFinal: true,
  pensionRate: 8,
  nhfRate: 2.5,
  taxBands: [
    { upTo: 800_000, rate: 0 },
    { upTo: 3_000_000, rate: 15 },
    { upTo: 12_000_000, rate: 18 },
    { upTo: 25_000_000, rate: 21 },
    { upTo: 50_000_000, rate: 23 },
    { upTo: null, rate: 25 },
  ],
};

export const PAY_OPTIONS = {
  currencies: ["₦ Nigerian naira", "GH₵ Ghanaian cedi", "KSh Kenyan shilling", "£ Pound sterling", "AED UAE dirham", "$ US dollar"],
  profiles: ["Nigeria · PAYE, pension 8%, NHF 2.5%", "Ghana · PAYE, SSNIT 5.5%", "Kenya · PAYE, NSSF, NHIF", "United Kingdom · PAYE, NI, auto-enrolment", "United Arab Emirates · no income tax", "Custom — defined below"],
  cycles: ["Monthly", "Twice monthly", "Fortnightly", "Weekly"],
  payDates: ["Last working day", "25th", "28th", "1st of the next month"],
  cutoffs: ["5 days before pay date", "The 20th", "The 15th"],
  approvers: ["The Proprietor only", "The Principal", "Either, above a threshold"],
  payslips: ["Portal and email", "Portal only", "Printed only", "Portal, email and printed"],
  viewers: ["Proprietor", "Principal", "Bursar", "Head of Department"],
  groups: ["Leadership", "Academic · senior", "Academic · teaching", "Administration", "Support", "Other — described below"],
  who: ["Everyone on the band", "Form masters only", "Post holders only", "Heads of department only", "Boarding staff only", "Named people only"],
  basis: ["Flat monthly", "% of gross", "Per term", "Per period taught"],
  treatment: ["Taxable", "Non-taxable to the statutory limit", "Reimbursement — not pay", "Employer cost — not pay"],
  shapes: ["Even · 8% a step", "Even · 12% a step", "Even · 15% a step", "Flat · one rate", "I will set each step myself"],
  statuses: ["Paid", "Awaiting approval", "Approved", "Held", "Returned to draft"],
  methods: ["Bank transfer", "Cash · collected at the bursary", "Mobile money"],
  reasons: ["New starter", "Promotion", "Appraisal outcome · step increase", "Correction of an error", "Acting in a higher role"],
  offCycleKinds: ["Correction of an underpayment", "Arrears from a backdated step", "Salary advance", "Reimbursed expense", "Final settlement"],
  recover: ["Not recoverable — this is owed", "Over 3 months", "Over 6 months", "In full next month"],
} as const;

export type BandStep = { name: string; gross: number };
export type BandAllowance = { name: string; who: string; basis: string; rate: number; treat: string };

/* ───────────────────────── appraisal ───────────────────────── */

export type KpiDefinition = {
  name: string;
  measure: string;
  /** "Register" and the like are read from the product; "Manager rating" is a person's judgement. */
  source: string;
  weight: number;
  target: string;
  scale?: string;
  runningFigure?: boolean;
  countsToPay?: boolean;
  ifMissing?: string;
};

export type KpiSetName = "teaching" | "leadership" | "support";

const kpi = (name: string, measure: string, source: string, weight: number, target: string): KpiDefinition => ({ name, measure, source, weight, target, scale: "1 to 5", runningFigure: true, countsToPay: true, ifMissing: "Excluded, and the weight is redistributed" });

export const KPI_SET_DEFAULTS: Record<KpiSetName, KpiDefinition[]> = {
  teaching: [
    kpi("Register punctuality", "Registers marked on the days school was in session", "Attendance · automatic", 20, "95% of school days"),
    kpi("Score submission", "Score sheets submitted rather than left in progress or returned", "Scores · automatic", 20, "100%, none returned"),
    kpi("Report card remarks", "Remarks written for every child in their form class", "Report Cards · automatic", 15, "100%"),
    kpi("Class performance", "Class average against the subject average", "Results · automatic", 15, "At or above the subject average"),
    kpi("Guardian engagement", "Queries answered within 2 working days", "Parents · automatic", 10, "90%"),
    kpi("Lesson observation", "Two observations a term by the head of department", "Manager rating", 15, "3.5 of 5"),
    kpi("Professional conduct", "Punctuality, duty rota, dress", "Manager rating", 5, "Met"),
  ],
  leadership: [
    kpi("Results delivered", "Whole-school pass rate against the target", "Results · automatic", 25, "At or above target"),
    kpi("Submission discipline", "Score sheets and remarks in on time across the school", "Scores · automatic", 20, "95%"),
    kpi("Collection rate", "Fees collected against fees invoiced", "Fee Management · automatic", 20, "92%"),
    kpi("Compliance returns", "Statutory returns filed by their deadline", "Compliance · automatic", 15, "All, on time"),
    kpi("Staff development", "Appraisals completed and observations done", "Appraisal · automatic", 20, "100% of their people"),
  ],
  support: [
    kpi("Service level", "Requests closed within the agreed time", "Automatic where measured", 30, "90%"),
    kpi("Record accuracy", "Errors found in their records on audit", "Records · automatic", 25, "Fewer than 5 a term"),
    kpi("Response time", "First response to a request", "Automatic where measured", 20, "Same working day"),
    kpi("Compliance", "Checks, licences and certificates current", "Compliance · automatic", 15, "All current"),
    kpi("Professional conduct", "Punctuality, conduct, teamwork", "Manager rating", 10, "Met"),
  ],
};

export const KPI_SOURCES = [
  "Attendance · automatic",
  "Scores · automatic",
  "Report Cards · automatic",
  "Results · automatic",
  "Parents · automatic",
  "Fee Management · automatic",
  "Compliance · automatic",
  "Appraisal · automatic",
  "Training · automatic",
  "Manager rating",
  "The staff member’s own evidence",
];

/** Which KPI set a role is appraised against. */
export function kpiSetFor(role: string): KpiSetName {
  if (/Proprietor|Principal|Head of Department|Exam Officer|Vice Principal/.test(role)) return "leadership";
  if (/Form Master|Subject Teacher|Teaching Assistant/.test(role)) return "teaching";
  return "support";
}

export function isAutomaticSource(source: string): boolean {
  return /automatic/i.test(source);
}
