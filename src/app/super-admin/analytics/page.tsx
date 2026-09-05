import { AlertTriangle, Banknote, Building2, ClipboardList, CreditCard, Gauge, Lightbulb, MessageCircle, PackageOpen, Repeat2, SmilePlus, TrendingDown, TrendingUp, Trophy, UsersRound } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBiOverview,
  SuperAdminChurnAnalysis,
  SuperAdminCustomReportRow,
  SuperAdminDisplacementAnalysis,
  SuperAdminNpsAnalytics,
  SuperAdminProductAdoption,
  SuperAdminRevenueReport,
  SuperAdminSchoolRow
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
  if (pct < 45) {
    const alpha = (0.07 + (pct / 45) * 0.33).toFixed(3);
    return { background: `rgba(18,121,106,${alpha})`, color: "#0d2315" };
  }
  const t = (pct - 45) / 55;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return { background: `rgb(${lerp(18, 6)},${lerp(121, 56)},${lerp(106, 47)})`, color: "#fff" };
}

function HeatCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="inline-flex min-w-14 items-center justify-center rounded-[7px] border border-[#E9F0EC] bg-[#F2F7F4] px-1 py-[9px] font-[var(--font-heading)] text-[11.5px] font-semibold text-[#C2D2C8]">—</span>;
  }
  const style = heatCellStyle(value);
  return (
    <span className="inline-flex min-w-14 items-center justify-center rounded-[7px] px-1 py-[9px] font-[var(--font-heading)] text-[11.5px] font-semibold" style={{ background: style.background, color: style.color }}>
      {value}%
    </span>
  );
}

const barToneColors: Record<"good" | "warn" | "bad", string> = { good: "#22A06B", warn: "#D9A22C", bad: "#DB5555" };

function BarCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[12.5px] text-[var(--color-text-muted)]">—</span>;
  }
  const tone: "good" | "warn" | "bad" = value >= 80 ? "good" : value >= 60 ? "warn" : "bad";
  const color = barToneColors[tone];
  return (
    <div className="flex items-center gap-[9px]">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDF3EF]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="whitespace-nowrap text-[12px] font-semibold" style={{ color }}>{value}%</div>
    </div>
  );
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
      <ModuleHero
        eyebrow="Platform intelligence"
        title="Analytics & BI"
        description="Growth and conversion, cohort/churn/NPS retention signals, revenue reporting, product adoption, and saved reports."
      />

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
  const [bi, displacement] = await Promise.all([
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi"),
    apiGet<SuperAdminDisplacementAnalysis>("/api/super-admin/analytics/displacement")
  ]);

  const funnelStages = bi.funnel.map((stage, index) => {
    const previous = bi.funnel[index - 1];
    // Positive = the stage count grew versus the one before it (these stages track
    // different, non-nested populations — e.g. "converted to paid" isn't a strict subset
    // of "approaching trial end" — so a real funnel here isn't always monotonic).
    const changePct = previous && previous.count > 0 ? Math.round(((stage.count - previous.count) / previous.count) * 1000) / 10 : null;
    const ofFirstPct = bi.funnel[0]?.count > 0 ? Math.round((stage.count / bi.funnel[0].count) * 1000) / 10 : null;
    return { ...stage, changePct, ofFirstPct };
  });

  return (
    <section className="grid gap-5">
      <section className="surface-card overflow-hidden">
        <SectionHeader title="Growth and conversion funnel" description="Each stage is a real school count, clickable through to the schools behind it — not a sample." />
        <div className="flex items-end gap-2.5 px-5 pb-[22px] pt-2.5">
          {funnelStages.map((stage, index) => {
            const barPct = Math.max(stage.ofFirstPct ?? 100, 2);
            const isLast = index === funnelStages.length - 1;
            return (
              <div key={stage.stage} className="min-w-0 flex-1">
                <div className="flex h-[132px] items-end">
                  <div
                    className="w-full rounded-t-[8px]"
                    style={{ height: `${barPct}%`, background: isLast ? "#0d2315" : `rgba(18,121,106,${0.28 + index * 0.1})` }}
                  />
                </div>
                <p className="mt-[11px] font-[var(--font-display)] text-[15px] font-bold text-[var(--color-text-primary)]">{stage.count.toLocaleString()}</p>
                <p className="mt-1 text-pretty text-[11px] leading-[1.35] text-[#77857C]">{stage.stage}</p>
                <p className="mt-[5px] text-[11px] font-semibold" style={{ color: stage.changePct === null ? "#9FB8A7" : stage.changePct < 0 ? "#B23B3B" : "#22A06B" }}>
                  {stage.changePct === null ? "—" : stage.changePct < 0 ? `−${Math.abs(stage.changePct)}% drop` : `+${stage.changePct}%`}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <TableCard
        title="Week-over-week funnel movement"
        description="Tracked so the team can see whether conversion is genuinely improving."
        items={bi.weekOverWeek}
        pageSize={false}
        getRowKey={(item) => item.stage}
        columns={[
          { key: "stage", header: "Stage", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.stage}</span>, sortValue: (item) => item.stage },
          { key: "thisWeek", header: "This week", render: (item) => <span className="font-[var(--font-mono)] font-black text-[var(--color-text-primary)]">{item.thisWeek}</span>, sortValue: (item) => item.thisWeek },
          { key: "lastWeek", header: "Last week", render: (item) => item.lastWeek, sortValue: (item) => item.lastWeek },
          {
            key: "change",
            header: "Change",
            render: (item) => (
              <span className="font-bold" style={{ color: item.changePct >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                {item.changePct >= 0 ? "+" : ""}{item.changePct}%
              </span>
            ),
            sortValue: (item) => item.changePct
          }
        ]}
      />

      <div className="grid gap-1.5">
        <p className="section-eyebrow">Displacement</p>
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Where schools switched from</h2>
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">Computed from real migration records — which system a school moved from, and whether the move stuck.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Displaced a system" value={`${displacement.displacementRatePct}%`} detail="Of migrated schools, arrived from another platform" icon={Repeat2} tone="accent" />
        <StatCard label="From paper or spreadsheets" value={`${displacement.paperOrSpreadsheetPct}%`} detail="The discovery half of the market" icon={ClipboardList} />
        <StatCard label="Migration completion" value={`${displacement.migrationCompletionRatePct}%`} detail="Across all source systems" tone="success" icon={TrendingUp} />
        <StatCard label="Trialled and returned" value={displacement.trialledAndReturned} detail="Rolled-back migrations, reason recorded" tone={displacement.trialledAndReturned > 0 ? "warning" : "success"} icon={TrendingDown} />
        <StatCard label="Sources we cannot read" value={displacement.unreadableSourceCount} detail="No adapter available, every attempt rolled back" tone={displacement.unreadableSourceCount > 0 ? "danger" : "success"} icon={PackageOpen} />
      </section>

      <TableCard
        title="Win analysis by displaced system"
        description="Which system we take schools from, and whether our import tooling can actually read it."
        items={displacement.bySourceSystem}
        pageSize={false}
        getRowKey={(item) => item.sourceSystem}
        emptyState="No migrations logged yet."
        columns={[
          { key: "source", header: "Previous system", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.sourceSystem}</span>, sortValue: (item) => item.sourceSystem },
          { key: "won", header: "Won", render: (item) => item.won, sortValue: (item) => item.won },
          { key: "lost", header: "Lost", render: (item) => item.lost, sortValue: (item) => item.lost },
          {
            key: "rate",
            header: "Migration rate",
            render: (item) => (item.migrationRatePct === null ? "—" : <BarCell value={item.migrationRatePct} />),
            sortValue: (item) => item.migrationRatePct ?? 0
          },
          {
            key: "adapter",
            header: "Adapter",
            render: (item) => (
              <StatusPill bg={item.adapterAvailable ? "var(--color-success-dim)" : "var(--color-danger-dim)"} fg={item.adapterAvailable ? "var(--color-success)" : "var(--color-danger)"} label={item.adapterAvailable ? "Available" : "None"} />
            )
          }
        ]}
      />

      <TableCard
        title="Loss analysis — returned to previous system"
        description="Every rolled-back migration, with the reason recorded."
        items={displacement.lossAnalysis}
        pageSize={false}
        getRowKey={(item, index) => `${item.schoolName}-${index}`}
        emptyState="No school has rolled back a migration."
        columns={[
          { key: "school", header: "School", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.schoolName}</span> },
          { key: "returnedTo", header: "Returned to", render: (item) => item.sourceSystem },
          { key: "reason", header: "Reason given", render: (item) => <span className="text-[var(--color-text-secondary)]">{item.reason}</span> }
        ]}
      />
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

  const npsScore = nps.npsScore;
  const npsPassives = Math.max(0, nps.total - nps.promoters - nps.detractors);
  const promoterPct = nps.total > 0 ? Math.round((nps.promoters / nps.total) * 100) : 0;
  const passivePct = nps.total > 0 ? Math.round((npsPassives / nps.total) * 100) : 0;
  const detractorPct = nps.total > 0 ? Math.round((nps.detractors / nps.total) * 100) : 0;
  const maxTierChurn = Math.max(...churn.byTier.map((item) => item.ratePct), 1);
  const maxTenureChurn = Math.max(...churn.byTenure.map((item) => item.pct), 1);
  const maxTierRegionNps = Math.max(...nps.byTierAndRegion.map((item) => Math.abs(item.npsScore)), 1);

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
          { key: "retention", header: "Retention", render: (item) => <BarCell value={item.retentionPct} />, sortValue: (item) => item.retentionPct }
        ]}
      />
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
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Churn rate by tenure</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Share of all churn, by how long the school had been on the platform.</p>
          <div className="mt-4 grid gap-3.5">
            {churn.byTenure.every((item) => item.count === 0) ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No churn logged yet.</p>
            ) : (
              churn.byTenure.map((item) => (
                <div key={item.bucket}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--color-text-secondary)]">{item.bucket}</span>
                    <span className="font-[var(--font-mono)] text-[13px] font-black" style={{ color: item.pct >= 40 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full" style={{ width: `${(item.pct / maxTenureChurn) * 100}%`, background: item.pct >= 40 ? "var(--color-danger)" : "var(--color-accent-primary)" }} />
                  </div>
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
        <StatCard label="Response rate" value={`${nps.responseRatePct}%`} detail={`${nps.total} of every non-deleted school's admin`} tone="neutral" icon={ClipboardList} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="surface-card p-6">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">NPS by tier and region</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Broken down so outreach can be targeted where it moves the number.</p>
          <div className="mt-4 grid gap-3.5">
            {nps.byTierAndRegion.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">No NPS responses yet.</p>
            ) : (
              nps.byTierAndRegion.map((item) => (
                <div key={`${item.kind}-${item.label}`}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                    <span className="font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">{item.npsScore >= 0 ? "+" : ""}{item.npsScore} · {item.responses} resp.</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(Math.abs(item.npsScore) / maxTierRegionNps) * 100}%` }} />
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
  const report = await apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report");

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
        <TableCard
          title="Revenue by state"
          description="Where the platform's schools and revenue are concentrated, and where growth is coming from. A state figure that cannot be traced to named schools is not a figure anyone should act on — open any row to see them."
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
            },
            {
              key: "open",
              header: "",
              render: (item) => (
                <a href={`/super-admin/schools?state=${encodeURIComponent(item.state)}`} className="font-semibold text-[var(--color-text-accent)] underline">
                  View schools
                </a>
              )
            }
          ]}
          emptyState="No school location data yet."
        />
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
    </section>
  );
}

function moduleLabel(module: string) {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

async function ProductTab() {
  const [adoption, bi] = await Promise.all([
    apiGet<SuperAdminProductAdoption>("/api/super-admin/analytics/product-adoption"),
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi")
  ]);

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Weekly active schools" value={adoption.schoolsActiveThisWeek} detail="At least one login in the last 7 days" icon={Building2} tone="accent" />
        <StatCard label="Platform adoption index" value={adoption.adoptionIndex} detail={`Weighted across ${adoption.modulesTracked} modules`} icon={Gauge} />
        <StatCard label="Modules below the 40% floor" value={adoption.modulesBelowFloor} detail="Enabled by fewer than 4 in 10 schools" tone={adoption.modulesBelowFloor > 0 ? "danger" : "success"} icon={PackageOpen} />
        <StatCard label="Top adopted module" value={adoption.topModule ? `${adoption.topModule.adoptionPct}%` : "—"} detail={adoption.topModule ? moduleLabel(adoption.topModule.module) : "No module usage recorded yet"} tone="success" icon={Banknote} />
        <StatCard label="Modules tracked" value={adoption.modulesTracked} detail="Toggleable in every school's configuration" icon={CreditCard} />
      </section>

      <section>
        <TableCard
          title="Module adoption by tier"
          description="Share of schools on each tier with the module switched on — a real usage signal, not an entitlement gate. Every school gets every module at signup and enables or disables it from its own configuration."
          items={adoption.heatmapByTier}
          pageSize={false}
          getRowKey={(item) => item.module}
          emptyState="No module usage recorded yet."
          columns={[
            { key: "module", header: "Module", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{moduleLabel(item.module)}</span>, sortValue: (item) => item.module },
            ...adoption.tierColumns.map((tier, tierIndex) => ({
              key: `tier-${tier.plan}`,
              header: `${tier.plan} (${tier.schoolCount})`,
              render: (item: (typeof adoption.heatmapByTier)[number]) => <HeatCell value={item.cells[tierIndex] ?? null} />,
              sortValue: (item: (typeof adoption.heatmapByTier)[number]) => item.cells[tierIndex] ?? -1
            }))
          ]}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <TableCard
          title="Adoption gaps"
          description="Every module sitting below the 40% floor across the whole platform."
          items={adoption.gaps}
          pageSize={false}
          getRowKey={(item) => item.module}
          emptyState="No module is below the 40% floor."
          columns={[
            { key: "module", header: "Module", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{moduleLabel(item.module)}</span>, sortValue: (item) => item.module },
            { key: "adoption", header: "Adoption", render: (item) => <BarCell value={item.adoptionPct} />, sortValue: (item) => item.adoptionPct },
            { key: "using", header: "Schools using", render: (item) => item.schoolsUsing, sortValue: (item) => item.schoolsUsing },
            { key: "notUsing", header: "Schools not using", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.schoolsNotUsing}</span>, sortValue: (item) => item.schoolsNotUsing }
          ]}
        />
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--color-border-default)] px-5 py-4">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">How this grid is read</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">Three rules keep the comparison honest</p>
          </div>
          <div className="grid gap-3 p-5">
            {[
              { title: "Compare down a column, or across a row — every school can toggle every module", detail: "There is no tier-based entitlement gate in this product, so a low cell is a genuine usage gap, not a locked feature." },
              { title: "Adoption is measured per school, not per user", detail: "One teacher using a module does not make a school an adopter of it." },
              { title: "Below 40% for two tiers running is worth a product conversation", detail: "The floor is a prompt to ask why, not an automatic verdict." }
            ].map((row) => (
              <div key={row.title} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{row.title}</p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{row.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section>
        <TableCard
          title="Adoption by state"
          description="Same metric grouped by region, to separate a product problem from a connectivity or training problem."
          items={adoption.heatmapByState}
          pageSize={false}
          getRowKey={(item) => item.state}
          emptyState="No school location data yet."
          columns={[
            { key: "state", header: "State", render: (item) => <div><span className="font-bold text-[var(--color-text-primary)]">{item.state}</span><p className="text-[11px] text-[var(--color-text-muted)]">{item.schoolCount} school{item.schoolCount === 1 ? "" : "s"}</p></div>, sortValue: (item) => item.state },
            ...adoption.stateHeatmapModules.map((module, moduleIndex) => ({
              key: `module-${module}`,
              header: moduleLabel(module),
              render: (item: (typeof adoption.heatmapByState)[number]) => <HeatCell value={item.cells[moduleIndex] ?? null} />,
              sortValue: (item: (typeof adoption.heatmapByState)[number]) => item.cells[moduleIndex] ?? -1
            }))
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

      <TableCard
        title="Reporting cadence"
        description="Every figure on this page is computed live at request time — there is no scheduled rollup job or cached snapshot behind any of it."
        items={[
          { type: "Custom reports", frequency: "Computed live when run" },
          { type: "Funnel / conversion", frequency: "Computed live on page load" },
          { type: "Displacement", frequency: "Computed live on page load" },
          { type: "Cohort retention", frequency: "Computed live on page load" },
          { type: "Revenue (MRR / ARR)", frequency: "Computed live on page load" },
          { type: "Churn analysis", frequency: "Computed live on page load" },
          { type: "NPS", frequency: "Computed live on page load" },
          { type: "Product adoption", frequency: "Computed live on page load" }
        ]}
        pageSize={false}
        getRowKey={(item) => item.type}
        columns={[
          { key: "type", header: "Report type", render: (item) => item.type },
          { key: "frequency", header: "Frequency", render: (item) => <span className="text-[var(--color-text-muted)]">{item.frequency}</span> }
        ]}
      />
    </section>
  );
}
