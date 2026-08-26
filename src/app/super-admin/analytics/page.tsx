import { Activity, AlertTriangle, Banknote, Building2, CircleDollarSign, ClipboardList, CreditCard, Gauge, Lightbulb, MessageCircle, PackageOpen, Repeat2, ShieldAlert, SmilePlus, TrendingDown, TrendingUp, Trophy, UserCog, Users, UsersRound } from "lucide-react";

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
  SuperAdminRevenueReport,
  SuperAdminRevenueView,
  SuperAdminSchoolRow,
  SuperAdminUsageRow
} from "@/lib/domain/types";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/utils/formatters";

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

function PercentCell({ value }: { value: number | null }) {
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

function tabHref(tab: string) {
  return tab === "growth" ? "/super-admin/analytics" : `/super-admin/analytics?tab=${tab}`;
}

export default async function SuperAdminAnalyticsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = searchParams ? await searchParams : {};
  const validTabs = new Set(["growth", "retention", "revenue", "product", "reports"]);
  const tab = rawTab && validTabs.has(rawTab) ? rawTab : "growth";

  const tabs = [
    { label: "Growth", href: tabHref("growth"), active: tab === "growth" },
    { label: "Retention", href: tabHref("retention"), active: tab === "retention" },
    { label: "Revenue", href: tabHref("revenue"), active: tab === "revenue" },
    { label: "Product", href: tabHref("product"), active: tab === "product" },
    { label: "Reports", href: tabHref("reports"), active: tab === "reports" }
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
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Analytics &amp; BI</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            Growth and conversion, cohort/churn/NPS retention signals, revenue reporting, product adoption, and saved reports.
          </p>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "growth" ? <GrowthTab /> : null}
      {tab === "retention" ? <RetentionTab /> : null}
      {tab === "revenue" ? <RevenueTab /> : null}
      {tab === "product" ? <ProductTab /> : null}
      {tab === "reports" ? <ReportsTab /> : null}
    </div>
  );
}

async function GrowthTab() {
  const [overview, usage, revenue, bi] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminUsageRow[]>("/api/super-admin/analytics/usage"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue"),
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi")
  ]);
  const activeSchools = overview.schools.active ?? overview.schools.total;
  const weeklyActivePct = overview.schools.total > 0 ? Math.round((activeSchools / overview.schools.total) * 100) : 0;
  const topSchools = usage.slice(0, 8);
  const recentRevenue = revenue.monthlyRevenue.slice(-6);
  const maxRevenue = Math.max(...recentRevenue.map((item) => item.amount), 1);

  const funnelStages = bi.funnel.map((stage, index) => {
    const previous = bi.funnel[index - 1];
    const dropPct = previous && previous.count > 0 ? Math.round(((previous.count - stage.count) / previous.count) * 1000) / 10 : null;
    const ofFirstPct = bi.funnel[0]?.count > 0 ? Math.round((stage.count / bi.funnel[0].count) * 1000) / 10 : null;
    return { ...stage, dropPct, ofFirstPct };
  });
  const worstDrop = funnelStages.reduce<{ stage: string; dropPct: number } | null>((worst, stage) => {
    if (stage.dropPct === null) return worst;
    if (!worst || stage.dropPct > worst.dropPct) return { stage: stage.stage, dropPct: stage.dropPct };
    return worst;
  }, null);

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active schools" value={activeSchools} detail={`of ${overview.schools.total} total · ${weeklyActivePct}% active`} tone={weeklyActivePct >= 80 ? "success" : weeklyActivePct >= 60 ? "warning" : "danger"} icon={Building2} />
        <StatCard label="Students" value={overview.users.students.toLocaleString()} detail={`${overview.users.teachers.toLocaleString()} teachers · ${overview.users.parents.toLocaleString()} parents`} icon={UsersRound} />
        <StatCard label="MRR" value={formatCurrency(revenue.mrr)} detail={`ARR ${formatCurrency(revenue.arr)}`} tone="success" icon={CircleDollarSign} />
        <StatCard label="School admins" value={overview.users.schoolAdmins.toLocaleString()} detail="Primary platform owners" icon={UserCog} />
        <StatCard label="Top activity" value={topSchools[0]?.logins ?? 0} detail={topSchools[0]?.schoolName ?? "No school"} icon={Activity} tone="accent" />
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

      <section className="surface-card overflow-hidden">
        <SectionHeader title="Growth and conversion funnel" description="Live counts from signup through to a second paid term — each stage is a real school count, not a sample." />
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
          {funnelStages.map((stage, index) => (
            <article key={stage.stage} className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
              <p className="font-[var(--font-heading)] text-[24px] font-black text-[var(--color-text-primary)]">{stage.count.toLocaleString()}</p>
              <p className="mt-1 min-h-10 text-[12px] font-bold leading-5 text-[var(--color-text-primary)]">{stage.stage}</p>
              <p className="mt-2 text-[11.5px] font-bold" style={{ color: stage.dropPct !== null && stage.dropPct >= 20 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                {stage.dropPct === null ? "—" : `−${stage.dropPct}% drop`}
              </p>
              {index < funnelStages.length - 1 ? <div className="mt-3 h-1 rounded-full bg-[var(--color-accent-primary)] opacity-60" /> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
        <TableCard
          title="Funnel stage detail"
          items={funnelStages}
          pageSize={false}
          getRowKey={(item) => item.stage}
          columns={[
            { key: "stage", header: "Stage", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.stage}</span>, sortValue: (item) => item.stage },
            { key: "count", header: "Schools", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.count.toLocaleString()}</span>, sortValue: (item) => item.count },
            { key: "ofFirst", header: "Share of signups", render: (item) => (item.ofFirstPct === null ? "—" : `${item.ofFirstPct}%`), sortValue: (item) => item.ofFirstPct ?? 0 },
            { key: "drop", header: "Drop from previous stage", render: (item) => (item.dropPct === null ? "—" : <span className="font-bold" style={{ color: item.dropPct >= 20 ? "var(--color-danger)" : "var(--color-text-primary)" }}>−{item.dropPct}%</span>), sortValue: (item) => item.dropPct ?? 0 }
          ]}
        />
        {worstDrop ? (
          <StatCard label="Largest drop" value={`−${worstDrop.dropPct}%`} detail={worstDrop.stage} tone="danger" icon={TrendingDown} />
        ) : (
          <StatCard label="Largest drop" value="—" detail="Not enough funnel stages recorded yet" tone="neutral" icon={TrendingDown} />
        )}
      </section>
    </section>
  );
}

async function RetentionTab() {
  const [bi, churn, nps, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi"),
    apiGet<SuperAdminChurnAnalysis>("/api/super-admin/analytics/churn"),
    apiGet<SuperAdminNpsAnalytics>("/api/super-admin/analytics/nps"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));

  const cohorts = bi.cohorts;
  const bestCohort = cohorts.reduce<typeof cohorts[number] | null>((best, item) => (!best || item.retentionPct > best.retentionPct ? item : best), null);
  const largestCohort = cohorts.reduce<typeof cohorts[number] | null>((largest, item) => (!largest || item.joined > largest.joined ? item : largest), null);
  const newestCohort = cohorts[cohorts.length - 1] ?? null;

  const npsScore = nps.npsScore;
  const npsPassives = Math.max(0, nps.total - nps.promoters - nps.detractors);
  const promoterPct = nps.total > 0 ? Math.round((nps.promoters / nps.total) * 100) : 0;
  const passivePct = nps.total > 0 ? Math.round((npsPassives / nps.total) * 100) : 0;
  const detractorPct = nps.total > 0 ? Math.round((nps.detractors / nps.total) * 100) : 0;
  const maxTierChurn = Math.max(...churn.byTier.map((item) => item.ratePct), 1);
  const maxTierNps = Math.max(...nps.byTier.map((item) => Math.abs(item.npsScore)), 1);

  return (
    <section className="grid gap-5">
      {/* Cohort retention */}
      <div className="grid gap-1.5">
        <p className="section-eyebrow">Cohort retention</p>
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Retention by signup cohort</h2>
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">Schools grouped by the month they joined, and the share still active today.</p>
      </div>
      <TableCard
        title="Cohorts"
        items={cohorts}
        pageSize={false}
        getRowKey={(item) => item.cohort}
        emptyState="No cohort data yet."
        columns={[
          { key: "cohort", header: "Cohort (join month)", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.cohort}</span>, sortValue: (item) => item.cohort },
          { key: "joined", header: "Joined", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.joined}</span>, sortValue: (item) => item.joined },
          { key: "active", header: "Still active", render: (item) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{item.stillActive}</span>, sortValue: (item) => item.stillActive },
          { key: "retention", header: "Retention", render: (item) => <PercentCell value={item.retentionPct} />, sortValue: (item) => item.retentionPct }
        ]}
      />
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Best retaining cohort" value={bestCohort ? `${bestCohort.retentionPct}%` : "—"} detail={bestCohort?.cohort ?? "No cohorts yet"} tone="success" icon={Trophy} />
        <StatCard label="Newest cohort" value={newestCohort ? `${newestCohort.retentionPct}%` : "—"} detail={newestCohort?.cohort ?? "No cohorts yet"} tone="warning" icon={ShieldAlert} />
        <StatCard label="Largest cohort" value={largestCohort?.joined ?? 0} detail={largestCohort ? `${largestCohort.cohort} schools` : "No cohorts yet"} icon={Users} />
      </section>

      {/* Churn analysis */}
      <div className="mt-2 grid gap-1.5">
        <p className="section-eyebrow">Churn analysis</p>
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Why schools leave</h2>
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">Logged churn records, grouped by reason and subscription tier.</p>
      </div>
      <TableCard
        title={`Churn reason breakdown · ${churn.total} school${churn.total === 1 ? "" : "s"}`}
        items={churn.byReason}
        pageSize={false}
        getRowKey={(item) => item.reason}
        emptyState="No churn logged yet."
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
          { key: "reason", header: "Churn reason", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.reason.replaceAll("_", " ")}</span>, sortValue: (item) => item.reason },
          { key: "count", header: "Count", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.count}</span>, sortValue: (item) => item.count },
          { key: "share", header: "Share", render: (item) => <span className="font-bold" style={{ color: item.pct >= 25 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.pct}%</span>, sortValue: (item) => item.pct }
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Churn rate by tier</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Share of every school that has ever been on a tier which later churned.</p>
          <div className="mt-4 grid gap-3.5">
            {churn.byTier.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No tier churn data yet.</p>
            ) : (
              churn.byTier.map((item) => (
                <div key={item.plan}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--color-text-secondary)]">{item.plan}</span>
                    <span className="font-[var(--font-mono)] text-[13px] font-black" style={{ color: item.ratePct >= 5 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.ratePct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full" style={{ width: `${(item.ratePct / maxTierChurn) * 100}%`, background: item.ratePct >= 5 ? "var(--color-danger)" : "var(--color-accent-primary)" }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Recently churned schools</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Most recent 20 churn log entries.</p>
          <div className="mt-4 grid gap-3 max-h-[320px] overflow-y-auto pr-1">
            {churn.recent.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No churn logged yet.</p>
            ) : (
              churn.recent.map((item) => (
                <div key={item.id} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.schoolName}</p>
                    <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(item.churnedAt)}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--color-text-secondary)]">{item.reason.replaceAll("_", " ")}{item.notes ? ` — ${item.notes}` : ""}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* NPS */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <p className="section-eyebrow">NPS &amp; satisfaction</p>
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Net promoter score</h2>
          <p className="text-[12.5px] text-[var(--color-text-secondary)]">Recorded from school admin survey responses.</p>
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Platform NPS" value={`${npsScore >= 0 ? "+" : ""}${npsScore}`} detail={`${nps.total} response${nps.total === 1 ? "" : "s"} recorded`} tone={npsScore >= 30 ? "success" : npsScore >= 0 ? "warning" : "danger"} icon={SmilePlus} />
        <StatCard label="Promoters" value={`${promoterPct}%`} detail={`${nps.promoters} of ${nps.total} · score 9-10`} tone="success" icon={Trophy} />
        <StatCard label="Passives" value={`${passivePct}%`} detail={`${npsPassives} of ${nps.total} · score 7-8`} tone="warning" icon={MessageCircle} />
        <StatCard label="Detractors" value={`${detractorPct}%`} detail={`${nps.detractors} of ${nps.total} · score 0-6`} tone="danger" icon={AlertTriangle} />
        <StatCard label="Responses logged" value={nps.total} detail="All time, across all schools" tone="neutral" icon={ClipboardList} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">NPS by tier</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Broken down so outreach can be targeted where it moves the number.</p>
          <div className="mt-4 grid gap-3.5">
            {nps.byTier.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No NPS responses yet.</p>
            ) : (
              nps.byTier.map((item) => (
                <div key={item.plan}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--color-text-secondary)]">{item.plan}</span>
                    <span className="font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">{item.npsScore >= 0 ? "+" : ""}{item.npsScore} · {item.responses} resp.</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(Math.abs(item.npsScore) / maxTierNps) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Verbatim comments</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Stored and searchable — low scorers can be flagged for personal outreach by Customer Success.</p>
          <div className="mt-4 grid gap-4">
            {nps.comments.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No verbatim comments recorded yet.</p>
            ) : (
              nps.comments.slice(0, 8).map((item, index) => {
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
              })
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

async function RevenueTab() {
  const [revenue, report] = await Promise.all([
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue"),
    apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report")
  ]);
  const subscriberCounts = new Map<string, number>(revenue.schoolsByPlan.map((item) => [item.plan, item.count]));
  const maxTierRevenue = Math.max(...report.revenueByTier.map((item) => item.revenue), 1);

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Outstanding"
          value={formatCompactCurrency(report.outstandingReceivables)}
          detail={`${report.unpaidSchoolCount} school${report.unpaidSchoolCount === 1 ? "" : "s"} with an open balance. Full value: ${formatCurrency(report.outstandingReceivables)}.`}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Renewal rate"
          value={`${report.renewalRate}%`}
          detail={`${report.renewedRecently} of ${report.activeSchoolCount} renewed in the last 90 days.`}
          icon={Repeat2}
          tone="success"
        />
        <StatCard
          label="ARPU"
          value={formatCompactCurrency(report.arpu)}
          detail={`Per paying school, per semester. Full value: ${formatCurrency(report.arpu)}.`}
          icon={UsersRound}
          tone="info"
        />
        <StatCard
          label="Credit share"
          value={`${report.creditRevenueSharePct}%`}
          detail={`${formatCompactCurrency(report.notificationCreditRevenue)} of platform revenue from credit bundles.`}
          icon={CreditCard}
          tone="accent"
        />
        <StatCard
          label="Next term"
          value={formatCompactCurrency(report.mrr)}
          detail={`Active schools × confirmed tiers. Full value: ${formatCurrency(report.mrr)}.`}
          icon={TrendingUp}
          tone="success"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Tier split</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Revenue by tier</h3>
          <div className="mt-4 grid gap-3">
            {report.revenueByTier.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No active paid subscriptions yet.</p>
            ) : (
              report.revenueByTier.map((item) => (
                <div key={item.plan}>
                  <div className="flex items-center justify-between text-[13px] font-semibold text-[var(--color-text-primary)]">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-[3px] bg-[var(--color-accent-primary)]" />
                      {item.plan}
                      <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{subscriberCounts.get(item.plan) ?? 0} subs</span>
                    </span>
                    <span className="font-[var(--font-mono)]">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(item.revenue / maxTierRevenue) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <TableCard
          title="LTV projection by tier"
          items={report.ltvByTier}
          columns={[
            { key: "tier", header: "Tier", render: (item) => item.plan },
            { key: "duration", header: "Avg duration", render: (item) => `${(item.avgTenureMonths / 4).toFixed(1)} terms` },
            { key: "termly", header: "Termly value", render: (item) => formatCurrency(item.termlyValue) },
            { key: "ltv", header: "Projected LTV", render: (item) => formatCurrency(item.ltv) }
          ]}
          emptyState="No active subscriptions yet."
        />
      </section>

      <TableCard
        title="Revenue by state"
        description="Where the platform's schools and revenue are concentrated, and where growth is coming from."
        items={report.revenueByState}
        columns={[
          { key: "state", header: "State", render: (item) => item.state },
          { key: "topCity", header: "Top city", render: (item) => item.topCity ?? "—" },
          { key: "schools", header: "Schools", render: (item) => item.schoolCount },
          { key: "revenue", header: "Semester revenue", render: (item) => formatCurrency(item.revenue) },
          { key: "arpu", header: "ARPU", render: (item) => formatCurrency(item.arpu) },
          {
            key: "trend",
            header: "Trend (90d)",
            render: (item) =>
              item.newSchools90d > 0 ? (
                <span className="font-semibold" style={{ color: "var(--color-success)" }}>
                  +{item.newSchools90d} school{item.newSchools90d === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[var(--color-text-muted)]">Steady</span>
              )
          }
        ]}
        emptyState="No school location data yet."
      />
    </section>
  );
}

async function ProductTab() {
  const bi = await apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi");
  const totalModules = bi.heatmap.length;
  const belowFloor = bi.heatmap.filter((item) => item.adoptionPct < 40).length;
  const topModule = bi.heatmap[0] ?? null;

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Schools active this week" value={bi.schoolsActiveThisWeek} detail="At least one login in the last 7 days" icon={Building2} />
        <StatCard label="Modules tracked" value={totalModules} detail="Feature flags enabled by at least one school" icon={Gauge} />
        <StatCard label="Modules below the 40% floor" value={belowFloor} detail="Enabled by fewer than 4 in 10 schools" tone={belowFloor > 0 ? "danger" : "success"} icon={PackageOpen} />
        <StatCard label="Top adopted module" value={topModule ? `${topModule.adoptionPct}%` : "—"} detail={topModule?.module ?? "No module usage recorded yet"} tone="success" icon={Banknote} />
      </section>

      <section>
        <TableCard
          title="Module adoption heatmap"
          description="Share of all schools with each feature flag enabled — computed live from every school's feature flags."
          items={bi.heatmap}
          pageSize={false}
          getRowKey={(item) => item.module}
          emptyState="No module usage recorded yet."
          columns={[
            { key: "module", header: "Module", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.module}</span>, sortValue: (item) => item.module },
            { key: "schools", header: "Schools using", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.schoolsUsing}</span>, sortValue: (item) => item.schoolsUsing },
            { key: "adoption", header: "Adoption", render: (item) => <PercentCell value={item.adoptionPct} />, sortValue: (item) => item.adoptionPct },
            {
              key: "level",
              header: "Level",
              render: (item) => (
                <StatusPill
                  bg={item.level === "HIGH" ? "var(--color-success-dim)" : item.level === "MEDIUM" ? "var(--color-warning-dim)" : "var(--color-danger-dim)"}
                  fg={item.level === "HIGH" ? "var(--color-success)" : item.level === "MEDIUM" ? "var(--color-warning)" : "var(--color-danger)"}
                  label={item.level}
                />
              ),
              sortValue: (item) => item.level
            }
          ]}
        />
      </section>

      <TableCard
        title="Feature request intelligence"
        description="Ranked by keyword frequency across support tickets tagged as feature requests."
        items={bi.featureRequests}
        pageSize={false}
        getRowKey={(item) => item.keyword}
        emptyState="No feature-request tickets logged yet."
        columns={[
          { key: "keyword", header: "Keyword", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.keyword}</span>, sortValue: (item) => item.keyword },
          { key: "requests", header: "Mentions", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.requestCount}</span>, sortValue: (item) => item.requestCount },
          { key: "schools", header: "Schools requesting", render: (item) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{item.schoolsRequesting}</span>, sortValue: (item) => item.schoolsRequesting },
          { key: "priority", header: "Priority score", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.priorityScore}</span>, sortValue: (item) => item.priorityScore }
        ]}
      />
      <p className="-mt-2 flex items-center gap-2 text-[11.5px] text-[var(--color-text-muted)]">
        <Lightbulb className="h-3.5 w-3.5" /> Priority score weights mention count, distinct schools, and distinct tiers requesting.
      </p>
    </section>
  );
}

async function ReportsTab() {
  const reports = await apiGet<SuperAdminCustomReportRow[]>("/api/super-admin/analytics/custom-reports");

  return (
    <section className="grid gap-5 xl:grid-cols-[1.35fr_0.75fr]">
      <TableCard
        title="Saved custom reports"
        items={reports}
        pageSize={false}
        getRowKey={(item) => item.id}
        emptyState="No saved reports yet. Build one to start tracking a metric over time."
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
          { key: "metric", header: "Metric", render: (item) => item.metric, sortValue: (item) => item.metric },
          { key: "dimension", header: "Grouped by", render: (item) => item.dimension, sortValue: (item) => item.dimension },
          { key: "createdBy", header: "Created by", render: (item) => item.createdBy, sortValue: (item) => item.createdBy },
          { key: "created", header: "Last generated", render: (item) => (item.generatedAt ? formatDate(item.generatedAt) : formatDate(item.createdAt)), sortValue: (item) => item.generatedAt ?? item.createdAt }
        ]}
      />

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--color-border-default)] px-5 py-4">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">How custom reports work</p>
        </div>
        <div className="grid gap-3 p-5">
          {[
            { title: "Pick a metric and a grouping", detail: "School count, student count, or MRR — grouped by tier, state, or subscription status." },
            { title: "Computed live from Prisma", detail: "Every report re-reads the schools table at run time — there is no cached or sample data." },
            { title: "Saved for reuse", detail: "A saved report keeps its metric and grouping so it can be regenerated any time." }
          ].map((row) => (
            <div key={row.title} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
              <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{row.title}</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{row.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
