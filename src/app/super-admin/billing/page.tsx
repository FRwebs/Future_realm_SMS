import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminBillingRow, SuperAdminRevenueView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const planOptions = [
  { label: "Basic", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Professional", value: "PROFESSIONAL" },
  { label: "Custom", value: "CUSTOM" },
  { label: "Enterprise", value: "ENTERPRISE" }
];

export default async function SuperAdminBillingPage() {
  const [billingEnvelope, revenue] = await Promise.all([
    apiGetEnvelope<SuperAdminBillingRow[]>("/api/super-admin/billing"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);
  const billing = billingEnvelope.data ?? [];
  const trialSchools = billing.filter((item) => item.status === "TRIAL").length;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Subscriptions</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Billing</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard metric={{ label: "MRR", value: formatCurrency(revenue.mrr), change: "Monthly recurring revenue" }} />
        <MetricCard metric={{ label: "ARR", value: formatCurrency(revenue.arr), change: "Annualized revenue" }} />
        <MetricCard metric={{ label: "Paid Schools", value: String(revenue.totalPaidSchools), change: "Active billing" }} />
        <MetricCard metric={{ label: "Trial Schools", value: String(trialSchools), change: "Trial billing" }} />
      </section>

      <TableCard
        title="School billing"
        description="Subscription status by tenant."
        items={billing}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "plan", header: "Plan", render: (item) => item.plan },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "last", header: "Last Payment", render: (item) => item.lastPaymentAt ? formatDate(item.lastPaymentAt) : "-" },
          { key: "next", header: "Next Due", render: (item) => item.nextDueAt ? formatDate(item.nextDueAt) : "-" },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <div className="flex flex-wrap gap-2">
                <ResourceActionDialog
                  triggerLabel="Change Plan"
                  title={`Change plan for ${item.schoolName}`}
                  description="Update this school's subscription plan."
                  endpoint={`/api/super-admin/billing/${item.schoolId}`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Save plan"
                  fields={[{ name: "plan", label: "Plan", type: "select", options: planOptions, defaultValue: item.plan }]}
                />
                <ResourceActionDialog
                  triggerLabel="Extend Trial"
                  title={`Extend trial for ${item.schoolName}`}
                  description="Add trial days and move billing due date forward."
                  endpoint={`/api/super-admin/billing/${item.schoolId}/extend-trial`}
                  method="POST"
                  variant="secondary"
                  submitLabel="Extend trial"
                  fields={[{ name: "days", label: "Days", type: "number", defaultValue: 14, min: 1, max: 365 }]}
                />
                <ResourceActionDialog
                  triggerLabel="Suspend Billing"
                  title={`Suspend billing for ${item.schoolName}`}
                  description="Marks billing as overdue and restricts school access."
                  endpoint={`/api/super-admin/billing/${item.schoolId}/suspend-billing`}
                  method="PATCH"
                  variant="danger"
                  submitLabel="Suspend billing"
                  confirmLabel="Confirm Suspend"
                  fields={[]}
                />
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
