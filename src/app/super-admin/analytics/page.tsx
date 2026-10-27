import { AlertTriangle, Banknote, Building2, ClipboardList, CreditCard, Gauge, Lightbulb, MessageCircle, PackageOpen, Repeat2, SmilePlus, TrendingDown, TrendingUp, Trophy, UsersRound } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { BarList } from "@/components/data-display/bar-list";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";

import { FeatureRequestTable, type LoggedRequest } from "./_feature-request-table";
import { ModuleAdoptionTable } from "./_module-adoption-table";
import { RevenueStateTable } from "./_revenue-state-table";
import { SavedReportsTable } from "./_saved-reports-table";
import { StateAdoptionTable } from "./_state-adoption-table";
import type {
  SuperAdminInternalMember,
  SuperAdminBiOverview,
  SuperAdminChurnAnalysis,
  SuperAdminCustomReportRow,
  SuperAdminDisplacementAnalysis,
  SuperAdminNpsAnalytics,
  SuperAdminProductAdoption,
  SuperAdminRevenueReport,
  SuperAdminSchoolRow
} from "@/lib/domain/types";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils/formatters";

const churnReasonOptions = ["PRICE_TOO_HIGH", "SWITCHED_TO_COMPETITOR", "SCHOOL_CLOSED", "PRODUCT_ISSUES", "INSUFFICIENT_SUPPORT", "LOW_STAFF_ADOPTION", "OTHER"].map((v) => ({ label: v.replaceAll("_", " "), value: v }));

function churnSignal(reason: string) {
  const signals: Record<string, string> = {
    LOW_STAFF_ADOPTION: "Onboarding and training process review needed",
    PRICE_TOO_HIGH: "Pricing strategy review needed",
    SWITCHED_TO_COMPETITOR: "Competitive intelligence needed — which competitor?",
    INSUFFICIENT_SUPPORT: "Support quality review needed",
    SCHOOL_CLOSED: "External — no action",
    PRODUCT_ISSUES: "Product roadmap input",
    OTHER: "Must be described in notes — cannot be closed without detail"
  };
  return signals[reason] ?? "Not categorized";
}

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

const barToneColors: Record<"good" | "warn" | "bad", string> = { good: "#22A06B", warn: "#D9A22C", bad: "#DB5555" };

function BarCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[11.5px] text-[var(--color-text-muted)]">—</span>;
  }
  const tone: "good" | "warn" | "bad" = value >= 80 ? "good" : value >= 60 ? "warn" : "bad";
  const color = barToneColors[tone];
  return (
    <div className="flex items-center gap-[8px]">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDF3EF]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="whitespace-nowrap text-[11px] font-semibold" style={{ color }}>{value}%</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, aside }: { eyebrow?: string; title: string; description?: string; aside?: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
        <p className="mt-1 text-[14.5px] font-bold text-[var(--color-text-primary)]">{title}</p>
        {description ? <p className="mt-1 max-w-4xl text-[11.5px] leading-5 text-[var(--color-text-secondary)]">{description}</p> : null}
      </div>
      {aside ? <p className="text-[10.5px] font-bold text-[var(--color-text-muted)]">{aside}</p> : null}
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
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 07"
        title="Analytics & BI"
        description="Honest measurement, made easier than optimistic measurement."
        action={
          <ResourceActionDialog
            triggerLabel="Build report"
            title="Build a report"
            description="Answer one question well, then save it for the people who ask it monthly."
            endpoint="/api/super-admin/analytics-bi/reports"
            variant="heroWhite"
            submitLabel="Build report"
            size="report"
            note="A group smaller than the threshold shows “under N” instead of a figure, so a small school is never identifiable." fields={[
              { name: "name", label: "Subject", required: true, placeholder: "e.g. Retention by joining cohort", section: "The question" },
              { name: "question", label: "What question it answers", placeholder: "One line shown under the name on the Reports tab", section: "The question" },
              { name: "metric", label: "Metric", type: "select", section: "The question", options: [{ label: "School count", value: "schoolCount" }, { label: "Student count", value: "studentCount" }, { label: "MRR", value: "mrr" }] },
              { name: "dimension", label: "Segment by", type: "select", section: "The question", options: [{ label: "Tier", value: "tier" }, { label: "State", value: "state" }, { label: "Status", value: "status" }] },
              { name: "periodDays", label: "Period — schools that joined in the last (days)", type: "number", min: 1, max: 1825, section: "The question", note: "Blank means every school on record." },
              { name: "compare", label: "Compare with", type: "switch", on: false, note: "The period before (needs a period)", section: "The question" },
              { name: "suppressUnder", label: "Withhold groups with fewer schools than", type: "number", min: 2, max: 100, section: "Presentation", note: "A group smaller than this shows “under N” instead of a figure. Blank shows every count as it is." },
              { name: "showDropoff", label: "Show drop-off at every stage", type: "switch", on: false, section: "Presentation", note: "Each group’s drop from the one before it, and the schools behind every figure one click away" },
              { name: "weightChurned", label: "Weight churned schools separately", type: "switch", on: false, section: "Presentation", note: "Churned schools leave the main figure and get a column of their own — their requests are evidence, not noise" },
              { name: "frequency", label: "Schedule", type: "select", defaultValue: "", section: "Delivery", options: [{ label: "On demand only", value: "" }, { label: "Weekly", value: "WEEKLY" }, { label: "Monthly", value: "MONTHLY" }], note: "A scheduled report is emailed to its recipients as it falls due (checked hourly)." },
              { name: "recipients", label: "Recipients (comma-separated emails)", type: "textarea", section: "Delivery" },
              { name: "_owner", label: "Owner", type: "static", section: "Save as a template", placeholder: "You — recorded when saved", note: "The Super Admin who saved this template." },
              { name: "groupName", label: "Group under", section: "Save as a template", placeholder: "e.g. Monthly board pack", note: "Templates are filed under this on the Reports tab." },
              { name: "visibility", label: "Visible to", type: "select", defaultValue: "ALL", section: "Save as a template", options: [{ label: "Every Super Admin", value: "ALL" }, { label: "Only me", value: "OWNER" }] },
              { name: "lockFilters", label: "Lock the filters", type: "switch", on: false, note: "Readers see it as saved", section: "Save as a template" }
            ]}
          />
        }
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
  const [bi, displacement, owners, members] = await Promise.all([
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi"),
    apiGet<SuperAdminDisplacementAnalysis>("/api/super-admin/analytics/displacement"),
    apiGet<Array<{ stage: string; ownerId: string; owner: string }>>("/api/super-admin/analytics-bi/owners").catch(() => []),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team").catch(() => [] as SuperAdminInternalMember[])
  ]);
  const ownerOf = new Map(owners.map((row) => [row.stage, row]));
  // A loss we caused by not being able to read the school's previous system is a
  // migration defect, not a product one — and the two route to different teams.
  const unreadableSources = new Set(displacement.bySourceSystem.filter((item) => !item.adapterAvailable).map((item) => item.sourceSystem));
  const migrationFailureLosses = displacement.lossAnalysis.filter((item) => unreadableSources.has(item.sourceSystem)).length;

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
    <section className="grid gap-[14px]">
      <section className="surface-card overflow-hidden">
        <SectionHeader title="Growth and conversion funnel" description="Each stage is a real school count computed from signup, trial, and billing records — not a sample." />
        <div className="flex items-end gap-[9px] px-[18px] pb-[20px] pt-[9px]">
          {funnelStages.map((stage, index) => {
            const barPct = Math.max(stage.ofFirstPct ?? 100, 2);
            const isLast = index === funnelStages.length - 1;
            return (
              <div key={stage.stage} className="min-w-0 flex-1">
                <div className="flex h-[119px] items-end">
                  <div
                    className="w-full rounded-[8px_7px_0_0]"
                    style={{ height: `${barPct}%`, background: isLast ? "#0d2315" : `rgba(18,121,106,${0.28 + index * 0.1})` }}
                  />
                </div>
                <p className="mt-[10px] font-[var(--font-display)] text-[13.5px] font-bold text-[var(--color-text-primary)]">{stage.count.toLocaleString()}</p>
                <p className="mt-[3.5px] text-pretty text-[10px] leading-[1.35] text-[#5f6e65]">{stage.stage}</p>
                <p className="mt-[4.5px] text-[10px] font-semibold" style={{ color: stage.changePct === null ? "#9FB8A7" : stage.changePct < 0 ? "#B23B3B" : "#22A06B" }}>
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
          },
          {
            key: "owner",
            header: "Owner",
            render: (item) => {
              const current = ownerOf.get(item.stage);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px]">{current ? current.owner : <span className="text-[var(--color-text-muted)]">Nobody yet</span>}</span>
                  <ResourceActionDialog
                    triggerLabel={current ? "Change" : "Assign"}
                    title={`Owner of “${item.stage}”`}
                    description="The person accountable for moving this stage of the funnel."
                    endpoint="/api/super-admin/analytics-bi/owners"
                    method="POST"
                    variant="textAction"
                    submitLabel="Save owner"
                    fields={[
                      { name: "stage", label: "Stage", type: "select", defaultValue: item.stage, options: [{ label: item.stage, value: item.stage }] },
                      { name: "ownerId", label: "Owner", type: "select", defaultValue: current?.ownerId ?? "", options: [{ label: "Nobody", value: "" }, ...members.map((m) => ({ label: `${m.name} · ${m.role.replaceAll("_", " ").toLowerCase()}`, value: m.id }))] }
                    ]}
                  />
                </div>
              );
            }
          }
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Displacement rate" value={`${displacement.displacementRatePct}%`} detail="Arrived from another system, not from paper" icon={Repeat2} tone="dark" />
        <StatCard label="From paper or spreadsheets" value={`${displacement.paperOrSpreadsheetPct}%`} detail="The discovery half of the market" icon={ClipboardList} />
        <StatCard label="Migration completion rate" value={`${displacement.migrationCompletionRatePct}%`} detail="Across all source systems" tone="success" icon={TrendingUp} />
        <StatCard label="Trialled and returned" value={displacement.trialledAndReturned} detail="Rolled-back migrations, reason recorded" tone={displacement.trialledAndReturned > 0 ? "warning" : "success"} icon={TrendingDown} />
        <StatCard label="Sources we cannot read" value={displacement.unreadableSourceCount} detail="No adapter available, every attempt rolled back" tone={displacement.unreadableSourceCount > 0 ? "danger" : "success"} icon={PackageOpen} />
      </section>

      <TableCard
        title="Win analysis by displaced system"
        description="Which system we take schools from, and whether our import tooling can actually read it. Nothing in this system captures why a school chose to switch — that column says so plainly rather than guessing."
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
          { key: "reason", header: "What they said made them move", render: () => <span className="text-[11px] text-[var(--color-text-muted)]">Not captured — no field records this</span> },
          {
            key: "adapter",
            header: "Adapter",
            render: (item) => (
              <StatusPill bg={item.adapterAvailable ? "var(--color-success-dim)" : "var(--color-danger-dim)"} fg={item.adapterAvailable ? "var(--color-success)" : "var(--color-danger)"} label={item.adapterAvailable ? "Available" : "None"} />
            )
          }
        ]}
        footnote="Migration completion rate by source tells us where our import tooling is weak, and therefore which competitor we are effectively unable to displace — whatever our product does."
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
        footnote={
          displacement.lossAnalysis.length === 0
            ? undefined
            : `${migrationFailureLosses} of ${displacement.lossAnalysis.length} loss${displacement.lossAnalysis.length === 1 ? "" : "es"} ${migrationFailureLosses === 1 ? "is a migration failure" : "are migration failures"} rather than product failures — we could not read the system the school was leaving. That is a migration defect, and it routes to Module 14 as one.`
        }
      />
    </section>
  );
}

async function RetentionTab() {
  const [bi, churn, nps, schoolsEnvelope, trends] = await Promise.all([
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi"),
    apiGet<SuperAdminChurnAnalysis>("/api/super-admin/analytics/churn"),
    apiGet<SuperAdminNpsAnalytics>("/api/super-admin/analytics/nps"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGet<TrendsView>("/api/super-admin/analytics-bi/trends")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));

  const cohorts = bi.cohorts;
  const curveMonths = Array.from(new Set(trends.retention.flatMap((row) => row.readings.map((reading) => reading.month)))).sort();

  const npsScore = nps.npsScore;
  const npsPassives = Math.max(0, nps.total - nps.promoters - nps.detractors);
  const promoterPct = nps.total > 0 ? Math.round((nps.promoters / nps.total) * 100) : 0;
  const passivePct = nps.total > 0 ? Math.round((npsPassives / nps.total) * 100) : 0;
  const detractorPct = nps.total > 0 ? Math.round((nps.detractors / nps.total) * 100) : 0;
  const maxTierChurn = Math.max(...churn.byTier.map((item) => item.ratePct), 1);
  const maxTenureChurn = Math.max(...churn.byTenure.map((item) => item.pct), 1);
  const maxTierRegionNps = Math.max(...nps.byTierAndRegion.map((item) => Math.abs(item.npsScore)), 1);

  const retentionByCohort = new Map(trends.retention.map((row) => [row.cohort, row]));
  const tone = (value: number, bad: number) => (value >= bad ? ("bad" as const) : ("teal" as const));

  return (
    <section className="grid gap-[14px]">
      <TableCard
        title="Cohort retention analysis"
        description="Schools grouped by the month they joined — the most honest measure of whether the platform is building lasting value"
        items={cohorts}
        pageSize={false}
        getRowKey={(item) => item.cohort}
        emptyState="No cohort data yet."
        columns={[
          { key: "cohort", header: "Cohort", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.cohort}</span>, sortValue: (item) => item.cohort },
          { key: "joined", header: "Schools", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.joined}</span>, sortValue: (item) => item.joined },
          { key: "active", header: "Still active", render: (item) => item.stillActive, sortValue: (item) => item.stillActive },
          { key: "retention", header: "Retention", render: (item) => <BarCell value={item.retentionPct} />, sortValue: (item) => item.retentionPct },
          ...curveMonths.map((month) => ({
            key: month,
            header: month,
            render: (item: SuperAdminBiOverview["cohorts"][number]) => {
              const reading = retentionByCohort.get(item.cohort)?.readings.find((r) => r.month === month);
              if (!reading || reading.measured === 0) return <span className="text-[var(--color-text-muted)]">—</span>;
              return `${Math.round((reading.active / reading.measured) * 100)}%`;
            }
          })),
          {
            key: "verdict",
            header: "Verdict",
            render: (item) => {
              const verdict = item.joined < 3 ? { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Too early" } : item.retentionPct >= 80 ? { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Product working" } : item.retentionPct >= 60 ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Watch" } : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "At risk" };
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: verdict.bg, color: verdict.fg }}>{verdict.label}</span>;
            },
            sortValue: (item) => item.retentionPct
          }
        ]}
        footnote={trends.firstSnapshot ? `Month columns are read from daily snapshots, which began ${trends.firstSnapshot} — earlier months cannot be reconstructed. Read each cohort against others of the same age: a cohort that joined last month has simply had less time to churn.` : "Read each cohort against others of the same age: a cohort that joined last month has simply had less time to churn. Month-by-month columns appear as daily snapshots accumulate."}
      />

      <TableCard
        title="Churn reason breakdown"
        description={`The handling admin must log a reason from a defined list when a school churns · ${churn.total} school${churn.total === 1 ? "" : "s"}`}
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
            variant="secondary"
            submitLabel="Log churn"
            note="The reason is chosen from a list so it can be counted; “Other” must be explained in the notes."
            fields={[
              { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "Who left" },
              { name: "reason", label: "Reason", type: "select", options: churnReasonOptions, section: "Why" },
              { name: "notes", label: "Notes", type: "textarea", section: "Why" }
            ]}
          />
        }
        columns={[
          { key: "reason", header: "Churn reason", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.reason.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>, sortValue: (item) => item.reason },
          { key: "count", header: "Count", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.count}</span>, sortValue: (item) => item.count },
          { key: "share", header: "Share", render: (item) => <span className="font-bold" style={{ color: item.pct >= 25 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{item.pct}%</span>, sortValue: (item) => item.pct },
          { key: "signal", header: "What it signals", render: (item) => <span className="text-[var(--color-text-secondary)]">{churnSignal(item.reason)}</span> }
        ]}
      />

      <div className="grid items-start gap-[14px] lg:grid-cols-2">
        <BarList
          title="Churn rate by tier"
          sub="Share of schools in each tier that did not renew"
          empty="No tier churn data yet."
          items={churn.byTier.map((item) => ({ label: item.plan, value: `${item.ratePct}%`, pct: (item.ratePct / maxTierChurn) * 100, tone: tone(item.ratePct, 5) }))}
        />
        <BarList
          title="Churn rate by tenure"
          sub="Risk is concentrated early — share of all churn, by how long the school had been on the platform"
          empty="No churn logged yet."
          items={churn.byTenure.every((item) => item.count === 0) ? [] : churn.byTenure.map((item) => ({ label: item.bucket, value: `${item.pct}%`, pct: (item.pct / maxTenureChurn) * 100, tone: tone(item.pct, 40) }))}
        />
      </div>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Platform NPS" value={`${npsScore >= 0 ? "+" : ""}${npsScore}`} detail={`${nps.total} response${nps.total === 1 ? "" : "s"} recorded`} tone="dark" icon={SmilePlus} />
        <StatCard label="Promoters" value={`${promoterPct}%`} detail={`Score 9–10 · ${nps.promoters} of ${nps.total}`} tone="success" icon={Trophy} />
        <StatCard label="Passives" value={`${passivePct}%`} detail={`Score 7–8 · ${npsPassives} of ${nps.total}`} tone="warning" icon={MessageCircle} />
        <StatCard label="Detractors" value={`${detractorPct}%`} detail={`Score 0–6 · ${nps.detractors} of ${nps.total}, flagged for outreach`} tone="danger" icon={AlertTriangle} />
        <StatCard label="Response rate" value={`${nps.responseRatePct}%`} detail={`${nps.total} school admin${nps.total === 1 ? "" : "s"} answered`} tone="neutral" icon={ClipboardList} />
      </section>

      <BarList
        title="NPS by tier and region"
        sub="Broken down so outreach can be targeted where it moves the number"
        empty="No NPS responses yet."
        items={nps.byTierAndRegion.map((item) => ({ label: item.label, value: `${item.npsScore >= 0 ? "+" : ""}${item.npsScore}`, pct: (Math.abs(item.npsScore) / maxTierRegionNps) * 100, tone: item.npsScore < 0 ? ("bad" as const) : ("teal" as const), note: `${item.responses} response${item.responses === 1 ? "" : "s"}` }))}
        footer={
          <ResourceActionDialog
            triggerLabel="Record NPS"
            title="Record an NPS response"
            description="Log a school’s NPS score (0–10) and an optional verbatim comment."
            endpoint="/api/super-admin/analytics/nps"
            variant="secondary"
            submitLabel="Record"
            fields={[
              { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "Who answered" },
              { name: "score", label: "Score (0–10)", type: "number", required: true, min: 0, max: 10, section: "The answer" },
              { name: "comment", label: "Comment", type: "textarea", section: "The answer" }
            ]}
          />
        }
      />
    </section>
  );
}

async function RevenueTab() {
  const report = await apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report");

  return (
    <section className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total outstanding receivables"
          value={formatCompactCurrency(report.outstandingReceivables)}
          detail={`${report.unpaidSchoolCount} school${report.unpaidSchoolCount === 1 ? "" : "s"} with an open balance. Full value: ${formatCurrency(report.outstandingReceivables)}.`}
          icon={AlertTriangle}
          tone="dark"
        />
        <StatCard
          label="Term-over-term renewal rate"
          value={`${report.renewalRate}%`}
          detail={`${report.renewedRecently} of ${report.activeSchoolCount} renewed in the last 90 days.`}
          icon={Repeat2}
          tone="success"
        />
        <StatCard
          label="ARPU trend"
          value={formatCompactCurrency(report.arpu)}
          detail={`Per paying school, per semester. Full value: ${formatCurrency(report.arpu)}.`}
          icon={UsersRound}
          tone="info"
        />
        <StatCard
          label="Credit revenue share"
          value={`${report.creditRevenueSharePct}%`}
          detail={`${formatCompactCurrency(report.notificationCreditRevenue)} of platform revenue from credit bundles.`}
          icon={CreditCard}
          tone="accent"
        />
        <StatCard
          label="Projected next term"
          value={formatCompactCurrency(report.mrr)}
          detail={`Active schools × confirmed tiers. Full value: ${formatCurrency(report.mrr)}.`}
          icon={TrendingUp}
          tone="success"
        />
      </section>

      <section className="grid items-start gap-[14px] xl:grid-cols-[1.2fr_1fr]">
        <RevenueStateTable items={report.revenueByState} />
        <TableCard
          title="LTV projection by tier"
          description="Based on average subscription duration per tier."
          items={report.ltvByTier}
          columns={[
            { key: "tier", header: "Tier", render: (item) => item.plan },
            { key: "duration", header: "Avg duration", render: (item) => `${(item.avgTenureMonths / 4).toFixed(1)} terms` },
            { key: "termly", header: "Termly value", render: (item) => formatCurrency(item.termlyValue) },
            { key: "ltv", header: "Projected LTV", render: (item) => formatCurrency(item.ltv) }
          ]}
          emptyState="No active subscriptions yet."
          footnote="Average duration is what turns a termly price into a lifetime value, which is why the tier a school stays on usually matters more than the tier it arrives on — an argument for upgrade paths rather than pure acquisition."
        />
      </section>
    </section>
  );
}

type TrendsView = {
  weeks: string[];
  series: Array<{ module: string; points: Array<number | null> }>;
  retention: Array<{ cohort: string; joined: number; readings: Array<{ month: string; day: string; measured: number; active: number }> }>;
  firstSnapshot: string | null;
  snapshotDays: number;
};

function moduleLabel(module: string) {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

async function ProductTab() {
  const [adoption, bi, trends, unused, tickets, logged, productSchools] = await Promise.all([
    apiGet<SuperAdminProductAdoption>("/api/super-admin/analytics/product-adoption"),
    apiGet<SuperAdminBiOverview>("/api/super-admin/analytics/bi"),
    apiGet<TrendsView>("/api/super-admin/analytics-bi/trends"),
    apiGet<{ measured: string[]; unused: Array<{ school: string; feature: string }> }>("/api/super-admin/analytics-bi/paid-unused"),
    apiGet<Record<string, { tickets: number; schools: number; sample: string | null }>>("/api/super-admin/analytics-bi/tickets-about"),
    apiGet<LoggedRequest[]>("/api/super-admin/analytics-bi/feature-requests").catch(() => [] as LoggedRequest[]),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const requestSchools = (productSchools.data ?? []).map((school) => ({ label: `${school.name} — ${school.plan.toLowerCase()}`, value: school.id }));
  // A module under the 40% floor in two or more tiers that have schools is worth a sprint review — the page's own rule.
  const populated = adoption.tierColumns.map((tier, index) => ({ index, schools: tier.schoolCount })).filter((tier) => tier.schools > 0);
  const sprintCandidates = adoption.heatmapByTier.filter((row) => populated.filter((tier) => (row.cells[tier.index] ?? 100) < 40).length >= Math.min(2, populated.length) && populated.length > 0);

  return (
    <section className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Weekly active schools" value={adoption.schoolsActiveThisWeek} detail="At least one login in the last 7 days" icon={Building2} tone="dark" />
        <StatCard label="Platform adoption index" value={adoption.adoptionIndex} detail={`Weighted across ${adoption.modulesTracked} modules`} icon={Gauge} />
        <StatCard label="Modules below the 40% floor" value={adoption.modulesBelowFloor} detail="Used in the last 60 days by fewer than 4 in 10 schools" tone={adoption.modulesBelowFloor > 0 ? "danger" : "success"} icon={PackageOpen} />
        <StatCard label="Paid features never used" value={unused.unused.length} detail={`Schools whose plan includes ${unused.measured.join(", ")} and have never applied it — the only gated feature the product can measure`} tone={unused.unused.length ? "warning" : "success"} icon={Banknote} />
        <StatCard label="Sprint candidates flagged" value={sprintCandidates.length} detail={sprintCandidates.length ? sprintCandidates.map((row) => moduleLabel(row.module)).join(", ") : "No module is under the floor across two tiers"} tone={sprintCandidates.length ? "warning" : "success"} icon={CreditCard} />
      </section>

      <ModuleAdoptionTable
        trends={trends.series}
        heatmapByTier={adoption.heatmapByTier}
        tierColumns={adoption.tierColumns}
        schoolsInScope={adoption.tierColumns.reduce((sum, tier) => sum + tier.schoolCount, 0)}
      />

      <section className="grid items-start gap-[14px] xl:grid-cols-[1.35fr_1fr]">
        <TableCard
          title="Adoption gaps auto-nominated for the next sprint"
          description="Every module sitting below the 40% floor across the whole platform."
          items={adoption.gaps}
          pageSize={false}
          getRowKey={(item) => item.module}
          emptyState="No module is below the 40% floor."
          columns={[
            { key: "module", header: "Module", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{moduleLabel(item.module)}</span>, sortValue: (item) => item.module },
            { key: "adoption", header: "Adoption", render: (item) => <BarCell value={item.adoptionPct} />, sortValue: (item) => item.adoptionPct },
            { key: "using", header: "Schools using", headerClassName: "!whitespace-normal", render: (item) => item.schoolsUsing, sortValue: (item) => item.schoolsUsing },
            { key: "notUsing", header: "Schools not using", headerClassName: "!whitespace-normal", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.schoolsNotUsing}</span>, sortValue: (item) => item.schoolsNotUsing },
            {
              key: "diagnosis",
              header: "Diagnosis from support tickets",
              headerClassName: "!whitespace-normal",
              render: (item) => {
                const heard = tickets[item.module];
                return heard && heard.tickets > 0
                  ? <span className="text-[11px] text-[var(--color-text-secondary)]">{heard.tickets} ticket{heard.tickets === 1 ? "" : "s"} from {heard.schools} school{heard.schools === 1 ? "" : "s"} in 90 days mention it{heard.sample ? ` — “${heard.sample}”` : ""}</span>
                  : <span className="text-[11px] text-[var(--color-text-muted)]">No ticket in 90 days mentions it — likely not a support problem</span>;
              }
            }
          ]}
        />
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--color-border-default)] px-5 py-4">
            <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">How this grid is read</p>
            <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">Four rules keep the comparison honest</p>
          </div>
          <div className="grid gap-3 p-5">
            {[
              { title: "Compare down a column, or across a row — a school counts for a module when it did something in it in the last 60 days", detail: "Module switches are not what is counted; records are. Only custom branding is plan-gated today, so a low cell is a genuine usage gap, not a locked feature." },
              { title: "Trial columns are a conversion signal, not adoption", detail: "A trial school that never turns a module on hasn't seen its value yet — a real churn predictor, read differently from a paying school's cell." },
              { title: "Adoption is measured per school, not per user", detail: "One teacher using a module does not make a school an adopter of it." },
              { title: "Below 40% for two tiers running is worth a product conversation", detail: "The floor is a prompt to ask why, not an automatic verdict." }
            ].map((row) => (
              <div key={row.title} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{row.title}</p>
                <p className="mt-0.5 text-[10.5px] text-[var(--color-text-muted)]">{row.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <StateAdoptionTable heatmapByState={adoption.heatmapByState} stateHeatmapModules={adoption.stateHeatmapModules} />

      <FeatureRequestTable
        items={bi.featureRequests}
        logged={logged}
        actions={
          <ResourceActionDialog
            triggerLabel="Log a request"
            title="Log a feature request"
            description="A request that arrived by call, visit or WhatsApp, recorded so it carries the same weight as a tagged ticket."
            endpoint="/api/super-admin/analytics-bi/feature-requests"
            method="POST"
            variant="primary"
            submitLabel="Log request"
            note="Attribution is mandatory. A request with no school behind it cannot be weighted, so it cannot be scored."
            impact={{ label: "Once logged", rows: [["Scored straight away", "The school’s tier weight × how badly it hurts, added to the request it belongs to"], ["Visible as “Logged by hand”", "So roadmap review can weigh it against the automatic ticket counts"], ["You stay the owner", "Questions about this request come back to you"]] }}
            fields={[
              { name: "title", label: "Request", required: true, placeholder: "One line, in the school’s own words where possible", section: "What was asked for" },
              { name: "detail", label: "Detail", type: "textarea", placeholder: "What they are doing today, and what they expect instead", section: "What was asked for" },
              { name: "module", label: "Module", type: "select", defaultValue: "", options: [{ label: "Not sure", value: "" }, ...["Fees & payments", "Attendance", "Results & report cards", "Admissions", "Students & guardians", "Communications", "Timetable", "Staff & access", "Other"].map((value) => ({ label: value, value }))], section: "What was asked for" },
              { name: "mergedIntoId", label: "Existing request to merge into", type: "select", defaultValue: "", options: [{ label: "None — create new", value: "" }, ...logged.map((entry) => ({ label: entry.title, value: entry.id }))], note: "Merging adds this school’s weight to a request already on the list", section: "What was asked for" },
              { name: "schoolId", label: "School", type: "select", required: true, options: [{ label: "Choose a school", value: "" }, ...requestSchools], section: "Who asked" },
              { name: "personName", label: "Person", placeholder: "Name and role", section: "Who asked" },
              { name: "channel", label: "How it reached us", type: "select", defaultValue: "PHONE", options: [{ label: "Phone call", value: "PHONE" }, { label: "Visit", value: "VISIT" }, { label: "WhatsApp", value: "WHATSAPP" }, { label: "Email", value: "EMAIL" }, { label: "Something else", value: "OTHER" }], section: "Who asked" },
              { name: "raisedOn", label: "Date raised", type: "date", section: "Who asked", note: "Blank means today" },
              { name: "loggedBy", label: "Logged by", type: "static", placeholder: "You", section: "Who asked" },
              { name: "tierWeight", label: "Tier weight", type: "static", placeholder: "Taken from the school’s plan", section: "Who asked" },
              { name: "severity", label: "Severity", type: "select", defaultValue: "MEDIUM", options: [{ label: "Low", value: "LOW" }, { label: "Medium", value: "MEDIUM" }, { label: "High", value: "HIGH" }], note: "High means the school has a workaround that costs staff time every week", section: "How badly it hurts" },
              { name: "blocksRenewal", label: "Blocking a renewal", type: "switch", on: false, note: "Counts one and a half times", section: "How badly it hurts" },
              { name: "tellSchool", label: "Tell the school when it ships", type: "switch", on: true, note: "Noted on the request so the release note can reach them", section: "Also record" },
              { name: "ticketRef", label: "Support ticket", placeholder: "e.g. SUP-2026-0001", section: "Also record" },
              { name: "roadmapFlag", label: "Flag for the next roadmap review", type: "switch", on: false, note: "Surfaces it regardless of score", section: "Also record" }
            ]}
          />
        }
      />
      <p className="-mt-2 flex items-center gap-2 text-[10.5px] text-[var(--color-text-muted)]">
        <Lightbulb className="h-3.5 w-3.5" /> Priority score weights mention count, distinct schools, and distinct tiers requesting. Requests come from support-ticket keywords and from asks logged by hand.
      </p>
    </section>
  );
}

async function ReportsTab() {
  const [reports, session] = await Promise.all([
    apiGet<SuperAdminCustomReportRow[]>("/api/super-admin/analytics-bi/reports"),
    getServerSession()
  ]);
  const ownerName = session?.name ? `You · ${session.name}` : "You";

  return (
    <section className="grid items-start gap-[14px] xl:grid-cols-[1.1fr_1fr]">
      <SavedReportsTable
        items={reports}
        actions={
          <ResourceActionDialog
            triggerLabel="New template"
            title="Save as a report template"
            description="The report you just built, kept so the people who ask for it monthly can run it themselves."
            endpoint="/api/super-admin/analytics-bi/reports"
            submitLabel="Save template"
            size="report"
            fields={[
              { name: "name", label: "Subject", required: true, placeholder: "e.g. Retention by joining cohort", section: "The question" },
              { name: "question", label: "What question it answers", placeholder: "One line shown under the name on the Reports tab", section: "The question" },
              { name: "metric", label: "Metric", type: "select", section: "The question", options: [{ label: "School count", value: "schoolCount" }, { label: "Student count", value: "studentCount" }, { label: "MRR", value: "mrr" }] },
              { name: "dimension", label: "Segment by", type: "select", section: "The question", options: [{ label: "Tier", value: "tier" }, { label: "State", value: "state" }, { label: "Status", value: "status" }] },
              { name: "periodDays", label: "Period — schools that joined in the last (days)", type: "number", min: 1, max: 1825, section: "The question", note: "Blank means every school on record." },
              { name: "compare", label: "Compare with", type: "switch", on: false, note: "The period before (needs a period)", section: "The question" },
              { name: "suppressUnder", label: "Withhold groups with fewer schools than", type: "number", min: 2, max: 100, section: "Presentation", note: "A group smaller than this shows “under N” instead of a figure. Blank shows every count as it is." },
              { name: "showDropoff", label: "Show drop-off at every stage", type: "switch", on: false, section: "Presentation", note: "Each group’s drop from the one before it, and the schools behind every figure one click away" },
              { name: "weightChurned", label: "Weight churned schools separately", type: "switch", on: false, section: "Presentation", note: "Churned schools leave the main figure and get a column of their own — their requests are evidence, not noise" },
              { name: "frequency", label: "Schedule", type: "select", defaultValue: "", section: "Delivery", options: [{ label: "On demand only", value: "" }, { label: "Weekly", value: "WEEKLY" }, { label: "Monthly", value: "MONTHLY" }], note: "A scheduled report is emailed to its recipients as it falls due (checked hourly)." },
              { name: "recipients", label: "Recipients (comma-separated emails)", type: "textarea", section: "Delivery" },
              { name: "_owner", label: "Owner", type: "static", section: "Save as a template", placeholder: ownerName, note: "The Super Admin who saved this template." },
              { name: "groupName", label: "Group under", section: "Save as a template", placeholder: "e.g. Monthly board pack", note: "Templates are filed under this on the Reports tab." },
              { name: "visibility", label: "Visible to", type: "select", defaultValue: "ALL", section: "Save as a template", options: [{ label: "Every Super Admin", value: "ALL" }, { label: "Only me", value: "OWNER" }] },
              { name: "lockFilters", label: "Lock the filters", type: "switch", on: false, note: "Readers see it as saved", section: "Save as a template" }
            ]}
          />
        }
      />

      <TableCard
        title="Reporting cadence"
        description="Most figures are computed live when the page loads. Three things are also kept over time, so a trend or a retention curve can be drawn from what was true then."
        items={[
          { type: "Adoption heatmap", frequency: "Computed live — schools that did something in the module in the last 60 days" },
          { type: "Module adoption trend (12 weeks)", frequency: "A reading kept weekly, refreshed hourly through the week" },
          { type: "Cohort retention curve", frequency: "Read from a daily snapshot of every school's status" },
          { type: "Funnel / conversion", frequency: "Computed live on page load" },
          { type: "Revenue (MRR / ARR)", frequency: "Computed live on page load" },
          { type: "Churn analysis and NPS", frequency: "Computed live on page load" },
          { type: "Scheduled reports", frequency: "Emailed weekly or monthly as each falls due" }
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
