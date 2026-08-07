import { MetricCard } from "@/components/dashboard/metric-card";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBillingRow,
  SuperAdminChurnRiskRow,
  SuperAdminInvoiceRow,
  SuperAdminNotificationWallet,
  SuperAdminPromoCodeRow,
  SuperAdminRevenueReport,
  SuperAdminRevenueView
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const planOptions = [
  { label: "Basic", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Professional", value: "PROFESSIONAL" },
  { label: "Custom", value: "CUSTOM" },
  { label: "Enterprise", value: "ENTERPRISE" }
];

function tabHref(tab: string) {
  return tab === "overview" ? "/super-admin/billing" : `/super-admin/billing?tab=${tab}`;
}

export default async function SuperAdminBillingPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "overview" } = searchParams ? await searchParams : {};

  const [billingEnvelope, revenue] = await Promise.all([
    apiGetEnvelope<SuperAdminBillingRow[]>("/api/super-admin/billing"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue")
  ]);
  const billing = billingEnvelope.data ?? [];
  const trialSchools = billing.filter((item) => item.status === "TRIAL").length;

  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: tab === "overview" },
    { label: "Invoices", href: tabHref("invoices"), active: tab === "invoices" },
    { label: "Churn Risk", href: tabHref("churn"), active: tab === "churn" },
    { label: "Notification Credits", href: tabHref("credits"), active: tab === "credits" },
    { label: "Promo Codes", href: tabHref("promo"), active: tab === "promo" },
    { label: "Revenue Report", href: tabHref("report"), active: tab === "report" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Subscriptions</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Billing</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink/60">Subscription tiers, invoice lifecycle, churn risk, notification credit wallets, and promo campaigns.</p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <>
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
                  <ActionMenu triggerLabel={`Billing actions for ${item.schoolName}`}>
                    <ResourceActionDialog
                      triggerLabel="Change Plan"
                      title={`Change plan for ${item.schoolName}`}
                      description="Update this school's subscription plan."
                      endpoint={`/api/super-admin/billing/${item.schoolId}`}
                      method="PATCH"
                      variant="menu"
                      submitLabel="Save plan"
                      fields={[{ name: "plan", label: "Plan", type: "select", options: planOptions, defaultValue: item.plan }]}
                    />
                    <ResourceActionDialog
                      triggerLabel="Extend Trial"
                      title={`Extend trial for ${item.schoolName}`}
                      description="Add trial days and move billing due date forward."
                      endpoint={`/api/super-admin/billing/${item.schoolId}/extend-trial`}
                      method="POST"
                      variant="menu"
                      submitLabel="Extend trial"
                      fields={[{ name: "days", label: "Days", type: "number", defaultValue: 14, min: 1, max: 365 }]}
                    />
                    <ResourceActionDialog
                      triggerLabel="Suspend Billing"
                      title={`Suspend billing for ${item.schoolName}`}
                      description="Marks billing as overdue and restricts school access."
                      endpoint={`/api/super-admin/billing/${item.schoolId}/suspend-billing`}
                      method="PATCH"
                      variant="menuDanger"
                      submitLabel="Suspend billing"
                      confirmLabel="Confirm Suspend"
                      fields={[]}
                    />
                  </ActionMenu>
                )
              }
            ]}
          />
        </>
      ) : null}

      {tab === "invoices" ? <InvoicesTab /> : null}
      {tab === "churn" ? <ChurnRiskTab /> : null}
      {tab === "credits" ? <NotificationCreditsTab billing={billing} /> : null}
      {tab === "promo" ? <PromoCodesTab /> : null}
      {tab === "report" ? <RevenueReportTab /> : null}
    </div>
  );
}

async function InvoicesTab() {
  const envelope = await apiGetEnvelope<SuperAdminInvoiceRow[]>("/api/super-admin/billing/invoices");
  const invoices = envelope.data ?? [];

  return (
    <TableCard
      title="Invoices"
      description="Every invoice tracked from draft through payment or cancellation. No invoice is sent without admin review."
      items={invoices}
      actions={
        <ResourceActionDialog
          triggerLabel="Draft invoice"
          title="Draft a new invoice"
          description="Create a draft invoice for a school. It will not be sent until you review and send it."
          endpoint="/api/super-admin/billing/invoices"
          method="POST"
          submitLabel="Create draft"
          fields={[
            { name: "schoolId", label: "School ID", required: true },
            { name: "amount", label: "Amount (NGN)", type: "number", required: true },
            { name: "taxAmount", label: "Tax amount (NGN)", type: "number", defaultValue: 0 },
            { name: "dueAt", label: "Due date", type: "date", required: true },
            { name: "note", label: "Internal note", type: "textarea" }
          ]}
        />
      }
      columns={[
        { key: "invoiceNo", header: "Invoice", render: (item) => item.invoiceNo },
        { key: "school", header: "School", render: (item) => item.schoolName },
        { key: "amount", header: "Total", render: (item) => formatCurrency(item.totalAmount) },
        { key: "paid", header: "Paid", render: (item) => formatCurrency(item.amountPaid) },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
        { key: "due", header: "Due", render: (item) => formatDate(item.dueAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Invoice actions for ${item.invoiceNo}`}>
              {item.status === "DRAFT" ? (
                <ResourceActionDialog
                  triggerLabel="Send to school"
                  title={`Send invoice ${item.invoiceNo}`}
                  description="Deliver this invoice to the school's owner email."
                  endpoint={`/api/super-admin/billing/invoices/${item.id}/send`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Send invoice"
                  confirmLabel="Confirm"
                  confirmMessage="This delivers the invoice to the school."
                  fields={[]}
                />
              ) : null}
              {item.status !== "CANCELLED" && item.status !== "PAID" ? (
                <ResourceActionDialog
                  triggerLabel="Record payment"
                  title={`Record payment for ${item.invoiceNo}`}
                  description="Manually record a payment received via transfer, POS, or cash."
                  endpoint={`/api/super-admin/billing/invoices/${item.id}/payments`}
                  method="POST"
                  variant="menu"
                  submitLabel="Record payment"
                  fields={[
                    { name: "amount", label: "Amount received (NGN)", type: "number", required: true },
                    { name: "method", label: "Method", type: "select", options: [{ label: "Bank Transfer", value: "BANK_TRANSFER" }, { label: "POS", value: "POS" }, { label: "Cash", value: "CASH" }] },
                    { name: "reference", label: "Bank reference / receipt no.", required: true },
                    { name: "paidOn", label: "Payment date", type: "date" }
                  ]}
                />
              ) : null}
              {item.status !== "CANCELLED" && item.status !== "PAID" ? (
                <ResourceActionDialog
                  triggerLabel="Cancel invoice"
                  title={`Cancel invoice ${item.invoiceNo}`}
                  description="Void this invoice with a logged reason."
                  endpoint={`/api/super-admin/billing/invoices/${item.id}/cancel`}
                  method="PATCH"
                  variant="menuDanger"
                  submitLabel="Cancel invoice"
                  confirmLabel="Confirm"
                  confirmMessage="This voids the invoice permanently."
                  fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
                />
              ) : null}
            </ActionMenu>
          )
        }
      ]}
      emptyState="No invoices drafted yet."
    />
  );
}

async function ChurnRiskTab() {
  const envelope = await apiGetEnvelope<SuperAdminChurnRiskRow[]>("/api/super-admin/billing/churn");
  const schools = envelope.data ?? [];

  return (
    <section className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Churn risk scoring</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/60">
              Daily behavioural signal scoring (login recency, result/fee activity, trial engagement, support health). Schools with a score below 50 are flagged as high risk.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Recalculate now"
            title="Recalculate churn risk"
            description="Recompute the churn risk score for every active, trial, and grace-period school."
            endpoint="/api/super-admin/billing/churn/recalculate"
            method="POST"
            submitLabel="Recalculate"
            fields={[]}
          />
        </div>
      </section>
      <TableCard
        title="Schools by churn risk"
        description="Lowest scores (highest risk) first."
        items={schools}
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "score", header: "Score", render: (item) => <span className={item.score < 50 ? "font-black text-rose-700" : "font-semibold text-ink"}>{item.score}</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "plan", header: "Plan", render: (item) => item.plan },
          { key: "signals", header: "Signals", render: (item) => item.signals.length ? item.signals.join("; ") : "No risk signals" },
          { key: "calculated", header: "Last calculated", render: (item) => (item.lastCalculatedAt ? formatDate(item.lastCalculatedAt) : "Never") }
        ]}
        emptyState="No churn scores calculated yet. Click Recalculate now."
      />
    </section>
  );
}

async function NotificationCreditsTab({ billing }: { billing: SuperAdminBillingRow[] }) {
  const wallets = await Promise.all(
    billing.slice(0, 25).map(async (item) => {
      const wallet = await apiGet<SuperAdminNotificationWallet>(`/api/super-admin/billing/${item.schoolId}/wallet`);
      return { ...wallet, schoolName: item.schoolName };
    })
  );

  return (
    <TableCard
      title="Notification credit wallets"
      description="SMS and WhatsApp credit balances. Top up manually after confirming a school's bundle payment."
      items={wallets}
      columns={[
        { key: "school", header: "School", render: (item) => item.schoolName },
        { key: "sms", header: "SMS balance", render: (item) => item.smsBalance },
        { key: "whatsapp", header: "WhatsApp balance", render: (item) => item.whatsappBalance },
        { key: "low", header: "Status", render: (item) => (item.isLow ? <span className="font-bold text-rose-700">Low balance</span> : <span className="text-emerald-700">Healthy</span>) },
        { key: "topped", header: "Last topped up", render: (item) => (item.lastToppedUpAt ? formatDate(item.lastToppedUpAt) : "Never") },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ResourceActionDialog
              triggerLabel="Top up"
              title={`Top up credits — ${item.schoolName}`}
              description="Add SMS and/or WhatsApp credits after confirming the school's bundle payment."
              endpoint={`/api/super-admin/billing/${item.schoolId}/wallet/top-up`}
              method="POST"
              variant="secondary"
              submitLabel="Top up"
              fields={[
                { name: "smsCredits", label: "SMS credits to add", type: "number", defaultValue: 0 },
                { name: "whatsappCredits", label: "WhatsApp credits to add", type: "number", defaultValue: 0 }
              ]}
            />
          )
        }
      ]}
      emptyState="No schools to display."
    />
  );
}

async function PromoCodesTab() {
  const [codesEnvelope, reportEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminPromoCodeRow[]>("/api/super-admin/billing/promo-codes"),
    apiGetEnvelope<Array<{ campaignName: string; totalRedemptions: number; totalDiscountIssued: number; schoolsConverted: number }>>("/api/super-admin/billing/promo-codes/report")
  ]);
  const codes = codesEnvelope.data ?? [];
  const campaigns = reportEnvelope.data ?? [];

  return (
    <section className="grid gap-6">
      <TableCard
        title="Promo codes"
        description="Discount codes and their redemption performance."
        items={codes}
        actions={
          <ResourceActionDialog
            triggerLabel="Create promo code"
            title="Create promo code"
            description="Codes can be applied manually to a school's invoice."
            endpoint="/api/super-admin/billing/promo-codes"
            method="POST"
            submitLabel="Create code"
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "e.g. LAUNCH2026" },
              { name: "type", label: "Discount type", type: "select", options: [{ label: "Percentage", value: "PERCENTAGE" }, { label: "Fixed amount (NGN)", value: "FIXED" }] },
              { name: "value", label: "Value", type: "number", required: true },
              { name: "campaignName", label: "Campaign name" },
              { name: "maxUses", label: "Max redemptions" },
              { name: "expiresAt", label: "Expiry date", type: "date" }
            ]}
          />
        }
        columns={[
          { key: "code", header: "Code", render: (item) => item.code },
          { key: "campaign", header: "Campaign", render: (item) => item.campaignName ?? "Uncategorized" },
          { key: "value", header: "Value", render: (item) => (item.type === "PERCENTAGE" ? `${item.value}%` : formatCurrency(item.value)) },
          { key: "uses", header: "Redemptions", render: (item) => `${item.uses}${item.maxUses ? ` / ${item.maxUses}` : ""}` },
          { key: "discount", header: "Total discount issued", render: (item) => formatCurrency(item.totalDiscountIssued) },
          { key: "converted", header: "Schools converted", render: (item) => item.schoolsConverted },
          {
            key: "actions",
            header: "Apply",
            render: (item) => (
              <ResourceActionDialog
                triggerLabel="Apply to school"
                title={`Apply ${item.code} to a school`}
                description="Applies this promo code's discount to a school's account."
                endpoint="/api/super-admin/billing/promo-codes/apply"
                method="POST"
                variant="secondary"
                submitLabel="Apply code"
                fields={[
                  { name: "code", label: "Code", defaultValue: item.code },
                  { name: "schoolId", label: "School ID", required: true },
                  { name: "reason", label: "Reason", type: "textarea", required: true }
                ]}
              />
            )
          }
        ]}
        emptyState="No promo codes created yet."
      />

      <TableCard
        title="Campaign performance"
        description="Redemptions and discount issued, grouped by campaign."
        items={campaigns}
        columns={[
          { key: "campaign", header: "Campaign", render: (item) => item.campaignName },
          { key: "redemptions", header: "Total redemptions", render: (item) => item.totalRedemptions },
          { key: "discount", header: "Total discount issued", render: (item) => formatCurrency(item.totalDiscountIssued) },
          { key: "converted", header: "Schools converted", render: (item) => item.schoolsConverted }
        ]}
        emptyState="No campaign activity yet."
      />
    </section>
  );
}

async function RevenueReportTab() {
  const report = await apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report");

  return (
    <section className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard metric={{ label: "Outstanding receivables", value: formatCurrency(report.outstandingReceivables), change: "Unpaid invoices" }} />
        <MetricCard metric={{ label: "Renewal rate (90d)", value: `${report.renewalRate}%`, change: "Schools with recent payment" }} />
        <MetricCard metric={{ label: "Notification credit revenue", value: formatCurrency(report.notificationCreditRevenue), change: "Separate from subscriptions" }} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-xl font-bold text-ink">Revenue by tier</h3>
          <div className="mt-4 grid gap-2">
            {report.revenueByTier.map((item) => (
              <div key={item.plan} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{item.plan}</span>
                <span className="font-[var(--font-mono)] text-sm font-black text-ink">{formatCurrency(item.revenue)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-xl font-bold text-ink">Projected LTV by tier</h3>
          <div className="mt-4 grid gap-2">
            {report.ltvByTier.map((item) => (
              <div key={item.plan} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{item.plan}</span>
                <span className="font-[var(--font-mono)] text-sm font-black text-ink">{formatCurrency(item.ltv)}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <TableCard
        title="Revenue by state"
        description="Where the platform's schools and revenue are concentrated."
        items={report.revenueByState}
        columns={[
          { key: "state", header: "State", render: (item) => item.state },
          { key: "schools", header: "Schools", render: (item) => item.schoolCount },
          { key: "revenue", header: "Monthly revenue", render: (item) => formatCurrency(item.revenue) }
        ]}
        emptyState="No school location data yet."
      />
    </section>
  );
}
