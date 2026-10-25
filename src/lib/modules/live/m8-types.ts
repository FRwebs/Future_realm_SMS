/** The shapes `/api/v1/student-records` answers with, as the Student Records tabs and pages read them. */

export type StudentState = "Enrolled" | "Blocked" | "Withdrawn" | "Alumni";
export type FeeState = "Paid" | "Part paid" | "Outstanding" | "Not billed";
export type Portal = "Active" | "Not activated";

export type RegistryRow = {
  id: string;
  name: string;
  boarding: "Day" | "Boarding";
  arm: string;
  level: string;
  adm: string;
  gender: string;
  guardian: { id: string; name: string; relation: string; phone: string } | null;
  att: number | null;
  avg: number | null;
  grade: string;
  fee: FeeState;
  portal: Portal;
  state: StudentState;
};

export type Registry = {
  term: { id: string; name: string; session: string; label: string } | null;
  school: string;
  totals: { records: number; enrolled: number; withoutArm: number; alumni: number; withdrawn: number; blocked: number; in: number; out: number; owingFamilies: number; noGuardianPortal: number; noGuardian: number; pendingChanges: number; arms: number };
  rows: RegistryRow[];
  options: { arms: string[]; levels: string[] };
};

export type EnrolOptions = {
  admissionNumber: string;
  levels: string[];
  arms: Array<{ id: string; name: string; level: string; seats: number }>;
  terms: string[];
  guardians: Array<{ id: string; name: string; phone: string; children: number }>;
};

export type AttendanceSession = {
  session: string;
  terms: Array<{ term: string; days: number; present: number; absent: number; late: number; excused: number; state: string }>;
  days: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  pct: number | null;
  marked: number;
};

export type DossierSubject = {
  id: string;
  name: string;
  category: string;
  teacher: string | null;
  dept: string;
  total: number | null;
  grade: string;
  pos: number | null;
  outOf: number;
  classAvg: number | null;
  standing: string;
  state: string;
  components: Array<{ name: string; score: number; max: number }>;
};

export type Dossier = {
  id: string;
  /** The child's own sign-in to the student portal. */
  account?: { hasLogin: boolean; active: boolean; email: string | null; lastSignIn: string | null; passwordChangedAt: string | null; mustChangePassword: boolean; twoStep: boolean };
  name: string;
  fullName: string;
  initials: string;
  adm: string;
  status: string;
  state: StudentState;
  gender: string;
  dob: string | null;
  age: number;
  nationality: string;
  stateOfOrigin: string | null;
  language: string;
  address: string | null;
  house: string | null;
  admitted: string | null;
  previousSchool: string | null;
  boarding: { is: boolean; where: string | null };
  hasPhoto: boolean;
  portal: Portal;
  arm: { id: string; name: string; level: string; capacity: number } | null;
  roll: number;
  formMaster: { id: string; name: string; role: string; phone: string; email: string; since: number; portal: Portal } | null;
  term: { id: string; name: string; session: string; label: string } | null;
  attendance: {
    days: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    pct: number | null;
    sessions: AttendanceSession[];
    entries: Array<{ date: string; mark: string; reason: string | null; accepted: string; source: string }>;
  };
  academic: {
    sheet: { avg: number; total: number; grade: string; position: number | null; outOf: number; status: string; passed: number } | null;
    subjects: DossierSubject[];
    scored: number;
    strongest: { name: string; total: number | null } | null;
    weakest: { name: string; total: number | null } | null;
    history: Array<{ termId: string; term: string; session: string; avg: number; pos: number | null; grade: string; state: string; published: string | null; current: boolean }>;
    registration: { count: number; track: string; fixed: boolean };
    passMark: number;
  };
  cards: Array<{ id: string; termId: string; term: string; session: string; avg: number | null; pos: number | null; grade: string; state: string; published: string | null }>;
  /** The child's learning support plan: what their teachers must do, and — only for those who write it — the background behind it. */
  support?: { canManage: boolean; plan: { id: string; strategies: Array<{ area: string; strategy: string }>; reviewedOn: string; nextReviewOn: string; overdue: boolean; author: { name: string; title: string } | null; confidentialNote?: string | null } | null };
  wellbeing: {
    log: Array<{ id: string; date: string; kind: string; entry: string; by: string; outcome: string; visibleTo: string }>;
    counselling: number;
    visits: number;
    health: { conditions: string | null; allergies: string | null; bloodGroup: string | null; genotype: string | null; notes: string | null } | null;
  };
  family: {
    guardians: Array<{ id: string; name: string; initials: string; relation: string; phone: string; email: string | null; occupation: string | null; primary: boolean; portal: Portal; delivery: string; visibility: string[]; canCollect: boolean }>;
    primaryId: string | null;
    consent: Array<{ code: string; name: string; required: boolean; status: string; means: string | null; on: string | null }>;
    collectors: Array<{ id: string; name: string; relation: string; note: string; own: boolean }>;
    sent: Array<{ label: string; sub: string; pill: string }>;
    siblings: number;
    guardianIds: string[];
  };
  fees: {
    billed: number;
    paid: number;
    owing: number;
    state: FeeState;
    days: number;
    structures: string[];
    items: Array<{ name: string; amount: number; structure: string; invoice: string }>;
    invoices: Array<{ id: string; number: string; term: string; total: number; balance: number; status: string }>;
    receipts: Array<{ id: string; ref: string; amount: number; mode: string; reference: string; at: string | null; term: string; by: string }>;
    familyId: string;
  };
  records: {
    documents: Array<{ id: string; label: string; source: string; on: string | null; state: string; file: string }>;
    missing: string[];
    required: number;
    changes: Array<{ id: string; field: string; before: string | null; after: string; status: string; at: string }>;
    pending: number;
    audit: Array<{ label: string; by: string; at: string }>;
  };
};

export type TermResult = {
  school: { name: string; address: string; phone: string; email: string };
  student: { name: string; adm: string; gender: string };
  attendance: { days: number; present: number; pct: number | null };
  term: { id: string; name: string; session: string };
  arm: string;
  avg: number;
  total: number;
  grade: string;
  position: number | null;
  outOf: number;
  status: string;
  state: string;
  published: string | null;
  teacherComment: string | null;
  principalComment: string | null;
  components: string[];
  subjects: Array<{ id: string; name: string; category: string; components: Array<{ name: string; code: string; order: number; score: number; max: number }>; total: number; grade: string; classAvg: number | null; standing: string }>;
};

export type ChangeItem = {
  id: string;
  studentId: string;
  student: string;
  adm: string;
  field: string;
  before: string;
  after: string;
  reason: string | null;
  evidence: string | null;
  by: { name: string; role: string };
  byId: string | null;
  ownRequest: boolean;
  age: number;
  hours: number;
  at: string;
};

export type Changes = {
  term: { name: string; session: string; label: string } | null;
  pending: ChangeItem[];
  approved: Array<ChangeItem & { status: string; decidedBy: { name: string; role: string }; decidedAt: string | null; note: string | null }>;
  completeness: Array<{ key: string; label: string; sub: string; count: number; tone: string; items: Array<{ id: string; label: string; sub: string }> }>;
  duplicates: Array<{ ids: string[]; label: string; sub: string }>;
  migration: { job: string; presented: number | null; signedOffBy: string | null; signedOffOn: string | null; rolledBack: boolean } | null;
  total: number;
  fields: string[];
};

export type Stage = "Enquiry" | "Applied" | "Assessed" | "Offered" | "Accepted" | "Enrolled";

export type ApplicantRow = {
  id: string;
  name: string;
  gender: string;
  dob: string;
  ref: string;
  forClass: string;
  guardian: string;
  phone: string;
  screening: { at: string; venue: string | null } | null;
  needsScreening: boolean;
  score: number | null;
  stage: Stage | "Declined" | "Waitlisted";
  status: string;
  days: number;
  cycle: string;
  cycleId: string | null;
  feeCleared: boolean;
  duplicate: boolean;
  offerExpires: string | null;
};

export type DiarySession = { id: string; date: string; start: string; end: string; forLabel: string; seats: number; booked: number; invigilator: string; venue: string; type: string };

export type AdmissionsBoard = {
  cycle: string;
  stages: Array<{ stage: Stage; count: number }>;
  rows: ApplicantRow[];
  all: number;
  closed: number;
  sessions: DiarySession[];
  holding: { needDate: number; expiring: number; noPhone: number; toConvert: number };
  conversion: number;
  byClass: Array<{ name: string; total: number; enrolled: number }>;
  cycles: Array<{ name: string; enquiries: number; applied: number; offered: number; enrolled: number; rate: number; open: boolean }>;
  history: ApplicantRow[];
};

export type AdmissionOptions = { levels: string[]; terms: string[]; staff: string[]; sessions: DiarySession[] };

export type Applicant = {
  id: string;
  name: string;
  gender: string;
  dob: string;
  ref: string;
  forClass: string;
  cycle: string;
  stage: Stage | "Declined" | "Waitlisted";
  stageIndex: number;
  status: string;
  declined: boolean;
  waitlisted: boolean;
  days: number;
  opened: string;
  next: { step: string; label: string } | null;
  feeCleared: boolean;
  guardian: { name: string; phone: string; email: string | null; secondName: string | null; secondPhone: string | null; address: string | null };
  child: { previousSchool: string | null; medical: string | null };
  screening: { at: string; venue: string | null; by: string | null; score: number | null; max: number; result: string | null; completed: boolean } | null;
  offer: { number: string; status: string; sentAt: string | null; expiresAt: string } | null;
  stages: Array<{ name: Stage; done: boolean; when: string | null; by: string | null; note: string | null }>;
  documents: Array<{ label: string; source: string; received: string | null; verified: boolean }>;
  missingDocuments: string[];
  said: Array<{ label: string; sub: string }>;
  placesLeft: number | null;
  siblingInSchool: boolean;
  otherApplications: number;
  student: { id: string; adm: string } | null;
  duplicate: string | null;
  fee: { status: string; waived: boolean };
};
