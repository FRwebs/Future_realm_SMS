/** What `/api/v1/analytics-reports` answers with — the shapes the Analytics & Reports tabs read. */

export type Insights = {
  term: { name: string; session: string; previous: string | null } | null;
  kpis: {
    average: number | null; averageMove: number | null; results: number;
    attendance: number | null; attendanceMove: number | null;
    collection: number | null; collectionMove: number | null; billed: number;
    portal: { activated: number; guardians: number; never: number; pct: number | null };
    growth: { admitted: number; left: number; net: number };
  };
  grades: Array<{ label: string; remark: string; min: number; max: number; count: number; pct: number }>;
  failing: { label: string; count: number; pct: number | null } | null;
  scheme: string;
  correlation: Array<{ label: string; students: number; average: number | null }>;
  subjects: Array<{ name: string; scored: number; average: number | null; difficulty: string | null; pass: number | null; credit: number | null; movement: number | null; insight: string }>;
  weekdays: Array<{ label: string; rate: number | null }>;
  financial: { billed: number; outstanding: number; aged: number; agedInvoices: number; agedFamilies: number; discounts: number; discountRules: number; discountPct: number | null };
  engagement: { signedIn30: number; activated: number; signedInPct: number | null; channels: Array<{ channel: string; total: number; sent: number }>; unreachable: number; worst: { arm: string; count: number } | null };
};

export type ReportsOverview = {
  kpis: { standard: number; custom: number; scheduled: number; datasets: number; exports: number };
  standard: Array<{ code: string; name: string; answers: string; covers: string; lastAt: string | null; lastBy: string | null }>;
  definitions: Array<{ code: string; name: string; dataset: string; datasetName: string; groupBy?: string; filterColumn?: string; filterValue?: string; schedule: string; owner: string; lastAt: string | null }>;
  datasets: Array<{ code: string; name: string; rows: number; lastAt: string | null; lastBy: string | null }>;
  recent: Array<{ id: string; title: string; kind: string; rows: number | null; by: string | null; at: string; kept: boolean }>;
  schedules: string[];
  datasetOptions: Array<{ code: string; name: string; columns: string[] }>;
};

export type ComplianceReturn = { id: string; name: string; body: string; period: string; dueOn: string; days: number; format: string; covers: string; status: string; filedOn: string | null; ownerRole: string | null; ready: boolean; blocker: string | null };
export type ComplianceGap = { what: string; count: number; blocks: string; fix: string };
export type Compliance = {
  stats: { tracked: number; bodies: number; dueSoon: number; blocked: number; ready: number; filed: number; nextDays: number | null };
  returns: ComplianceReturn[];
  gaps: ComplianceGap[];
  archive: Array<{ id: string; returnId: string; title: string; rows: number | null; by: string | null; at: string; kept: boolean }>;
};
