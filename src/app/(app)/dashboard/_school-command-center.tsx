import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, CheckCircle2, MessageCircle, Sparkles, Target } from "lucide-react";

import { roleLabels } from "@/lib/auth/roles";
import type {
  FinancialSnapshot,
  SnapshotItem,
  SnapshotTone,
  PulseCell,
  TermMilestone,
  TermProgress
} from "@/lib/dashboard/command-center-snapshot";
import type { DashboardMetric, DashboardSummary, SessionUser } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { OfflineSyncStatus } from "./_offline-sync-status";

type RoleDashboardProfile = {
  eyebrow: string;
  mission: string;
  focus: string[];
};

type TimelineItem = { id: string; title: string; detail: string; meta: string; category: string };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function toneRing(tone: "neutral" | "warning" | "danger") {
  if (tone === "danger") return { background: "var(--color-danger-dim)", color: "var(--color-danger)" };
  if (tone === "warning") return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  return { background: "var(--color-success-dim)", color: "var(--color-success)" };
}

function snapshotColor(tone: SnapshotTone) {
  if (tone === "danger") return "var(--color-danger)";
  if (tone === "warn") return "var(--color-warning)";
  if (tone === "good") return "var(--color-success)";
  return "var(--color-text-primary)";
}

function milestoneColor(state: TermMilestone["state"]) {
  if (state === "done") return "var(--color-accent-primary)";
  if (state === "current") return "var(--color-warning)";
  return "var(--color-border-strong)";
}

export function SchoolCommandCenter({
  session,
  overview,
  profile,
  roleSignals,
  topAlerts,
  timeline,
  pulse,
  termProgress,
  academicSnapshot,
  financialSnapshot,
  staffActivity,
  commsSnapshot
}: {
  session: SessionUser;
  overview: DashboardSummary;
  profile: RoleDashboardProfile;
  roleSignals: DashboardMetric[];
  topAlerts: DashboardSummary["alerts"];
  timeline: TimelineItem[];
  pulse: PulseCell[];
  termProgress: TermProgress | null;
  academicSnapshot: SnapshotItem[];
  financialSnapshot: FinancialSnapshot;
  staffActivity: SnapshotItem[];
  commsSnapshot: SnapshotItem[];
}) {
  const firstName = session.name.split(" ")[0] ?? session.name;
  const quickActions = overview.quickActions ?? [];
  const actionCenter = (overview.pendingActions ?? []).slice(0, 6);
  const collectionPct = financialSnapshot.expected > 0 ? Math.min(100, Math.round((financialSnapshot.collected / financialSnapshot.expected) * 100)) : 0;

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              {profile.eyebrow}
            </div>
            <h1 className="mt-4 max-w-4xl font-[var(--font-heading)] text-[28px] font-black leading-tight tracking-tight text-[var(--color-text-primary)] md:text-[34px]">
              {greeting()}, {firstName}. Here&apos;s your school at a glance.
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-6 text-[var(--color-text-secondary)]">{profile.mission}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                {overview.currentTerm} · {overview.currentSession}
              </span>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                {roleLabels[session.role]}
              </span>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                {overview.schoolName}
              </span>
            </div>
          </div>
        </div>
      </section>

      {quickActions.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href as Route}
              className="group inline-flex items-center gap-2 rounded-[11px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2.5 transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
            >
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{action.label}</span>
            </Link>
          ))}
        </section>
      ) : null}

      {termProgress ? (
        <section className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Term progress — {termProgress.label}</p>
            <p className="text-[11.5px] text-[var(--color-text-muted)]">{termProgress.resumptionLabel}</p>
          </div>
          <div className="relative mx-2 mt-4 h-2 rounded-full bg-[var(--color-bg-elevated)]">
            <div className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${termProgress.pct}%` }} />
            {termProgress.dots.map((dot, index) => (
              <div
                key={`${dot.label}-${index}`}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-bg-surface)]"
                style={{ left: `${dot.pct}%`, background: milestoneColor(dot.state) }}
                title={dot.label}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {termProgress.dots.map((dot, index) => (
              <span key={`${dot.label}-label-${index}`} className="text-[10.5px] font-semibold text-[var(--color-text-muted)]">
                {dot.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {pulse.length > 0 ? (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#0D2315] p-1 sm:grid-cols-3 xl:grid-cols-7">
          {pulse.map((cell) => (
            <div key={cell.label} className="px-4 py-4 xl:border-r xl:border-white/10 xl:last:border-r-0">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/50">{cell.label}</p>
              <p className="mt-2 font-[var(--font-heading)] text-[19px] font-bold text-white">{cell.value}</p>
              <p className="mt-1.5 text-[10.5px] font-medium text-white/60">{cell.change}</p>
            </div>
          ))}
          <OfflineSyncStatus variant="pulse" />
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Academic snapshot</p>
          </div>
          <div className="grid gap-1">
            {academicSnapshot.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
                <p className="flex-1 text-[12.5px] text-[var(--color-text-secondary)]">{item.label}</p>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
                  style={{ background: `color-mix(in srgb, ${snapshotColor(item.tone)} 14%, transparent)`, color: snapshotColor(item.tone) }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Financial snapshot</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{overview.currentTerm}</p>
          </div>
          <div className="mb-3">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">{formatCurrency(financialSnapshot.collected)}</p>
              <p className="text-[11.5px] text-[var(--color-text-muted)]">of {formatCurrency(financialSnapshot.expected)} expected</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
              <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${collectionPct}%` }} />
            </div>
          </div>
          <div className="grid gap-1">
            {financialSnapshot.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] py-2 last:border-b-0">
                <p className="flex-1 text-[12.5px] text-[var(--color-text-secondary)]">{item.label}</p>
                <p className="shrink-0 text-[12.5px] font-bold" style={{ color: snapshotColor(item.tone) }}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Staff activity</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Today</p>
          </div>
          <div className="grid gap-1">
            {staffActivity.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] py-2.5 last:border-b-0">
                <div className="flex flex-1 items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: snapshotColor(item.tone) }} />
                  <p className="text-[12.5px] text-[var(--color-text-secondary)]">{item.label}</p>
                </div>
                <p className="shrink-0 font-[var(--font-heading)] text-[14.5px] font-bold" style={{ color: snapshotColor(item.tone) }}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-default)] px-6 py-4">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">My action center</p>
            <p className="text-[11.5px] font-semibold text-[var(--color-text-accent)]">Generated from your role &amp; assignments</p>
          </div>
          <div className="grid">
            {actionCenter.map((item) => (
              <Link
                key={item.id}
                href={item.href as Route}
                className="flex items-center gap-3 border-b border-[var(--color-border-muted)] px-6 py-3.5 transition last:border-b-0 hover:bg-[var(--color-bg-subtle)]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={toneRing(item.tone)}
                >
                  {item.tone === "danger" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{item.detail}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--color-border-default)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  Review
                </span>
              </Link>
            ))}
            {actionCenter.length === 0 ? (
              <div className="empty-state p-6 text-sm text-[var(--color-text-secondary)]">No pending actions right now.</div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4">
          <section className="surface-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Communication snapshot</p>
              <MessageCircle className="h-4 w-4 text-[var(--color-text-muted)]" />
            </div>
            <div className="grid gap-1">
              {commsSnapshot.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] py-2 last:border-b-0">
                  <p className="flex-1 text-[12.5px] text-[var(--color-text-secondary)]">{item.label}</p>
                  <p className="shrink-0 text-[12.5px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <OfflineSyncStatus variant="card" />
        </section>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-default)] px-6 py-4">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Activity feed</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--color-success)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-success)" }} />
            Live
          </span>
        </div>
        <div className="grid">
          {timeline.map((item) => (
            <div key={`${item.category}-${item.id}`} className="flex gap-3 border-b border-[var(--color-border-muted)] px-6 py-3 last:border-b-0">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-primary)]" />
              <div className="min-w-0">
                <p className="text-[12.5px] leading-5 text-[var(--color-text-primary)]">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{item.meta}</p>
              </div>
            </div>
          ))}
          {timeline.length === 0 ? <p className="px-6 py-6 text-center text-sm text-[var(--color-text-muted)]">No recent activity yet.</p> : null}
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-eyebrow">Operational alerts</p>
            <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Risk radar</h3>
          </div>
          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
            {topAlerts.length} visible
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {topAlerts.map((alert) => (
            <article key={alert.id} className="rounded-[12px] p-4" style={toneRing(alert.tone)}>
              <p className="text-[13px] font-bold">{alert.title}</p>
              <p className="mt-2 text-[12px] leading-6 opacity-85">{alert.detail}</p>
            </article>
          ))}
          {topAlerts.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No alerts visible right now.</p> : null}
        </div>
      </section>

      {roleSignals.length > 0 ? (
        <section className="surface-card p-5">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Additional role signals</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roleSignals.map((metric) => (
              <article key={metric.label} className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{metric.label}</p>
                <p className="mt-1.5 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{metric.value}</p>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{metric.change}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
