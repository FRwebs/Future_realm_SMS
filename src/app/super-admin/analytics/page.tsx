import { TrendCard } from "@/components/dashboard/trend-card";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminAnalyticsOverview, SuperAdminRevenueView, SuperAdminUsageRow } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";

export default async function SuperAdminAnalyticsPage() {
  const [overview, usage, revenue] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview"),
    apiGet<SuperAdminUsageRow[]>("/api/super-admin/analytics/usage"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Platform intelligence</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Analytics</h1>
      </section>

      <FilterToolbar
        action="/super-admin/analytics"
        controls={[
          { name: "dateFrom", label: "Date from", type: "date" },
          { name: "dateTo", label: "Date to", type: "date" }
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <TrendCard
          title="User growth by role"
          description="Current role split across the platform."
          items={[
            { label: "Parents", value: overview.users.parents },
            { label: "Teachers", value: overview.users.teachers },
            { label: "Students", value: overview.users.students },
            { label: "Admins", value: overview.users.schoolAdmins }
          ]}
        />
        <TrendCard
          title="School growth"
          description="Twelve-month cumulative school growth proxy."
          items={revenue.monthlyRevenue.map((item, index) => ({ label: item.month, value: Math.max(overview.schools.total - 12 + index, 1) }))}
        />
        <TrendCard
          title="Revenue trend"
          description={`MRR now ${formatCurrency(revenue.mrr)}.`}
          items={revenue.monthlyRevenue.map((item) => ({ label: item.month, value: Math.round(item.amount / 1000), suffix: "k" }))}
        />
      </section>

      <TableCard
        title="Top active schools"
        description="Ranked by current audit/login activity and active users."
        items={usage.slice(0, 10)}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "logins", header: "Logins", render: (item) => item.logins },
          { key: "users", header: "Active Users", render: (item) => item.activeUsers },
          { key: "modules", header: "Modules Used", render: (item) => item.modulesUsed.join(", ") || "-" }
        ]}
      />
    </div>
  );
}
