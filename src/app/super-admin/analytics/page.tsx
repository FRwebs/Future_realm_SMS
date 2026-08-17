import { TrendCard } from "@/components/dashboard/trend-card";
import { DetailTabs } from "@/components/data-display/detail-tabs";
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
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Platform intelligence</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Analytics & BI</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Product adoption, conversion funnel, cohort retention, churn reasons, NPS, feature-request intelligence, and a custom report builder.
        </p>
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

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-3">
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
          { key: "modules", header: "Modules Used", render: (item) => item.modulesUsed.join(", ") || "—" }
        ]}
      />
    </>
  );
}

async function AdoptionTab() {
  const bi = await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Module adoption</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
          {bi.schoolsActiveThisWeek} schools active this week
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Adoption per module across every school. High ≥66%, Medium ≥33%, Low below.
        </p>
      </section>

      <TableCard
        title="Product adoption heatmap"
        description="Shading reflects the adoption rate for each module."
        items={bi.heatmap}
        emptyState="No adoption data yet."
        columns={[
          { key: "module", header: "Module", render: (item) => item.module.replaceAll("_", " ") },
          { key: "using", header: "Schools using", render: (item) => item.schoolsUsing },
          {
            key: "pct",
            header: "Adoption",
            render: (item) => (
              <div className="w-28">
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full" style={{ width: `${item.adoptionPct}%`, background: heatCellStyle(item.adoptionPct).color }} />
                </div>
              </div>
            )
          },
          {
            key: "level",
            header: "Level",
            render: (item) => {
              const style = heatCellStyle(item.adoptionPct);
              return <StatusPill bg={style.background} fg={style.color} label={`${item.level} · ${item.adoptionPct}%`} />;
            }
          }
        ]}
      />
    </section>
  );
}

async function FunnelTab() {
  const bi = await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");
  const maxCount = Math.max(...bi.funnel.map((stage) => stage.count), 1);

  return (
    <section className="surface-card p-6">
      <p className="section-eyebrow">Growth funnel</p>
      <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Signup to active conversion</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
        Each stage's drop-off is measured against the stage before it.
      </p>
      <div className="mt-6 grid gap-3">
        {bi.funnel.map((stage, i) => {
          const prev = i > 0 ? bi.funnel[i - 1].count : stage.count;
          const dropPct = prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0;
          return (
            <div key={stage.stage}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-[var(--color-text-primary)]">{stage.stage}</span>
                <span className="flex items-center gap-3">
                  <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{stage.count}</span>
                  {i > 0 ? (
                    <span className="text-[11px] font-bold" style={{ color: dropPct > 30 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                      −{dropPct}%
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(stage.count / maxCount) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function CohortsTab() {
  const bi = await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");

  return (
    <TableCard
      title="Cohort retention"
      description="Schools grouped by the month they joined, and how many are still active."
      items={bi.cohorts}
      emptyState="No cohort data yet."
      columns={[
        { key: "cohort", header: "Cohort", render: (item) => item.cohort },
        { key: "joined", header: "Joined", render: (item) => item.joined },
        { key: "active", header: "Still active", render: (item) => item.stillActive },
        {
          key: "pct",
          header: "Retention",
          render: (item) => (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${item.retentionPct}%` }} />
              </div>
              <span className="font-[var(--font-mono)] text-[12.5px] font-bold text-[var(--color-text-primary)]">{item.retentionPct}%</span>
            </div>
          )
        }
      ]}
    />
  );
}

async function FeatureRequestsTab() {
  const bi = await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");

  return (
    <TableCard
      title="Feature request intelligence"
      description="Top requested feature keywords, mined from feature-request support tickets."
      items={bi.featureRequests}
      emptyState="No feature-request tickets yet."
      columns={[
        { key: "keyword", header: "Keyword", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.keyword}</span> },
        { key: "requests", header: "Requests", render: (item) => item.requestCount },
        { key: "schools", header: "Schools", render: (item) => item.schoolsRequesting },
        {
          key: "score",
          header: "Priority score",
          render: (item) => (
            <StatusPill
              bg={item.priorityScore >= 70 ? "var(--color-danger-dim)" : item.priorityScore >= 40 ? "var(--color-warning-dim)" : "var(--color-bg-subtle)"}
              fg={item.priorityScore >= 70 ? "var(--color-danger)" : item.priorityScore >= 40 ? "var(--color-warning)" : "var(--color-text-muted)"}
              label={String(item.priorityScore)}
            />
          )
        }
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

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-eyebrow">Retention risk</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Churn analysis</h2>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{churn.total} logged churn(s). Any reason exceeding 25% of churn is escalated to a response plan.</p>
          </div>
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
        </div>
        <div className="mt-5 grid gap-2">
          {churn.byReason.map((r) => (
            <div key={r.reason} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{r.reason.replaceAll("_", " ")}</span>
              <span className="flex items-center gap-3">
                <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{r.count}</span>
                <span className="text-[11px] font-bold" style={{ color: r.pct > 25 ? "var(--color-danger)" : "var(--color-text-muted)" }}>{r.pct}%</span>
              </span>
            </div>
          ))}
          {churn.byReason.length === 0 ? <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">No churn logged yet.</p> : null}
        </div>
      </section>

      <TableCard
        title="Recent churn"
        description="Most recently logged departures."
        items={churn.recent}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "reason", header: "Reason", render: (item) => item.reason.replaceAll("_", " ") },
          { key: "notes", header: "Notes", render: (item) => item.notes ?? "—" },
          { key: "date", header: "Churned", render: (item) => formatDate(item.churnedAt) }
        ]}
        emptyState="No churn recorded."
      />
    </section>
  );
}

async function NpsTab() {
  const [nps, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminNpsAnalytics>("/api/super-admin/analytics/nps"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-eyebrow">Satisfaction</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Net Promoter Score</h2>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Termly satisfaction. Detractors (0-6) are flagged for Customer Success outreach.</p>
          </div>
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
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { label: "NPS", value: nps.npsScore },
            { label: "Promoters", value: nps.promoters, tone: "good" as const },
            { label: "Passives", value: nps.passives, tone: "warn" as const },
            { label: "Detractors", value: nps.detractors, tone: "bad" as const }
          ].map((m) => (
            <article key={m.label} className="surface-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{m.label}</p>
              <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{m.value}</p>
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
          { key: "score", header: "Score", render: (item) => <span className="font-bold" style={{ color: "var(--color-danger)" }}>{item.score}</span> },
          { key: "comment", header: "Comment", render: (item) => item.comment ?? "—" },
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
