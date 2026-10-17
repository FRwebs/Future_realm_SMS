/** The shapes `/api/v1/parents-guardians` answers with, as the Parents & Guardians tabs and pages read them. */

export type GuardianPortal = "Active" | "Invited" | "Not activated";
export type Delivery = "Delivered" | "Failing" | "No number";
export type Coverage = "Complete" | "Gaps" | "None";

export type FamilyRow = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  email: string | null;
  occupation: string | null;
  portal: GuardianPortal;
  delivery: Delivery;
  consent: Coverage;
  consents: Record<string, string>;
  children: Array<{ id: string; name: string; arm: string; level: string }>;
  owes: number;
  amount: number;
  phoneOnly: boolean;
  second: boolean;
  language: string;
  joined: number;
  givenBy: string;
};

export type Families = {
  rows: FamilyRow[];
  totals: { families: number; children: number; active: number; never: number; neverChildren: number; failing: number; noPhone: number; phoneOnly: number; second: number; reachable: number; otherLanguage: number };
  duplicates: Array<{ kind: string; key: string; ids: string[]; label: string; sub: string; same: boolean }>;
  options: { levels: string[]; arms: string[] };
};

export type GuardianOptions = {
  students: Array<{ id: string; name: string; adm: string; arm: string }>;
  guardians: Array<{ id: string; name: string; phone: string; children: number }>;
  consents: string[];
  relations: string[];
  visibility: string[];
};

export type FamilyChild = {
  id: string;
  name: string;
  gender: string;
  boarding: string;
  adm: string;
  arm: string;
  level: string;
  att: number | null;
  avg: number | null;
  grade: string;
  pos: number | null;
  fee: string;
  billed: number;
  paid: number;
  owing: number;
  structures: string[];
  state: string;
  primary: boolean;
  see: string[];
  collect: boolean;
};

export type Family = {
  id: string;
  name: string;
  initials: string;
  relation: string;
  phone: string;
  email: string | null;
  occupation: string | null;
  address: string | null;
  language: string;
  secondName: string | null;
  secondPhone: string | null;
  canSms: boolean;
  canEmail: boolean;
  phoneOnly: { reason: string | null; mode: string | null } | null;
  portal: GuardianPortal;
  delivery: Delivery;
  invalidPhone: boolean;
  joined: number;
  children: FamilyChild[];
  owes: number;
  amount: number;
  billed: number;
  days: number;
  receipts: number;
  attendance: number | null;
  consent: Coverage;
  consents: Array<{ code: string; name: string; required: boolean; blocks: string; status: string; means: string | null; on: string | null }>;
  collectors: Array<{ id: string; name: string; relation: string; phone: string; photo: boolean }>;
  sent: Array<{ label: string; sub: string; pill: string }>;
  familyHref: string | null;
};

export type ConsentTypeRow = { code: string; name: string; short: string; who: string; required: boolean; covers: string; blocks: string; given: number; gaps: number; withdrawn: number };

export type ConsentOverview = {
  types: ConsentTypeRow[];
  rows: FamilyRow[];
  totals: { families: number; complete: number; gaps: number; noCore: number; noCoreChildren: number; required: number; optional: number; noPortal: number };
  withdrawals: Array<{ code: string; name: string; count: number; latest: string | null; who: string[] }>;
  options: { levels: string[]; arms: string[] };
};

export type SubmissionItem = {
  id: string;
  type: string;
  family: string;
  child: string | null;
  detail: string;
  owner: string;
  ownerRole: string;
  state: string;
  open: boolean;
  overdue: boolean;
  age: string;
  days: number;
  sla: number;
  outcome: string | null;
  channel: string | null;
  at: string;
  resolvedAt: string | null;
};

export type Submissions = {
  items: SubmissionItem[];
  totals: { open: number; overdue: number; resolved: number; median: number | null; all: number };
  levels: Array<{ name: string; target: number; reviewer: string; accepted: boolean; open: number; overdue: number }>;
  types: string[];
};

export type SubmissionOptions = { guardians: Array<{ id: string; name: string; phone: string; children: Array<{ id: string; name: string }> }>; types: string[] };
