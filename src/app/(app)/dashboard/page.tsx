import Link from "next/link";

import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendCard } from "@/components/dashboard/trend-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { DashboardSummary } from "@/lib/domain/types";
import { getRoleAccent } from "@/lib/navigation/registry";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

function alertClass(tone: "neutral" | "warning" | "danger") {
  if (tone === "danger") return "bg-rose-50 text-rose-900";
  if (tone === "warning") return "bg-amber-50 text-amber-900";
  return "bg-brand-50 text-brand-900";
}

function displayDateOrText(value: string) {
  return Number.isNaN(new Date(value).getTime()) ? value : formatDate(value);
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
  const accent = getRoleAccent(session.role);

  return (
    <div className="grid gap-6">
      <section className={`overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br ${accent.gradient} p-6 text-white shadow-panel`}>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/65">{overview.schoolName}</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-extrabold text-ink">
              <span className="text-white">{dashboardTitle(session.role, session.name)}</span>
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/75">
              {overview.currentSession} · {overview.currentTerm} · {roleLabels[session.role]}
            </p>
          </div>
          <div className="rounded-[1.25rem] bg-white/12 px-4 py-3 text-sm text-white/75 ring-1 ring-white/15">
            Dashboard widgets and quick actions are filtered by your resolved permissions.
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      {overview.roleWidgets?.length ? (
        <section className="grid gap-4 md:grid-cols-3">
          {overview.roleWidgets.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Pending actions</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">What needs attention</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-ink/60">Items are filtered for your role and link back to the owning workflow.</p>
          </div>
          <div className="mt-6 grid gap-3">
            {(overview.pendingActions ?? []).map((item) => (
              <a key={item.id} href={item.href} className={`rounded-[1.5rem] p-5 transition hover:-translate-y-0.5 ${alertClass(item.tone)}`}>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{item.detail}</p>
              </a>
            ))}
            {(overview.pendingActions ?? []).length === 0 ? <p className="text-sm text-ink/60">No pending actions for this role.</p> : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Quick actions</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">Jump into work</h2>
          <div className="mt-6 grid gap-3">
            {(overview.quickActions ?? []).map((action) => (
              <a key={action.href} href={action.href} className="rounded-[1.4rem] border border-ink/8 bg-sand/55 p-4 transition hover:bg-brand-50">
                <p className="font-semibold text-ink">{action.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink/62">{action.description}</p>
              </a>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <TrendCard title="Attendance trend" description="Daily attendance performance from the latest school week." items={overview.attendanceTrend.map((item) => ({ label: item.day, value: item.rate, suffix: "%" }))} />
        <TrendCard title="Fee collection trend" description="Collections versus outstanding exposure in NGN millions." items={overview.feeTrend.map((item) => ({ label: item.month, value: item.collected, suffix: "m" }))} />
        <TrendCard title="Admissions funnel" description="Applications by current workflow stage." items={overview.admissionsByStage.map((item) => ({ label: item.stage.replaceAll("_", " "), value: item.count }))} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Upcoming exams</h3>
          <div className="mt-5 grid gap-3">
            {(overview.upcomingExams ?? []).map((exam) => (
              <a key={exam.id} href={exam.href} className="rounded-2xl bg-sand/60 p-4 text-sm">
                <p className="font-semibold text-ink">{exam.title}</p>
                <p className="mt-1 text-ink/65">{exam.detail}</p>
                <p className="mt-1 text-ink/45">{formatDate(exam.startsAt)}</p>
              </a>
            ))}
            {(overview.upcomingExams ?? []).length === 0 ? <p className="text-sm text-ink/60">No upcoming exams found.</p> : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Recent payments</h3>
          <div className="mt-5 grid gap-3">
            {(overview.recentPayments ?? []).map((payment) => (
              <Link key={payment.id} href="/finance/payments" className="rounded-2xl bg-sand/60 p-4 text-sm">
                <p className="font-semibold text-ink">{payment.reference}</p>
                <p className="mt-1 text-ink/65">{payment.studentName} · {formatCurrency(payment.amount)}</p>
                <p className="mt-1 text-ink/45">{payment.status}{payment.paidAt ? ` · ${formatDate(payment.paidAt)}` : ""}</p>
              </Link>
            ))}
            {(overview.recentPayments ?? []).length === 0 ? <p className="text-sm text-ink/60">No payment records visible for this role.</p> : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Announcements</h3>
          <div className="mt-5 grid gap-3">
            {(overview.recentAnnouncements ?? []).map((announcement) => (
              <a key={announcement.id} href={announcement.href} className="rounded-2xl bg-sand/60 p-4 text-sm">
                <p className="font-semibold text-ink">{announcement.title}</p>
                <p className="mt-1 line-clamp-2 text-ink/65">{announcement.detail}</p>
                <p className="mt-1 text-ink/45">{formatDate(announcement.publishedAt)}</p>
              </a>
            ))}
            {(overview.recentAnnouncements ?? []).length === 0 ? <p className="text-sm text-ink/60">No active announcements.</p> : null}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Recent activity</h3>
          <div className="mt-5 grid gap-3">
            {(overview.recentActivity ?? []).map((item) => (
              <article key={item.id} className="rounded-2xl bg-sand/60 p-4 text-sm">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-ink/65">{item.detail}</p>
                <p className="mt-1 text-ink/45">{displayDateOrText(item.time)}</p>
              </article>
            ))}
            {(overview.recentActivity ?? []).length === 0 ? <p className="text-sm text-ink/60">No recent activity visible for this role.</p> : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Operational alerts</h3>
          <div className="mt-5 grid gap-4">
            {overview.alerts.map((alert) => (
              <article key={alert.id} className={`rounded-[1.5rem] p-5 ${alertClass(alert.tone)}`}>
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{alert.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
