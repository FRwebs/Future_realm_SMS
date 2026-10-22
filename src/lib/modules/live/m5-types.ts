/** What `/api/v1/score-results` answers with — the shapes the Score Entry & Results tabs and pages read. */

export type Column = { key: string; id: string | null; code: string; name: string; short: string; max: number; weight: number; exam: boolean };
export type CellValue = number | "ABS" | null;
export type Term = { id: string; name: string; session: string };
export type State = "Not started" | "In progress" | "Submitted" | "Returned" | "Approved" | "Unassigned";

export type SheetRow = {
  id: string;
  name: string;
  adm: string;
  cells: Record<string, CellValue>;
  total: number | null;
  blank: number;
  absent: number;
  complete: boolean;
  grade: string | null;
  rating: string;
  pos: number | null;
  standing: string;
};

export type Flag = { key: string; kind: string; title: string; detail: string; studentIds: string[]; blocking: boolean; outcome?: { outcome: string; note: string; by: string; at: string } | null };

export type Band = { label: string; min: number; max: number; remark: string };

export type ChooserSheet = { classId: string; arm: string; subjectId: string; subject: string; teacher: string | null; teacherId: string | null; state: State; roll: number; entered: number; scored: number; mine: boolean };

export type Chooser = {
  term: Term;
  levels: string[];
  level: string | null;
  arms: Array<{ id: string; name: string; level: string }>;
  picked: { id: string; name: string } | null;
  subjects: ChooserSheet[];
  kpis: { in: number; expected: number; outstanding: number; approved: number; withTeacher: number; impossible: number; impossibleNames: string[] };
  outstanding: ChooserSheet[];
  unavailable: boolean;
};

export type Grid = {
  term: Term;
  arm: { id: string; name: string; section: string | null; level: string };
  subject: { id: string; name: string; code: string; category: string; teacher: string | null; teacherId: string | null; passMark: number };
  state: State;
  columns: Column[];
  pinned: boolean;
  frameworkAt: string | null;
  rows: Array<SheetRow & { others: number | null }>;
  stats: { scored: number; roll: number; mean: number | null; high: { name: string; total: number } | null; low: { name: string; total: number } | null; passed: number; failed: number; armMean: number | null; blanks: number; absences: number };
  bands: Band[];
  passMark: number;
  blocked: string | null;
  editable: boolean;
  mine: boolean;
  enteredBy: string[];
  submittedAt: string | null;
  returned: { note: string; at: string | null; by?: string | null; byRole?: string | null } | null;
  windows: Array<{ component: string; key: string; opensAt: string; closesAt: string; open: boolean; late: boolean }>;
  flags: Flag[];
};

export type BroadsheetEnter = {
  term: Term;
  arm: { id: string; name: string };
  subjects: Array<{ subjectId: string; name: string; code: string; teacher: string | null; state: State; scored: number; mean: number | null }>;
  rows: Array<{ id: string; name: string; adm: string; totals: Array<number | null> }>;
  bands: Array<{ label: string; min: number; max: number }>;
};

export type ReviewArm = { id: string; name: string; level: string; master: string | null; masterId: string | null; sheets: number; in: number; approved: number; flags: number; roll: number; pending: string[]; pendingIds: string[]; state: string };
export type TrackerSheet = { classId: string; subjectId: string; unit: string; sub: string; owner: string; ownerId: string | null; state: State; age: string; overdue: boolean };

export type ReviewOverview = {
  term: Term;
  school: string;
  scheme: string;
  windows: Array<{ component: string; opensAt: string; closesAt: string }>;
  closes: string | null;
  closedDays: number | null;
  kpis: { expected: number; in: number; outstanding: number; approved: number; ready: number; readyStudents: number; readyArms: number; returned: number; oldestReturned: number; impossible: number; impossibleNames: string[]; past: number };
  arms: ReviewArm[];
  tracker: TrackerSheet[];
  verification: Array<{ kind: string; count: number; found: string; title: string; what: string }>;
  returned: Array<{ classId: string; subjectId: string; name: string; teacher: string | null; teacherId: string | null }>;
  mine: Array<{ classId: string; subjectId: string; name: string }>;
  readySheets: Array<{ classId: string; subjectId: string; name: string; roll: number }>;
  unavailable: boolean;
};

export type ArmReview = {
  term: Term;
  arm: { id: string; name: string; level: string; master: string | null };
  roll: number;
  kpis: { approved: number; sheets: number; awaiting: number; ready: number; returned: number; flags: number; blocked: number };
  subjects: Array<{ subjectId: string; name: string; teacher: string | null; teacherId: string | null; state: State; scored: number; roll: number; entered: string; mean: number | null; flags: number; mine: boolean }>;
  students: Array<{ id: string; name: string; adm: string; scored: number; expected: number; average: number | null; pos: number | null; grade: string | null; ready: boolean; blockedBy: string[]; absences: number }>;
  ready: Array<{ subjectId: string; name: string; roll: number }>;
  armMean: number | null;
  excluded: string[];
};

export type SheetPage = {
  term: Term;
  arm: { id: string; name: string };
  subject: { id: string; name: string; category: string; passMark: number };
  state: State;
  columns: Column[];
  pinned: boolean;
  frameworkAt: string | null;
  teacher: { id: string | null; name: string; phone: string | null; role: string; staffNo: string | null; dept: string | null } | null;
  rows: SheetRow[];
  stats: { scored: number; roll: number; mean: number | null; high: { name: string; total: number } | null; low: { name: string; total: number } | null; passed: number; failed: number; armMean: number | null };
  distribution: Array<{ label: string; min: number; max: number; remark: string; count: number }>;
  flags: Flag[];
  outcomes: string[];
  openFlags: number;
  decision: { submittedAt: string | null; submittedBy: string | null; decidedAt: string | null; decidedBy: string | null; note: string | null; returnedAt: string | null };
  enteredBy: Array<string | undefined>;
  corrections: { all: number; open: number };
  mine: boolean;
  canDecide: boolean;
  reversible: boolean;
  reverseUntil: string | null;
  published: boolean;
  cardsWaiting: number;
};

export type ResultArm = {
  id: string;
  name: string;
  level: string;
  masterId: string | null;
  master: string | null;
  roll: number;
  computed: number;
  average: number | null;
  pass: number | null;
  credit: number | null;
  top: { grade: string | null; name: string } | null;
  incomplete: boolean;
  blocked: number;
  pending: number;
  subjects: number;
};

export type ResultsOverview = {
  term: Term;
  scheme: string;
  passMark: number;
  kpis: { computed: number; total: number; average: number | null; pass: number | null; credit: number | null; best: ResultArm | null; weakest: ResultArm | null; incomplete: number };
  arms: ResultArm[];
  subjects: Array<{ name: string; average: number; pass: number; credit: number; high: number; weakest: string; scored: number }>;
  withoutSubjects: number;
  blockedArms: string[];
};

export type ArmBroadsheet = {
  term: Term;
  arm: { id: string; name: string; level: string; master: string | null };
  summary: ResultArm;
  subjects: Array<{ id: string; name: string; code: string; state: State; mean: number | null; pass: number | null }>;
  students: Array<{ id: string; name: string; adm: string; average: number | null; grade: string | null; pos: number | null; total: number; ready: boolean; blockedBy: string[]; totals: Array<number | null> }>;
  correctionIds: string[];
  scheme: string;
  passMark: number;
};

export type StudentPage = {
  term: Term;
  scheme: string;
  passMark: number;
  arm: { id: string; name: string; level: string };
  student: { id: string; name: string; adm: string };
  summary: { average: number | null; approvedAverage: number | null; grade: string | null; pos: number | null; outOf: number; levelPos: number | null; levelOutOf: number; level: string; scored: number; expected: number; passed: number; credits: number; armAverage: number; ready: boolean; blockedBy: string[] };
  absences: string[];
  subjects: Array<{ subjectId: string; name: string; state: State; teacher: string | null; columns: Column[]; cells: Record<string, CellValue>; total: number | null; grade: string | null; pos: number | null; rating: string; scored: number; passMark: number; counts: boolean }>;
  session: { name: string; terms: Array<{ id: string; name: string; average: number; position: number | null; status: string; published: string | null; current: boolean }>; average: number | null; direction: number | null };
  attendance: { pct: number; days: number } | null;
  card: { status: string; published: string | null } | null;
  corrections: Array<{ id: string; subjectId: string; component: string; from: number | null; to: number; status: string }>;
  generated: string;
  bands: Array<{ label: string; min: number; max: number; remark: string; gpa: number | null }>;
};

export type Correction = {
  id: string;
  classId: string;
  subjectId: string;
  studentId: string;
  arm: string;
  subject: string;
  student: string;
  adm: string;
  component: string;
  from: number | null;
  to: number;
  reason: string;
  explanation: string;
  evidence: string | null;
  status: string;
  open: boolean;
  reachedParent: boolean;
  requestedBy: string;
  requestedById: string;
  requestedAt: string;
  stepOneBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  effect: { avgBefore: number | null; avgAfter: number | null; posBefore: number | null; posAfter: number | null } | null;
  revision: number | null;
  steps: number;
  nextStep: number | null;
};

export type CorrectionOptions = { reasons: string[]; subjects: string[]; components: string[]; students: Array<{ id: string; name: string; adm: string; arm: string }>; routing: string };

export type Explain =
  | { kind: "result"; student: { id: string; name: string; adm: string }; arm: string; term: string; lines: Array<{ name: string; total: number | null; counted: boolean; why: string }>; sum: number; count: number; average: number | null; grade: string | null; pos: number | null; outOf: number; scheme: string; bands: Band[] }
  | { kind: "subject"; student: { id: string; name: string; adm: string }; arm: string; term: string; subject: string; total: number | null; lines: Array<{ name: string; max: number; weight: number; value: string | null; at: string | null; by: string | null; corrected: number }>; grade: { label: string; remark: string; min: number; max: number; gpa: number | null } | null; pos: number | null; outOf: number; levelPos: number | null; levelOutOf: number; level: string; teacher: string | null; state: State; approvedBy: string | null; approvedAt: string | null; frameworkAt: string | null; corrections: Array<{ component: string; from: number | null; to: number; status: string; at: string }>; rating: string; ordinal: string | null };
