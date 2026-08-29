import { AlertTriangle, BadgePercent, CalendarCheck2, CreditCard, Gift, Repeat2, TicketPercent, TrendingUp, UsersRound } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PlanEditDialog } from "@/components/super-admin/plan-action-dialogs";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBillingRow,
  SuperAdminChurnRiskRow,
  SuperAdminInvoiceRow,
  SuperAdminNotificationWallet,
  SuperAdminPlanRow,
  SuperAdminPromoCodeRow,
  SuperAdminRevenueReport,
  SuperAdminRevenueView
} from "@/lib/domain/types";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/utils/formatters";

const TRIAL_DAYS = 30;

const planOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Trial", value: "PROFESSIONAL" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];

const invoiceStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Draft" },
  ISSUED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Issued" },
  PARTIALLY_PAID: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partially Paid" },
  PAID: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Paid" },
  OVERDUE: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Overdue" },
  VOID: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Cancelled" }
};

const invoiceStatusReference = [
  { status: "Draft", meaning: "Created but not yet visible to the school. Safe to edit or discard." },
  { status: "Issued", meaning: "Sent to the school's owner email. Awaiting payment." },
  { status: "Partially Paid", meaning: "A payment was recorded but the balance is not yet cleared." },
  { status: "Paid", meaning: "Balance is fully cleared. Billing status moves to Active." },
  { status: "Overdue", meaning: "Past the due date with an outstanding balance. Triggers a churn-risk signal." },
  { status: "Cancelled", meaning: "Voided with a logged reason. No longer collectible." }
];

const churnSignalReference = [
  { signal: "No admin or teacher login in 10+ days", weight: -25, threshold: "10 days since last login" },
  { signal: "No result or score entry in 14+ days", weight: -25, threshold: "14 days since last score entry" },
  { signal: "No fee recording activity in 14+ days", weight: -15, threshold: "14 days since last recorded payment" },
  { signal: "Trial nearing expiry with low engagement", weight: -25, threshold: "Trial ends within 7 days and no login in 7+ days" },
  { signal: "Critical support ticket unresolved 5+ days", weight: -15, threshold: "Open CRITICAL ticket older than 5 days" },
  { signal: "No parent notification sent all term", weight: -5, threshold: "Zero notifications sent since term start" }
];

const billingRules = [
  "Billed per student, per term — confirmed against the enrolled headcount at the start of each term.",
  "Trials run 30 days automatically at signup, with every feature unlocked and no card required.",
  "A school moves to Grace Period on the first missed payment, then Suspended if it lapses further.",
  "Notification (SMS/WhatsApp) credit revenue is tracked separately from subscription revenue.",
  "Pricing here is the live rate card used by onboarding, billing, and upgrades."
];

function studentRangeLabel(plan: SuperAdminPlanRow) {
  const slug = plan.slug.toLowerCase();
  if (slug === "starter") return "1-250 students";
  if (slug === "standard") return "251-700 students";
  if (slug === "elite") return "701+ students";
  if (slug === "ngo-mission" || slug === "trial") return "Any size";
  if (!plan.studentLimit) return "Unlimited students";
  return `Up to ${plan.studentLimit.toLocaleString()} students`;
}

function planDisplayRank(plan: SuperAdminPlanRow) {
  const order = ["starter", "standard", "elite", "ngo-mission", "trial"];
  const index = order.indexOf(plan.slug.toLowerCase());
  return index === -1 ? 99 : index;
}

function planPriceLabel(plan: SuperAdminPlanRow) {
  const slug = plan.slug.toLowerCase();
  if (slug === "trial") return "Free";
  if (slug === "ngo-mission") return "90% off tier";
  return formatCurrency(plan.monthlyPrice);
}

function planUsd(plan: SuperAdminPlanRow) {
  const usdLabels: Record<string, string> = {
    starter: "$0.90",
    standard: "$2.20",
    elite: "$3.45",
    "ngo-mission": "90% off",
    trial: "Free"
  };
  return usdLabels[plan.slug.toLowerCase()] ?? `≈ $${Math.round(plan.monthlyPrice / 1540).toLocaleString()}`;
}

function planEntitlements(value: unknown) {
  if (Array.isArray(value)) return { modules: value.map(String), features: [] };
  if (typeof value === "string") return { modules: value.split(",").map((item) => item.trim()).filter(Boolean), features: [] };
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      modules: Array.isArray(record.modules) ? record.modules.map(String) : [],
      features: Array.isArray(record.features) ? record.features.map(String) : []
    };
  }
  return { modules: [], features: [] };
}

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

export default async function SuperAdminBillingPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "overview";

  const [billingEnvelope, revenue, plansEnvelope, report, invoicesEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminBillingRow[]>("/api/super-admin/billing"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue"),
    apiGetEnvelope<SuperAdminPlanRow[]>("/api/super-admin/plans"),
    apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report"),
    apiGetEnvelope<SuperAdminInvoiceRow[]>("/api/super-admin/billing/invoices")
  ]);
  const billing = billingEnvelope.data ?? [];
  const trialBilling = billing.filter((item) => item.tenantStatus === "TRIAL");
  const arpu = revenue.totalPaidSchools > 0 ? revenue.mrr / revenue.totalPaidSchools : 0;
  const activePlans = (plansEnvelope.data ?? []).filter((item) => item.isActive).sort((a, b) => planDisplayRank(a) - planDisplayRank(b) || a.monthlyPrice - b.monthlyPrice);
  const planByTier = new Map(activePlans.map((item) => [item.plan, item]));
  const schoolsWithRevenue = revenue.schoolsByPlan.filter((item) => item.count > 0);
  const maxTierMrr = Math.max(...revenue.schoolsByPlan.map((row) => (planByTier.get(row.plan)?.monthlyPrice ?? 0) * row.count), 1);
  const churnRatePct = Math.round((100 - report.renewalRate) * 10) / 10;
  const notRenewedCount = Math.max(0, report.activeSchoolCount - report.renewedRecently);
  const allInvoices = invoicesEnvelope.data ?? [];
  const outstandingInvoiceCount = allInvoices.filter((item) => item.status === "ISSUED" || item.status === "PARTIALLY_PAID" || item.status === "OVERDUE").length;

  const validTabs = new Set(["overview", "invoices", "trials", "wallets", "pricing"]);
  const activeTab = validTabs.has(tab) ? tab : "overview";

  const tabs = [
    { label: "Overview", href: tabHref("overview"), active: activeTab === "overview" },
    { label: "Invoices", href: tabHref("invoices"), active: activeTab === "invoices", badge: outstandingInvoiceCount },
    { label: "Trials", href: tabHref("trials"), active: activeTab === "trials", badge: trialBilling.length },
    { label: "Wallets", href: tabHref("wallets"), active: activeTab === "wallets" },
    { label: "Pricing & Promotions", href: tabHref("pricing"), active: activeTab === "pricing" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Subscriptions"
        title="Billing"
        description="Subscription tiers, invoice lifecycle, churn risk, notification credit wallets, and promo campaigns."
      />

      <DetailTabs tabs={tabs} />

      {activeTab === "overview" ? (
        <>
          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Semester revenue"
              value={formatCompactCurrency(revenue.mrr)}
              detail={`Current semester recurring revenue. Full value: ${formatCurrency(revenue.mrr)}.`}
              icon={Repeat2}
              tone="accent"
            />
            <StatCard
              label="Year estimate"
              value={formatCompactCurrency(revenue.arr)}
              detail={`Estimated from semester billing. Full value: ${formatCurrency(revenue.arr)}.`}
              icon={TrendingUp}
              tone="success"
            />
            <StatCard
              label="ARPU"
              value={formatCompactCurrency(arpu)}
              detail={`Average per paying school across ${revenue.totalPaidSchools} paid tenant${revenue.totalPaidSchools === 1 ? "" : "s"}.`}
              icon={UsersRound}
              tone="info"
            />
            <StatCard
              label="Churn rate"
              value={`${churnRatePct}%`}
              detail={`${notRenewedCount} of ${report.activeSchoolCount} active schools did not renew last term.`}
              icon={AlertTriangle}
              tone="warning"
            />
            <StatCard
              label="Renewal pipeline"
              value={formatCompactCurrency(report.mrr)}
              detail={`Projected next-term renewal value from ${report.activeSchoolCount} active schools.`}
              icon={CalendarCheck2}
              tone="success"
            />
            <StatCard
              label="Credit revenue"
              value={formatCompactCurrency(report.notificationCreditRevenue)}
              detail={`${report.creditRevenueSharePct}% of platform revenue from notification credit bundles.`}
              icon={CreditCard}
              tone="accent"
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <section className="surface-card overflow-hidden">
              <div className="border-b border-[var(--color-border-default)] px-5 py-4">
                <p className="section-eyebrow">Revenue composition</p>
                <h2 className="mt-1 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Semester revenue by active tier</h2>
              </div>
              <div className="grid gap-4 p-5">
                {schoolsWithRevenue.length === 0 ? (
                  <p className="rounded-[12px] border border-dashed border-[var(--color-border-default)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
                    No active paid subscriptions yet.
                  </p>
                ) : (
                  schoolsWithRevenue.map((item) => {
                    const price = planByTier.get(item.plan)?.monthlyPrice ?? 0;
                    const tierMrr = price * item.count;
                    return (
                      <div key={item.plan} className="grid gap-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[13px] font-bold text-[var(--color-text-primary)]">{item.plan}</p>
                            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                              {item.count} subscription{item.count === 1 ? "" : "s"} at {formatCurrency(price)}
                            </p>
                          </div>
                          <p className="font-[var(--font-mono)] text-[14px] font-bold text-[var(--color-text-primary)]">{formatCurrency(tierMrr)}</p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                          <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${Math.max(6, (tierMrr / maxTierMrr) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-5 py-4">
                <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">Billing rules</p>
                <div className="mt-2 grid gap-2">
                  {billingRules.map((rule) => (
                    <p key={rule} className="text-[12px] leading-5 text-[var(--color-text-secondary)]">{rule}</p>
                  ))}
                </div>
              </div>
            </section>

            <section className="surface-card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="section-eyebrow">Collections</p>
                  <h2 className="mt-1 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Receivables &amp; renewals</h2>
                </div>
                <a href={tabHref("pricing")} className="text-[12.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
                  View rate card
                </a>
              </div>
              <div className="grid gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12.5px] text-[var(--color-text-secondary)]">Outstanding receivables</p>
                  <p className="font-[var(--font-mono)] text-[15px] font-bold" style={{ color: "var(--color-warning)" }}>
                    {formatCurrency(report.outstandingReceivables)}
                  </p>
                </div>
                <p className="-mt-2 text-[11.5px] text-[var(--color-text-muted)]">
                  {report.unpaidSchoolCount} school{report.unpaidSchoolCount === 1 ? "" : "s"} with an open balance.
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-4">
                  <p className="text-[12.5px] text-[var(--color-text-secondary)]">Renewal rate</p>
                  <p className="font-[var(--font-mono)] text-[15px] font-bold text-[var(--color-text-primary)]">{report.renewalRate}%</p>
                </div>
                <p className="-mt-2 text-[11.5px] text-[var(--color-text-muted)]">
                  {report.renewedRecently} of {report.activeSchoolCount} active schools renewed in the last 90 days.
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-4">
                  <p className="text-[12.5px] text-[var(--color-text-secondary)]">Notification credit revenue</p>
                  <p className="font-[var(--font-mono)] text-[15px] font-bold text-[var(--color-text-primary)]">{formatCompactCurrency(report.notificationCreditRevenue)}</p>
                </div>
                <p className="-mt-2 text-[11.5px] text-[var(--color-text-muted)]">{report.creditRevenueSharePct}% of platform revenue, kept separate from subscriptions.</p>
              </div>
            </section>
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

          <div className="grid gap-1.5">
            <p className="section-eyebrow">Retention</p>
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Churn risk</h2>
          </div>
          <ChurnRiskTab />

          <div className="grid gap-1.5">
            <p className="section-eyebrow">Reporting</p>
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Revenue reporting</h2>
          </div>
          <RevenueReportTab revenue={revenue} report={report} />
        </>
      ) : null}

      {activeTab === "invoices" ? <InvoicesTab billing={billing} params={params} allInvoices={allInvoices} /> : null}
      {activeTab === "trials" ? <TrialsTab trialBilling={trialBilling} /> : null}
      {activeTab === "wallets" ? <WalletsTab billing={billing} /> : null}
      {activeTab === "pricing" ? <PricingPromotionsTab billing={billing} activePlans={activePlans} /> : null}
    </div>
  );
}

function InvoicesTab({
  billing,
  params,
  allInvoices
}: {
  billing: SuperAdminBillingRow[];
  params: Record<string, string | undefined>;
  allInvoices: SuperAdminInvoiceRow[];
}) {
  const search = params.invoiceSearch?.trim().toLowerCase();
  const invoices = search
    ? allInvoices.filter((item) => item.invoiceNo.toLowerCase().includes(search) || item.schoolName.toLowerCase().includes(search))
    : allInvoices;
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));

  return (
    <div className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
      <div className="grid gap-3.5">
        <form method="GET" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="invoices" />
          <input
            type="search"
            name="invoiceSearch"
            defaultValue={params.invoiceSearch}
            placeholder="Search by invoice no. or school"
            className="field-control h-10 w-72 rounded-[10px] text-[13px]"
          />
          <button type="submit" className="btn-secondary h-10 text-[12.5px]">Search</button>
          {search ? (
            <a href="/super-admin/billing?tab=invoices" className="text-[12.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
              Clear
            </a>
          ) : null}
        </form>
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
      </div>

      <div className="grid gap-3.5 self-start">
        <section className="surface-card p-5">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Invoice status meanings</p>
          <div className="mt-3.5 grid gap-3">
            {invoiceStatusReference.map((row) => {
              const tone = invoiceStatusTone[row.status.toUpperCase().replace(/\s+/g, "_")] ?? invoiceStatusTone.DRAFT;
              return (
                <div key={row.status} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {row.status}
                  </span>
                  <p className="text-[11.5px] leading-5 text-[var(--color-text-secondary)]">{row.meaning}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
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
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Trial pipeline</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
          Schools on a {TRIAL_DAYS}-day trial
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every school starts on an automatic {TRIAL_DAYS}-day trial at signup. Sorted by soonest to expire.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
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
          <div className="grid gap-3 self-start">
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

        <div className="grid gap-3.5 self-start">
          <section className="surface-card p-5">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Automatic trial alerts</p>
            <div className="mt-3.5 grid gap-3">
              {[
                { title: "Day 7 check-in", detail: "Email nudge to the school owner with setup progress." },
                { title: "Day 11 warning", detail: "In-app banner and email — 3 days remaining." },
                { title: "Day 14 expiry", detail: "Trial ends. School moves to Trial Expired automatically." },
                { title: "High-risk flag", detail: "No login in 5+ days triggers a churn-risk signal." }
              ].map((alert) => (
                <div key={alert.title} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{alert.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{alert.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-[14px] p-5" style={{ background: "var(--color-bg-subtle)", border: "1px solid var(--color-border-default)" }}>
            <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Post-trial behaviour</p>
            <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-text-secondary)]">
              If no conversion, the school moves to <strong>Trial Expired</strong> — read-only for 3 days, then
              locked. All data is preserved and restored instantly on conversion.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

async function ChurnRiskTab() {
  const envelope = await apiGetEnvelope<SuperAdminChurnRiskRow[]>("/api/super-admin/billing/churn");
  const schools = envelope.data ?? [];
  const flaggedSchools = schools.filter((school) => school.score < 50).slice(0, 6);

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

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
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

        <div className="grid gap-3.5 self-start">
          <section className="surface-card p-5">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Churn risk signals</p>
            <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Every school starts at 100. Each signal below subtracts its weight; a final score under 50 is flagged high risk.</p>
            <div className="mt-3.5 grid gap-3">
              {churnSignalReference.map((row) => (
                <div key={row.signal} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[12px] font-semibold leading-5 text-[var(--color-text-primary)]">{row.signal}</p>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
                      {row.weight}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{row.threshold}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Flagged schools</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Weekly digest to Finance &amp; CS</p>
            </div>
            <div className="mt-3.5 grid gap-4">
              {flaggedSchools.length === 0 ? (
                <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">
                  No schools currently below the risk threshold.
                </p>
              ) : (
                flaggedSchools.map((school) => (
                  <div key={school.schoolId}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{school.schoolName}</p>
                      <span className="font-[var(--font-mono)] text-[13px] font-bold" style={{ color: "var(--color-danger)" }}>
                        {school.score}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                      <div className="h-full rounded-full" style={{ width: `${school.score}%`, background: "var(--color-danger)" }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                      {school.signals[0] ?? "No specific signal logged"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

async function WalletsTab({ billing }: { billing: SuperAdminBillingRow[] }) {
  const wallets = await Promise.all(
    billing.slice(0, 25).map(async (item) => {
      const wallet = await apiGet<SuperAdminNotificationWallet>(`/api/super-admin/billing/${item.schoolId}/wallet`);
      return { ...wallet, schoolName: item.schoolName };
    })
  );
  const lowBalanceWallets = wallets.filter((wallet) => wallet.isLow);

  return (
    <div className="grid gap-5">
      {lowBalanceWallets.length > 0 ? (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-5 py-4"
          style={{ background: "var(--color-danger-dim)", border: "1px solid var(--color-danger)" }}
        >
          <div>
            <p className="text-[13px] font-bold" style={{ color: "var(--color-danger)" }}>
              {lowBalanceWallets.length} school{lowBalanceWallets.length === 1 ? "" : "s"} below the low-balance threshold
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
              {lowBalanceWallets.map((wallet) => wallet.schoolName).join(", ")} — SMS or WhatsApp sends will fail once a balance reaches zero.
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
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

        <div className="grid gap-3.5 self-start">
          <section className="surface-card p-5">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">How credits work</p>
            <div className="mt-3.5 grid gap-3">
              {[
                { title: "Bundles are purchased off-platform", detail: "A school pays for an SMS/WhatsApp bundle by transfer, then a Super Admin confirms and tops up here." },
                { title: "Balances deduct per send", detail: "Every notification sent debits the school's SMS or WhatsApp balance by one unit." },
                { title: "Low balance blocks nothing else", detail: "Only outbound notifications are affected — attendance, results, and fees keep working normally." },
                { title: "Revenue is tracked separately", detail: "Credit top-ups are notification revenue, kept apart from subscription revenue in Revenue Reporting." }
              ].map((rule) => (
                <div key={rule.title} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{rule.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{rule.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

async function PricingPromotionsTab({ billing, activePlans }: { billing: SuperAdminBillingRow[]; activePlans: SuperAdminPlanRow[] }) {
  const [codesEnvelope, reportEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminPromoCodeRow[]>("/api/super-admin/billing/promo-codes"),
    apiGetEnvelope<Array<{ campaignName: string; totalRedemptions: number; totalDiscountIssued: number; schoolsConverted: number }>>("/api/super-admin/billing/promo-codes/report")
  ]);
  const codes = codesEnvelope.data ?? [];
  const campaigns = reportEnvelope.data ?? [];
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));

  const activeCodeCount = codes.filter((code) => code.isActive).length;
  const totalRedemptions = codes.reduce((sum, code) => sum + code.uses, 0);
  const totalDiscountIssued = codes.reduce((sum, code) => sum + code.totalDiscountIssued, 0);
  const totalSchoolsConverted = codes.reduce((sum, code) => sum + code.schoolsConverted, 0);

  return (
    <section className="grid gap-5">
      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-eyebrow">Live rate card</p>
            <h2 className="mt-1 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Subscription plans</h2>
          </div>
          <a href="/super-admin/feature-flags?tab=plans" className="text-[12.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
            Open Tier Plans
          </a>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {activePlans.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-[var(--color-border-default)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] md:col-span-2 xl:col-span-3">
              No active plans. Configure one in Feature &amp; Tier Management.
            </p>
          ) : (
            activePlans.map((plan) => {
              const entitlements = planEntitlements(plan.includedModules);
              const featureSummary = entitlements.features.length
                ? entitlements.features.slice(0, 3).join(", ")
                : entitlements.modules.slice(0, 3).join(", ");
              return (
              <article key={plan.id} className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-sm)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{plan.plan}</p>
                    <h3 className="mt-1 truncate text-[15px] font-bold text-[var(--color-text-primary)]">{plan.name}</h3>
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{plan.slug}</p>
                  </div>
                  <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Active" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Semester</p>
                    <p className="mt-1 font-[var(--font-mono)] text-[15px] font-bold text-[var(--color-text-primary)]">{planPriceLabel(plan)}</p>
                    <p className="text-[11.5px] text-[var(--color-text-muted)]">per student</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">USD</p>
                    <p className="mt-1 font-[var(--font-mono)] text-[15px] font-bold text-[var(--color-text-primary)]">{planUsd(plan)}</p>
                    <p className="text-[11.5px] text-[var(--color-text-muted)]">{plan.subscriberCount} subscriber{plan.subscriberCount === 1 ? "" : "s"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 border-t border-[var(--color-border-default)] pt-3 text-[12px] text-[var(--color-text-secondary)]">
                  <div className="flex justify-between gap-3">
                    <span>Students</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{studentRangeLabel(plan)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Staff</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{plan.staffLimit ? `${plan.staffLimit.toLocaleString()} staff` : "Unlimited"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Support</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{plan.supportTier}</span>
                  </div>
                  {featureSummary ? (
                    <p className="border-t border-[var(--color-border-default)] pt-2 leading-5">{featureSummary}</p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {plan.apiAccess ? <StatusPill bg="var(--color-info-dim)" fg="var(--color-info)" label="API" /> : null}
                    {plan.customBranding ? <StatusPill bg="var(--color-accent-primary-dim)" fg="var(--color-text-accent)" label="Branding" /> : null}
                    {!plan.apiAccess && !plan.customBranding ? <StatusPill bg="var(--color-bg-subtle)" fg="var(--color-text-muted)" label="Core" /> : null}
                  </div>
                  <PlanEditDialog plan={plan} />
                </div>
              </article>
              );
            })
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Active promo codes" value={activeCodeCount} detail={`${codes.length} total code${codes.length === 1 ? "" : "s"} created`} tone="success" icon={TicketPercent} />
        <StatCard label="Total redemptions" value={totalRedemptions} detail={`${totalSchoolsConverted} school${totalSchoolsConverted === 1 ? "" : "s"} converted`} tone="accent" icon={Gift} />
        <StatCard label="Total discount issued" value={formatCurrency(totalDiscountIssued)} detail="Across all codes" tone="warning" icon={BadgePercent} />
      </section>

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

function RevenueReportTab({ revenue, report }: { revenue: SuperAdminRevenueView; report: SuperAdminRevenueReport }) {
  const subscriberCounts = new Map<string, number>(revenue.schoolsByPlan.map((item) => [item.plan, item.count]));
  const maxTierRevenue = Math.max(...report.revenueByTier.map((item) => item.revenue), 1);

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Outstanding"
          value={formatCompactCurrency(report.outstandingReceivables)}
          detail={`${report.unpaidSchoolCount} school${report.unpaidSchoolCount === 1 ? "" : "s"} with an open balance. Full value: ${formatCurrency(report.outstandingReceivables)}.`}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Renewal rate"
          value={`${report.renewalRate}%`}
          detail={`${report.renewedRecently} of ${report.activeSchoolCount} renewed in the last 90 days.`}
          icon={Repeat2}
          tone="success"
        />
        <StatCard
          label="ARPU"
          value={formatCompactCurrency(report.arpu)}
          detail={`Per paying school, per semester. Full value: ${formatCurrency(report.arpu)}.`}
          icon={UsersRound}
          tone="info"
        />
        <StatCard
          label="Credit share"
          value={`${report.creditRevenueSharePct}%`}
          detail={`${formatCompactCurrency(report.notificationCreditRevenue)} of platform revenue from credit bundles.`}
          icon={CreditCard}
          tone="accent"
        />
        <StatCard
          label="Next term"
          value={formatCompactCurrency(report.mrr)}
          detail={`Active schools × confirmed tiers. Full value: ${formatCurrency(report.mrr)}.`}
          icon={TrendingUp}
          tone="success"
        />
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
        <TableCard
          title="LTV projection by tier"
          items={report.ltvByTier}
          columns={[
            { key: "tier", header: "Tier", render: (item) => item.plan },
            { key: "duration", header: "Avg duration", render: (item) => `${(item.avgTenureMonths / 4).toFixed(1)} terms` },
            { key: "termly", header: "Termly value", render: (item) => formatCurrency(item.termlyValue) },
            { key: "ltv", header: "Projected LTV", render: (item) => formatCurrency(item.ltv) }
          ]}
          emptyState="No active subscriptions yet."
        />
      </section>

      <TableCard
        title="Revenue by state"
        description="Where the platform's schools and revenue are concentrated, and where growth is coming from."
        items={report.revenueByState}
        columns={[
          { key: "state", header: "State", render: (item) => item.state },
          { key: "topCity", header: "Top city", render: (item) => item.topCity ?? "—" },
          { key: "schools", header: "Schools", render: (item) => item.schoolCount },
          { key: "revenue", header: "Semester revenue", render: (item) => formatCurrency(item.revenue) },
          { key: "arpu", header: "ARPU", render: (item) => formatCurrency(item.arpu) },
          {
            key: "trend",
            header: "Trend (90d)",
            render: (item) =>
              item.newSchools90d > 0 ? (
                <span className="font-semibold" style={{ color: "var(--color-success)" }}>
                  +{item.newSchools90d} school{item.newSchools90d === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[var(--color-text-muted)]">Steady</span>
              )
          }
        ]}
        emptyState="No school location data yet."
      />
    </section>
  );
}
