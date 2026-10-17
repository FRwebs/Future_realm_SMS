/** The shapes `/api/v1/fee-management` answers with, as the Fee Management tabs and pages read them. */

export type Bucket = "Current" | "30 days" | "60 days" | "90+ days";
export type Stage = "Not started" | "First reminder" | "Second reminder" | "Meeting requested" | "On a payment plan";

export type PaymentRow = {
  id: string;
  ref: string;
  student: string;
  adm: string;
  arm: string;
  amount: number;
  kind: "Full payment" | "Part payment";
  mode: string;
  bankRef: string | null;
  by: string;
  at: string | null;
  invoice: string | null;
};

export type FamilyRow = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  portal: "Active" | "Not activated";
  owing: number;
  billed: number;
  paid: number;
  days: number;
  bucket: Bucket;
  stage: Stage;
  children: Array<{ id: string; name: string; arm: string; level: string; owing: number }>;
  canSms: boolean;
};

export type Collections = {
  term: { id: string; name: string; session: string; label: string } | null;
  school: string;
  totals: { expected: number; collected: number; outstanding: number; families: number; over90: number; over90Families: number; discount: number; lastTermRate: number | null; receipts: number };
  payments: PaymentRow[];
  recent: { amount: number };
  debtors: FamilyRow[];
  bars: { sections: Array<{ name: string; billed: number; paid: number }>; methods: Array<{ name: string; amount: number }>; items: Array<{ name: string; expected: number; collected: number }> };
  payers: Array<{ id: string; name: string; adm: string; arm: string; owing: number; billed: number; paid: number; family: string; guardian: string }>;
  options: { levels: string[]; arms: string[]; methods: string[] };
  receiptPrefix: string;
};

export type FormClass = { className: string; rows: Array<{ id: string; name: string; adm: string; status: string; guardian: string }>; outstanding: number };

export type FamilyDetail = {
  family: FamilyRow & { email: string | null; guardianId: string | null };
  children: Array<{
    id: string;
    name: string;
    adm: string;
    arm: string;
    boarding: boolean;
    structures: string[];
    billed: number;
    paid: number;
    owing: number;
    state: string;
    invoices: Array<{ id: string; number: string; structure: string; total: number; received: number; balance: number; issuedOn: string; items: Array<{ description: string; amount: number }> }>;
  }>;
  receipts: PaymentRow[];
  contacts: Array<{ id: string; kind: string; channel: string | null; summary: string; at: string; meetingAt: string | null }>;
  plans: Array<{ id: string; number: string; status: string; total: number; balance: number; notes: string | null; items: Array<{ id: string; dueOn: string; amount: number; paid: number; status: string }> }>;
  adjustments: Array<{ id: string; type: string; amount: number; reason: string; at: string }>;
  policy: { receiptPrefix: string; writeOffBy: string; approvalLimit: number };
};

export type StructureRow = {
  id: string;
  ref: string;
  name: string;
  kind: string;
  state: "Published" | "Draft" | "Archived";
  classes: string[];
  mapped: boolean;
  items: number;
  students: number;
  termly: number;
  expected: number;
  term: string | null;
  session: string | null;
};

export type RuleRow = { code: string; name: string; appliesTo: string; valueIs: string; value: number; items: string[]; stacks: string; until: string; endDate?: string; visible: boolean; families: number | null };

export type Structures = {
  term: { id: string; label: string } | null;
  structures: StructureRow[];
  totals: { count: number; published: number; draft: number; expected: number; classesMapped: number; classes: number; placements: number; boarders: number; rules: number; discount: number };
  rules: RuleRow[];
  levels: Array<{ id: string; name: string }>;
  unmappedStructures: number;
};

export type StructureDetail = Omit<StructureRow, "items"> & {
  items: Array<{ id: string; name: string; type: string; freq: string; amount: number; takers: number; expected: number; collected: number; pct: number | null }>;
  levels: Array<{ id: string; name: string; students: number; billed: number; pct: number | null }>;
  allLevels: Array<{ id: string; name: string }>;
  publishedOn: string;
  termLabel: string | null;
  termlyAll: number;
  sessional: number;
  rules: Array<{ name: string; appliesTo: string; valueIs: string; value: number }>;
  owner: string | null;
  note: string | null;
};

export type PublishPreview = {
  id: string;
  name: string;
  state: string;
  mapped: boolean;
  kind: string;
  invoices: number;
  alreadyBilled: number;
  perStudent: number;
  total: number;
  families: number;
  noPhone: number;
  noGuardian: number;
  rules: Array<{ name: string; auto: boolean }>;
  concession: string | null;
};

export type CashUpRow = { day: string; recorded: number; counted: number | null; variance: number | null; by: string; byRole: string; state: "Closed" | "In progress" | "Unreconciled"; note: string | null };

export type Review = {
  term: string;
  cashup: CashUpRow[];
  unreconciled: number;
  oldestUnreconciled: string | null;
  openVariance: number;
  recorders: Array<{ name: string; role: string; n: number; value: number; reversals: number; duplicates: number }>;
  flags: Array<{ key: string; label: string; count: number; found: string; action: string; items: Array<{ id: string; label: string; sub: string }> }>;
  flagCount: number;
  waivers: Array<{ id: string; family: string; child: string; arm: string; type: string; value: number; reason: string; days: number; by: string; invoice: string }>;
  waiverValue: number;
  oldestWaiver: number;
};

export type History = {
  session: string;
  kpis: { collectedSession: number; collectedTerm: number; expectedTerm: number; receipts: number; reversals: number; reversalValue: number; outstanding: number };
  terms: Array<{ id: string; session: string; term: string; expected: number; collected: number; rate: number | null; never: number; receipts: number; state: string }>;
  sections: Array<{ name: string; students: number; expected: number; collected: number; rate: number | null }>;
  receipts: Array<{ id: string; ref: string; student: string; adm: string; arm: string; amount: number; mode: string; bankRef: string | null; by: string; at: string }>;
  recorders: string[];
  options: { sessions: string[] };
};

export type ReceiptDoc = {
  id: string;
  ref: string;
  issued: string | null;
  payer: string;
  student: string;
  adm: string;
  arm: string;
  mode: string;
  bankRef: string;
  date: string | null;
  by: string;
  paid: number;
  billed: number;
  paidToDate: number;
  balance: number;
  receipts: number;
  term: string;
  invoice: string | null;
  items: Array<{ label: string; billed: number; previously: number; applied: number; balance: number }>;
  school: { name: string; address: string; phone: string; email: string };
  ageing: string;
  daysOld: number;
};
