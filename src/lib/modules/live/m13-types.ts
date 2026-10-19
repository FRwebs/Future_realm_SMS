/** What `/api/v1/approvals-hub` answers with — the shapes the Approvals & Workflow tabs and pages read. */

export type Fact = [string, string, string?];

export type ItemView = {
  key: string;
  type: string;
  typeName: string;
  title: string;
  summary: string | null;
  requester: { name: string; role: string } | null;
  approver: string;
  second: string;
  state: string;
  age: number;
  escalatesIn: number;
  overdue: boolean;
  escalated: boolean;
  blocking: string | null;
  evidence: string | null;
  mine: boolean;
  step: 1 | 2;
  bulk: boolean;
  href: string;
  raisedAt: string;
};

export type QueueOverview = {
  me: { id: string; role: string };
  canSeeAll: boolean;
  scope: "me" | "raised" | "all";
  kpis: { waiting: number; escalating: number; oldest: { days: number; type: string; title: string } | null; blocked: { items: number; text: string }; decided: { count: number; avgDays: number | null }; inFlight: number };
  featured: (ItemView & { facts: Fact[] }) | null;
  waiting: ItemView[];
  list: ItemView[];
  raised: Array<{ key: string; title: string; state: string; line: string }>;
  types: Array<{ type: string; name: string }>;
  counts: Record<string, number>;
};

export type Message = { id: string; kind: string; body: string; at: string; by: string | null; role: string | null; mine: boolean };

export type RouteSummary = { approver: string; second: string; escalateDays: number; escalateTo: string; evidence: boolean; why: string; bulk: boolean };

export type ItemPage = ItemView & {
  decided: { outcome: string; by: string | null; at: string; note: string | null; tookDays: number } | null;
  context: { request: Fact[]; context: Fact[]; downstream: Fact[]; evidence: Fact[]; table?: { title: string; sub: string; head: string[]; rows: string[][] } };
  messages: Message[];
  next: string | null;
  position: number | null;
  of: number;
  route: RouteSummary;
  can: { decide: boolean; comment: boolean };
  requestedAt: string;
};

export type PerformanceData = {
  session: string;
  term: string;
  kpis: { decided: number; types: number; outstanding: number; waitingOnMe: number; escalated: number; avgDays: number | null; previousAvgDays: number | null; blocked: number; blockedText: string };
  approvers: Array<{ id: string; name: string; role: string; you: boolean; decided: number; open: number; oldest: number | null; avgDays: number | null; escalated: number }>;
  byType: Array<{ type: string; name: string; count: number; avgDays: number | null; escalateDays: number; pct: number }>;
  requesters: Array<{ name: string; total: number; returned: number; pct: number; reason: string | null }>;
};

export type RouteRow = { type: string; name: string; module: string; moduleSlug: string; approver: string; second: string; escalateDays: number; escalateTo: string; overridden: boolean; why: string; blocks: string; open: number; avgDays: number | null; locked: boolean; bulk: boolean; evidence: boolean; who: string; notify: string; enforces: { evidence: boolean; who: boolean } };

export type RuleRow = { id: string; code: string | null; name: string; kind: string; fields: string[]; maxChars: number; state: "Active" | "Revoked"; fired: number; by: string; why: string; at: string };

export type WorkflowData = {
  routes: RouteRow[];
  modules: string[];
  approvers: string[];
  rules: RuleRow[];
  locked: Array<{ name: string; why: string }>;
  slowest: { name: string; type: string; avgDays: number | null } | null;
  options: { approvers: string[]; escalateTo: string[]; who: string[]; notify: string[]; days: number[]; ruleFields: string[] };
};

export type RoutePage = {
  route: RouteRow;
  defaults: { approver: string; second: string; escalateDays: number };
  config: { approver: string; second: string; escalateDays: number; escalateTo: string; evidence: boolean; bulk: boolean; who: string; notify: string };
  recent: Array<{ key: string; title: string; by: string | null; tookDays: number; outcome: string; note: string | null; at: string }>;
  options: WorkflowData["options"];
};
