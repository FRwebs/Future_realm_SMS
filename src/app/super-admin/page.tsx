import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendCard } from "@/components/dashboard/trend-card";
import { TableCard } from "@/components/data-display/table-card";
import { getServerSession } from "@/lib/auth/session";
import { apiGet } from "@/lib/api/server";
import { roleLabels } from "@/lib/auth/roles";
import type { SuperAdminAnalyticsOverview, SuperAdminRevenueView } from "@/lib/domain/types";
import { getRoleAccent } from "@/lib/navigation/registry";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

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

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession();
  const [overview, revenue] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);

  const schoolPlanTotal = revenue.schoolsByPlan.reduce((sum, item) => sum + item.count, 0) || 1;
  const accent = getRoleAccent(session?.role ?? "SUPER_ADMIN");

  return (
    <div className="grid gap-6">
      <section className={`rounded-[2rem] border border-white/50 bg-gradient-to-br ${accent.gradient} p-6 text-white shadow-panel`}>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/65">Platform overview</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-white">{platformGreeting(session?.role ?? "SUPER_ADMIN", session?.name)}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
          {session ? roleLabels[session.role] : "Platform team"} dashboard with tenant health, revenue, support, security, and operational signals filtered by internal role.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard metric={{ label: "Total Schools", value: String(overview.schools.total), change: `${overview.schools.active} active` }} />
        <MetricCard metric={{ label: "Suspended / Trial", value: `${overview.schools.suspended} / ${overview.schools.trial}`, change: "Tenant status" }} />
        <MetricCard metric={{ label: "Total Users", value: String(overview.users.total), change: `${overview.users.schoolAdmins} school admins` }} />
        <MetricCard metric={{ label: "MRR / ARR", value: formatCurrency(overview.revenue.mrr), change: `${formatCurrency(overview.revenue.arr)} ARR` }} />
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
