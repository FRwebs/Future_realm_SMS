/**
 * Compliance returns, standard reports and the datasets this school can export.
 *
 * A return is a different job from analytics: it has a recipient, a deadline
 * and a format, and it is either filed or it is not. Every school in every
 * country answers to somebody — a ministry, a board, an examinations council,
 * an inspectorate — and this is the evidence for that.
 */

export type ReturnState = "Not started" | "In progress" | "Blocked" | "Filed";

export type ComplianceReturn = {
  name: string;
  body: string;
  due: string;
  /** Days until the deadline. */
  days: number;
  period: string;
  state: ReturnState;
  format: string;
  covers: string;
  /** Whether everything it needs is on file today. */
  ready: boolean;
  blocker?: string;
  owner: string;
  filed?: string;
};

export const complianceReturns: ComplianceReturn[] = [
  {
    name: "Annual school census",
    body: "Ministry of Education",
    due: "31 October 2026",
    days: 56,
    period: "2026/2027 session",
    state: "Not started",
    format: "Ministry template · Excel",
    covers: "Enrolment by class, gender and age; staff numbers by qualification; facilities",
    ready: true,
    owner: "Miss Grace Etim · Registrar",
  },
  {
    name: "Termly enrolment return",
    body: "State Universal Basic Education Board",
    due: "14 September 2026",
    days: 10,
    period: "Second Term 2026/2027",
    state: "In progress",
    format: "Board portal · CSV",
    covers: "Enrolment, admissions, withdrawals and transfers this term",
    ready: true,
    owner: "Miss Grace Etim · Registrar",
  },
  {
    name: "Examination entry file",
    body: "WAEC · West African Examinations Council",
    due: "30 November 2026",
    days: 86,
    period: "2026/2027 · SSS 3",
    state: "Blocked",
    format: "WAEC schema · fixed width",
    covers: "Candidate names, dates of birth, subjects and photographs",
    ready: false,
    blocker: "4 candidates have no transfer certificate and 2 have no photograph on file",
    owner: "Mrs Folake Adeniyi · Exam Officer",
  },
  {
    name: "Attendance compliance return",
    body: "Ministry of Education",
    due: "8 October 2026",
    days: 34,
    period: "Second Term 2026/2027",
    state: "Not started",
    format: "Ministry template · PDF",
    covers: "Attendance by class, chronic absence cases and actions taken",
    ready: true,
    owner: "Adaeze Nwosu · Principal",
  },
  {
    name: "Safeguarding and child protection audit",
    body: "Independent Schools Inspectorate",
    due: "15 January 2027",
    days: 132,
    period: "2026/2027 session",
    state: "Not started",
    format: "Inspectorate checklist · PDF",
    covers: "Safeguarding checks on staff, incident log, policy version and training records",
    ready: false,
    blocker: "6 staff have no safeguarding check on file",
    owner: "Adaeze Nwosu · Principal",
  },
  {
    name: "Data protection register",
    body: "Nigeria Data Protection Commission",
    due: "31 March 2027",
    days: 207,
    period: "Calendar year 2026",
    state: "Not started",
    format: "NDPC form · PDF",
    covers: "What personal data is held, on what basis, for how long, and who can reach it",
    ready: true,
    owner: "Mrs Chinelo Obi · Data Protection Officer",
  },
  {
    name: "Staff qualification return",
    body: "Teachers Registration Council",
    due: "30 September 2026",
    days: 26,
    period: "2026/2027 session",
    state: "Filed",
    format: "TRC portal · CSV",
    filed: "2 September 2026",
    covers: "Every teacher, their qualifications and their registration number",
    ready: true,
    owner: "Miss Grace Etim · Registrar",
  },
  {
    name: "Financial statement for the board",
    body: "School Board of Governors",
    due: "20 December 2026",
    days: 106,
    period: "Second Term 2026/2027",
    state: "Not started",
    format: "Board format · PDF",
    covers: "Fees billed, collected and outstanding; waivers and write-offs; subscription costs",
    ready: true,
    owner: "Mr Tunde Bakare · Bursar",
  },
];

export const blockedReturns = complianceReturns.filter((entry) => !entry.ready);
export const dueSoonReturns = complianceReturns.filter(
  (entry) => entry.days <= 35 && entry.state !== "Filed",
);
export const filedReturns = complianceReturns.filter((entry) => entry.state === "Filed");
export const readyReturns = complianceReturns.filter(
  (entry) => entry.ready && entry.state !== "Filed",
);

/** The nearest deadline among the returns still to file. */
export const nextDeadlineDays = Math.min(
  ...complianceReturns.filter((entry) => entry.state !== "Filed").map((entry) => entry.days),
);

/**
 * What is missing before a return can be filed.
 *
 * Each row names the return it blocks, so a gap has a consequence rather than
 * being a number on a completeness dial.
 */
export type RecordGap = {
  missing: string;
  count: number;
  blocks: string;
  fixIn: string;
  href: string;
};

export const recordGaps: RecordGap[] = [
  { missing: "Transfer certificates", count: 4, blocks: "WAEC examination entry file", fixIn: "Student Records · Registry", href: "/student-records/registry" },
  { missing: "Student photographs", count: 2, blocks: "WAEC examination entry file", fixIn: "Student Records · Registry", href: "/student-records/registry" },
  { missing: "Safeguarding checks on staff", count: 6, blocks: "Safeguarding and child protection audit", fixIn: "Staff & Access · Directory", href: "/staff-access/directory" },
  { missing: "Students with no class arm", count: 3, blocks: "Annual school census · enrolment by class", fixIn: "Student Records · Registry", href: "/student-records/registry" },
  { missing: "Guardians with no consent on file", count: 6, blocks: "Data protection register", fixIn: "Parents & Guardians · Consent", href: "/parents-guardians/consent" },
  { missing: "Teachers with no registration number", count: 2, blocks: "Staff qualification return · already filed without them", fixIn: "Staff & Access · Directory", href: "/staff-access/directory" },
];

export const totalRecordGaps = recordGaps.reduce((total, gap) => total + gap.count, 0);

export type FiledReturn = {
  label: string;
  sub: string;
  pill: "Filed" | "Amended";
};

export const filedArchive: FiledReturn[] = [
  { label: "Staff qualification return · Teachers Registration Council", sub: "Filed 2 September 2026 by Miss Grace Etim · 31 teachers · archived with the source data", pill: "Filed" },
  { label: "Termly enrolment return · First Term 2026/2027", sub: "Filed 18 September 2025 by Miss Grace Etim · 1,546 students · acknowledged by the board", pill: "Filed" },
  { label: "Annual school census 2025/2026 · Ministry of Education", sub: "Filed 28 October 2025 by Adaeze Nwosu · acknowledged 4 November", pill: "Filed" },
  { label: "WAEC examination entry file · 2025/2026", sub: "Filed 24 November 2025 · 118 candidates · one amendment filed 2 December for a corrected date of birth", pill: "Amended" },
];

/* ------------------------------------------------------------------ Reports */

export type StandardReport = {
  name: string;
  sub: string;
  answers: string;
  lastGenerated: string;
  by: string;
};

export const standardReports: StandardReport[] = [
  { name: "Broadsheet", sub: "Students against subjects, per arm", answers: "The document a school checks results on", lastGenerated: "Today, 09:14", by: "Mr S. Adeyemi" },
  { name: "Term academic summary", sub: "Averages, positions, pass rates", answers: "What the term achieved, per level", lastGenerated: "19 Dec 2026", by: "Adaeze Nwosu" },
  { name: "Attendance register", sub: "Paper-register layout, per arm", answers: "What an inspection asks for", lastGenerated: "Yesterday", by: "Adaeze Nwosu" },
  { name: "Fee collection summary", sub: "Expected, collected, outstanding", answers: "The proprietor's monthly figure", lastGenerated: "1 Sep 2026", by: "Mrs C. Obi" },
  { name: "Debtor list", sub: "Who owes, how much, how long", answers: "Taken into a management meeting", lastGenerated: "Today, 08:02", by: "Mrs C. Obi" },
  { name: "Enrolment return", sub: "Headcount by level, arm and gender", answers: "Filed with the education authority", lastGenerated: "14 Aug 2026", by: "Miss G. Etim" },
  { name: "Staff list", sub: "Roles, departments, load", answers: "For the authority and for insurance", lastGenerated: "14 Aug 2026", by: "Adaeze Nwosu" },
  { name: "Nominal roll", sub: "Every student, formally listed", answers: "The authority's own format", lastGenerated: "14 Aug 2026", by: "Miss G. Etim" },
  { name: "Term performance analysis", sub: "Subject and arm comparison", answers: "Prepared for a staff meeting", lastGenerated: "19 Dec 2026", by: "Mr S. Adeyemi" },
  { name: "Result-day readiness", sub: "Blockers, named and counted", answers: "Can we publish, and if not why", lastGenerated: "Today, 07:41", by: "Adaeze Nwosu" },
  { name: "Parent meeting pack", sub: "Per child, per family", answers: "Printed for consultation day", lastGenerated: "Not yet this term", by: "—" },
  { name: "Consent coverage", sub: "Who consented to what, and when", answers: "Produced when a parent or regulator asks", lastGenerated: "20 Aug 2026", by: "Miss G. Etim" },
];

export type CustomReport = {
  name: string;
  shape: string;
  groupedBy: string;
  schedule: string;
  owner: string;
};

export const customReports: CustomReport[] = [
  { name: "Outstanding fees by arm and ageing", shape: "Table · 5 filters", groupedBy: "Arm, then bucket", schedule: "Every Monday, 07:00", owner: "Mrs C. Obi" },
  { name: "Attendance below 80% by arm", shape: "Table · 2 filters", groupedBy: "Arm", schedule: "Every Friday, 16:00", owner: "Adaeze Nwosu" },
  { name: "Subject averages by gender", shape: "Bar chart", groupedBy: "Subject, then gender", schedule: "On demand", owner: "Mr S. Adeyemi" },
  { name: "Guardian submissions by type and owner", shape: "Table", groupedBy: "Type, then owner", schedule: "On demand", owner: "Miss G. Etim" },
  { name: "Credit consumption by sender", shape: "Bar chart", groupedBy: "Sender", schedule: "On demand", owner: "Mrs C. Obi" },
  { name: "Withdrawal reasons by term", shape: "Line chart", groupedBy: "Term", schedule: "On demand", owner: "Adaeze Nwosu" },
];

export type Dataset = {
  name: string;
  rows: string;
  lastTaken: string;
};

export const datasets: Dataset[] = [
  { name: "Students · full record", rows: "1,655", lastTaken: "2 Sep · Miss G. Etim" },
  { name: "Scores · all components", rows: "52,180", lastTaken: "Today · Mr S. Adeyemi" },
  { name: "Attendance · every mark", rows: "38,000", lastTaken: "Yesterday · Adaeze Nwosu" },
  { name: "Payments and receipts", rows: "1,842", lastTaken: "1 Sep · Mrs C. Obi" },
  { name: "Guardians and consents", rows: "1,182", lastTaken: "20 Aug · Miss G. Etim" },
  { name: "Staff and permissions", rows: "31", lastTaken: "14 Aug · Adaeze Nwosu" },
  { name: "Audit log · complete", rows: "184,220", lastTaken: "28 Aug · Dr E. Nwosu" },
];

/* ----------------------------------------------------------------- Insights */

export type SubjectComparison = {
  subject: string;
  average: string;
  difficulty: string;
  passRate: string;
  credit: string;
  movement: string;
  up: boolean | null;
  insight: string;
};

export const subjectComparison: SubjectComparison[] = [
  { subject: "English Language", average: "69.9", difficulty: "Moderate", passRate: "94%", credit: "81%", movement: "+1.4", up: true, insight: "Consistent across all four arms" },
  { subject: "Biology", average: "68.8", difficulty: "Moderate", passRate: "91%", credit: "78%", movement: "+2.2", up: true, insight: "Strongest improvement this term" },
  { subject: "Mathematics", average: "68.6", difficulty: "Moderate", passRate: "88%", credit: "74%", movement: "+0.8", up: true, insight: "SSS 2C is 9 points below the other arms" },
  { subject: "Chemistry", average: "68.4", difficulty: "Moderate", passRate: "85%", credit: "71%", movement: "−1.1", up: false, insight: "Practical component scored lower across every arm" },
  { subject: "Physics", average: "64.3", difficulty: "Demanding", passRate: "79%", credit: "62%", movement: "−0.4", up: false, insight: "The hardest paper in the school for the third term running" },
  { subject: "Financial Accounting", average: "71.2", difficulty: "Accessible", passRate: "96%", credit: "88%", movement: "+3.1", up: true, insight: "Highest credit rate in the school" },
  { subject: "Civic Education", average: "No data", difficulty: "—", passRate: "—", credit: "—", movement: "—", up: null, insight: "Two arms had no teacher assigned for 34 days" },
];

/** The grade spread, in this school's own bands rather than a generic scale. */
export const gradeDistribution = [
  { label: "A1 · Excellent · 75–100", students: 218, pct: 100, tone: "positive" as const },
  { label: "B2 · Very good · 70–74", students: 186, pct: 85, tone: "positive" as const },
  { label: "B3 · Good · 65–69", students: 312, pct: 100, tone: "positive" as const },
  { label: "C4 · Credit · 60–64", students: 404, pct: 100, tone: "progress" as const },
  { label: "D7 · Pass · 40–59", students: 358, pct: 100, tone: "attention" as const },
  { label: "F9 · Fail · 0–39", students: 82, pct: 38, tone: "negative" as const, note: "5.3% of the school · down from 7.1% last term" },
];

/** Attendance by weekday — the pattern a school can actually act on. */
export const attendanceByWeekday = [
  { label: "Monday", pct: 91, display: "91.2%", tone: "attention" as const, note: "The weakest day, every term" },
  { label: "Tuesday", pct: 95, display: "95.4%", tone: "positive" as const },
  { label: "Wednesday", pct: 96, display: "95.8%", tone: "positive" as const },
  { label: "Thursday", pct: 95, display: "95.1%", tone: "positive" as const },
  { label: "Friday", pct: 94, display: "93.6%", tone: "positive" as const },
];
