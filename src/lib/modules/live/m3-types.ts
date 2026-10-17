/**
 * The shapes `/api/v1/class-structure` answers with, as the Class & Timetable tabs
 * and pages read them. Kept apart from the builders so a page that only needs to
 * know what an arm looks like does not import every tab.
 */

export type TermRef = { id: string; name: string; session: string };

export type ClassRow = {
  id: string;
  name: string;
  stage: string;
  position: number;
  isActive: boolean;
  visibleToParents: boolean;
  arms: number;
  armNames: string[];
  roll: number;
  capacity: number;
  formMastersNamed: number;
  overArms: string[];
  uncoveredSubjectArms: number;
  state: string;
};

export type ArmRow = {
  id: string;
  name: string;
  levelId: string;
  arm: string;
  stream: string | null;
  room: string | null;
  isActive: boolean;
  roll: number;
  capacity: number;
  formMaster: { id: string; name: string } | null;
  subjects: number;
  uncoveredSubjects: number;
  state: "Over capacity" | "Under-filled" | "Open";
};

export type Unallocated = { id: string; name: string; admissionNumber: string; enrolledAt: string };

export type Overview = {
  term: TermRef | null;
  classes: ClassRow[];
  arms: ArmRow[];
  unallocated: Unallocated[];
  balancing: { armId: string; name: string; roll: number; capacity: number; halves: number[] } | null;
  recent: Array<{ id: string; label: string; detail: string; by: string; at: string }>;
};

export type TeacherRef = { id: string; name: string; department: string | null };

export type SubjectArm = {
  id: string;
  classId: string;
  arm: string;
  armLabel: string;
  levelId: string;
  level: string;
  levelOrder: number;
  subjectId: string;
  subject: string;
  code: string;
  category: string;
  department: string | null;
  teacher: TeacherRef | null;
  assistant: TeacherRef | null;
  periods: number;
  takers: number;
  countsToAverage: boolean;
  daysUnassigned: number;
  compulsory: boolean;
  scores: { state: string; average: number | null; students: number };
};

export type TeacherLoad = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  staffNo: string | null;
  designation: string | null;
  department: string | null;
  subjects: string[];
  arms: string[];
  subjectArms: number;
  sheetsOwed: number;
  periods: number;
  ceiling: number;
  raised: boolean;
  load: "Over the ceiling" | "At the ceiling" | "Within range" | "Under-loaded" | "No assignment" | string;
};

export type InvalidCombination = { student: string; arm: string; detail: string };

export type Teaching = {
  term: TermRef | null;
  schoolCeiling: number;
  subjectArms: SubjectArm[];
  teachers: TeacherLoad[];
  invalidCombinations: InvalidCombination[];
  subjectCount: number;
  catalogue: Array<{ id: string; name: string; code: string; category: string; department: string | null }>;
};

export type CoverageCheck = {
  key: string;
  unit: string;
  sub: string;
  owner: string;
  role: string;
  state: string;
  age: string;
  overdue: boolean;
  count: number;
  href: string;
};

export type Coverage = {
  term: { name: string; day: number } | null;
  checks: CoverageCheck[];
  groups: Record<"By teacher" | "By class" | "By subject", CoverageCheck[]>;
  cards: {
    uncovered: number;
    uncoveredSub: string;
    noArm: number;
    overCeiling: number;
    underLoaded: number;
    unpublishedArms: number;
    timetabledArms: number;
    clashes: number;
  };
};

export type ArmDetail = {
  id: string;
  name: string;
  level: string;
  levelId: string;
  stage: string;
  stream: string | null;
  room: string | null;
  roll: number;
  capacity: number;
  isActive: boolean;
  term: TermRef | null;
  formMaster: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    staffNo: string | null;
    designation: string | null;
    department: string | null;
    since: string | null;
    lastSeen: string | null;
    periods: number;
    load: string;
    subjects: string[];
    otherArms: string[];
  } | null;
  subjects: SubjectArm[];
  siblings: Array<{ id: string; name: string; roll: number; capacity: number; average: number | null }>;
  schoolCeiling: number;
  results: { average: number | null; sheets: number; passRate: number | null; topGrade: string | null };
  roster: Array<{
    id: string;
    name: string;
    admissionNumber: string;
    gender: string;
    guardian: string | null;
    guardianPhone: string | null;
    relationship: string | null;
    average: number | null;
    position: number | null;
    grade: string | null;
    resultState: string;
    attendance: number | null;
    daysMarked: number;
    owes: number;
    portal: string;
  }>;
  activity: Array<{ id: string; label: string; detail: string }>;
};

export type TimetableVersionRow = {
  id: string;
  name: string;
  note: string | null;
  term: string | null;
  state: "DRAFT" | "RUNNING" | "ARCHIVED";
  arms: number;
  periodsPerDay: number;
  builtBy: string;
  builtById: string | null;
  updatedAt: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  synthetic: boolean;
};

export type TimetableList = {
  term: TermRef | null;
  versions: TimetableVersionRow[];
  totals: { arms: number; liveArms: number; clashes: number };
  publishes: Array<{
    id: string;
    action: string;
    at: string;
    by: string;
    detail: Record<string, unknown>;
  }>;
};

export type Cell = { subjectId: string; teacherId: string | null };
export type Grid = Record<string, Record<string, Cell>>;
export type PeriodInfo = { n: number | "break"; start: string; end: string };

export type TimetableDetail = {
  version: {
    id: string;
    name: string;
    state: "DRAFT" | "RUNNING" | "ARCHIVED";
    note: string | null;
    term: string | null;
    termId: string | null;
    periodsPerDay: number;
    periodMinutes: number;
    firstStarts: string;
    breakAfter: number | null;
    schoolDays: string[];
    appliesTo: string;
    checkClashes: boolean;
    builtBy: string | null;
    updatedAt: string;
    publishedAt: string | null;
    scheduledFor: string | null;
    live: boolean;
  };
  arms: Array<{
    id: string;
    name: string;
    level: string;
    levelId: string;
    stage: string;
    room: string | null;
    formMaster: string | null;
  }>;
  subjects: Record<
    string,
    Array<{
      subjectId: string;
      name: string;
      code: string;
      teacherId: string | null;
      teacher: string | null;
      periods: number;
    }>
  >;
  grid: Grid;
  periods: PeriodInfo[];
  clashes: Array<{
    teacherId: string;
    teacher: string;
    day: number;
    dayName: string;
    period: number;
    classIds: string[];
    classNames: string[];
  }>;
};

export type StudentInArm = {
  id: string;
  name: string;
  admissionNumber: string;
  gender: string;
  dateOfBirth: string;
  admissionDate: string;
  status: string;
  nationality: string;
  stateOfOrigin: string | null;
  arm: { id: string; name: string; level: string } | null;
  backArm: string;
  portal: string;
  term: { name: string; session: string } | null;
  guardians: Array<{ id: string; name: string; relationship: string; phone: string; email: string | null; primary: boolean; sms: boolean }>;
  attendance: { marked: number; present: number; absent: number; late: number; excused: number; rate: number | null };
  result: {
    average: number;
    total: number;
    grade: string | null;
    position: number | null;
    outOf: number;
    status: string;
    subjects: Array<{ subject: string; code: string; total: number; components: Array<{ name: string; score: number; max: number }> }>;
  } | null;
  fees: { outstanding: number; invoices: Array<{ id: string; number: string; total: number; balance: number; status: string; dueOn: string }> };
  registration: { track: string; subjects: number } | null;
};
