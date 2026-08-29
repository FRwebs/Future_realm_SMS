import { getServerSession } from "@/lib/auth/session";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import { roleLabels } from "@/lib/auth/roles";
import { DashboardExportButton, type DashboardExportRow } from "@/components/super-admin/dashboard-export-button";
import type {
  SuperAdminAnalyticsOverview,
  SuperAdminPartnerCommissionSummaryRow,
  SuperAdminRevenueReport,
  SuperAdminRevenueView
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import Link from "next/link";
import type { Route } from "next";
import { Handshake, Sparkles } from "lucide-react";

type DashboardPrivacyRequest = {
  id: string;
  type: string;
  status: string;
  subject: string;
  school?: { name: string } | null;
  createdAt: string;
};

type DashboardSecurityIncident = {
  id: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
};

type DashboardSecurityView = {
  privacy: DashboardPrivacyRequest[];
  incidents: DashboardSecurityIncident[];
};

const NDPA_RESPONSE_WINDOW_DAYS = 30;
const BREACH_CONTAINMENT_HOURS = 72;

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

function CardHeader({ title, meta, sub }: { title: string; meta?: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {meta ? <p className="shrink-0 text-[11.5px] text-[#9fb8a7]">{meta}</p> : null}
      </div>
      {sub ? <p className="mt-1.5 text-[11.5px] leading-5 text-[#8c9a92]">{sub}</p> : null}
    </div>
  );
}

function Sparkline({ values, stroke, fill, dot }: { values: number[]; stroke: string; fill: string; dot: string }) {
  if (values.length < 2) return null;
  const w = 132;
  const h = 30;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * w;
    const y = h - ((value - min) / range) * h;
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M${points[0][0]},${h} ` + points.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${points[points.length - 1][0]},${h} Z`;
  const [endX, endY] = points[points.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" fill="none" className="max-w-[132px] flex-1 shrink-0" style={{ height: h }}>
      <path d={area} fill={fill} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={endX} cy={endY} r={2.4} fill={dot} />
    </svg>
  );
}

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
  const [overview, revenue, revenueReport, commissionEnvelope, securityData] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue"),
    apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report"),
    apiGetEnvelope<SuperAdminPartnerCommissionSummaryRow[]>("/api/super-admin/partners/commission-summary"),
    apiGet<DashboardSecurityView>("/api/super-admin/security")
  ]);
  const commissionSummary = commissionEnvelope.data ?? [];

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
      overdueAging: [],
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

  const pulseCells: Array<{ label: string; value: string; sub: string; tone: HealthTone }> = [
    { label: "Active schools", value: commandCenter.pulse.totalActiveSchools.toLocaleString(), sub: `${overview.schools.total} total tenants`, tone: "good" },
    { label: "Total students", value: commandCenter.pulse.totalStudents.toLocaleString(), sub: "Across active schools", tone: "good" },
    { label: "Online now", value: commandCenter.pulse.schoolsOnline.toLocaleString(), sub: "Last 30 minutes", tone: "good" },
    { label: "Uptime (30d)", value: formatPercent(commandCenter.pulse.uptime30Day), sub: "API success proxy", tone: commandCenter.pulse.uptime30Day >= 99.5 ? "good" : "warn" },
    { label: "Sync queue", value: commandCenter.pulse.offlineSyncQueueSize.toLocaleString(), sub: "Pending records", tone: commandCenter.pulse.offlineSyncQueueSize > 0 ? "warn" : "good" },
    { label: "Last backup", value: commandCenter.pulse.lastSuccessfulBackupAt ? formatDate(commandCenter.pulse.lastSuccessfulBackupAt) : "Not logged", sub: "Successful run", tone: commandCenter.pulse.lastSuccessfulBackupAt ? "good" : "danger" }
  ];

  const revenueSparkline = revenue.monthlyRevenue.slice(-8).map((item) => item.amount);

  const collectedPct = commandCenter.revenueSnapshot.currentTermInvoiced > 0
    ? Math.min(100, Math.round((commandCenter.revenueSnapshot.currentTermCollected / commandCenter.revenueSnapshot.currentTermInvoiced) * 1000) / 10)
    : 0;
  const collectionGap = Math.max(0, commandCenter.revenueSnapshot.currentTermInvoiced - commandCenter.revenueSnapshot.currentTermCollected);
  const overdueAgingMax = Math.max(...commandCenter.revenueSnapshot.overdueAging.map((band) => band.amount), 1);
  const overdueInvoiceCount = commandCenter.revenueSnapshot.overdueAging.reduce((sum, band) => sum + band.count, 0);

  const revenueTrendTiles = [
    { label: "New MRR added this month", value: formatCurrency(commandCenter.revenueSnapshot.newMrrThisMonth), secondary: `${overview.signups.last30Days} new signup(s), 30d` },
    { label: "Notification credit revenue", value: formatCurrency(commandCenter.revenueSnapshot.notificationCreditRevenue), secondary: `${formatPercent(revenueReport.creditRevenueSharePct)} of platform revenue` },
    { label: "Term invoiced (total)", value: formatCurrency(commandCenter.revenueSnapshot.currentTermInvoiced), secondary: `${formatCurrency(commandCenter.revenueSnapshot.currentTermCollected)} collected so far` },
    { label: "Month-over-month growth", value: `${commandCenter.revenueSnapshot.monthOverMonthGrowth >= 0 ? "+" : ""}${formatPercent(commandCenter.revenueSnapshot.monthOverMonthGrowth)}`, secondary: "Collected revenue vs prior month" }
  ];

  const tierTotal = revenue.schoolsByPlan.reduce((sum, item) => sum + item.count, 0) || 1;

  function complianceCountdown(deadline: Date) {
    const days = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return { countdown: `${Math.abs(days)}d overdue`, tone: "danger" as HealthTone, deadline };
    if (days <= 3) return { countdown: `${days}d left`, tone: "danger" as HealthTone, deadline };
    if (days <= 10) return { countdown: `${days}d left`, tone: "warn" as HealthTone, deadline };
    return { countdown: `${days}d left`, tone: "good" as HealthTone, deadline };
  }

  const complianceWatchItems = [
    ...securityData.privacy
      .filter((request) => request.status === "OPEN" || request.status === "IN_REVIEW")
      .map((request) => {
        const deadline = new Date(new Date(request.createdAt).getTime() + NDPA_RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const countdown = complianceCountdown(deadline);
        return {
          id: request.id,
          label: `${request.type.replaceAll("_", " ")} request — ${request.subject}`,
          detail: `${request.school?.name ?? "Platform-wide"} · opened ${formatDate(request.createdAt)} · NDPA 30-day response window`,
          ...countdown
        };
      }),
    ...securityData.incidents
      .filter((incident) => incident.status !== "RESOLVED")
      .map((incident) => {
        const deadline = new Date(new Date(incident.detectedAt).getTime() + BREACH_CONTAINMENT_HOURS * 60 * 60 * 1000);
        const countdown = complianceCountdown(deadline);
        return {
          id: incident.id,
          label: `${incident.type} incident containment`,
          detail: `${incident.severity} severity · detected ${formatDate(incident.detectedAt)} · 72h containment window`,
          ...countdown
        };
      })
  ].sort((left, right) => left.deadline.getTime() - right.deadline.getTime()).slice(0, 7);

  const commissionWatchItems = [...commissionSummary]
    .sort((left, right) => right.totalCommissionOwed - left.totalCommissionOwed)
    .slice(0, 5);

  const geoRevenueByState = new Map(revenueReport.revenueByState.map((item) => [item.state, item.revenue]));

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
  const systemHealthThreshold: Record<string, string> = {
    apiUptime: "critical below 99.5%",
    averageResponseMs: "warn > 1.5s",
    syncFailureRate24h: "warn > 5%",
    notificationDeliveryRate: "warn < 90%",
    activeInfrastructureAlerts: "warn ≥ 2"
  };

  const activityFeed = overview.recentActivity.slice(0, 7);

  const exportRows: DashboardExportRow[] = [
    ...pulseCells.map((cell) => ({ section: "Pulse", label: cell.label, value: cell.value })),
    { section: "Revenue", label: "Revenue collected this month", value: formatCurrency(commandCenter.revenueSnapshot.currentTermCollected) },
    { section: "Revenue", label: "Term invoiced", value: formatCurrency(commandCenter.revenueSnapshot.currentTermInvoiced) },
    { section: "Revenue", label: "Overdue balances", value: formatCurrency(commandCenter.revenueSnapshot.overdueBalances) },
    ...revenueTrendTiles.map((tile) => ({ section: "Revenue", label: tile.label, value: tile.value })),
    { section: "Support", label: "Open tickets", value: String(commandCenter.supportQueue.totalOpenTickets) },
    { section: "Support", label: "SLA breaches", value: String(commandCenter.supportQueue.ticketsBreachingSla) },
    ...systemHealthRows.map((row) => ({ section: "System health", label: row.label, value: String(row.value) }))
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[20px] bg-[#0d2315] px-6 py-[30px] text-white md:px-8">
        <div className="pointer-events-none absolute -right-[110px] -top-40 h-[420px] w-[420px] rounded-full border border-[rgba(95,214,180,0.13)]" />
        <div className="pointer-events-none absolute -right-10 -top-[90px] h-[270px] w-[270px] rounded-full border border-[rgba(95,214,180,0.09)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-[70px] h-[300px] w-[300px] rounded-full border border-white/5" />
        <div className="relative z-[1] flex flex-wrap items-end justify-between gap-[30px]">
          <div className="min-w-0 flex-1">
            <div className="mb-[17px] inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.16)] bg-white/[0.09] px-[14px] py-[6px]">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#5FD6B4]" />
              <span className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.13em] text-white/[0.84]">{profile.eyebrow}</span>
            </div>
            <h2 className="max-w-[600px] text-pretty font-[var(--font-heading)] text-[26px] font-extrabold leading-[1.1] tracking-[-0.032em] text-white md:text-[33px]">
              {platformGreeting(session?.role ?? "SUPER_ADMIN", session?.name)}
            </h2>
            <p className="mt-3 max-w-[560px] text-pretty text-[13.5px] leading-[1.55] text-white/62">
              {profile.mission} {session ? `Current internal role: ${roleLabels[session.role]}.` : ""}
            </p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            {profile.actions.map((action) => (
              <Link
                key={action.href}
                href={action.href as Route}
                className="whitespace-nowrap rounded-full border border-[rgba(255,255,255,0.18)] bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-white/20"
              >
                {action.label}
              </Link>
            ))}
            <DashboardExportButton rows={exportRows} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#0D2315] p-1 sm:grid-cols-3 xl:grid-cols-6">
        {pulseCells.map((cell) => {
          const dotColor = cell.tone === "danger" ? "#e97070" : cell.tone === "warn" ? "#e5b33d" : "#3ee08a";
          const valueColor = cell.tone === "danger" ? "#f0a0a0" : cell.tone === "warn" ? "#f2c766" : "#fff";
          return (
            <div key={cell.label} className="border-white/[0.09] px-[18px] py-4 xl:border-r xl:last:border-r-0">
              <div className="flex items-center gap-[7px]">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: dotColor }} />
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.09em] text-white/50">{cell.label}</p>
              </div>
              <p className="mt-[9px] font-[var(--font-mono)] text-[23px] font-extrabold leading-none tracking-tight" style={{ color: valueColor }}>{cell.value}</p>
              <p className="mt-1.5 truncate text-[11px] text-white/55">{cell.sub}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <article className="flex flex-col justify-between rounded-[16px] bg-[#0d2315] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-white/50">Revenue collected this term</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                <p className="font-[var(--font-heading)] text-[38px] font-extrabold tracking-tight text-white">{formatCurrency(commandCenter.revenueSnapshot.currentTermCollected)}</p>
                <p className="text-[13px] text-white/55">of {formatCurrency(commandCenter.revenueSnapshot.currentTermInvoiced)} invoiced</p>
              </div>
            </div>
            <div className="w-[200px] shrink-0 opacity-90">
              <Sparkline values={revenueSparkline} stroke="#5FD6B4" fill="rgba(95,214,180,0.16)" dot="#5FD6B4" />
            </div>
          </div>
          <div className="mt-5">
            <div className="h-[9px] overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#5FD6B4]" style={{ width: `${collectedPct}%` }} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="font-[var(--font-heading)] text-[13px] font-bold text-[#5FD6B4]">{formatPercent(collectedPct)}</span>
                <span className="text-[12px] text-white/55">collected · {formatCurrency(collectionGap)} remaining</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold" style={{ color: commandCenter.revenueSnapshot.monthOverMonthGrowth >= 0 ? "#5FD6B4" : "#F0A0A0" }}>
                  {commandCenter.revenueSnapshot.monthOverMonthGrowth >= 0 ? "+" : ""}{formatPercent(commandCenter.revenueSnapshot.monthOverMonthGrowth)}
                </span>
                <span className="text-[11.5px] text-white/40">vs last month</span>
              </div>
            </div>
          </div>
        </article>

        <article className="flex flex-col rounded-[16px] border p-5" style={{ borderColor: "#f0dfdf", background: "var(--color-bg-surface)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "#a4726f" }}>Overdue balances</p>
              <div className="mt-2.5 flex items-baseline gap-2">
                <p className="font-[var(--font-heading)] text-[28px] font-extrabold text-[var(--color-text-primary)]">{formatCurrency(commandCenter.revenueSnapshot.overdueBalances)}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{overdueInvoiceCount} invoice{overdueInvoiceCount === 1 ? "" : "s"}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {commandCenter.revenueSnapshot.overdueAging.map((band) => (
              <div key={band.band}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[11.5px]">
                  <span className="text-[var(--color-text-muted)]">{band.band}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{formatCurrency(band.amount)}</span>
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">{band.count}</span>
                  </span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full" style={{ width: `${(band.amount / overdueAgingMax) * 100}%`, background: "var(--color-danger)" }} />
                </div>
              </div>
            ))}
            {commandCenter.revenueSnapshot.overdueAging.every((band) => band.amount === 0) ? (
              <p className="rounded-[10px] px-3 py-4 text-center text-[12px] font-semibold" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                No overdue balances.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {revenueTrendTiles.map((tile) => (
          <article key={tile.label} className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-[18px]">
            <p className="min-h-[31px] text-[11.5px] leading-[1.35] text-[var(--color-text-muted)]">{tile.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{tile.value}</p>
            <p className="mt-1.5 truncate text-[11px] text-[var(--color-text-muted)]">{tile.secondary}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[1.35fr_1fr]">
        <section className="surface-card p-6">
          <CardHeader
            title="Regulatory obligations watch"
            meta="Module 10 · NDPA 2023"
            sub="Every open data-subject request and unresolved security incident, counted down against its response window."
          />
          <div className="mt-3.5 grid gap-0">
            {complianceWatchItems.map((item) => {
              const colors = toneColors[item.tone];
              return (
                <div key={item.id} className="flex items-start gap-2.5 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colors.fg }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-5 text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{item.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: colors.bg, color: colors.fg }}>{item.countdown}</span>
                </div>
              );
            })}
            {complianceWatchItems.length === 0 ? (
              <p className="rounded-[10px] px-4 py-6 text-center text-sm font-semibold" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                No open compliance obligations.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-[16px] border border-[#0d2315] bg-[#0d2315] p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10">
              <Handshake className="h-[18px] w-[18px] text-[#5FD6B4]" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/50">Module 13</p>
              <h3 className="mt-1 font-[var(--font-heading)] text-[18px] font-bold text-white">Channel &amp; commission</h3>
            </div>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-5 text-white/60">Accrued on reconciled revenue only — never on an invoice.</p>
          <div className="mt-3.5 grid gap-0">
            {commissionWatchItems.map((partner) => (
              <div key={partner.partnerId} className="flex items-start justify-between gap-3 border-b border-white/10 py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-5 text-white/85">{partner.partnerName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/50">{partner.convertedDealCount} converted deal{partner.convertedDealCount === 1 ? "" : "s"}{partner.territory ? ` · ${partner.territory}` : ""}</p>
                </div>
                <p className="shrink-0 font-[var(--font-heading)] text-[16px] font-bold text-[#5FD6B4]">{formatCurrency(partner.totalCommissionOwed)}</p>
              </div>
            ))}
            {commissionWatchItems.length === 0 ? <p className="py-4 text-center text-[12px] font-semibold text-white/50">No commission activity recorded.</p> : null}
          </div>
        </section>
      </section>

      <section className="grid gap-3.5 lg:grid-cols-[1.15fr_1fr_1fr]">
        <section className="surface-card p-5">
          <CardHeader title="Subscription health" meta={`${tierTotal.toLocaleString()} accounts`} />
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

        <section className="surface-card p-5">
          <CardHeader title="Onboarding & trial pipeline" sub="No approval stage — schools provision instantly." />
          <div className="mt-3.5 grid gap-3.5">
            {pipelineStages.map((stage) => (
              <div key={stage.label}>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--color-text-secondary)]">{stage.label}</span>
                  <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{stage.value}</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full bg-[var(--color-border-muted)]">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(stage.value / pipelineMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <CardHeader title="Support queue" />
          <div className="mt-3.5 grid gap-0">
            <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-text-muted)" }} />
                <span className="text-[12.5px] text-[var(--color-text-secondary)]">Open tickets</span>
              </div>
              <span className="font-[var(--font-heading)] text-[15px] font-bold text-[var(--color-text-primary)]">{commandCenter.supportQueue.totalOpenTickets}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-danger)" }} />
                <span className="text-[12.5px] text-[var(--color-text-secondary)]">Critical open</span>
              </div>
              <span className="font-[var(--font-heading)] text-[15px] font-bold" style={{ color: commandCenter.supportQueue.criticalOpenTickets > 0 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{commandCenter.supportQueue.criticalOpenTickets}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-danger)" }} />
                <span className="text-[12.5px] text-[var(--color-text-secondary)]">Breaching target now</span>
              </div>
              <span className="font-[var(--font-heading)] text-[15px] font-bold" style={{ color: "var(--color-danger)" }}>{commandCenter.supportQueue.ticketsBreachingSla}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 last:border-b-0">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-success)" }} />
                <span className="text-[12.5px] text-[var(--color-text-secondary)]">Avg resolution this week</span>
              </div>
              <span className="font-[var(--font-heading)] text-[15px] font-bold text-[var(--color-text-primary)]">{formatHours(commandCenter.supportQueue.averageResolutionHoursThisWeek)}</span>
            </div>
          </div>
          {commandCenter.supportQueue.ticketsBreachingSla > 0 ? (
            <div className="mt-3.5 rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: "#f6dede", background: "var(--color-danger-dim)" }}>
              <p className="text-[12px] font-semibold" style={{ color: "var(--color-danger)" }}>
                {commandCenter.supportQueue.ticketsBreachingSla} ticket{commandCenter.supportQueue.ticketsBreachingSla === 1 ? "" : "s"} breach target within the hour
              </p>
            </div>
          ) : null}
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <section className="surface-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] px-5 py-4">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Alert centre</h3>
            <p className="text-[11.5px] font-semibold" style={{ color: "var(--color-accent-primary)" }}>Every alert carries a one-click action</p>
          </div>
          <div className="grid gap-0">
            {commandCenter.alerts.map((alert) => {
              const alertColor = alert.severity === "danger" ? "var(--color-danger)" : "var(--color-warning)";
              return (
                <div key={alert.id} className="flex items-center gap-3 border-b border-[var(--color-border-muted)] px-5 py-3.5 last:border-b-0">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: alertColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-[var(--color-text-primary)]">{alert.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{alert.detail}</p>
                  </div>
                  <Link
                    href={alert.actionHref as Route}
                    className="shrink-0 text-[11.5px] font-bold transition hover:underline"
                    style={{ color: "var(--color-accent-primary)" }}
                  >
                    Review
                  </Link>
                </div>
              );
            })}
            {commandCenter.alerts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm font-semibold" style={{ color: "var(--color-success)" }}>
                No active command-center alerts.
              </p>
            ) : null}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Activity feed</h3>
            <span className="flex items-center gap-[5px] text-[11px] font-semibold" style={{ color: "var(--color-success)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-success)" }} />
              Live
            </span>
          </div>
          <div className="mt-3.5 grid gap-0">
            {activityFeed.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="flex gap-[11px]">
                <div className="flex shrink-0 flex-col items-center">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-accent-primary)" }} />
                  {index < activityFeed.length - 1 ? <span className="mt-[3px] w-px flex-1 bg-[var(--color-border-muted)]" /> : null}
                </div>
                <div className="pb-2">
                  <p className="text-[12.5px] leading-5 text-[var(--color-text-primary)]">
                    {item.superAdmin} <span className="text-[var(--color-text-secondary)]">{item.action.replaceAll("_", " ").toLowerCase()}</span> {item.target}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{item.schoolName ?? "Platform"} · {formatDate(item.timestamp)}</p>
                </div>
              </div>
            ))}
            {activityFeed.length === 0 ? <p className="py-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">No recent activity.</p> : null}
          </div>
        </section>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-2">
        <section className="surface-card p-5">
          <CardHeader title="System health indicators" meta="Module 12 · real-time" />
          <div className="mt-3.5 grid gap-0">
            {systemHealthRows.map((item) => {
              const { tone, label } = systemHealthTone(item.key, typeof item.value === "string" ? Number.parseFloat(item.value) : item.value);
              return (
                <div key={item.label} className="grid grid-cols-[1.4fr_0.8fr_1fr] items-center gap-3 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
                  <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className="font-[var(--font-heading)] text-[14px] font-bold text-[var(--color-text-primary)]">{item.value}</span>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] text-[var(--color-text-muted)]">{systemHealthThreshold[item.key]}</span>
                    <StatusPill tone={tone} label={label} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Geographic distribution</h3>
            <span className="text-[11.5px] font-semibold" style={{ color: "var(--color-accent-primary)" }}>State density view</span>
          </div>
          <div className="mt-3.5 grid grid-cols-[1.1fr_2.4fr_0.7fr_0.9fr] gap-3 border-b border-[var(--color-border-muted)] pb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
            <span>State</span>
            <span>Share</span>
            <span>Schools</span>
            <span className="text-right">MRR</span>
          </div>
          {commandCenter.geography.slice(0, 6).map((item) => {
            const stateMrr = geoRevenueByState.get(item.state) ?? 0;
            return (
              <div key={item.state} className="grid grid-cols-[1.1fr_2.4fr_0.7fr_0.9fr] items-center gap-3 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
                <span className="truncate text-[12.5px] text-[var(--color-text-secondary)]">{item.state}</span>
                <div className="h-[7px] overflow-hidden rounded-full bg-[var(--color-border-muted)]">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(item.schoolCount / geographyMax) * 100}%` }} />
                </div>
                <span className="text-[12.5px] text-[var(--color-text-secondary)]">{item.schoolCount}</span>
                <span className="text-right text-[12.5px] font-semibold text-[var(--color-text-primary)]">{formatCurrency(stateMrr)}</span>
              </div>
            );
          })}
          {commandCenter.geography.length === 0 ? <p className="py-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">No school location data yet.</p> : null}
        </section>
      </section>
    </div>
  );
}
