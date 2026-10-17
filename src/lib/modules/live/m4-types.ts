/** What `/api/v1/attendance-management` answers with — the shapes the Attendance tabs and pages read. */

export type Policy = {
  markCutoff: string;
  bell: string;
  lateCounts: boolean;
  target: number;
  chronic: number;
  watch: number;
  minDays: number;
  alertDays: number;
  alertChannel: string;
  guardianNotifyAt: string;
};

export type Explanation = {
  id: string;
  studentId: string | null;
  child: string | null;
  adm: string | null;
  arm: string | null;
  guardian: string;
  relation: string;
  detail: string;
  state: string;
  open: boolean;
  outcome: string | null;
  at: string;
  decidedAt: string | null;
};

export type ArmDay = {
  id: string;
  name: string;
  master: string | null;
  masterId: string | null;
  dept: string | null;
  roll: number;
  state: "Marked" | "In progress" | "Unmarked";
  pastCutoff: boolean;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number | null;
  markedAt: string | null;
  breach: boolean;
  termRate: number | null;
};

export type TeacherDay = { id: string; name: string; dept: string | null; arms: string[]; roll: number; marked: number; total: number; punctuality: number | null };

export type Overview = {
  date: string;
  label: string;
  today: boolean;
  note: string | null;
  term: { id: string; name: string; start: string; end: string };
  since: string | null;
  policy: Policy;
  day: { arms: number; roll: number; marked: number; partial: number; unmarked: number; pastCutoff: number; accounted: number; present: number; late: number; absent: number; excused: number; rate: number | null };
  arms: ArmDay[];
  teachers: TeacherDay[];
  unassigned: string[];
  explanations: Explanation[];
  chronic: number;
  days: string[];
};

export type DayStudent = {
  id: string;
  roll: number;
  name: string;
  adm: string;
  mark: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "NONE";
  markLabel: string;
  markedAt: string | null;
  reason: string | null;
  reasonCode: string | null;
  explained: boolean;
  termRate: number | null;
  guardian: { name: string; phone: string | null } | null;
  case: boolean;
};

export type DayRecent = { date: string; label: string; present: number; late: number; absent: number; excused: number; rate: number | null; markedAt: string | null; state: string };

export type Day = {
  arm: { id: string; name: string; master: string | null; masterId: string | null; phone: string | null; staffNo: string | null; dept: string | null; others: string[] };
  date: string;
  label: string;
  isToday: boolean;
  isSchoolDay: boolean;
  taken: boolean;
  register: { state: string; markedAt: string | null; by: string | null };
  students: DayStudent[];
  counts: { roll: number; present: number; absent: number; late: number; excused: number; unexplained: number };
  rate: number | null;
  recent: DayRecent[];
  termRate: number | null;
  record: { registers: string; punctuality: number | null; corrections: number };
  days: Array<{ date: string; label: string; state: string }>;
  policy: Policy;
  term: { id: string; name: string };
};

export type Week = {
  arm: { id: string; name: string; master: string | null; masterId: string | null };
  start: string;
  label: string;
  previous: string | null;
  next: string | null;
  days: Array<{ date: string; name: string; label: string; sits: boolean; unrecorded: boolean; taken: boolean; missed: boolean; roll: number; present: number; late: number; absent: number; excused: number; rate: number | null; markedAt: string | null; state: string }>;
  sat: number;
  taken: number;
  week: { rate: number | null; absent: number; late: number; excused: number };
  who: Array<{ id: string; name: string; adm: string; absent: number; late: number; reasons: string[]; termRate: number | null }>;
  policy: Policy;
  since: string | null;
  term: { id: string; name: string };
};

export type TrendWeek = { n: number; key: string; label: string; dates: string; days: number; rate: number | null; absent: number; late: number; excused: number; missed: number; markers: string[] };
export type TrendStudent = { id: string; name: string; adm: string; days: number; absent: number; late: number; excused: number; rate: number | null; flag: string; case: string | null };

export type Trend = {
  arm: { id: string; name: string; master: string | null; masterId: string | null };
  term: { id: string; name: string };
  since: string | null;
  weeks: TrendWeek[];
  rate: number | null;
  schoolDays: number;
  best: { label: string; dates: string; rate: number | null } | null;
  worst: { label: string; dates: string; rate: number | null } | null;
  below: number;
  missed: number;
  students: TrendStudent[];
  roll: number;
  counts: { chronic: number; falling: number; strong: number };
  policy: Policy;
};

export type MarkState = {
  arm: { id: string; name: string; master: string | null };
  date: string;
  label: string;
  term: { id: string; name: string };
  mode: string;
  startedAt: string | null;
  markedAt: string | null;
  backdated: boolean;
  canBackdate: boolean;
  whyNot: string | null;
  editable: boolean;
  students: Array<{ id: string; roll: number; name: string; adm: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null; reason: string; reasonCode: string; termRate: number | null }>;
  reasons: string[];
  policy: Policy;
  since: string | null;
  days: string[];
};

export type ComplianceTeacher = {
  id: string;
  name: string;
  dept: string | null;
  arms: string[];
  roll: number;
  state: string;
  todayMissing: number;
  week: number;
  term: number;
  owed: number;
  punctuality: number | null;
  pattern: string;
  breachedWeeks: number;
};

export type TrackerArm = { id: string; name: string; roll: number; owner: string; ownerId: string | null; role: string; state: string; overdue: boolean; started: string | null; markedAt: string | null; late: boolean };

export type BackdatedRow = { id: string; who: string; arm: string; markedOn: string; forDate: string; reason: string };

export type Compliance = {
  date: string;
  label: string;
  today: boolean;
  note: string | null;
  cutoff: string;
  term: { id: string; name: string };
  since: string | null;
  schoolDays: number;
  kpis: { unmarked: number; notYet: number; week: number; weekTeachers: number; term: number; owed: number; compliance: number | null; repeat: number; median: number | null; medianOf: number };
  teachers: ComplianceTeacher[];
  tracker: TrackerArm[];
  missing: Array<{ name: string; days: number }>;
  backdated: BackdatedRow[];
  unassigned: string[];
};

export type CorrectionRow = {
  id: string;
  who: string;
  arm: string;
  markedOn: string;
  forDate: string;
  forIso: string;
  kind: string;
  state: string;
  awaiting: boolean;
  student: string;
  from: string;
  to: string;
  reasonCode: string;
  explanation: string;
  evidence: boolean;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  requestedById: string;
};

export type Flagged = { id: string; name: string; adm: string; arm: string; classId: string | null; days: number; absent: number; late: number; excused: number; rate: number | null; flag: string; case: string | null; told: number; reachable: boolean };

export type Log = {
  term: { id: string; name: string };
  since: string | null;
  schoolDays: number;
  plannedDays: number;
  policy: Policy;
  kpis: {
    rate: number | null;
    best: { id: string; name: string; term: number | null } | null;
    worst: { id: string; name: string; master: string | null; term: number | null } | null;
    chronic: number;
    closed: number;
    formal: number;
    corrections: { all: number; backdated: number; sameDay: number; awaiting: number };
  };
  weeks: string[];
  trend: Array<{ id: string; name: string; master: string | null; weeks: Array<number | null>; term: number | null; direction: string }>;
  flagged: Flagged[];
  corrections: CorrectionRow[];
  backdated: BackdatedRow[];
  roll: number;
};

export type Options = {
  school: string;
  staff: Array<{ id: string; name: string; role: string }>;
  students: Array<{ id: string; name: string; adm: string; arm: string }>;
  arms: Array<{ id: string; name: string; master: string | null }>;
};

export type CorrectionOptions = { reasons: string[]; absenceReasons: string[]; approver: string };

export type StudentCase = {
  student: { id: string; name: string; adm: string; arm: string; classId: string | null };
  term: { id: string; name: string };
  tally: { present: number; late: number; absent: number; excused: number };
  days: number;
  rate: number | null;
  flag: string;
  unexplained: number;
  longest: number;
  longestStart: string | null;
  longestEnd: string | null;
  case: { id: string; status: string; openedAt: string; openedAtRate: number; automatic: boolean; outcome: string | null; outcomeNote: string | null; closedAt: string | null; closedBy: string | null } | null;
  contacts: { count: number; last: string | null; hasNumber: boolean; daysSince: number | null };
  absences: Array<{ date: string; label: string; status: string; reason: string | null }>;
  corrections: Array<{ id: string; date: string; from: string; to: string; kind: string; status: string; reason: string }>;
  outcomes: string[];
  policy: Policy;
};

export type TeacherRecord = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  staffNo: string | null;
  dept: string | null;
  row: ComplianceTeacher | null;
  corrections: number;
  lastNotified: string | null;
  medianSchool: number | null;
  cutoff: string;
};

export type ExplanationDetail = Explanation & { absences: Array<{ date: string; label: string; reason: string | null }> };
