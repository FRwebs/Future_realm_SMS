/** What `/api/v1/report-cards` answers with — the shapes the Report Cards tabs and pages read. */

export type Term = { id: string; name: string; session: string };
export type CardState = "Published" | "Withheld" | "Blocked" | "Remark owed" | "Awaiting review" | "Ready";
export type PublishDate = { iso: string; days: number } | null;

export type RemarksOverview = {
  term: Term;
  levels: string[];
  level: string | null;
  arms: Array<{ id: string; name: string; level: string }>;
  arm: string | null;
  label: string;
  students: Array<{ id: string; classId: string; arm: string; name: string; adm: string; average: number | null; band: string; attendance: number | null; teacher: string; reviewed: boolean; state: string }>;
  tracker: Array<{ classId: string; arm: string; owner: string | null; ownerId: string | null; written: number; roll: number; state: string }>;
  kpis: { students: number; teacherIn: number; waiting: number; reviewed: number; firstWaiting: { classId: string; id: string } | null; first: { classId: string; id: string } | null };
  publishDate: PublishDate;
  bands: string[];
  unavailable: boolean;
  school: string;
  owing: Array<{ id: string; name: string }>;
};

export type RemarkPage = {
  school: string;
  term: Term;
  arm: { id: string; name: string; master: string | null };
  student: { id: string; name: string; adm: string; first: string };
  position: number;
  of: number;
  peers: Array<{ id: string; name: string; reviewed: boolean }>;
  next: { id: string; name: string } | null;
  previous: { id: string; name: string } | null;
  summary: { average: number | null; band: string; pos: number | null; outOf: number; grade: string | null; armAverage: number | null; best: { name: string; total: number | null } | null; weakest: { name: string; total: number | null } | null; passed: number; subjects: number; blocked: boolean; blockedBy: string[]; state: string };
  attendance: { pct: number | null; absent: number; days: number };
  subjects: Array<{ name: string; total: number | null; grade: string | null; pos: number | null; classAvg: number | null; standing: string; state: string }>;
  teacher: { state: string; text: string; by: string | null; role: string; when: string; onBehalf: boolean; ownerId: string | null };
  mine: { state: string; text: string; tone: string; flags: string[]; by: string | null };
  suggestion: string;
  tones: string[];
  flagOptions: string[];
  minRemark: number;
  history: Array<{ term: string; average: number; pos: number | null; published: string | null; state: string; remark: string | null }>;
  canWriteFormMaster: boolean;
  canReview: boolean;
  published: boolean;
  cardState: string;
};

export type CompletionArm = { id: string; name: string; level: string; master: string | null; masterId: string | null; roll: number; ready: number; blocked: number; owed: number; inReview: number; published: number; withheld: number; average: number | null; state: string; noPrincipal: number; unassigned: string[] };

export type CompletionOverview = {
  term: Term;
  policy: { withholdForDebt: boolean; reversibleMinutes: number; minRemark: number };
  arms: CompletionArm[];
  levels: string[];
  kpis: { cards: number; ready: number; clear: number; arms: number; blocked: number; owed: number; inReview: number; published: number; withheld: number; blockedArms: string[]; owedArms: number; noPrincipal: number };
  holding: { unassigned: string[]; unplaced: number; withoutSubjects: number };
  publishDate: PublishDate;
  unavailable: boolean;
  school: string;
};

export type CompletionArmPage = {
  school: string;
  term: Term;
  arm: { id: string; name: string; level: string };
  policy: CompletionOverview["policy"];
  master: { id: string; name: string; phone: string | null; role: string } | null;
  sum: { roll: number; ready: number; blocked: number; owed: number; inReview: number; published: number; withheld: number };
  state: string;
  subjects: { approved: number; of: number };
  children: Array<{ id: string; name: string; adm: string; average: number | null; pos: number | null; grade: string | null; scores: boolean; remark: string; review: boolean; state: CardState; portal: string; fee: string; withheld: boolean; blockedBy: string[]; revision: number; published: boolean }>;
  principalWritten: number;
  remarksWritten: number;
  emails: number;
  guardians: number;
  publishDate: PublishDate;
};

export type CardComponent = { name: string; short: string; max: number; score: number | "ABS" | null };
export type CardSubject = { subjectId: string; subject: string; teacher: string | null; components: CardComponent[]; total: number | null; grade: string | null; remark: string; pos: number | null; outOf: number; classAvg: number | null; caTotal: number | null; examTotal: number | null };
export type CardData = {
  studentId: string; studentName: string; admissionNumber: string; gender: string; dob: string | null; className: string; arm: string; formMaster: string | null; term: string; termId: string; session: string; classId: string;
  attendance: { days: number; present: number; absent: number; pct: number | null };
  subjects: CardSubject[]; total: number; average: number | null; grade: string | null; gradeRemark: string | null; position: number | null; outOf: number; passed: number; credits: number; expected: number;
  classTeacherRemark: string; principalRemark: string; classTeacherBy: string | null; principalBy: string | null;
  traits: Array<{ title: string; items: Array<{ label: string; value: string }> }>;
  resumption: string | null; issuedAt: string | null; scheme: string; frameworkNote: string;
};

export type CardView = {
  school: { name: string; place: string; contact: string };
  card: CardData;
  live: boolean;
  snapshot: boolean;
  state: "Published" | "Revised" | "Withheld" | "Draft";
  revision: number;
  reference: string;
  published: string | null;
  withheldReason: string | null;
  delivery: string | null;
  revisions: Array<{ revision: number; kind: string; reason: string; createdAt: string; notified: boolean }>;
  peers: Array<{ id: string; name: string }>;
  term: Term;
  generated: string;
};

export type ArchiveOverview = {
  terms: Array<{ id: string; name: string; session: string; current: boolean }>;
  arms: Array<{ id: string; name: string }>;
  kpis: { issued: number; sessions: number; revisions: number; undelivered: number; withheld: number };
  rows: Array<{ studentId: string; name: string; adm: string; classId: string | null; arm: string; termId: string; term: string; revision: number; state: string; delivery: string; reference: string | null; published: string | null }>;
  revisions: Array<{ id: string; name: string; studentId: string; termId: string; term: string; revision: number; kind: string; reason: string; at: string; notified: boolean }>;
  batches: Array<{ id: string; kind: string; scope: string; cards: number; by: string; at: string; channels: string[]; reversible: boolean; termId: string; term: string }>;
  policy: { reversibleMinutes: number };
  filters: { term: string | null; arm: string | null };
};
