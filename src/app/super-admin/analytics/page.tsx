import { TrendCard } from "@/components/dashboard/trend-card";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type {
  SuperAdminAnalyticsOverview,
  SuperAdminBiOverview,
  SuperAdminChurnAnalysis,
  SuperAdminCustomReportRow,
  SuperAdminNpsAnalytics,
  SuperAdminRevenueView,
  SuperAdminUsageRow
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const churnReasonOptions = ["PRICE_TOO_HIGH", "SWITCHED_TO_COMPETITOR", "SCHOOL_CLOSED", "PRODUCT_ISSUES", "INSUFFICIENT_SUPPORT", "LOW_STAFF_ADOPTION", "OTHER"].map((v) => ({ label: v.replaceAll("_", " "), value: v }));

function tabHref(tab: string) {
  return tab === "overview" ? "/super-admin/analytics" : `/super-admin/analytics?tab=${tab}`;
}

export default async function SuperAdminAnalyticsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "overview" } = searchParams ? await searchParams : {};
  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Adoption & Funnel", href: tabHref("bi"), active: tab === "bi" },
    { label: "Churn", href: tabHref("churn"), active: tab === "churn" },
    { label: "NPS", href: tabHref("nps"), active: tab === "nps" },
    { label: "Custom Reports", href: tabHref("reports"), active: tab === "reports" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Platform intelligence</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Analytics & BI</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Product adoption, conversion funnel, cohort retention, churn reasons, NPS, feature-request intelligence, and a custom report builder.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? <OverviewTab /> : null}
      {tab === "bi" ? <BiTab /> : null}
      {tab === "churn" ? <ChurnTab /> : null}
      {tab === "nps" ? <NpsTab /> : null}
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

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-3">
        <TrendCard title="User growth by role" description="Current role split across the platform." items={[
          { label: "Parents", value: overview.users.parents },
          { label: "Teachers", value: overview.users.teachers },
          { label: "Students", value: overview.users.students },
          { label: "Admins", value: overview.users.schoolAdmins }
        ]} />
        <TrendCard title="School growth" description="Twelve-month cumulative school growth proxy." items={revenue.monthlyRevenue.map((item, index) => ({ label: item.month, value: Math.max(overview.schools.total - 12 + index, 1) }))} />
        <TrendCard title="Revenue trend" description={`MRR now ${formatCurrency(revenue.mrr)}.`} items={revenue.monthlyRevenue.map((item) => ({ label: item.month, value: Math.round(item.amount / 1000), suffix: "k" }))} />
      </section>

      <TableCard
        title="Top active schools"
        description="Ranked by current audit/login activity and active users."
        items={usage.slice(0, 10)}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "logins", header: "Logins", render: (item) => item.logins },
          { key: "users", header: "Active Users", render: (item) => item.activeUsers },
          { key: "modules", header: "Modules Used", render: (item) => item.modulesUsed.join(", ") || "-" }
        ]}
      />
    </>
  );
}

async function BiTab() {
  const bi = await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");

  return (
    <section className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Conversion funnel</h2>
        <div className="mt-4 grid gap-2">
          {bi.funnel.map((stage, i) => {
            const prev = i > 0 ? bi.funnel[i - 1].count : stage.count;
            const dropPct = prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0;
            return (
              <div key={stage.stage} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{stage.stage}</span>
                <span className="flex items-center gap-3"><span className="font-[var(--font-mono)] font-black text-ink">{stage.count}</span>{i > 0 ? <span className="text-xs text-rose-600">-{dropPct}%</span> : null}</span>
              </div>
            );
          })}
        </div>
      </section>

      <TableCard
        title="Product adoption heatmap"
        description="Module adoption across all schools. High ≥66%, Medium ≥33%, Low below."
        items={bi.heatmap}
        columns={[
          { key: "module", header: "Module", render: (item) => item.module.replaceAll("_", " ") },
          { key: "using", header: "Schools using", render: (item) => item.schoolsUsing },
          { key: "pct", header: "Adoption", render: (item) => `${item.adoptionPct}%` },
          { key: "level", header: "Level", render: (item) => <StatusBadge status={item.level} tone={item.level === "HIGH" ? "success" : item.level === "MEDIUM" ? "warning" : "danger"} /> }
        ]}
        emptyState="No adoption data yet."
      />

      <TableCard
        title="Cohort retention"
        description="Schools grouped by the month they joined, and how many are still active."
        items={bi.cohorts}
        columns={[
          { key: "cohort", header: "Cohort", render: (item) => item.cohort },
          { key: "joined", header: "Joined", render: (item) => item.joined },
          { key: "active", header: "Still active", render: (item) => item.stillActive },
          { key: "pct", header: "Retention", render: (item) => `${item.retentionPct}%` }
        ]}
        emptyState="No cohort data yet."
      />

      <TableCard
        title="Feature request intelligence"
        description="Top requested feature keywords, mined from feature-request support tickets."
        items={bi.featureRequests}
        columns={[
          { key: "keyword", header: "Keyword", render: (item) => item.keyword },
          { key: "requests", header: "Requests", render: (item) => item.requestCount },
          { key: "schools", header: "Schools", render: (item) => item.schoolsRequesting },
          { key: "score", header: "Priority score", render: (item) => item.priorityScore }
        ]}
        emptyState="No feature-request tickets yet."
      />
    </section>
  );
}

async function ChurnTab() {
  const churn = await apiGet<SuperAdminChurnAnalysis>("/api/super-admin/analytics/churn");

  return (
    <section className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Churn analysis</h2>
            <p className="mt-2 text-sm text-ink/60">{churn.total} logged churn(s). Any reason exceeding 25% of churn is escalated to a response plan.</p>
          </div>
          <ResourceActionDialog
            triggerLabel="Log churn"
            title="Log a churned school"
            description="Record why a school left, from the defined reason list."
            endpoint="/api/super-admin/analytics/churn"
            submitLabel="Log churn"
            fields={[
              { name: "schoolId", label: "School ID", required: true },
              { name: "reason", label: "Reason", type: "select", options: churnReasonOptions },
              { name: "notes", label: "Notes", type: "textarea" }
            ]}
          />
        </div>
        <div className="mt-5 grid gap-2">
          {churn.byReason.map((r) => (
            <div key={r.reason} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
              <span className="text-sm font-semibold text-ink">{r.reason.replaceAll("_", " ")}</span>
              <span className="flex items-center gap-3"><span className="font-[var(--font-mono)] font-black text-ink">{r.count}</span><span className={r.pct > 25 ? "text-xs font-bold text-rose-600" : "text-xs text-ink/50"}>{r.pct}%</span></span>
            </div>
          ))}
          {churn.byReason.length === 0 ? <p className="rounded-2xl bg-sand/60 px-4 py-6 text-center text-sm text-ink/50">No churn logged yet.</p> : null}
        </div>
      </section>

      <TableCard
        title="Recent churn"
        description="Most recently logged departures."
        items={churn.recent}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "reason", header: "Reason", render: (item) => item.reason.replaceAll("_", " ") },
          { key: "notes", header: "Notes", render: (item) => item.notes ?? "-" },
          { key: "date", header: "Churned", render: (item) => formatDate(item.churnedAt) }
        ]}
        emptyState="No churn recorded."
      />
    </section>
  );
}

async function NpsTab() {
  const nps = await apiGet<SuperAdminNpsAnalytics>("/api/super-admin/analytics/nps");

  return (
    <section className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Net Promoter Score</h2>
            <p className="mt-2 text-sm text-ink/60">Termly satisfaction. Detractors (0-6) are flagged for Customer Success outreach.</p>
          </div>
          <ResourceActionDialog
            triggerLabel="Record NPS"
            title="Record an NPS response"
            description="Log a school's NPS score (0-10) and optional verbatim comment."
            endpoint="/api/super-admin/analytics/nps"
            submitLabel="Record"
            fields={[
              { name: "schoolId", label: "School ID", required: true },
              { name: "score", label: "Score (0-10)", type: "number", required: true, min: 0, max: 10 },
              { name: "comment", label: "Comment", type: "textarea" }
            ]}
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[
            { label: "NPS", value: nps.npsScore },
            { label: "Promoters", value: nps.promoters },
            { label: "Passives", value: nps.passives },
            { label: "Detractors", value: nps.detractors }
          ].map((m) => (
            <article key={m.label} className="rounded-[1.25rem] border border-slate-100 bg-sand/55 p-4">
              <p className="text-xs font-bold text-slate-500">{m.label}</p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">{m.value}</p>
            </article>
          ))}
        </div>
      </section>

      <TableCard
        title="Low-score respondents"
        description="Detractors flagged for personal outreach by Customer Success."
        items={nps.lowScoreFlags}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "score", header: "Score", render: (item) => <span className="font-bold text-rose-700">{item.score}</span> },
          { key: "comment", header: "Comment", render: (item) => item.comment ?? "-" },
          { key: "date", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
        emptyState="No detractors — great!"
      />
    </section>
  );
}

async function ReportsTab() {
  const reports = await apiGet<SuperAdminCustomReportRow[]>("/api/super-admin/analytics/custom-reports");

  return (
    <TableCard
      title="Custom reports"
      description="Build reusable reports from a metric and a dimension. Open a report to run it."
      items={reports ?? []}
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
        { key: "name", header: "Report", render: (item) => item.name },
        { key: "metric", header: "Metric", render: (item) => item.metric },
        { key: "dimension", header: "Grouped by", render: (item) => item.dimension },
        { key: "by", header: "Created by", render: (item) => item.createdBy },
        { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
      ]}
      emptyState="No custom reports saved yet."
    />
  );
}
