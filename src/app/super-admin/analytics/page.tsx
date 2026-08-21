import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminAnalyticsOverview,
  SuperAdminBiOverview,
  SuperAdminChurnAnalysis,
  SuperAdminCustomReportRow,
  SuperAdminNpsAnalytics,
  SuperAdminRevenueView,
  SuperAdminSchoolRow,
  SuperAdminUsageRow
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const churnReasonOptions = ["PRICE_TOO_HIGH", "SWITCHED_TO_COMPETITOR", "SCHOOL_CLOSED", "PRODUCT_ISSUES", "INSUFFICIENT_SUPPORT", "LOW_STAFF_ADOPTION", "OTHER"].map((v) => ({ label: v.replaceAll("_", " "), value: v }));

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function heatCellStyle(pct: number) {
  if (pct >= 66) return { background: "var(--color-success-dim)", color: "var(--color-success)" };
  if (pct >= 33) return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  return { background: "var(--color-danger-dim)", color: "var(--color-danger)" };
}

function tabHref(tab: string) {
  return tab === "overview" ? "/super-admin/analytics" : `/super-admin/analytics?tab=${tab}`;
}

export default async function SuperAdminAnalyticsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "overview" } = searchParams ? await searchParams : {};
  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Adoption Heatmap", href: tabHref("adoption"), active: tab === "adoption" },
    { label: "Growth Funnel", href: tabHref("funnel"), active: tab === "funnel" },
    { label: "Cohort Retention", href: tabHref("cohorts"), active: tab === "cohorts" },
    { label: "Churn Analysis", href: tabHref("churn"), active: tab === "churn" },
    { label: "NPS & Satisfaction", href: tabHref("nps"), active: tab === "nps" },
    { label: "Feature Requests", href: tabHref("requests"), active: tab === "requests" },
    { label: "Custom Reports", href: tabHref("reports"), active: tab === "reports" }
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Platform intelligence</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Analytics & BI</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            Product adoption, conversion funnel, cohort retention, churn reasons, NPS, feature-request intelligence, and a custom report builder.
          </p>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? <OverviewTab /> : null}
      {tab === "adoption" ? <AdoptionTab /> : null}
      {tab === "funnel" ? <FunnelTab /> : null}
      {tab === "cohorts" ? <CohortsTab /> : null}
      {tab === "churn" ? <ChurnTab /> : null}
      {tab === "nps" ? <NpsTab /> : null}
      {tab === "requests" ? <FeatureRequestsTab /> : null}
      {tab === "reports" ? <ReportsTab /> : null}
    </div>
  );
}

async function OverviewTab() {
  const [overview, usage, revenue] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminUsageRow[]>("/api/super-admin/analytics/usage"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);
  const activeSchools = overview.schools.active ?? overview.schools.total;
  const weeklyActivePct = overview.schools.total > 0 ? Math.round((activeSchools / overview.schools.total) * 100) : 0;
  const topSchools = usage.slice(0, 8);
  const recentRevenue = revenue.monthlyRevenue.slice(-6);
  const maxRevenue = Math.max(...recentRevenue.map((item) => item.amount), 1);

  return (
    <section className="grid gap-5">
      <section className="flex justify-end">
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary h-10 px-4 text-[12px]" type="button">Export</button>
          <button className="btn-primary h-10 px-4 text-[12px]" type="button">Build report</button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active schools" value={activeSchools} detail={`of ${overview.schools.total} total · ${weeklyActivePct}% active`} tone={weeklyActivePct >= 80 ? "success" : weeklyActivePct >= 60 ? "warning" : "danger"} />
        <StatCard label="Students" value={overview.users.students.toLocaleString()} detail={`${overview.users.teachers.toLocaleString()} teachers · ${overview.users.parents.toLocaleString()} parents`} />
        <StatCard label="MRR" value={formatCurrency(revenue.mrr)} detail={`ARR ${formatCurrency(revenue.arr)}`} tone="success" />
        <StatCard label="School admins" value={overview.users.schoolAdmins.toLocaleString()} detail="Primary platform owners" />
        <StatCard label="Top activity" value={topSchools[0]?.logins ?? 0} detail={topSchools[0]?.schoolName ?? "No school"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card overflow-hidden">
          <SectionHeader title="Revenue and school growth signal" aside={`MRR now ${formatCurrency(revenue.mrr)}`} />
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {recentRevenue.map((item) => (
              <div key={item.month} className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold text-[var(--color-text-muted)]">{item.month}</p>
                  <p className="font-[var(--font-mono)] text-[12px] font-black text-[var(--color-text-primary)]">{formatCurrency(item.amount)}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${Math.max((item.amount / maxRevenue) * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <SectionHeader title="Role split" aside="Live snapshot" />
          <div className="grid gap-3 p-5">
            {[
              ["Parents", overview.users.parents],
              ["Teachers", overview.users.teachers],
              ["Students", overview.users.students],
              ["Admins", overview.users.schoolAdmins]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{label}</span>
                <span className="font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">{Number(value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <TableCard
        title="Top active schools"
        items={topSchools}
        pageSize={false}
        getRowKey={(item) => item.schoolId}
        columns={[
          { key: "school", header: "School", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.schoolName}</span>, sortValue: (item) => item.schoolName },
          { key: "logins", header: "Logins", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.logins}</span>, sortValue: (item) => item.logins },
          { key: "users", header: "Active users", render: (item) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{item.activeUsers}</span>, sortValue: (item) => item.activeUsers },
          { key: "modules", header: "Modules used", render: (item) => item.modulesUsed.join(", ") || "—" },
          {
            key: "readout",
            header: "Readout",
            sortable: false,
            render: (item) => (
              <StatusPill
                bg={item.logins >= 100 ? "var(--color-success-dim)" : item.logins >= 40 ? "var(--color-warning-dim)" : "var(--color-danger-dim)"}
                fg={item.logins >= 100 ? "var(--color-success)" : item.logins >= 40 ? "var(--color-warning)" : "var(--color-danger)"}
                label={item.logins >= 100 ? "Daily habit" : item.logins >= 40 ? "Watch" : "At risk"}
              />
            )
          }
        ]}
      />
    </section>
  );
}

const adoptionStats = [
  { label: "Weekly active schools", value: "782", detail: "of 894 active · 87.5% — a school counts as active on 3+ sessions" },
  { label: "Platform adoption index", value: "68", detail: "Weighted across 12 modules · +4 pts this term" },
  { label: "Modules below the 40% floor", value: "4", detail: "CBT, payroll, predictive, biometric — all paid features", danger: true },
  { label: "Paid features never switched on", value: "₦28.4m", detail: "Annualised value of entitlements schools pay for but never open" },
  { label: "Sprint candidates flagged", value: "3", detail: "Auto-nominated from this grid on Monday rollup" }
];

const tierHeaders = [
  { key: "starter", label: "Starter", sub: "268 schools" },
  { key: "standard", label: "Standard", sub: "236 schools" },
  { key: "elite", label: "Elite", sub: "184 schools" },
  { key: "trial", label: "Trial", sub: "142 schools" },
  { key: "ngo", label: "NGO / Mission", sub: "64 schools" }
] as const;

const adoptionRows = [
  { module: "Attendance management", meta: "Daily habit · core", starter: 96, standard: 98, elite: 99, trial: 61, ngo: 94, trend: "+9" },
  { module: "Student registration", meta: "Core", starter: 88, standard: 92, elite: 95, trial: 74, ngo: 86, trend: "+8" },
  { module: "Result computation", meta: "Core · termly peak", starter: 54, standard: 78, elite: 88, trial: 12, ngo: 49, trend: "+12" },
  { module: "Report cards & publishing", meta: "Core · termly peak", starter: 47, standard: 74, elite: 86, trial: 8, ngo: 44, trend: "+14" },
  { module: "Fee management", meta: "Finance", starter: 58, standard: 81, elite: 90, trial: 9, ngo: 34, trend: "+11" },
  { module: "Parent notifications", meta: "Notifications", starter: 41, standard: 79, elite: 92, trial: 11, ngo: 32, trend: "+13" },
  { module: "Parent & student portals", meta: "Core", starter: 36, standard: 64, elite: 81, trial: 14, ngo: 29, trend: "+12" },
  { module: "Timetable & scheduling", meta: "Operations", starter: 22, standard: 44, elite: 63, trial: 6, ngo: 18, trend: "+7" },
  { module: "CBT examination", meta: "Standard and Elite only", starter: null, standard: 14, elite: 31, trial: null, ngo: null, trend: "+4" },
  { module: "Staff payroll", meta: "Standard and Elite only", starter: null, standard: 19, elite: 38, trial: null, ngo: null, trend: "+5" },
  { module: "Biometric attendance", meta: "Elite only", starter: null, standard: null, elite: 22, trial: null, ngo: null, trend: "+6" },
  { module: "Predictive at-risk alerts", meta: "Elite only · pilot flag", starter: null, standard: null, elite: 17, trial: null, ngo: null, trend: "+16" }
];

const adoptionGaps = [
  { module: "CBT examination", adoption: "21%", schools: "420", value: "₦11.2m", diagnosis: "Question-bank import is the blocker — 34 tickets on Excel upload failures" },
  { module: "Staff payroll", adoption: "26%", schools: "420", value: "₦8.6m", diagnosis: "Schools keep payroll in a separate ledger — no PAYE schedule export yet" },
  { module: "Biometric attendance", adoption: "22%", schools: "184", value: "₦5.1m", diagnosis: "Device pairing flag was rolled back — blocked on hardware certification" },
  { module: "Predictive at-risk alerts", adoption: "17%", schools: "184", value: "₦3.5m", diagnosis: "Feature is live but undiscovered — no entry point on the dashboard" },
  { module: "Timetable & scheduling", adoption: "40%", schools: "894", value: "Bundled", diagnosis: "Manual timetable still faster for small schools — needs a paste-in importer" }
];

const adoptionReadingRules = [
  { title: "Compare down a column, never across a row", detail: "Tiers have different module sets — a grey cell is an entitlement gap, not a usage failure." },
  { title: "Trial columns are a conversion signal, not adoption", detail: "A trial school that never publishes a result has not seen the core value — the strongest churn predictor we have." },
  { title: "Two weeks below 40% nominates a sprint item", detail: "The nomination is automatic; the decision to build stays with the Product Lead." },
  { title: "Adoption is measured per school, not per user", detail: "One teacher using CBT does not make a school a CBT school." }
];

const stateRows = [
  { state: "Lagos", schools: "214 schools", attendance: 98, results: 82, fees: 86, notifications: 79, portals: 68, cbt: 34, payroll: 31 },
  { state: "Abuja (FCT)", schools: "126 schools", attendance: 97, results: 80, fees: 84, notifications: 76, portals: 64, cbt: 29, payroll: 28 },
  { state: "Rivers", schools: "84 schools", attendance: 95, results: 74, fees: 78, notifications: 68, portals: 54, cbt: 18, payroll: 21 },
  { state: "Oyo", schools: "78 schools", attendance: 94, results: 71, fees: 72, notifications: 61, portals: 48, cbt: 14, payroll: 17 },
  { state: "Kano", schools: "66 schools", attendance: 89, results: 58, fees: 61, notifications: 44, portals: 33, cbt: 6, payroll: 11 },
  { state: "Enugu", schools: "52 schools", attendance: 92, results: 66, fees: 68, notifications: 52, portals: 41, cbt: 9, payroll: 14 },
  { state: "Kaduna", schools: "44 schools", attendance: 87, results: 54, fees: 57, notifications: 39, portals: 28, cbt: 4, payroll: 9 },
  { state: "All other states", schools: "230 schools", attendance: 90, results: 62, fees: 64, notifications: 48, portals: 36, cbt: 11, payroll: 15 }
];

function AdoptionCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="inline-flex min-w-14 justify-center rounded-[8px] bg-[var(--color-bg-subtle)] px-2 py-1 text-[12px] font-bold text-[var(--color-text-muted)]">—</span>;
  }
  const style = heatCellStyle(value);
  return <span className="inline-flex min-w-14 justify-center rounded-[8px] px-2 py-1 text-[12px] font-black" style={{ background: style.background, color: style.color }}>{value}%</span>;
}

function SectionHeader({ eyebrow, title, description, aside }: { eyebrow?: string; title: string; description?: string; aside?: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
        <p className="mt-1 text-[16px] font-bold text-[var(--color-text-primary)]">{title}</p>
        {description ? <p className="mt-1 max-w-4xl text-[12.5px] leading-5 text-[var(--color-text-secondary)]">{description}</p> : null}
      </div>
      {aside ? <p className="text-[11.5px] font-bold text-[var(--color-text-muted)]">{aside}</p> : null}
    </div>
  );
}

async function AdoptionTab() {
  await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");

  return (
    <section className="grid gap-5">
      <section className="flex justify-end">
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary h-10 px-4 text-[12px]" type="button">Export</button>
          <button className="btn-primary h-10 px-4 text-[12px]" type="button">Build report</button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {adoptionStats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} tone={stat.danger ? "danger" : "neutral"} />)}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--color-border-default)] px-5 py-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[16px] font-bold text-[var(--color-text-primary)]">Module adoption by tier</p>
            <p className="mt-1 max-w-4xl text-[12.5px] leading-5 text-[var(--color-text-secondary)]">
              Share of schools on each tier that used the module at least once in the last 7 days — shading is the adoption rate.
            </p>
            <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">Daily rollup · week 32 of 2026 · compared against week 20</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["Period", "Last 7 days"],
              ["Cohort", "All cohorts"],
              ["Region", "All states"],
              ["Minimum schools", "10"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
                <p className="mt-0.5 text-[12px] font-bold text-[var(--color-text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-[12.5px]">
            <thead className="bg-[var(--color-bg-subtle)]">
              <tr>
                <th className="border-b border-[var(--color-border-default)] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Module</th>
                {tierHeaders.map((tier) => (
                  <th key={tier.key} className="border-b border-[var(--color-border-default)] px-3 py-3 text-center">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{tier.label}</p>
                    <p className="mt-0.5 text-[10.5px] font-semibold text-[var(--color-text-secondary)]">{tier.sub}</p>
                  </th>
                ))}
                <th className="border-b border-[var(--color-border-default)] px-4 py-3 text-center text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">12-week trend</th>
              </tr>
            </thead>
            <tbody>
              {adoptionRows.map((row) => (
                <tr key={row.module}>
                  <td className="border-b border-[var(--color-border-muted)] px-4 py-3">
                    <p className="font-bold text-[var(--color-text-primary)]">{row.module}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{row.meta}</p>
                  </td>
                  {tierHeaders.map((tier) => <td key={tier.key} className="border-b border-[var(--color-border-muted)] px-3 py-3 text-center"><AdoptionCell value={row[tier.key]} /></td>)}
                  <td className="border-b border-[var(--color-border-muted)] px-4 py-3 text-center font-bold text-[var(--color-success)]">{row.trend}</td>
                </tr>
              ))}
              <tr className="bg-[var(--color-bg-subtle)]">
                <td className="px-4 py-3 font-bold text-[var(--color-text-primary)]">Tier adoption index</td>
                {["61", "69", "76", "24", "58"].map((value) => <td key={value} className="px-3 py-3 text-center font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{value}</td>)}
                <td className="px-4 py-3 text-center font-bold text-[var(--color-success)]">+11 platform</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-default)] px-5 py-3 text-[11.5px] text-[var(--color-text-muted)]">
          <span>0% of tier</span>
          <span>100%</span>
          <span>Grey cells mean not available on this tier · click any cell to open the school list behind it</span>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--color-border-default)] px-5 py-4">
            <p className="text-[16px] font-bold text-[var(--color-text-primary)]">Adoption gaps auto-nominated for the next sprint</p>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-5 text-[var(--color-text-secondary)]">Every paid module below the 40% floor for two consecutive weeks appears here with the revenue it is failing to justify.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-[12.5px]">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {["Module", "Adoption", "Entitled schools", "Value at risk", "Diagnosis from support tickets"].map((header) => (
                    <th key={header} className="border-b border-[var(--color-border-default)] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adoptionGaps.map((gap) => (
                  <tr key={gap.module}>
                    <td className="border-b border-[var(--color-border-muted)] px-4 py-3 font-bold text-[var(--color-text-primary)]">{gap.module}</td>
                    <td className="border-b border-[var(--color-border-muted)] px-4 py-3 font-bold text-[var(--color-danger)]">{gap.adoption}</td>
                    <td className="border-b border-[var(--color-border-muted)] px-4 py-3 font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{gap.schools}</td>
                    <td className="border-b border-[var(--color-border-muted)] px-4 py-3 font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{gap.value}</td>
                    <td className="border-b border-[var(--color-border-muted)] px-4 py-3 text-[var(--color-text-secondary)]">{gap.diagnosis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11.5px] text-[var(--color-text-muted)]">Value at risk is the annualised subscription share attributable to the module for schools entitled to it but not using it.</p>
        </section>

        <section className="surface-card p-5">
          <p className="text-[15px] font-bold text-[var(--color-text-primary)]">How this grid is read</p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Three rules keep the conversation honest</p>
          <div className="mt-4 grid gap-3">
            {adoptionReadingRules.map((rule) => (
              <div key={rule.title} className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
                <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{rule.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{rule.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--color-border-default)] px-5 py-4">
          <p className="text-[16px] font-bold text-[var(--color-text-primary)]">Adoption by state — where the product is actually landing</p>
          <p className="mt-1 max-w-4xl text-[12.5px] leading-5 text-[var(--color-text-secondary)]">Same metric grouped by region, to separate a product problem from a connectivity or training problem.</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">Rolling 4-week average</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full border-separate border-spacing-0 text-[12.5px]">
            <thead className="bg-[var(--color-bg-subtle)]">
              <tr>
                {["State / region", "Attendance", "Results", "Fees", "Notifications", "Portals", "CBT", "Payroll"].map((header) => (
                  <th key={header} className="border-b border-[var(--color-border-default)] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stateRows.map((row) => (
                <tr key={row.state}>
                  <td className="border-b border-[var(--color-border-muted)] px-4 py-3">
                    <p className="font-bold text-[var(--color-text-primary)]">{row.state}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{row.schools}</p>
                  </td>
                  {(["attendance", "results", "fees", "notifications", "portals", "cbt", "payroll"] as const).map((key) => <td key={key} className="border-b border-[var(--color-border-muted)] px-4 py-3"><AdoptionCell value={row[key]} /></td>)}
                </tr>
              ))}
              <tr className="bg-[var(--color-bg-subtle)]">
                <td className="px-4 py-3 font-bold text-[var(--color-text-primary)]">Platform average</td>
                {["94", "71", "74", "61", "48", "19", "20"].map((value) => <td key={value} className="px-4 py-3 font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{value}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[11.5px] text-[var(--color-text-muted)]">Northern states track the platform on attendance but fall behind on notifications — a data-cost problem, not a product one.</p>
      </section>

    </section>
  );
}

async function FunnelTab() {
  await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");
  const funnelStages = [
    { count: "1,180", label: "Signed up", drop: "—" },
    { count: "986", label: "Verified", drop: "−16% drop" },
    { count: "902", label: "Trial started", drop: "−8.5% drop" },
    { count: "704", label: "Trial active (7+ day logins)", drop: "−22% drop", danger: true },
    { count: "628", label: "Approaching trial end", drop: "−11% drop" },
    { count: "418", label: "Converted to paid", drop: "−33% drop", danger: true },
    { count: "352", label: "Active 2nd term", drop: "−16% drop" }
  ];
  const weeklyMovement = [
    { stage: "Signed up", current: 58, previous: 49, change: "+18%", owner: "Marketing Lead" },
    { stage: "Verified", current: 44, previous: 42, change: "+5%", owner: "Onboarding" },
    { stage: "Trial started", current: 41, previous: 40, change: "+3%", owner: "Onboarding" },
    { stage: "Trial active (7+ logins)", current: 28, previous: 31, change: "−10%", owner: "Customer Success", danger: true },
    { stage: "Converted to paid", current: 11, previous: 14, change: "−21%", owner: "Sales Lead", danger: true }
  ];

  return (
    <section className="grid gap-5">
      <section className="surface-card overflow-hidden">
        <SectionHeader title="Growth and conversion funnel" />
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-7">
          {funnelStages.map((stage, index) => (
            <article key={stage.label} className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
              <p className="font-[var(--font-heading)] text-[24px] font-black text-[var(--color-text-primary)]">{stage.count}</p>
              <p className="mt-1 min-h-10 text-[12px] font-bold leading-5 text-[var(--color-text-primary)]">{stage.label}</p>
              <p className="mt-2 text-[11.5px] font-bold" style={{ color: stage.danger ? "var(--color-danger)" : "var(--color-text-muted)" }}>{stage.drop}</p>
              {index < funnelStages.length - 1 ? <div className="mt-3 h-1 rounded-full bg-[var(--color-accent-primary)] opacity-60" /> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
        <TableCard
          title="Week-over-week funnel movement"
          items={weeklyMovement}
          pageSize={false}
          getRowKey={(item) => item.stage}
          columns={[
            { key: "stage", header: "Stage", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.stage}</span>, sortValue: (item) => item.stage },
            { key: "current", header: "This week", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.current}</span>, sortValue: (item) => item.current },
            { key: "previous", header: "Last week", render: (item) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-secondary)]">{item.previous}</span>, sortValue: (item) => item.previous },
            { key: "change", header: "Change", render: (item) => <span className="font-bold" style={{ color: item.danger ? "var(--color-danger)" : "var(--color-success)" }}>{item.change}</span>, sortValue: (item) => Number.parseInt(item.change.replace(/[^\d-]/g, ""), 10) },
            { key: "owner", header: "Owner", render: (item) => item.owner, sortValue: (item) => item.owner }
          ]}
        />
        <StatCard label="Largest drop" value="−22%" detail="Trial started to trial active" tone="danger" />
      </section>
    </section>
  );
}

async function CohortsTab() {
  await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");
  const cohorts = [
    { cohort: "Term 1 2025", schools: 84, term1: "93%", term2: "88%", term3: "81%", verdict: "Product working", tone: "good" as const },
    { cohort: "Term 2 2025", schools: 126, term1: "91%", term2: "84%", term3: "76%", verdict: "Product working", tone: "good" as const },
    { cohort: "Term 3 2025", schools: 148, term1: "89%", term2: "79%", term3: "—", verdict: "On track", tone: "good" as const },
    { cohort: "Term 1 2026", schools: 172, term1: "86%", term2: "71%", term3: "—", verdict: "Watch", tone: "warn" as const },
    { cohort: "Term 2 2026", schools: 196, term1: "82%", term2: "—", term3: "—", verdict: "Watch", tone: "warn" as const },
    { cohort: "Term 3 2026", schools: 218, term1: "In progress", term2: "—", term3: "—", verdict: "Too early", tone: "neutral" as const }
  ];

  return (
    <section className="grid gap-5">
      <TableCard
        title="Cohort retention analysis"
        items={cohorts}
        pageSize={false}
        getRowKey={(item) => item.cohort}
        columns={[
          { key: "cohort", header: "Cohort", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.cohort}</span>, sortValue: (item) => item.cohort },
          { key: "schools", header: "Schools", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.schools}</span>, sortValue: (item) => item.schools },
          { key: "term1", header: "Term 1 retained", render: (item) => <AdoptionCell value={Number.parseInt(item.term1, 10) || null} />, sortValue: (item) => Number.parseInt(item.term1, 10) || 0 },
          { key: "term2", header: "Term 2 retained", render: (item) => <AdoptionCell value={Number.parseInt(item.term2, 10) || null} />, sortValue: (item) => Number.parseInt(item.term2, 10) || 0 },
          { key: "term3", header: "Term 3 retained", render: (item) => <AdoptionCell value={Number.parseInt(item.term3, 10) || null} />, sortValue: (item) => Number.parseInt(item.term3, 10) || 0 },
          {
            key: "verdict",
            header: "Verdict",
            render: (item) => {
              const pill = item.tone === "good" ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" } : item.tone === "warn" ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" } : { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" };
              return <StatusPill bg={pill.bg} fg={pill.fg} label={item.verdict} />;
            },
            sortValue: (item) => item.verdict
          }
        ]}
      />
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Best mature cohort" value="81%" detail="Term 1 2025 · term 3" tone="success" />
        <StatCard label="Newest watch cohort" value="71%" detail="Term 1 2026 · term 2" tone="warning" />
        <StatCard label="Largest cohort" value="218" detail="Term 3 2026 schools" />
      </section>
    </section>
  );
}

async function FeatureRequestsTab() {
  await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");
  const requests = [
    { rank: "01", feature: "Bulk score import from Excel", schools: 148, tier: "Standard + Elite", severity: "High", score: 96 },
    { rank: "02", feature: "Parent mobile app (native)", schools: 132, tier: "All tiers", severity: "Medium", score: 88 },
    { rank: "03", feature: "Automated fee payment reconciliation", schools: 104, tier: "Standard + Elite", severity: "High", score: 84 },
    { rank: "04", feature: "Custom report card comment bank", schools: 86, tier: "Elite", severity: "Medium", score: 71 },
    { rank: "05", feature: "Timetable clash detection", schools: 74, tier: "All tiers", severity: "Medium", score: 66 },
    { rank: "06", feature: "WAEC/NECO submission export", schools: 61, tier: "Standard + Elite", severity: "High", score: 62 },
    { rank: "07", feature: "Staff attendance and leave tracking", schools: 54, tier: "Standard", severity: "Low", score: 48 },
    { rank: "08", feature: "Multi-currency fee support", schools: 38, tier: "Elite", severity: "Low", score: 34 },
    { rank: "09", feature: "Hostel and boarding management", schools: 31, tier: "Elite", severity: "Low", score: 29 },
    { rank: "10", feature: "SMS delivery receipts in-app", schools: 26, tier: "Standard", severity: "Low", score: 24 }
  ];

  return (
    <TableCard
      title="Feature request intelligence"
      items={requests}
      pageSize={false}
      getRowKey={(item) => item.rank}
      columns={[
        { key: "rank", header: "#", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-muted)]">{item.rank}</span>, sortValue: (item) => Number(item.rank) },
        { key: "feature", header: "Feature request", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.feature}</span>, sortValue: (item) => item.feature },
        { key: "schools", header: "Schools", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.schools}</span>, sortValue: (item) => item.schools },
        { key: "tier", header: "Tier weight", render: (item) => item.tier },
        {
          key: "severity",
          header: "Severity",
          render: (item) => (
            <StatusPill
              bg={item.severity === "High" ? "var(--color-danger-dim)" : item.severity === "Medium" ? "var(--color-warning-dim)" : "var(--color-bg-subtle)"}
              fg={item.severity === "High" ? "var(--color-danger)" : item.severity === "Medium" ? "var(--color-warning)" : "var(--color-text-muted)"}
              label={item.severity}
            />
          ),
          sortValue: (item) => item.severity
        },
        { key: "score", header: "Priority score", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.score}</span>, sortValue: (item) => item.score }
      ]}
    />
  );
}

async function ChurnTab() {
  const [churn, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminChurnAnalysis>("/api/super-admin/analytics/churn"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const churnReasons = [
    { reason: "Low staff adoption", count: 14, share: "30%", signal: "Onboarding and training process review needed", danger: true },
    { reason: "Price too high", count: 11, share: "24%", signal: "Pricing strategy review needed" },
    { reason: "Switched to competitor", count: 7, share: "15%", signal: "Competitive intelligence needed — which competitor?" },
    { reason: "Insufficient support", count: 6, share: "13%", signal: "Support quality review needed" },
    { reason: "School closed", count: 4, share: "9%", signal: "External — no action" },
    { reason: "Product issues", count: 3, share: "7%", signal: "Product roadmap input" },
    { reason: "Other", count: 1, share: "2%", signal: "Must be described in notes — cannot be closed without detail" }
  ];
  const tierChurn = [
    { tier: "Starter", value: "5.2%", pct: 52, danger: true },
    { tier: "Standard", value: "2.8%", pct: 28 },
    { tier: "Elite", value: "1.1%", pct: 11 },
    { tier: "NGO / Mission", value: "0.4%", pct: 4 }
  ];
  const tenureChurn = [
    { label: "Term 1 after conversion", value: "9.4%", pct: 94, danger: true },
    { label: "Term 2", value: "6.1%", pct: 61, danger: true },
    { label: "Term 3", value: "2.4%", pct: 24 },
    { label: "Term 4 and beyond", value: "1.2%", pct: 12 }
  ];

  return (
    <section className="grid gap-5">
      <TableCard
        title={`Churn reason breakdown · ${churn.total || 46} schools`}
        items={churnReasons}
        pageSize={false}
        getRowKey={(item) => item.reason}
        actions={
          <ResourceActionDialog
            triggerLabel="Log churn"
            title="Log a churned school"
            description="Record why a school left, from the defined reason list."
            endpoint="/api/super-admin/analytics/churn"
            submitLabel="Log churn"
            fields={[
              { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
              { name: "reason", label: "Reason", type: "select", options: churnReasonOptions },
              { name: "notes", label: "Notes", type: "textarea" }
            ]}
          />
        }
        columns={[
          { key: "reason", header: "Churn reason", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.reason}</span>, sortValue: (item) => item.reason },
          { key: "count", header: "Count", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.count}</span>, sortValue: (item) => item.count },
          { key: "share", header: "Share", render: (item) => <span className="font-bold" style={{ color: item.danger ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.share}</span>, sortValue: (item) => Number.parseInt(item.share, 10) },
          { key: "signal", header: "What it signals", render: (item) => item.signal }
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Churn rate by tier</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Percentage of schools in each tier that did not renew last term.</p>
          <div className="mt-4 grid gap-3.5">
            {tierChurn.map((item) => (
              <div key={item.tier}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--color-text-secondary)]">{item.tier}</span>
                  <span className="font-[var(--font-mono)] text-[13px] font-black" style={{ color: item.danger ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.value}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.danger ? "var(--color-danger)" : "var(--color-accent-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Churn rate by tenure</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Risk is concentrated in the first two terms after conversion.</p>
          <div className="mt-4 grid gap-3.5">
            {tenureChurn.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className="font-[var(--font-mono)] text-[13px] font-black" style={{ color: item.danger ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.value}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.danger ? "var(--color-danger)" : "var(--color-accent-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

async function NpsTab() {
  const [nps, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminNpsAnalytics>("/api/super-admin/analytics/nps"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const npsScore = nps.npsScore || 52;
  const responseTotal = nps.total || 458;
  const scoreCards = [
    { label: "Platform NPS", value: `${npsScore >= 0 ? "+" : ""}${npsScore}`, detail: "Termly survey · up 6 points", tone: "good" as const },
    { label: "Promoters", value: "64%", detail: "Score 9-10", tone: "good" as const },
    { label: "Passives", value: "24%", detail: "Score 7-8", tone: "warn" as const },
    { label: "Detractors", value: "12%", detail: "Score 0-6 · flagged for outreach", tone: "bad" as const },
    { label: "Response rate", value: "71%", detail: `${responseTotal} of 642 school admins`, tone: "neutral" as const }
  ];
  const tierRegionScores = [
    { label: "Elite tier", value: "+68", pct: 68 },
    { label: "Standard tier", value: "+54", pct: 54 },
    { label: "Starter tier", value: "+41", pct: 41 },
    { label: "Lagos", value: "+58", pct: 58 },
    { label: "Abuja (FCT)", value: "+56", pct: 56 },
    { label: "Kano", value: "+34", pct: 34, note: "Lowest region — four detractors cite support response time" }
  ];
  const fallbackComments = [
    { schoolName: "Grace International Academy · Elite", score: 10, comment: "Result day used to take three days. It now takes an afternoon." },
    { schoolName: "Kings & Queens Int'l · Elite", score: 9, comment: "Parents finally stop calling the office for balances." },
    { schoolName: "Bright Path College · Standard", score: 7, comment: "Good system, but per-student pricing is hard at our size." },
    { schoolName: "Unity Model School · Standard", score: 4, comment: "Support took two days to answer a result problem." },
    { schoolName: "Zion Comprehensive · Starter", score: 5, comment: "Our teachers still keep a paper register as backup." }
  ];
  const comments = nps.comments.length > 0 ? nps.comments.slice(0, 5) : fallbackComments;

  return (
    <section className="grid gap-5">
      <section className="flex justify-end">
        <ResourceActionDialog
          triggerLabel="Record NPS"
          title="Record an NPS response"
          description="Log a school's NPS score (0-10) and optional verbatim comment."
          endpoint="/api/super-admin/analytics/nps"
          submitLabel="Record"
          fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
            { name: "score", label: "Score (0-10)", type: "number", required: true, min: 0, max: 10 },
            { name: "comment", label: "Comment", type: "textarea" }
          ]}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {scoreCards.map((card) => <StatCard key={card.label} label={card.label} value={card.value} detail={card.detail} tone={card.tone === "good" ? "success" : card.tone === "warn" ? "warning" : card.tone === "bad" ? "danger" : "neutral"} />)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">NPS by tier and region</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Broken down so outreach can be targeted where it moves the number.</p>
          <div className="mt-4 grid gap-3.5">
            {tierRegionScores.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className="font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">{item.value}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${item.pct}%` }} />
                </div>
                {item.note ? <p className="mt-1.5 text-[11.5px] text-[var(--color-danger)]">{item.note}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Verbatim comments</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Stored and searchable — low scorers are flagged for personal outreach by Customer Success.</p>
          <div className="mt-4 grid gap-4">
            {comments.map((item, index) => {
              const pill = item.score >= 9 ? { label: "Promoter", bg: "var(--color-success-dim)", fg: "var(--color-success)" } : item.score >= 7 ? { label: "Passive", bg: "var(--color-warning-dim)", fg: "var(--color-warning)" } : { label: "Detractor", bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
              return (
                <div key={`${item.schoolName}-${index}`} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <p className="text-[13px] leading-5 text-[var(--color-text-primary)]">&ldquo;{item.comment}&rdquo;</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] text-[var(--color-text-muted)]">{item.schoolName} · score {item.score}</span>
                    <StatusPill bg={pill.bg} fg={pill.fg} label={pill.label} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

const reportingCadence = [
  { type: "Adoption heatmap", cadence: "Daily rollup · weekly summary" },
  { type: "Funnel / conversion", cadence: "Real-time capture · weekly summary" },
  { type: "Cohort retention", cadence: "Weekly recalculation" },
  { type: "Revenue (MRR / ARR)", cadence: "Daily rollup · monthly summary" },
  { type: "Churn analysis", cadence: "Weekly recalculation" },
  { type: "NPS", cadence: "Per survey cycle · termly" },
  { type: "Geographic performance", cadence: "Weekly rollup" }
];

async function ReportsTab() {
  const reports = await apiGet<SuperAdminCustomReportRow[]>("/api/super-admin/analytics/custom-reports");
  const fallbackReports = [
    { id: "monthly-investor", name: "Monthly investor update pack", metric: "MRR, ARR, funnel, cohort", dimension: "PDF + Excel", createdBy: "System", createdAt: "2026-08-01T00:00:00.000Z" },
    { id: "revenue-tier-state", name: "Revenue by tier and state", metric: "Term 1 2026/27", dimension: "Excel", createdBy: "System", createdAt: "2026-08-05T00:00:00.000Z" },
    { id: "board-retention", name: "Board deck — retention", metric: "Cohorts, churn reasons", dimension: "PDF", createdBy: "System", createdAt: "2026-07-28T00:00:00.000Z" },
    { id: "support-review", name: "Support quality review", metric: "CSAT, SLA, per agent", dimension: "Excel", createdBy: "System", createdAt: "Weekly · auto" },
    { id: "lagos-density", name: "Lagos density analysis", metric: "City, tier, tenure", dimension: "PDF", createdBy: "System", createdAt: "2026-07-19T00:00:00.000Z" },
    { id: "ngo-compliance", name: "NGO programme compliance", metric: "NGO tier, verification", dimension: "Excel", createdBy: "System", createdAt: "2026-07-02T00:00:00.000Z" }
  ];
  const savedReports = reports.length > 0 ? reports : fallbackReports;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
      <TableCard
        title="Saved custom reports"
        items={savedReports}
        pageSize={false}
        getRowKey={(item) => item.id}
        actions={
          <ResourceActionDialog
            triggerLabel="New report"
            title="Build a custom report"
            description="Choose what to measure and how to group it."
            endpoint="/api/super-admin/analytics/custom-reports"
            submitLabel="Save report"
            fields={[
              { name: "name", label: "Report name", required: true },
              { name: "metric", label: "Metric", type: "select", options: [{ label: "School count", value: "schoolCount" }, { label: "Student count", value: "studentCount" }, { label: "MRR", value: "mrr" }] },
              { name: "dimension", label: "Group by", type: "select", options: [{ label: "Tier", value: "tier" }, { label: "State", value: "state" }, { label: "Status", value: "status" }] }
            ]}
          />
        }
        columns={[
          { key: "name", header: "Report", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.name}</span>, sortValue: (item) => item.name },
          { key: "metric", header: "Filters", render: (item) => item.metric, sortValue: (item) => item.metric },
          { key: "dimension", header: "Format", render: (item) => item.dimension, sortValue: (item) => item.dimension },
          { key: "created", header: "Last generated", render: (item) => item.createdAt.includes("T") ? formatDate(item.createdAt) : item.createdAt, sortValue: (item) => item.createdAt },
          { key: "action", header: "", sortable: false, render: () => <button className="btn-secondary h-8 px-3 text-[11.5px]" type="button">Run</button> }
        ]}
      />

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--color-border-default)] px-5 py-4">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Reporting cadence</p>
        </div>
        <div className="grid gap-3 p-5">
          {reportingCadence.map((row) => (
            <div key={row.type} className="flex items-start justify-between gap-3 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
              <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{row.type}</p>
              <p className="max-w-[55%] text-right text-[11.5px] text-[var(--color-text-muted)]">{row.cadence}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
