import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendCard } from "@/components/dashboard/trend-card";
import { TableCard } from "@/components/data-display/table-card";
import { getServerSession } from "@/lib/auth/session";
import { apiGet } from "@/lib/api/server";
import { roleLabels } from "@/lib/auth/roles";
import type { SuperAdminAnalyticsOverview, SuperAdminRevenueView } from "@/lib/domain/types";
import { getRoleAccent } from "@/lib/navigation/registry";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, Building2, LifeBuoy, LineChart, ShieldCheck, Sparkles } from "lucide-react";

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

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession();
  const [overview, revenue] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);

  const schoolPlanTotal = revenue.schoolsByPlan.reduce((sum, item) => sum + item.count, 0) || 1;
  const accent = getRoleAccent(session?.role ?? "SUPER_ADMIN");
  const profile = platformProfile(session?.role ?? "PLATFORM_OWNER");
  const riskCount = overview.schools.suspended + overview.schools.trial;

  return (
    <div className="grid gap-6">
      <section className={`relative overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br ${accent.gradient} p-6 text-white shadow-panel md:p-8`}>
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75">
              <Sparkles className="h-3.5 w-3.5" />
              {profile.eyebrow}
            </div>
            <h2 className="mt-4 font-[var(--font-heading)] text-4xl font-black tracking-tight text-white md:text-5xl">{platformGreeting(session?.role ?? "SUPER_ADMIN", session?.name)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/74">
              {profile.mission} {session ? `Current internal role: ${roleLabels[session.role]}.` : ""}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">Operating focus</p>
            <div className="mt-3 grid gap-2">
              {profile.focus.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold text-white/82">
                  <ShieldCheck className="h-4 w-4 text-emerald-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard metric={{ label: "Total Schools", value: String(overview.schools.total), change: `${overview.schools.active} active` }} />
        <MetricCard metric={{ label: "Suspended / Trial", value: `${overview.schools.suspended} / ${overview.schools.trial}`, change: "Tenant status" }} />
        <MetricCard metric={{ label: "Total Users", value: String(overview.users.total), change: `${overview.users.schoolAdmins} school admins` }} />
        <MetricCard metric={{ label: "MRR / ARR", value: formatCurrency(overview.revenue.mrr), change: `${formatCurrency(overview.revenue.arr)} ARR` }} />
      </section>

      <section className="rounded-[1.75rem] border border-white/65 bg-white/90 p-4 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {profile.actions.map((action) => (
            <Link
              key={action.href}
              href={action.href as Route}
              className="group rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50"
            >
              <span className="block text-[13px] font-bold text-slate-900 group-hover:text-primary-800">{action.label}</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate-500">{action.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <TrendCard
          title="New school signups"
          description="Twelve-month platform signup trend."
          items={revenue.monthlyRevenue.map((item, index) => ({ label: item.month, value: Math.max(1, Math.round((index + overview.signups.last30Days) / 2)) }))}
        />
        <TrendCard
          title="User distribution"
          description="Platform users by major school persona."
          items={[
            { label: "Parents", value: overview.users.parents },
            { label: "Teachers", value: overview.users.teachers },
            { label: "Students", value: overview.users.students },
            { label: "School Admins", value: overview.users.schoolAdmins }
          ]}
        />
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Schools by plan</h3>
          <div className="mt-5 grid gap-3">
            {revenue.schoolsByPlan.map((item) => (
              <div key={item.plan}>
                <div className="flex items-center justify-between text-sm font-semibold text-ink">
                  <span>{item.plan}</span>
                  <span>{item.count}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-sand">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${(item.count / schoolPlanTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[2rem] border border-white/65 bg-white/92 p-6 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-700">Platform risk radar</p>
              <h3 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-slate-950">{riskCount} tenant(s) need attention</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Trial and suspended schools are surfaced first because they impact conversion, support, and customer health.
              </p>
            </div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[2rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <Building2 className="h-5 w-5 text-primary-600" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Active tenants</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{overview.schools.active}</p>
          </article>
          <article className="rounded-[2rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <LineChart className="h-5 w-5 text-primary-600" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Last 30 days</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{overview.signups.last30Days}</p>
          </article>
          <article className="rounded-[2rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <LifeBuoy className="h-5 w-5 text-primary-600" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Support context</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{overview.users.schoolAdmins}</p>
          </article>
        </section>
      </section>

      <TableCard
        title="Recent Super Admin activity"
        description="The last 10 platform-level audit events."
        items={overview.recentActivity}
        columns={[
          { key: "time", header: "Timestamp", render: (item) => formatDate(item.timestamp) },
          { key: "admin", header: "Super Admin", render: (item) => item.superAdmin },
          { key: "action", header: "Action", render: (item) => item.action.replaceAll("_", " ") },
          { key: "target", header: "Target", render: (item) => item.target },
          { key: "school", header: "School", render: (item) => item.schoolName ?? "Platform" }
        ]}
        emptyState="No Super Admin audit activity has been captured yet."
      />
    </div>
  );
}
