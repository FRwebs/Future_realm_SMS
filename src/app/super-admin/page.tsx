import { getServerSession } from "@/lib/auth/session";
import { apiGet } from "@/lib/api/server";
import { roleLabels } from "@/lib/auth/roles";
import type { SuperAdminAnalyticsOverview, SuperAdminRevenueView } from "@/lib/domain/types";
import { getRoleAccent } from "@/lib/navigation/registry";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import Link from "next/link";
import type { Route } from "next";
import { Sparkles } from "lucide-react";

function platformGreeting(role: string, name?: string) {
  const firstName = name?.split(" ")[0] ?? "there";
  const titles: Record<string, string> = {
    PLATFORM_OWNER: `Good day, ${firstName}. Platform Overview.`,
    SUPER_ADMIN: `Good day, ${firstName}. Platform Overview.`,
    PLATFORM_ADMIN: `Good day, ${firstName}. Platform operations are ready.`,
    SUPPORT_AGENT: `Good day, ${firstName}. Your support queue is ready.`,
    SALES_MANAGER: `Good day, ${firstName}. Pipeline and trials are ready.`,
    FINANCE_MANAGER: `Good day, ${firstName}. Revenue and billing are ready.`,
    DEVELOPER: `Good day, ${firstName}. Technical controls are ready.`
  };
  return titles[role] ?? `Good day, ${firstName}.`;
}

function platformProfile(role?: string) {
  const profiles: Record<string, { eyebrow: string; mission: string; focus: string[]; actions: Array<{ label: string; href: string; description: string }> }> = {
    PLATFORM_OWNER: {
      eyebrow: "Platform owner cockpit",
      mission: "Monitor growth, revenue, tenant health, risk, and strategic platform performance.",
      focus: ["Tenant growth", "MRR / ARR", "Risk", "Product health"],
      actions: [
        { label: "Schools", href: "/super-admin/schools", description: "Open tenant management." },
        { label: "Billing", href: "/super-admin/billing", description: "Review subscription revenue." },
        { label: "Analytics", href: "/super-admin/analytics", description: "Inspect platform growth." }
      ]
    },
    PLATFORM_ADMIN: {
      eyebrow: "Platform admin cockpit",
      mission: "Keep tenant operations, user support, billing status, and security controls stable.",
      focus: ["Tenant operations", "Users", "Security", "Support"],
      actions: [
        { label: "Users", href: "/super-admin/users", description: "Support platform users." },
        { label: "Schools", href: "/super-admin/schools", description: "Manage tenants." },
        { label: "Security", href: "/super-admin/security", description: "Review access events." }
      ]
    },
    SUPPORT_AGENT: {
      eyebrow: "Support operations cockpit",
      mission: "Resolve tenant issues quickly with school, user, audit, and support visibility.",
      focus: ["Support queue", "User lookup", "Tenant context", "Audit trail"],
      actions: [
        { label: "Support", href: "/super-admin/support", description: "Open support workspace." },
        { label: "Users", href: "/super-admin/users", description: "Find affected users." },
        { label: "Schools", href: "/super-admin/schools", description: "Check tenant status." }
      ]
    },
    SALES_MANAGER: {
      eyebrow: "Sales growth cockpit",
      mission: "Track trials, plan mix, school signups, and conversion opportunities.",
      focus: ["Trials", "Plan mix", "Signups", "Pipeline"],
      actions: [
        { label: "CRM", href: "/super-admin/crm", description: "Open sales pipeline." },
        { label: "Schools", href: "/super-admin/schools", description: "Review trial tenants." },
        { label: "Analytics", href: "/super-admin/analytics", description: "Inspect growth trends." }
      ]
    },
    FINANCE_MANAGER: {
      eyebrow: "Platform finance cockpit",
      mission: "Track subscriptions, MRR, ARR, renewals, overdue billing, and plan distribution.",
      focus: ["MRR", "ARR", "Renewals", "Plan mix"],
      actions: [
        { label: "Billing", href: "/super-admin/billing", description: "Open subscription billing." },
        { label: "Analytics", href: "/super-admin/analytics", description: "Review revenue." },
        { label: "Schools", href: "/super-admin/schools", description: "Inspect tenant billing status." }
      ]
    },
    DEVELOPER: {
      eyebrow: "Developer operations cockpit",
      mission: "Watch platform health, security events, feature flags, and tenant risk indicators.",
      focus: ["Feature flags", "Security", "Audit logs", "Platform health"],
      actions: [
        { label: "Feature flags", href: "/super-admin/feature-flags", description: "Review rollout controls." },
        { label: "Security", href: "/super-admin/security", description: "Inspect security events." },
        { label: "Audit logs", href: "/super-admin/audit-logs", description: "Open platform audit trail." }
      ]
    }
  };
  return profiles[role ?? ""] ?? profiles.PLATFORM_OWNER;
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function formatHours(value: number) {
  if (!value) return "0h";
  return `${value}h`;
}

type HealthTone = "good" | "warn" | "danger";

const toneColors: Record<HealthTone, { bg: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  danger: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" }
};

function StatusPill({ tone, label }: { tone: HealthTone; label: string }) {
  const colors = toneColors[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: colors.bg, color: colors.fg }}>
      {label}
    </span>
  );
}

function systemHealthTone(key: string, value: number): { tone: HealthTone; label: string } {
  const bands: Record<string, { good: number; warn: number; lowerIsBetter?: boolean }> = {
    apiUptime: { good: 99.5, warn: 98 },
    averageResponseMs: { good: 800, warn: 1500, lowerIsBetter: true },
    syncFailureRate24h: { good: 2, warn: 5, lowerIsBetter: true },
    notificationDeliveryRate: { good: 97, warn: 90 },
    activeInfrastructureAlerts: { good: 0, warn: 2, lowerIsBetter: true }
  };
  const band = bands[key];
  if (!band) return { tone: "good", label: "Healthy" };
  const passes = band.lowerIsBetter ? value <= band.good : value >= band.good;
  const watches = band.lowerIsBetter ? value <= band.warn : value >= band.warn;
  if (passes) return { tone: "good", label: "Healthy" };
  if (watches) return { tone: "warn", label: "Watch" };
  return { tone: "danger", label: "Critical" };
}

const tierColors = ["#12796A", "#3F9C86", "#7FBBA8", "#B7D6C9", "#DEE8E2", "#0D2315"];

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession();
  const [overview, revenue] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);

  const accent = getRoleAccent(session?.role ?? "SUPER_ADMIN");
  const profile = platformProfile(session?.role ?? "PLATFORM_OWNER");
  const commandCenter = overview.commandCenter ?? {
    pulse: {
      totalActiveSchools: overview.schools.active,
      totalStudents: overview.users.students,
      schoolsOnline: 0,
      uptime30Day: 100,
      offlineSyncQueueSize: 0,
      lastSuccessfulBackupAt: null
    },
    revenueSnapshot: {
      currentMonthRevenue: overview.revenue.mrr,
      currentTermCollected: overview.revenue.mrr,
      currentTermInvoiced: overview.revenue.mrr,
      overdueBalances: 0,
      monthOverMonthGrowth: 0,
      newMrrThisMonth: 0,
      notificationCreditRevenue: 0
    },
    subscriptionHealth: {
      trialsExpiringNext7Days: 0,
      churnRiskSchools: 0,
      gracePeriodSchools: overview.schools.suspended
    },
    onboardingPipeline: {
      pendingVerification: overview.schools.trial,
      schoolsInTrial: overview.schools.trial,
      stuckMidOnboarding: 0,
      convertedThisWeek: overview.signups.last7Days
    },
    supportQueue: {
      totalOpenTickets: 0,
      criticalOpenTickets: 0,
      ticketsBreachingSla: 0,
      averageResolutionHoursThisWeek: 0,
      averageResolutionHoursLastWeek: 0
    },
    systemHealth: {
      apiUptime: 100,
      averageResponseMs: 0,
      syncFailureRate24h: 0,
      notificationDeliveryRate: 100,
      activeInfrastructureAlerts: 0
    },
    geography: [],
    alerts: []
  };

  const pulseCells = [
    { label: "Active schools", value: commandCenter.pulse.totalActiveSchools.toLocaleString(), sub: `${overview.schools.total} total tenants` },
    { label: "Total students", value: commandCenter.pulse.totalStudents.toLocaleString(), sub: "Across active schools" },
    { label: "Online now", value: commandCenter.pulse.schoolsOnline.toLocaleString(), sub: "Last 30 minutes" },
    { label: "Uptime (30d)", value: formatPercent(commandCenter.pulse.uptime30Day), sub: "API success proxy" },
    { label: "Sync queue", value: commandCenter.pulse.offlineSyncQueueSize.toLocaleString(), sub: "Pending records" },
    { label: "Last backup", value: commandCenter.pulse.lastSuccessfulBackupAt ? formatDate(commandCenter.pulse.lastSuccessfulBackupAt) : "Not logged", sub: "Successful run" }
  ];

  const revenueSparkline = revenue.monthlyRevenue.slice(-8).map((item) => item.amount);
  const revenueCards = [
    { label: "Revenue collected (month)", value: formatCurrency(commandCenter.revenueSnapshot.currentMonthRevenue), sparkline: revenueSparkline },
    { label: "Term collected vs invoiced", value: `${formatCurrency(commandCenter.revenueSnapshot.currentTermCollected)} / ${formatCurrency(commandCenter.revenueSnapshot.currentTermInvoiced)}` },
    { label: "Total overdue balances", value: formatCurrency(commandCenter.revenueSnapshot.overdueBalances) },
    { label: "MoM growth", value: formatPercent(commandCenter.revenueSnapshot.monthOverMonthGrowth) },
    { label: "New MRR", value: formatCurrency(commandCenter.revenueSnapshot.newMrrThisMonth) },
    { label: "Notification credit revenue", value: formatCurrency(commandCenter.revenueSnapshot.notificationCreditRevenue) }
  ];

  const tierTotal = revenue.schoolsByPlan.reduce((sum, item) => sum + item.count, 0) || 1;

  const healthFlags = [
    { label: "Trials expiring 7d", value: commandCenter.subscriptionHealth.trialsExpiringNext7Days, tone: "warn" as HealthTone },
    { label: "Churn-risk flagged", value: commandCenter.subscriptionHealth.churnRiskSchools, tone: "danger" as HealthTone },
    { label: "In grace period", value: commandCenter.subscriptionHealth.gracePeriodSchools, tone: "good" as HealthTone }
  ];

  const pipelineStages = [
    { label: "Pending verification", value: commandCenter.onboardingPipeline.pendingVerification },
    { label: "In trial", value: commandCenter.onboardingPipeline.schoolsInTrial },
    { label: "Stuck mid-onboarding", value: commandCenter.onboardingPipeline.stuckMidOnboarding },
    { label: "Converted this week", value: commandCenter.onboardingPipeline.convertedThisWeek }
  ];
  const pipelineMax = Math.max(...pipelineStages.map((stage) => stage.value), 1);

  const geographyMax = Math.max(...commandCenter.geography.map((item) => item.schoolCount), 1);

  const systemHealthRows = [
    { key: "apiUptime", label: "API uptime", value: formatPercent(commandCenter.systemHealth.apiUptime) },
    { key: "averageResponseMs", label: "Avg response time", value: `${commandCenter.systemHealth.averageResponseMs}ms` },
    { key: "syncFailureRate24h", label: "Sync failure rate (24h)", value: formatPercent(commandCenter.systemHealth.syncFailureRate24h) },
    { key: "notificationDeliveryRate", label: "Notification delivery", value: formatPercent(commandCenter.systemHealth.notificationDeliveryRate) },
    { key: "activeInfrastructureAlerts", label: "Infrastructure alerts", value: commandCenter.systemHealth.activeInfrastructureAlerts }
  ];

  const activityFeed = overview.recentActivity.slice(0, 7);

  return (
    <div className="grid gap-5">
      <section className={`relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-gradient-to-br ${accent.gradient} p-6 text-white md:p-8`}>
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">
              <Sparkles className="h-3.5 w-3.5" />
              {profile.eyebrow}
            </div>
            <h2 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white md:text-5xl">{platformGreeting(session?.role ?? "SUPER_ADMIN", session?.name)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/74">
              {profile.mission} {session ? `Current internal role: ${roleLabels[session.role]}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {profile.actions.map((action) => (
              <Link
                key={action.href}
                href={action.href as Route}
                className="rounded-[10px] border border-white/20 bg-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white backdrop-blur-xl transition hover:bg-white/20"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#0D2315] p-1 sm:grid-cols-3 xl:grid-cols-6">
        {pulseCells.map((cell) => (
          <div key={cell.label} className="border-white/10 px-4 py-4 xl:border-r xl:last:border-r-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/50">{cell.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-white">{cell.value}</p>
            <p className="mt-1 text-[10.5px] font-medium text-white/60">{cell.sub}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {revenueCards.map((card) => (
          <article key={card.label} className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-[18px]">
            <p className="text-[11px] font-bold text-[var(--color-text-muted)]">{card.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{card.value}</p>
            {card.sparkline && card.sparkline.length > 1 ? (
              <div className="mt-3 flex h-8 items-end gap-1">
                {card.sparkline.map((value, index) => {
                  const max = Math.max(...card.sparkline!, 1);
                  return <div key={index} className="flex-1 rounded-t bg-[var(--color-accent-primary-dim)]" style={{ height: `${Math.max(10, (value / max) * 100)}%` }} />;
                })}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Subscription health</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Plan and retention risk</h3>
          {revenue.schoolsByPlan.length > 0 ? (
            <>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                {revenue.schoolsByPlan.map((item, index) => (
                  <div key={item.plan} style={{ width: `${(item.count / tierTotal) * 100}%`, background: tierColors[index % tierColors.length] }} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {revenue.schoolsByPlan.map((item, index) => (
                  <div key={item.plan} className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--color-text-secondary)]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tierColors[index % tierColors.length] }} />
                    {item.plan} · {item.count}
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {healthFlags.map((flag) => {
              const colors = toneColors[flag.tone];
              return (
                <div key={flag.label} className="rounded-[10px] p-2.5" style={{ background: colors.bg }}>
                  <p className="font-[var(--font-heading)] text-xl font-bold" style={{ color: colors.fg }}>{flag.value}</p>
                  <p className="mt-1 text-[10px] font-semibold leading-[13px]" style={{ color: colors.fg }}>{flag.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="section-eyebrow">Onboarding pipeline</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Trial and conversion flow</h3>
          <div className="mt-4 grid gap-2.5">
            {pipelineStages.map((stage) => (
              <div key={stage.label} className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[var(--color-text-secondary)]">{stage.label}</span>
                  <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{stage.value}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border-muted)]">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(stage.value / pipelineMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="section-eyebrow">Support queue</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">SLA and resolution load</h3>
          <div className="mt-4 grid gap-2.5">
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3 text-[13px]">
              <span className="font-medium text-[var(--color-text-secondary)]">Open tickets</span>
              <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{commandCenter.supportQueue.totalOpenTickets}</span>
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3 text-[13px]">
              <span className="font-medium text-[var(--color-text-secondary)]">Critical open</span>
              <span className="font-[var(--font-mono)] font-bold" style={{ color: commandCenter.supportQueue.criticalOpenTickets > 0 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{commandCenter.supportQueue.criticalOpenTickets}</span>
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3 text-[13px]">
              <span className="font-medium text-[var(--color-text-secondary)]">Avg resolution (this week)</span>
              <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{formatHours(commandCenter.supportQueue.averageResolutionHoursThisWeek)}</span>
            </div>
            {commandCenter.supportQueue.ticketsBreachingSla > 0 ? (
              <div className="rounded-[10px] px-4 py-3 text-[12px] font-bold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
                {commandCenter.supportQueue.ticketsBreachingSla} ticket{commandCenter.supportQueue.ticketsBreachingSla === 1 ? "" : "s"} breach SLA within the hour
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Alert centre</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Items requiring admin action</h3>
          <div className="mt-4 grid gap-2.5">
            {commandCenter.alerts.map((alert) => (
              <div key={alert.id} className="flex items-start justify-between gap-3 rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: alert.severity === "danger" ? "var(--color-danger)" : "var(--color-warning)" }}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[var(--color-text-primary)]">{alert.title}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-[var(--color-text-muted)]">{alert.detail}</p>
                  </div>
                </div>
                <Link
                  href={alert.actionHref as Route}
                  className="shrink-0 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]"
                >
                  Review
                </Link>
              </div>
            ))}
            {commandCenter.alerts.length === 0 ? (
              <p className="rounded-[10px] px-4 py-6 text-center text-sm font-semibold" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                No active command-center alerts.
              </p>
            ) : null}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="section-eyebrow">Activity feed</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Latest platform events</h3>
          <div className="mt-4 grid gap-0">
            {activityFeed.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
                {index < activityFeed.length - 1 ? <span className="absolute left-[7px] top-3 h-full w-px bg-[var(--color-border-default)]" /> : null}
                <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--color-bg-surface)] bg-[var(--color-accent-primary)]" />
                <div className="min-w-0 pb-0.5">
                  <p className="text-[12.5px] font-semibold leading-5 text-[var(--color-text-primary)]">
                    {item.superAdmin} <span className="font-normal text-[var(--color-text-secondary)]">{item.action.replaceAll("_", " ").toLowerCase()}</span> {item.target}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{item.schoolName ?? "Platform"} · {formatDate(item.timestamp)}</p>
                </div>
              </div>
            ))}
            {activityFeed.length === 0 ? <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-sm font-semibold text-[var(--color-text-muted)]">No recent activity.</p> : null}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <section className="surface-card p-6">
          <p className="section-eyebrow">System health</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Reliability indicators</h3>
          <div className="mt-4 grid gap-2.5">
            {systemHealthRows.map((item) => {
              const { tone, label } = systemHealthTone(item.key, typeof item.value === "string" ? Number.parseFloat(item.value) : item.value);
              return (
                <div key={item.label} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">{item.label}</span>
                  <div className="flex items-center gap-2.5">
                    <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{item.value}</span>
                    <StatusPill tone={tone} label={label} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="section-eyebrow">Geographic distribution</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">School density by state</h3>
          <div className="mt-4 grid gap-2.5">
            {commandCenter.geography.slice(0, 6).map((item) => {
              const dominantPlan = Object.entries(item.planMix).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "No plan";
              return (
                <div key={item.state} className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-bold text-[var(--color-text-primary)]">{item.state}</span>
                    <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-accent)]">{item.schoolCount} schools</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border-muted)]">
                    <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(item.schoolCount / geographyMax) * 100}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                    <span>{item.activeSchools} active</span>
                    <span>{item.trialSchools} trial</span>
                    <span>{item.suspendedSchools} suspended</span>
                    <span>{dominantPlan}</span>
                  </div>
                </div>
              );
            })}
            {commandCenter.geography.length === 0 ? <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-sm font-semibold text-[var(--color-text-muted)]">No school location data yet.</p> : null}
          </div>
        </section>
      </section>
    </div>
  );
}
