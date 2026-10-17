/** The shapes `/api/v1/staff-access` answers with, as the Staff & Access tabs and pages read them. */

export type AccountState = "Active" | "Dormant" | "Never activated" | "Suspended";
export const ACTION_LIST = ["View", "Create", "Edit", "Approve", "Export", "Delete"] as const;
export type ActionName = (typeof ACTION_LIST)[number];

export type DirectoryRow = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string;
  staffNo: string | null;
  role: string;
  roleCode: string;
  department: string;
  employment: string;
  joined: string | null;
  joinedLabel: string;
  account: AccountState;
  accountDays: number;
  lastLoginAt: string | null;
  openTasks: number;
  periods: number;
  isYou: boolean;
};

export type DelegationRow = {
  id: string;
  userId: string;
  person: string;
  holds: string;
  grantedBy: string;
  grantedOn: string;
  expiresOn: string | null;
  reason: string;
  status: "Active" | "Expired";
};

export type Directory = {
  counts: {
    total: number;
    departments: number;
    active: number;
    dormant: number;
    never: number;
    suspended: number;
    delegationsActive: number;
    delegationsExpired: number;
    offboarded: number;
  };
  never: Array<{ id: string; name: string; role: string; days: number }>;
  rows: DirectoryRow[];
  delegations: DelegationRow[];
  roleOptions: string[];
  departmentOptions: string[];
};

export type Person = {
  userId: string;
  staffId: string | null;
  name: string;
  department: string;
  role: string;
  roleCode: string;
  hasTemplate: boolean;
  reach: number;
  moduleSlugs: string[];
  tabs: number;
  scope: string;
  fees: string;
  approve: string;
  sensitive: string[];
  account: AccountState;
  accountDays: number;
  above: number;
  aboveWhere: string[];
  below: number;
  isYou: boolean;
};

export type TemplateRow = { name: string; custom: boolean; id: string | null; people: number; reach: number; moduleSlugs: string[]; scope: string; approve: string };
export type GroupRow = { id: string; slug: string; name: string; holders: string[]; holderIds: string[]; covers: string[] };

export type AccessOverview = {
  people: Person[];
  templates: TemplateRow[];
  groups: GroupRow[];
  delegations: DelegationRow[];
  recertification: { last: { by: string; at: string; people: number; note?: string } | null; dueOn: string | null };
  modules: Array<{ code: string; slug: string; name: string; tabs: Array<{ slug: string; label: string }> }>;
};

export type TabGrant = {
  slug: string;
  label: string;
  rowKey: string;
  a: Record<ActionName, boolean>;
  on: number;
  base?: Record<ActionName, boolean>;
};

export type ModuleGrant = {
  code: string;
  slug: string;
  name: string;
  description: string;
  level: number;
  levelLabel: string;
  all: Record<ActionName, boolean>;
  any: Record<ActionName, boolean>;
  ticks: number;
  baseTicks?: number;
  tabs: TabGrant[];
};

export type PersonAccess = {
  userId: string;
  staffId: string | null;
  name: string;
  email: string;
  phone: string | null;
  staffNo: string | null;
  department: string;
  since: string | null;
  role: string;
  roleCode: string;
  hasTemplate: boolean;
  account: AccountState;
  accountDays: number;
  lastLoginAt: string | null;
  mfa: boolean;
  scope: string;
  fees: string;
  approve: string;
  accessEnds: string | null;
  scopeEnds: string | null;
  sensitive: string[];
  above: number;
  aboveKeys: string[];
  below: number;
  modules: ModuleGrant[];
  changes: Array<{ id: string; label: string; detail: string }>;
  recertified: { by: string; at: string } | null;
  canEdit: boolean;
};

export type TemplateGrid = {
  name: string;
  custom: boolean;
  id: string | null;
  purpose: string | null;
  scope: string;
  approve: string;
  people: Array<{ userId: string; name: string; department: string; above: number; below: number }>;
  modules: ModuleGrant[];
};

export type Assignment = {
  id: string;
  source: "subject" | "form" | "duty";
  ref: string;
  what: string;
  kind: string;
  where: string;
  load: string;
  since: string;
  state: string;
};

export type StaffRecord = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  staffNo: string;
  designation: string;
  role: string;
  roleCode: string;
  department: string;
  campus: string;
  employment: string;
  since: string;
  account: AccountState;
  accountDays: number;
  lastLoginAt: string | null;
  reportsTo: { id: string; name: string } | null;
  cover: { id: string; name: string } | null;
  personal: {
    gender: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    stateOfOrigin: string | null;
    address: string | null;
    qualification: string | null;
    years: number | null;
  };
  sensitiveHeld: string[];
  periods: number;
  ceiling: number;
  subjects: string[];
  arms: string[];
  assignments: Assignment[];
  pay: { band: string; bandName: string; step: number | null; method: string | null } | null;
  access: { scope: string; fees: string; approve: string; above: number };
  mfa: boolean;
  sessions: Array<{ id: string; device: string; ip: string | null; lastActivityAt: string; startedAt: string }>;
  signIns: Array<{ id: string; ok: boolean; reason: string | null; device: string | null; ip: string | null; at: string }>;
};

export type OffboardingPlan = {
  id: string;
  name: string;
  formClasses: Array<{ id: string; name: string; roll: number }>;
  subjects: Array<{ id: string; subject: string; arm: string; classId: string }>;
  unsubmittedSheets: number;
  delegations: number;
  routedApprovals: number;
  candidates: Array<{ id: string; name: string; role: string }>;
};

export type ActivityRow = {
  id: string;
  userId: string;
  name: string;
  role: string;
  department: string;
  isYou: boolean;
  registers: { marked: number; of: number } | null;
  sheets: { total: number; submitted: number; returned: number; inProgress: number } | null;
  remarks: { written: number; of: number } | null;
  approvals: { decided: number; open: number } | null;
  messages: number;
  lastLoginAt: string | null;
  account: AccountState;
};

export type Activity = {
  term: { name: string; day: number } | null;
  rows: ActivityRow[];
  totals: { staff: number; registerPct: number | null; sheetsOutstanding: number; teachersWithSheets: number; remarksOutstanding: number; formMastersNotStarted: number };
};

export type RoleOption = { label: string; role: string; teaching: boolean; template: string };

/* ───────────────────────── payroll ───────────────────────── */

export type PaySlip = {
  gross: number;
  allowances: Array<{ name: string; amount: number; treat: string; inPay: boolean }>;
  allowTotal: number;
  employerCost: number;
  taxable: number;
  paye: number;
  pension: number;
  nhf: number;
  deductions: number;
  net: number;
  prorate: number;
  unpaidDays: number;
};

export type PayRow = {
  id: string;
  userId: string;
  name: string;
  role: string;
  department: string;
  bandId: string | null;
  band: string | null;
  bandName: string | null;
  step: number | null;
  stepName: string | null;
  steps: number;
  method: string;
  state: string;
  reference: string | null;
  statusNote: string | null;
  paidAt: string | null;
  gross: number | null;
  allowances: number | null;
  deductions: number | null;
  net: number | null;
  slip: PaySlip | null;
  unpaidDays: number;
  mappedAt: string | null;
  startsThisMonth: boolean;
};

export type BandRow = {
  id: string;
  code: string;
  name: string;
  covers: string;
  coversGroup: string;
  steps: number;
  low: number | null;
  high: number | null;
  staff: number;
  allowances: string[];
  nextReview: string | null;
  isOpen: boolean;
};

export type FlowStageView = { name: string; who: string; does: string; scope: string; win: string; silence: string; notify: string[] };

export type PayrollSetupView = {
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
};

export type PayrollOverview = {
  amountsHidden: boolean;
  month: { month: number; year: number; label: string; monthName: string };
  workingDays: number;
  setup: PayrollSetupView;
  bands: BandRow[];
  rows: PayRow[];
  totals: { people: number; of: number; unmapped: number; gross: number | null; allowances: number | null; cost: number | null; deductions: number | null; net: number | null; needing: number };
  run: { id: string; status: string; stage: string; preparedBy: string | null; approvedBy: string | null } | null;
  offCycle: Array<{ id: string; name: string; kind: string; amount: number | null; payOn: string; status: string; reason: string }>;
  flow: FlowStageView[];
  variations: Array<{ kind: string; label: string; detail: string; tone: string; staffId?: string }>;
};

export type BandDetail = {
  band: {
    id: string;
    code: string;
    name: string;
    covers: string;
    coversGroup: string;
    steps: Array<{ name: string; gross: number }>;
    allowances: Array<{ name: string; who: string; basis: string; rate: number; treat: string }>;
    employerPension: number;
    nextReview: string | null;
    isOpen: boolean;
  };
  people: PayRow[];
  mask: boolean;
  setup: PayrollSetupView;
  month: { month: number; year: number; label: string; monthName: string };
};

/* ───────────────────────── leave ───────────────────────── */

export type LeaveTypeRow = {
  code: string;
  name: string;
  entitlement: number | null;
  unit: string;
  per: string;
  accrual: string;
  carry: string;
  pay: string;
  evidence: string;
  decides: string;
  threshold: number | null;
  notice: string;
  restricted: string[];
  coverRequired: boolean;
  halfDays: boolean;
  statutory: boolean;
  visible: boolean;
  requests: number;
};

export type LeaveRow = {
  id: string;
  staffId: string;
  userId: string;
  name: string;
  role: string;
  department: string;
  type: string;
  pay: string;
  startDate: string;
  endDate: string;
  dates: string;
  days: number;
  cover: string;
  coverState: string;
  stage: string | null;
  stageWho: string | null;
  stageDoes: string | null;
  sequence: string;
  status: string;
  mine: boolean;
  source: string;
  reason: string;
  decisionNote: string | null;
  createdAt: string;
  coverRequired: boolean;
};

export type LeaveOverview = {
  session: string | null;
  types: LeaveTypeRow[];
  stages: FlowStageView[];
  rows: LeaveRow[];
  balances: Array<{ id: string; name: string; role: string; department: string; annual: { used: number; of: number | null }; sick: { used: number; of: number | null }; other: number; total: number; away: boolean }>;
  kpis: { awayToday: number; awayNames: string[]; waiting: number; oldestDays: number; noCover: number; lost: number; annualUsedPct: number | null; staff: number };
};

/* ───────────────────────── appraisal ───────────────────────── */

export type KpiRow = { name: string; measure: string; source: string; weight: number; target: string; scale?: string; runningFigure?: boolean; countsToPay?: boolean; ifMissing?: string };
export type KpiSetView = { kpis: KpiRow[]; changedAt: string | null; changedBy: string | null };

export type AppraisalOverview = {
  cycle: { name: string; termId: string | null; publishedAt: string | null; publishedBy: string | null; deadline: string | null; published: boolean };
  flow: FlowStageView[];
  sets: Record<string, KpiSetView>;
  roles: Array<{ role: string; set: string; kpis: number; weight: number; automatic: number; people: number; publishable: boolean }>;
  people: Array<{ id: string; userId: string; appraisalId: string | null; name: string; role: string; department: string; set: string; stage: string; selfScore: number | null; mine: number | null; evidence: number; reviewer: string | null; isReviewer: boolean }>;
  kpis: { published: number; completed: number; writing: number; withMe: number; average: number | null };
};

export type AppraisalOne = {
  id: string;
  staffId: string;
  name: string;
  role: string;
  department: string;
  set: string;
  cycle: string;
  status: string;
  reviewer: string;
  isReviewer: boolean;
  isSelf: boolean;
  overall: number | null;
  strengths: string | null;
  improvements: string | null;
  reviewerComment: string | null;
  staffComment: string | null;
  sharedAt: string | null;
  kpis: Array<KpiRow & { ratingId: string | null; self: number | null; auto: number | null; mine: number | null; comment: string | null; evidence: string | null }>;
};

export type Moderation = {
  cycle: string;
  reviewed: number;
  of: number;
  departments: Array<{ name: string; average: number; count: number }>;
  managers: Array<{ name: string; average: number; count: number }>;
};

export type PayPerson = {
  mask: boolean;
  row: PayRow;
  setup: PayrollSetupView;
  month: { month: number; year: number; label: string; monthName: string };
  payments: Array<{ id: string; label: string; band: string | null; step: number | null; gross: number | null; net: number | null; method: string | null; status: string; reference: string | null; paidAt: string | null; note: string | null }>;
  changes: Array<{ id: string; at: string; from: string | null; to: string; reason: string }>;
  offCycle: Array<{ id: string; kind: string; amount: number | null; payOn: string; status: string; reason: string }>;
};
