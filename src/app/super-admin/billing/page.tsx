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

const TRIAL_DAYS = 14;

const planOptions = [
  { label: "Basic", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Professional", value: "PROFESSIONAL" },
  { label: "Custom", value: "CUSTOM" },
  { label: "Enterprise", value: "ENTERPRISE" }
];

const invoiceStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Draft" },
  ISSUED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Issued" },
  PARTIALLY_PAID: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partially Paid" },
  PAID: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Paid" },
  OVERDUE: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Overdue" },
  VOID: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Cancelled" }
};

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function InvoiceStatusPill({ status }: { status: string }) {
  const tone = invoiceStatusTone[status] ?? invoiceStatusTone.DRAFT;
  return <StatusPill bg={tone.bg} fg={tone.fg} label={tone.label} />;
}

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
  const trialBilling = billing.filter((item) => item.tenantStatus === "TRIAL");
  const arpu = revenue.totalPaidSchools > 0 ? revenue.mrr / revenue.totalPaidSchools : 0;

  const tabs = [
    { label: "Subscription Dashboard", href: tabHref("overview"), active: tab === "overview" },
    { label: "Invoices", href: tabHref("invoices"), active: tab === "invoices" },
    { label: "Trials", href: tabHref("trials"), active: tab === "trials", badge: trialBilling.length },
    { label: "Churn Risk", href: tabHref("churn"), active: tab === "churn" },
    { label: "Credit Wallets", href: tabHref("credits"), active: tab === "credits" },
    { label: "Promo Codes", href: tabHref("promo"), active: tab === "promo" },
    { label: "Revenue Reporting", href: tabHref("report"), active: tab === "report" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Subscriptions</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Billing</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Subscription tiers, invoice lifecycle, churn risk, notification credit wallets, and promo campaigns.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <>
          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard metric={{ label: "MRR", value: formatCurrency(revenue.mrr), change: "Monthly recurring revenue" }} />
            <MetricCard metric={{ label: "ARR", value: formatCurrency(revenue.arr), change: "Annualized revenue" }} />
            <MetricCard metric={{ label: "ARPU", value: formatCurrency(arpu), change: "Per paying school" }} />
            <MetricCard metric={{ label: "Paid Schools", value: String(revenue.totalPaidSchools), change: "Active billing" }} />
            <MetricCard metric={{ label: "Trial Schools", value: String(trialBilling.length), change: "Trial billing" }} />
          </section>

          <TableCard
            title="School billing"
            description="Subscription status by tenant."
            items={billing}
            columns={[
              { key: "school", header: "School", render: (item) => item.schoolName },
              { key: "plan", header: "Plan", render: (item) => item.plan },
              { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
              { key: "last", header: "Last Payment", render: (item) => item.lastPaymentAt ? formatDate(item.lastPaymentAt) : "—" },
              { key: "next", header: "Next Due", render: (item) => item.nextDueAt ? formatDate(item.nextDueAt) : "—" },
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

      {tab === "invoices" ? <InvoicesTab billing={billing} /> : null}
      {tab === "trials" ? <TrialsTab trialBilling={trialBilling} /> : null}
      {tab === "churn" ? <ChurnRiskTab /> : null}
      {tab === "credits" ? <NotificationCreditsTab billing={billing} /> : null}
      {tab === "promo" ? <PromoCodesTab billing={billing} /> : null}
      {tab === "report" ? <RevenueReportTab revenue={revenue} /> : null}
    </div>
  );
}

async function InvoicesTab({ billing }: { billing: SuperAdminBillingRow[] }) {
  const envelope = await apiGetEnvelope<SuperAdminInvoiceRow[]>("/api/super-admin/billing/invoices");
  const invoices = envelope.data ?? [];
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));

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
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
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
        { key: "status", header: "Status", render: (item) => <InvoiceStatusPill status={item.status} /> },
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
              {item.status !== "VOID" && item.status !== "PAID" ? (
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
              {item.status !== "VOID" && item.status !== "PAID" ? (
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

function TrialsTab({ trialBilling }: { trialBilling: SuperAdminBillingRow[] }) {
  const now = Date.now();

  const trials = trialBilling
    .map((item) => {
      const endsAt = item.trialEndsAt ? new Date(item.trialEndsAt).getTime() : null;
      const msRemaining = endsAt ? endsAt - now : null;
      const daysRemaining = msRemaining !== null ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24))) : null;
      const daysElapsed = daysRemaining !== null ? Math.min(TRIAL_DAYS, TRIAL_DAYS - daysRemaining) : null;
      const pct = daysElapsed !== null ? Math.round((daysElapsed / TRIAL_DAYS) * 100) : 0;
      return { ...item, daysRemaining, pct };
    })
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Trial pipeline</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
          Schools on a {TRIAL_DAYS}-day trial
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every school starts on an automatic {TRIAL_DAYS}-day trial at signup. Sorted by soonest to expire.
        </p>
      </section>

      {trials.length === 0 ? (
        <section className="surface-card p-6">
          <div className="empty-state">
            <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">No schools currently on trial</p>
            <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">
              Trial schools will appear here as they self-onboard.
            </p>
          </div>
        </section>
      ) : (
        <div className="grid gap-3">
          {trials.map((trial) => {
            const urgent = trial.daysRemaining !== null && trial.daysRemaining <= 2;
            const soon = trial.daysRemaining !== null && trial.daysRemaining <= 5;
            const barColor = urgent ? "var(--color-danger)" : soon ? "var(--color-warning)" : "var(--color-accent-primary)";
            return (
              <article key={trial.schoolId} className="surface-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{trial.schoolName}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{trial.plan} tier</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trial.daysRemaining !== null ? (
                      <StatusPill
                        bg={urgent ? "var(--color-danger-dim)" : soon ? "var(--color-warning-dim)" : "var(--color-accent-primary-dim)"}
                        fg={urgent ? "var(--color-danger)" : soon ? "var(--color-warning)" : "var(--color-text-accent)"}
                        label={trial.daysRemaining === 0 ? "Expires today" : `${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"} left`}
                      />
                    ) : null}
                    <ResourceActionDialog
                      triggerLabel="Extend"
                      title={`Extend trial for ${trial.schoolName}`}
                      description="Add trial days and move billing due date forward."
                      endpoint={`/api/super-admin/billing/${trial.schoolId}/extend-trial`}
                      method="POST"
                      variant="secondary"
                      submitLabel="Extend trial"
                      fields={[{ name: "days", label: "Days", type: "number", defaultValue: 14, min: 1, max: 365 }]}
                    />
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${trial.pct}%`, background: barColor }} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

async function ChurnRiskTab() {
  const envelope = await apiGetEnvelope<SuperAdminChurnRiskRow[]>("/api/super-admin/billing/churn");
  const schools = envelope.data ?? [];

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-eyebrow">Churn risk scoring</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Retention risk</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
          {
            key: "score",
            header: "Score",
            render: (item) => (
              <span className="font-[var(--font-mono)] font-bold" style={{ color: item.score < 50 ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                {item.score}
              </span>
            )
          },
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
        {
          key: "low",
          header: "Status",
          render: (item) =>
            item.isLow ? (
              <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Low balance" />
            ) : (
              <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Healthy" />
            )
        },
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

async function PromoCodesTab({ billing }: { billing: SuperAdminBillingRow[] }) {
  const [codesEnvelope, reportEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminPromoCodeRow[]>("/api/super-admin/billing/promo-codes"),
    apiGetEnvelope<Array<{ campaignName: string; totalRedemptions: number; totalDiscountIssued: number; schoolsConverted: number }>>("/api/super-admin/billing/promo-codes/report")
  ]);
  const codes = codesEnvelope.data ?? [];
  const campaigns = reportEnvelope.data ?? [];
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));

  return (
    <section className="grid gap-5">
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
          { key: "code", header: "Code", render: (item) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{item.code}</span> },
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
                  { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
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

async function RevenueReportTab({ revenue }: { revenue: SuperAdminRevenueView }) {
  const report = await apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report");
  const subscriberCounts = new Map<string, number>(revenue.schoolsByPlan.map((item) => [item.plan, item.count]));
  const maxTierRevenue = Math.max(...report.revenueByTier.map((item) => item.revenue), 1);

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard metric={{ label: "Outstanding receivables", value: formatCurrency(report.outstandingReceivables), change: "Unpaid invoices" }} />
        <MetricCard metric={{ label: "Renewal rate (90d)", value: `${report.renewalRate}%`, change: "Schools with recent payment" }} />
        <MetricCard metric={{ label: "Notification credit revenue", value: formatCurrency(report.notificationCreditRevenue), change: "Separate from subscriptions" }} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Tier split</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Revenue by tier</h3>
          <div className="mt-4 grid gap-3">
            {report.revenueByTier.map((item) => (
              <div key={item.plan}>
                <div className="flex items-center justify-between text-[13px] font-semibold text-[var(--color-text-primary)]">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-[3px] bg-[var(--color-accent-primary)]" />
                    {item.plan}
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{subscriberCounts.get(item.plan) ?? 0} subs</span>
                  </span>
                  <span className="font-[var(--font-mono)]">{formatCurrency(item.revenue)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${(item.revenue / maxTierRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="surface-card p-6">
          <p className="section-eyebrow">Projected value</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">LTV by tier</h3>
          <div className="mt-4 grid gap-2">
            {report.ltvByTier.map((item) => (
              <div key={item.plan} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.plan}</span>
                <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{formatCurrency(item.ltv)}</span>
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
