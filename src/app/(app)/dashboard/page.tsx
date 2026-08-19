import Link from "next/link";
import type { Route } from "next";
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Megaphone, Sparkles, Target, Users } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendCard } from "@/components/dashboard/trend-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadCommandCenterSnapshot } from "@/lib/dashboard/command-center-snapshot";
import { getRoleDashboardProfile } from "@/lib/domain/dashboard";
import { DashboardSummary } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";
import { SchoolCommandCenter } from "./_school-command-center";

function displayDateOrText(value: string) {
  return Number.isNaN(new Date(value).getTime()) ? value : formatDate(value);
}

function toneRing(tone: "neutral" | "warning" | "danger") {
  if (tone === "danger") return "border-[var(--color-border-default)]";
  if (tone === "warning") return "border-[var(--color-border-default)]";
  return "border-[var(--color-border-default)]";
}

function toneStyle(tone: "neutral" | "warning" | "danger") {
  if (tone === "danger") return { background: "var(--color-danger-dim)", color: "var(--color-danger)" };
  if (tone === "warning") return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  return { background: "var(--color-success-dim)", color: "var(--color-success)" };
}

function categoryIcon(category?: string) {
  const icons = {
    admissions: GraduationCap,
    finance: Target,
    academics: ClipboardList,
    attendance: Users,
    communication: Megaphone,
    system: Activity
  };
  return icons[category as keyof typeof icons] ?? Sparkles;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function dashboardTitle(role: string, name: string) {
  const firstName = name.split(" ")[0] ?? name;
  const titles: Record<string, string> = {
    SCHOOL_OWNER: `${greeting()}, ${firstName}. Here's your school at a glance.`,
    PROPRIETOR: `${greeting()}, ${firstName}. Here's your school at a glance.`,
    PRINCIPAL: `${greeting()}, Principal ${firstName}.`,
    HEAD_TEACHER: `${greeting()}, Head Teacher ${firstName}.`,
    VICE_PRINCIPAL_ACADEMICS: `${greeting()}, ${firstName}. Academic operations are ready.`,
    VICE_PRINCIPAL_ADMINISTRATION: `${greeting()}, ${firstName}. Admin operations are ready.`,
    HEAD_OF_DEPARTMENT: `${greeting()}, ${firstName}. Your department dashboard is ready.`,
    CLASS_TEACHER: `${greeting()}, ${firstName}. Your class workspace is ready.`,
    SUBJECT_TEACHER: `${greeting()}, ${firstName}. Today's teaching work is ready.`,
    TEACHER: `${greeting()}, ${firstName}. Today's teaching work is ready.`,
    BURSAR: `${greeting()}, ${firstName}. Finance operations are ready.`,
    ACCOUNTANT: `${greeting()}, ${firstName}. Finance operations are ready.`,
    ACCOUNT_OFFICER: `${greeting()}, ${firstName}. Finance support is ready.`,
    HR_OFFICER: `${greeting()}, ${firstName}. Staff operations are ready.`,
    ADMISSIONS_OFFICER: `${greeting()}, ${firstName}. Admissions pipeline is ready.`,
    EXAMINATION_OFFICER: `${greeting()}, ${firstName}. Exams and results workflow is ready.`,
    EXAM_OFFICER: `${greeting()}, ${firstName}. Exams and results workflow is ready.`,
    GUIDANCE_COUNSELOR: `${greeting()}, ${firstName}. Welfare support is ready.`,
    GUIDANCE_COUNSELLOR: `${greeting()}, ${firstName}. Welfare support is ready.`,
    LIBRARIAN: `${greeting()}, ${firstName}. Library operations are ready.`,
    TRANSPORT_COORDINATOR: `${greeting()}, ${firstName}. Fleet operations are ready.`,
    TRANSPORT_MANAGER: `${greeting()}, ${firstName}. Fleet operations are ready.`,
    HOSTEL_MANAGER: `${greeting()}, ${firstName}. Hostel operations are ready.`,
    HOSTEL_MASTER: `${greeting()}, ${firstName}. Hostel operations are ready.`,
    HOSTEL_MATRON: `${greeting()}, ${firstName}. Hostel operations are ready.`,
    HOSTEL_MISTRESS: `${greeting()}, ${firstName}. Hostel operations are ready.`,
    IT_ADMINISTRATOR: `${greeting()}, ${firstName}. Systems support is ready.`,
    ICT_CBT_ADMIN: `${greeting()}, ${firstName}. Systems support is ready.`,
    SCHOOL_NURSE: `${greeting()}, ${firstName}. Sick bay dashboard is ready.`,
    NURSE: `${greeting()}, ${firstName}. Sick bay dashboard is ready.`,
    RECEPTIONIST: `${greeting()}, ${firstName}. Front desk is ready.`,
    PARENT: `${greeting()}, ${firstName}. Your family portal is ready.`,
    STUDENT: `${greeting()}, ${firstName}. Your school day is ready.`
  };
  return titles[role] ?? `${greeting()}, ${firstName}.`;
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/dashboard"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const overview = await apiGet<DashboardSummary>("/api/v1/dashboard/overview");
  const profile = getRoleDashboardProfile(session.role);
  const primaryMetrics = overview.metrics.slice(0, 4);
  const roleSignals = overview.roleWidgets?.slice(0, 6) ?? [];
  const visibleActions = (overview.quickActions ?? []).slice(0, 5);
  const topAlerts = overview.alerts.slice(0, 3);
  const timeline = [
    ...(overview.recentActivity ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      meta: displayDateOrText(item.time),
      category: item.category
    })),
    ...(overview.recentAnnouncements ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      meta: formatDate(item.publishedAt),
      category: "communication"
    }))
  ].slice(0, 6);

  if (session.role === "SCHOOL_OWNER" || session.role === "PROPRIETOR") {
    const snapshot = await loadCommandCenterSnapshot(overview);

    return (
      <SchoolCommandCenter
        session={session}
        overview={overview}
        profile={profile}
        roleSignals={roleSignals}
        topAlerts={topAlerts}
        timeline={timeline}
        pulse={snapshot.pulse}
        termProgress={snapshot.termProgress}
        academicSnapshot={snapshot.academicSnapshot}
        financialSnapshot={snapshot.financialSnapshot}
        staffActivity={snapshot.staffActivity}
        commsSnapshot={snapshot.commsSnapshot}
      />
    );
  }

  return (
    <div className="portal-page">
      <section className="portal-hero">
        <div className="portal-hero-grid">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              {profile.eyebrow}
            </div>
            <h1 className="portal-title mt-4 max-w-4xl">
              {dashboardTitle(session.role, session.name)}
            </h1>
            <p className="portal-copy mt-3">{profile.mission}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {overview.currentTerm} · {overview.currentSession}
              </span>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {roleLabels[session.role]}
              </span>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {overview.schoolName}
              </span>
            </div>
          </div>
          <div className="portal-muted-tile">
            <p className="section-eyebrow">Focus for this role</p>
            <div className="mt-3 grid gap-2">
              {profile.focus.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-[10px] bg-[var(--color-bg-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primaryMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      {visibleActions.length ? (
        <section className="portal-panel">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-eyebrow">Quick action bar</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">The fastest routes for this role and permission set.</p>
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {visibleActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href as Route}
                  className="portal-action-tile group"
                >
                  <span className="block text-[13px] font-bold">{action.label}</span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-[var(--color-text-muted)]">{action.description}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card overflow-hidden">
          <div className="h-1 bg-[var(--color-accent-primary)]" />
          <div className="p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="section-eyebrow">Priority queue</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-[var(--color-text-primary)]">{profile.commandTitle}</h2>
                <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{profile.commandDescription}</p>
              </div>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {(overview.pendingActions ?? []).length} item(s)
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {(overview.pendingActions ?? []).slice(0, 5).map((item) => (
                <Link key={item.id} href={item.href as Route} className={`group rounded-[10px] border p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] ${toneRing(item.tone)}`} style={toneStyle(item.tone)}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-bg-surface)]">
                      {item.tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="mt-1 text-[13px] leading-6 opacity-80">{item.detail}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {(overview.pendingActions ?? []).length === 0 ? (
                <div className="empty-state p-6 text-sm text-[var(--color-text-secondary)]">
                  No pending actions for this role right now.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="h-1 bg-[var(--color-accent-primary)]" />
          <div className="p-6">
            <p className="section-eyebrow">Role snapshot</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-[var(--color-text-primary)]">{profile.spotlightTitle}</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{profile.spotlightDescription}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {roleSignals.length ? roleSignals.map((metric) => (
                <article key={metric.label} className="portal-muted-tile">
                  <p className="portal-stat-label">{metric.label}</p>
                  <p className="portal-stat-value">{metric.value}</p>
                  <p className="portal-stat-note">{metric.change}</p>
                </article>
              )) : (
                <div className="empty-state p-6 text-sm text-[var(--color-text-secondary)] sm:col-span-2">
                  No additional role-specific signal is available yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <TrendCard title="Attendance pulse" description="Daily attendance performance from the latest school week." items={overview.attendanceTrend.map((item) => ({ label: item.day, value: item.rate, suffix: "%" }))} />
        <TrendCard title="Fee movement" description="Collections versus outstanding exposure in NGN millions." items={overview.feeTrend.map((item) => ({ label: item.month, value: item.collected, suffix: "m" }))} />
        <TrendCard title="Admissions funnel" description="Applications by current workflow stage." items={overview.admissionsByStage.map((item) => ({ label: item.stage.replaceAll("_", " "), value: item.count }))} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-6">
            <p className="section-eyebrow">Role intelligence</p>
            <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{profile.insightTitle}</h3>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{profile.insightDescription}</p>
          </div>
          <div className="mt-5 grid gap-3">
            {(overview.upcomingExams ?? []).map((exam) => (
              <Link key={exam.id} href={exam.href as Route} className="mx-6 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-[13px] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-[var(--color-text-accent)]" />
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{exam.title}</p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">{exam.detail}</p>
                    <p className="mt-1 text-[var(--color-text-muted)]">{formatDate(exam.startsAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
            {(overview.upcomingExams ?? []).length === 0 ? <p className="px-6 pb-6 text-[13px] text-[var(--color-text-secondary)]">No upcoming exams found.</p> : null}
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-6">
            <p className="section-eyebrow">Recent operating timeline</p>
            <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What changed recently</h3>
          </div>
          <div className="grid gap-3 p-6">
            {timeline.map((item) => {
              const Icon = categoryIcon(item.category);
              return (
                <article key={`${item.category}-${item.id}`} className="flex gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">{item.detail}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{item.meta}</p>
                  </div>
                </article>
              );
            })}
            {timeline.length === 0 ? <p className="text-[13px] text-[var(--color-text-secondary)]">No recent activity visible for this role.</p> : null}
          </div>
        </section>
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
            <article key={alert.id} className={`rounded-[10px] border p-5 ${toneRing(alert.tone)}`} style={toneStyle(alert.tone)}>
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{alert.detail}</p>
            </article>
          ))}
          {topAlerts.length === 0 ? <p className="text-[13px] text-[var(--color-text-secondary)]">No alerts visible for this role.</p> : null}
        </div>
      </section>
    </div>
  );
}
