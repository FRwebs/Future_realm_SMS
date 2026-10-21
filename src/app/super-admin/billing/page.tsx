import { AlertTriangle, BadgePercent, Calendar, CreditCard, DollarSign, Gift, Repeat2, TicketPercent, TrendingUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { ReferenceList } from "@/components/data-display/reference-list";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PlanEditDialog } from "@/components/super-admin/plan-action-dialogs";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBillingRow,
  SuperAdminChurnRiskRow,
  SuperAdminInvoiceRow,
  SuperAdminPlanRow,
  SuperAdminPromoCodeRow,
  SuperAdminReconciliationTransaction,
  SuperAdminRevenueReport,
  SuperAdminRevenueView,
  SuperAdminSchoolRow
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

function planLabel(plan: string) {
  return planOptions.find((option) => option.value === plan)?.label ?? plan;
}

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
  "Billed per school, per plan, per term — a flat rate per tier, not multiplied by enrolled headcount anywhere in this system's real revenue or invoice figures.",
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
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color: fg }}>
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

  const [billingEnvelope, revenue, plansEnvelope, report, invoicesEnvelope, schoolsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminBillingRow[]>("/api/super-admin/billing"),
    apiGet<SuperAdminRevenueView>("/api/super-admin/analytics/revenue"),
    apiGetEnvelope<SuperAdminPlanRow[]>("/api/super-admin/plans"),
    apiGet<SuperAdminRevenueReport>("/api/super-admin/analytics/revenue-report"),
    apiGetEnvelope<SuperAdminInvoiceRow[]>("/api/super-admin/billing/invoices"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const trialPolicy = (await apiGet<{ trial: { days: number; readOnlyDays: number; lockReminderDays: number } }>("/api/super-admin/platform-policy").catch(() => null))?.trial ?? { days: TRIAL_DAYS, readOnlyDays: 7, lockReminderDays: 3 };
  const billing = billingEnvelope.data ?? [];
  const schoolsForRecommendations = schoolsEnvelope.data ?? [];
  const dismissals = (await apiGet<Record<string, { plan: string; reason: string; at: string; by: string }>>("/api/super-admin/billing-extras/tier-dismissals").catch(() => ({}))) as Record<string, { plan: string; reason: string; at: string; by: string }>;
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

  // Tier recommendations: computed live from each school's real, confirmed student count against
  // every active plan's studentLimit — never stored or scheduled. Only a genuine mismatch (current
  // tier's limit is smaller than the school's real headcount, or a cheaper tier would comfortably
  // fit it) produces a row. This system has no acceptance/dismissal record for a recommendation —
  // acting on one just opens the same real "Change Plan" action already used elsewhere on this page.
  const tierRecommendations = schoolsForRecommendations
    .filter((school) => school.status === "ACTIVE" || school.status === "GRACE_PERIOD")
    .map((school) => {
      const currentPlan = planByTier.get(school.plan);
      if (!currentPlan) return null;
      const fits = (plan: SuperAdminPlanRow) => plan.studentLimit === null || plan.studentLimit === undefined || plan.studentLimit >= school.totalStudents;
      const cheapestFit = activePlans.find(fits);
      if (!cheapestFit || cheapestFit.plan === currentPlan.plan) return null;
      // monthlyPrice is a flat per-school, per-semester rate in this system's real revenue
      // computation (see getPlanPriceMap / the mrr reduce in super-admin.service.ts) — never
      // multiplied by student count — so the difference here is flat too, not per-student.
      const termlyDifference = cheapestFit.monthlyPrice - currentPlan.monthlyPrice;
      return { school, currentPlan, recommendedPlan: cheapestFit, termlyDifference };
    })
    .filter((row): row is { school: SuperAdminSchoolRow; currentPlan: SuperAdminPlanRow; recommendedPlan: SuperAdminPlanRow; termlyDifference: number } => row !== null)
    .sort((a, b) => Math.abs(b.termlyDifference) - Math.abs(a.termlyDifference));

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
        eyebrow="Schools & Revenue"
        title="Subscriptions & Billing"
        description="Subscription tiers, invoice lifecycle, churn risk, notification credit wallets, and promo campaigns."
        action={
          <ResourceActionDialog
            triggerLabel="Create invoice run"
            title="Create invoice run"
            description="Drafts a PlatformInvoice for every targeted school at once, priced from each school's own current plan. Nothing is sent until reviewed and sent individually from the Invoices tab."
            endpoint="/api/super-admin/billing/invoices/run"
            method="POST"
            variant="heroWhite"
            submitLabel="Create invoice run"
            confirmLabel="Confirm"
            confirmMessage="This drafts a real invoice for every matching school. Nothing is sent to a school yet — drafts still need to be reviewed and sent individually."
            fields={[
              {
                name: "schoolIds",
                label: "Scope",
                type: "multiselect",
                section: "Period and scope",
                note: "Leave nothing selected to target every eligible active school.",
                options: schoolsForRecommendations
                  .filter((school) => school.status === "ACTIVE" || school.status === "GRACE_PERIOD" || school.status === "TRIAL")
                  .map((school) => ({ label: school.name, value: school.id }))
              },
              { name: "dueAt", label: "Due date (blank = the platform terms)", type: "date", section: "Period and scope" },
              { name: "note", label: "Note (shown only on the invoice record)", type: "text", section: "Period and scope" },
              {
                name: "excludeTrial",
                label: "Schools in a trial",
                type: "select",
                section: "Exclusions",
                defaultValue: "false",
                options: [
                  { label: "Include", value: "false" },
                  { label: "Exclude", value: "true" }
                ]
              },
              {
                name: "excludeGracePeriod",
                label: "Schools in grace period",
                type: "select",
                section: "Exclusions",
                defaultValue: "false",
                options: [
                  { label: "Include", value: "false" },
                  { label: "Exclude", value: "true" }
                ]
              },
              {
                name: "excludeUnverified",
                label: "Unverified schools",
                type: "select",
                section: "Exclusions",
                defaultValue: "false",
                note: "The mockup's \"NGO awaiting verification\" exclusion has no equivalent in this schema — there's no NGO/organization-type field, only a general verification status. This excludes any school whose registration hasn't been verified yet.",
                options: [
                  { label: "Include", value: "false" },
                  { label: "Exclude", value: "true" }
                ]
              }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {activeTab === "overview" ? (
        <>
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Semester revenue"
              value={formatCompactCurrency(revenue.mrr)}
              detail={`Current semester recurring revenue. Full value: ${formatCurrency(revenue.mrr)}.`}
              icon={Repeat2}
              tone="dark"
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
              icon={DollarSign}
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
              icon={Calendar}
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
                <h2 className="mt-1 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Semester revenue by active tier</h2>
              </div>
              <div className="grid gap-4 p-5">
                {schoolsWithRevenue.length === 0 ? (
                  <p className="rounded-[11px] border border-dashed border-[var(--color-border-default)] px-4 py-6 text-center text-[11.5px] text-[var(--color-text-muted)]">
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
                            <p className="text-[11.5px] font-bold text-[var(--color-text-primary)]">{item.plan}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                              {item.count} subscription{item.count === 1 ? "" : "s"} at {formatCurrency(price)}
                            </p>
                          </div>
                          <p className="font-[var(--font-mono)] text-[12.5px] font-bold text-[var(--color-text-primary)]">{formatCurrency(tierMrr)}</p>
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
                <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">Billing rules</p>
                <div className="mt-2 grid gap-2">
                  {billingRules.map((rule) => (
                    <p key={rule} className="text-[11px] leading-5 text-[var(--color-text-secondary)]">{rule}</p>
                  ))}
                </div>
              </div>
            </section>

            <section className="surface-card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="section-eyebrow">Collections</p>
                  <h2 className="mt-1 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Receivables &amp; renewals</h2>
                </div>
                <Link href={tabHref("pricing") as Route} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
                  View rate card
                </Link>
              </div>
              <div className="grid gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11.5px] text-[var(--color-text-secondary)]">Outstanding receivables</p>
                  <p className="font-[var(--font-mono)] text-[13.5px] font-bold" style={{ color: "var(--color-warning)" }}>
                    {formatCurrency(report.outstandingReceivables)}
                  </p>
                </div>
                <p className="-mt-2 text-[10.5px] text-[var(--color-text-muted)]">
                  {report.unpaidSchoolCount} school{report.unpaidSchoolCount === 1 ? "" : "s"} with an open balance.
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-4">
                  <p className="text-[11.5px] text-[var(--color-text-secondary)]">Renewal rate</p>
                  <p className="font-[var(--font-mono)] text-[13.5px] font-bold text-[var(--color-text-primary)]">{report.renewalRate}%</p>
                </div>
                <p className="-mt-2 text-[10.5px] text-[var(--color-text-muted)]">
                  {report.renewedRecently} of {report.activeSchoolCount} active schools renewed in the last 90 days.
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-4">
                  <p className="text-[11.5px] text-[var(--color-text-secondary)]">Notification credit revenue</p>
                  <p className="font-[var(--font-mono)] text-[13.5px] font-bold text-[var(--color-text-primary)]">{formatCompactCurrency(report.notificationCreditRevenue)}</p>
                </div>
                <p className="-mt-2 text-[10.5px] text-[var(--color-text-muted)]">{report.creditRevenueSharePct}% of platform revenue, kept separate from subscriptions.</p>
              </div>
            </section>
          </section>

          <TableCard
            title={`Tier recommendations — ${tierRecommendations.length} school${tierRecommendations.length === 1 ? "" : "s"} · accept or dismiss per school`}
            description="Student counts are the confirmed headcount on each school’s roll. The system recommends; it never applies a tier change by itself."
            footnote="Dismissing asks for a reason and keeps the school on its current tier until someone decides otherwise. Nothing here changes a price by itself."
            items={tierRecommendations}
            emptyState="No school's real headcount currently mismatches its tier."
            getRowKey={(row) => row.school.id}
            columns={[
              { key: "school", header: "School", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.school.name}</span> },
              { key: "confirmed", header: "Confirmed students", render: (row) => row.school.totalStudents.toLocaleString() },
              { key: "current", header: "Current tier", render: (row) => planLabel(row.currentPlan.plan) },
              {
                key: "recommended",
                header: "Recommended",
                render: (row) => (
                  <span className="font-bold" style={{ color: row.termlyDifference >= 0 ? "var(--color-success)" : "var(--color-warning)" }}>
                    {planLabel(row.recommendedPlan.plan)}
                  </span>
                )
              },
              {
                key: "difference",
                header: "Termly difference",
                render: (row) => (
                  <span className="font-[var(--font-mono)] font-bold" style={{ color: row.termlyDifference >= 0 ? "var(--color-success)" : "var(--color-warning)" }}>
                    {row.termlyDifference >= 0 ? "+" : "−"}{formatCurrency(Math.abs(row.termlyDifference))}
                  </span>
                )
              },
              {
                key: "decision",
                header: "Decision",
                render: (row) => {
                  const dismissed = dismissals[row.school.id];
                  if (dismissed && dismissed.plan === row.recommendedPlan.plan) {
                    return <span className="text-[10.5px] text-[var(--color-text-muted)]" title={dismissed.reason}>Dismissed by {dismissed.by} · {dismissed.reason}</span>;
                  }
                  return (
                    <div className="flex items-center gap-3">
                      <ResourceActionDialog
                        triggerLabel="Accept"
                        title={`Move ${row.school.name} to ${planLabel(row.recommendedPlan.plan)}`}
                        description={`Recommended from ${row.school.totalStudents.toLocaleString()} confirmed students. Accepting changes the school’s plan now.`}
                        endpoint={`/api/super-admin/billing/${row.school.id}`}
                        method="PATCH"
                        variant="textAction"
                        submitLabel="Accept and change plan"
                        fields={[{ name: "plan", label: "Plan", type: "select", options: planOptions, defaultValue: row.recommendedPlan.plan }]}
                      />
                      <ResourceActionDialog
                        triggerLabel="Dismiss"
                        title={`Dismiss the recommendation for ${row.school.name}`}
                        description={`${row.school.name} stays on ${planLabel(row.currentPlan.plan)} until someone decides otherwise.`}
                        endpoint="/api/super-admin/billing-extras/tier-recommendations/dismiss"
                        method="POST"
                        variant="textActionDanger"
                        submitLabel="Dismiss"
                        fields={[
                          { name: "schoolId", label: "School", type: "select", defaultValue: row.school.id, options: [{ label: row.school.name, value: row.school.id }] },
                          { name: "plan", label: "Recommended plan", type: "select", defaultValue: row.recommendedPlan.plan, options: [{ label: planLabel(row.recommendedPlan.plan), value: row.recommendedPlan.plan }] },
                          { name: "reason", label: "Why dismiss it?", type: "textarea", placeholder: "e.g. The school expects 80 more students in January" }
                        ]}
                      />
                    </div>
                  );
                }
              }
            ]}
          />

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
            <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Churn risk</h2>
          </div>
          <ChurnRiskTab />

          <div className="grid gap-1.5">
            <p className="section-eyebrow">Reporting</p>
            <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Revenue reporting</h2>
          </div>
          <RevenueReportTab revenue={revenue} report={report} />
        </>
      ) : null}

      {activeTab === "invoices" ? <InvoicesTab billing={billing} params={params} allInvoices={allInvoices} /> : null}
      {activeTab === "trials" ? <TrialsTab trialBilling={trialBilling} trialPolicy={trialPolicy} /> : null}
      {activeTab === "wallets" ? <WalletsTab billing={billing} /> : null}
      {activeTab === "pricing" ? <PricingPromotionsTab billing={billing} activePlans={activePlans} /> : null}
    </div>
  );
}

async function InvoicesTab({
  billing,
  params,
  allInvoices
}: {
  billing: SuperAdminBillingRow[];
  params: Record<string, string | undefined>;
  allInvoices: SuperAdminInvoiceRow[];
}) {
  const reconciliationQueue = (await apiGet<SuperAdminReconciliationTransaction[]>("/api/super-admin/billing/transactions/reconciliation-queue")) ?? [];
  type ConcessionRow = { id: string; schoolId: string; school: string; state: string | null; plan: string; kind: string; status: string; evidence: string | null; evidenceRef: string | null; verifiedAt: string | null; verifiedBy: string | null; expiresAt: string | null; daysLeft: number | null };
  const concessions = (await apiGet<ConcessionRow[]>("/api/super-admin/billing/concessions").catch(() => [] as ConcessionRow[])) ?? [];
  const concessionSchools = ((await apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100").catch(() => ({ data: [] as SuperAdminSchoolRow[] }))).data ?? []).filter((school) => !concessions.some((entry) => entry.schoolId === school.id && (entry.status === "VERIFIED" || entry.status === "PENDING")));
  const studentsBySchool = new Map(billing.map((row) => [row.schoolId, row.students ?? 0]));
  const unreconciledOverSevenDays = reconciliationQueue.filter((t) => t.ageDays > 7).length;
  const reconStats = (await apiGet<{ awaiting: number; overSevenDays: number; reconciledThisMonth: number; reconciledAmount: number; corrections: number; commissionUnlocked: number }>("/api/super-admin/billing-extras/reconciliation-stats").catch(() => null)) ?? { awaiting: reconciliationQueue.length, overSevenDays: unreconciledOverSevenDays, reconciledThisMonth: 0, reconciledAmount: 0, corrections: 0, commissionUnlocked: 0 };
  const search = params.invoiceSearch?.trim().toLowerCase();
  const invoices = search
    ? allInvoices.filter((item) => item.invoiceNo.toLowerCase().includes(search) || item.schoolName.toLowerCase().includes(search))
    : allInvoices;
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));

  return (
    <div className="grid gap-5">
      <div className="grid gap-3.5">
        <TableCard
      title="Invoices"
      description="Open an invoice to see who paid it, send it to the school, or chase it by hand. Every invoice is tracked from draft through payment or cancellation; none is sent without admin review."
      items={invoices}
      getRowKey={(item) => item.id}
      selection={{
        noun: "invoice",
        nounPlural: "invoices",
        actions: [
          { label: "Send a reminder to the selected", kind: "primary", endpoint: "/api/super-admin/billing-extras/invoices/remind", idsField: "invoiceIds" },
          { label: "Send the invoices", endpoint: "/api/super-admin/billing-extras/invoices/send", idsField: "invoiceIds" },
          { label: "Export the selection", endpoint: "/api/super-admin/billing-extras/invoices/export", method: "DOWNLOAD", idsField: "invoiceIds" }
        ]
      }}
      filterBar={
        <form method="GET" className="flex flex-wrap items-center gap-2 border-b border-[#EDF3EF] bg-[#FCFDFC] px-5 py-3.5">
          <input type="hidden" name="tab" value="invoices" />
          <input
            type="search"
            name="invoiceSearch"
            defaultValue={params.invoiceSearch}
            placeholder="Search by invoice no. or school"
            className="field-control h-10 w-72 rounded-[9px] text-[11.5px]"
          />
          <button type="submit" className="btn-secondary h-10 text-[11.5px]">Search</button>
          {search ? (
            <Link href="/super-admin/billing?tab=invoices" className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
              Clear
            </Link>
          ) : null}
        </form>
      }
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
            { name: "dueAt", label: "Due date (blank = the platform terms)", type: "date" },
            { name: "note", label: "Internal note", type: "textarea" }
          ]}
        />
      }
      columns={[
        { key: "invoiceNo", header: "Invoice", render: (item) => item.invoiceNo },
        { key: "school", header: "School", render: (item) => item.schoolName },
        { key: "students", header: "Students", render: (item) => (item.students ?? 0).toLocaleString() },
        { key: "amount", header: "Amount", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(item.totalAmount)}</p>{item.amountPaid > 0 && item.amountPaid < item.totalAmount ? <p className="text-[10.5px] text-[var(--color-text-muted)]">{formatCurrency(item.amountPaid)} paid</p> : null}</div> },
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

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="What each status means"
          description="Six states, and only these six. A school and Future Realm read the same word for the same thing."
          items={invoiceStatusReference}
          pageSize={false}
          getRowKey={(row) => row.status}
          columns={[
            { key: "status", header: "Status", render: (row) => { const tone = invoiceStatusTone[row.status.toUpperCase().replace(/\s+/g, "_")] ?? invoiceStatusTone.DRAFT; return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{row.status}</span>; } },
            { key: "meaning", header: "Meaning", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.meaning}</span> }
          ]}
        />
        <ReferenceList
          title="Recording a payment by hand"
          sub="Card payments reconcile themselves. A transfer needs a person, and that person has to say who paid."
          items={[
            { label: "The school and the payer are both required", detail: "A payment with no named payer cannot be answered for when a bursar rings six months later", pill: "Required", tone: "bad" },
            { label: "The bank reference is required for a transfer", detail: "It is the only thing that ties the money to the invoice", pill: "Required", tone: "bad" },
            { label: "Recording is not reconciling", detail: "A second person matches it against the bank statement — the same person cannot do both", pill: "Policy", tone: "warn" },
            { label: "A receipt is issued automatically", detail: "Sent to the payer and the school admin, and downloadable from the invoice afterwards", pill: "Automatic", tone: "good" }
          ]}
        />
      </div>

      <div className="col-span-full grid gap-3.5">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Recorded, awaiting reconciliation" value={reconStats.awaiting} detail="Segregation of duties enforced" tone="dark" />
          <StatCard label="Unreconciled beyond 7 days" value={reconStats.overSevenDays} detail="On the Finance Lead exception list" tone={reconStats.overSevenDays > 0 ? "warning" : "success"} />
          <StatCard label="Reconciled this month" value={reconStats.reconciledThisMonth} detail={`${formatCurrency(reconStats.reconciledAmount)} matched to bank records`} tone="neutral" />
          <StatCard label="Correcting entries" value={reconStats.corrections} detail="Originals remain visible" tone="neutral" />
          <StatCard label="Commission unlocked" value={formatCurrency(reconStats.commissionUnlocked)} detail="Accrues only on reconciliation" tone="neutral" />
        </div>
        <TableCard
          title="Reconciliation queue"
          description="Reconciliation is a separate action, performed by a different person from whoever recorded the payment — enforced by the system, not by policy."
          items={reconciliationQueue}
          getRowKey={(item) => item.id}
          emptyState="Nothing waiting on reconciliation."
          columns={[
            { key: "school", header: "School", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.schoolName}</span> },
            { key: "invoice", header: "Invoice", render: (item) => item.invoiceNo ?? "—" },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(item.amount) },
            { key: "recordedBy", header: "Recorded by", render: (item) => item.recordedBy },
            { key: "reference", header: "Bank reference", render: (item) => <span className="font-[var(--font-mono)] text-[11px]">{item.reference}</span> },
            { key: "age", header: "Age", render: (item) => `${item.ageDays}d` },
            {
              key: "actions",
              header: "",
              render: (item) => (
                <div className="flex items-center gap-3">
                <ResourceActionDialog
                  triggerLabel="Correct"
                  title={`Correct ${item.reference}`}
                  description="Writes a correcting entry for the difference. The original stays visible, and so does the correction."
                  endpoint={`/api/super-admin/billing-extras/transactions/${item.id}/correct`}
                  method="POST"
                  variant="textAction"
                  submitLabel="Write correcting entry"
                  fields={[{ name: "amount", label: "The amount that was actually received", type: "number", required: true, defaultValue: item.amount }, { name: "reason", label: "What is being corrected, and why", type: "textarea", required: true }]}
                />
                <ResourceActionDialog
                  triggerLabel="Reconcile"
                  title={`Reconcile ${item.reference}`}
                  description="Confirms this payment against the bank statement. Must be performed by someone other than whoever recorded it."
                  endpoint={`/api/super-admin/billing/transactions/${item.id}/reconcile`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Reconcile"
                  confirmLabel="Confirm"
                  fields={[]}
                />
                </div>
              )
            }
          ]}
        />

        <ReferenceList
          title="Controls around manual payment"
          sub="Every payment recorded by hand passes these controls, which matter more, not less, while card payments are the only automated route."
          items={[
            { label: "Recorder captures date, amount, method, bank reference and their own identity", detail: "", tone: "teal" },
            { label: "Reconciler must be a different person", detail: "The only control standing between a manual payment field and a fabricated revenue figure", tone: "bad" },
            { label: "Reconciliation requires a bank reference", detail: "Plus the matcher's identity and timestamp", tone: "teal" },
            { label: "Partial payments never advance to Reconciled", detail: "And never accrue commission until the balance is settled", tone: "warn" },
            { label: "Amendments write a correcting entry", detail: "Both entries remain visible permanently — use “Correct” on a payment in the queue", tone: "good" }
          ]}
        />

        <TableCard
          title="NGO — verification due"
          description="The discount is a grant with an end date. Each one records the evidence seen, who verified it and when it must be verified again. Thirty days before it ends the owner is told; if nobody re-verifies, the school moves to the Standard plan."
          items={concessions}
          pageSize={false}
          getRowKey={(item) => item.id}
          emptyState="No school is on an NGO or mission concession."
          actions={
            <ResourceActionDialog
              triggerLabel="Grant a concession"
              title="Grant an NGO / Mission concession"
              description="Verify the evidence first. The school moves to the NGO / Mission tier now and the grant runs for the months you set."
              endpoint="/api/super-admin/billing/concessions"
              method="POST"
              variant="secondary"
              submitLabel="Grant concession"
              fields={[
                { name: "schoolId", label: "School", type: "select", required: true, options: concessionSchools.map((school) => ({ label: school.name, value: school.id })) },
                { name: "kind", label: "Kind", type: "select", required: true, options: [{ label: "NGO", value: "NGO" }, { label: "Mission / faith-based", value: "MISSION" }] },
                { name: "evidence", label: "Evidence seen", type: "textarea", required: true, placeholder: "e.g. CAC incorporated-trustees certificate IT/12345, seen 12 Oct 2026" },
                { name: "evidenceRef", label: "Reference number", type: "text" },
                { name: "months", label: "Valid for (months)", type: "number", defaultValue: 12, min: 1, max: 24 }
              ]}
            />
          }
          columns={[
            { key: "school", header: "School", render: (item) => <div><p className="font-bold text-[var(--color-text-primary)]">{item.school}</p><p className="text-[10px] text-[var(--color-text-muted)]">{item.kind === "NGO" ? "NGO" : "Mission"}{item.state ? ` · ${item.state}` : ""}</p><p className="text-[10px] text-[var(--color-text-muted)]">{item.evidence ?? "No evidence recorded"}{item.evidenceRef ? ` · ${item.evidenceRef}` : ""}{item.verifiedAt ? ` · verified ${new Date(item.verifiedAt).toLocaleDateString("en-GB")} by ${item.verifiedBy ?? "—"}` : ""}</p></div> },
            { key: "students", header: "Students", render: (item) => (studentsBySchool.get(item.schoolId) ?? 0).toLocaleString() },
            { key: "discount", header: "Discount", render: () => <span className="text-[11px] font-semibold">Concession tier</span> },
            { key: "expires", header: "Verified until", render: (item) => item.expiresAt ? <span className="text-[11px]" style={{ color: item.status === "VERIFIED" && (item.daysLeft ?? 99) <= 30 ? "var(--color-warning)" : "var(--color-text-secondary)" }}>{new Date(item.expiresAt).toLocaleDateString("en-GB")}{item.status === "VERIFIED" && item.daysLeft !== null ? ` · ${item.daysLeft} days` : ""}</span> : "—" },
            { key: "status", header: "State", render: (item) => <span className="text-[10px] font-bold" style={{ color: item.status === "VERIFIED" ? "var(--color-success)" : item.status === "EXPIRED" ? "var(--color-warning)" : "var(--color-text-muted)" }}>{item.status === "VERIFIED" ? "Verified" : item.status === "EXPIRED" ? "Expired — moved to Standard" : item.status === "REVOKED" ? "Revoked" : "Pending"}</span> },
            {
              key: "actions", header: "Action", render: (item) => item.status === "REVOKED" ? null : (
                <ActionMenu>
                  <ResourceActionDialog triggerLabel="Re-verify" title={`Re-verify ${item.school}`} description="Record the evidence seen this time and run the grant on for another term." endpoint={`/api/super-admin/billing/concessions/${item.id}/renew`} method="PATCH" variant="secondary" submitLabel="Re-verify" fields={[{ name: "evidence", label: "Evidence seen", type: "textarea", required: true }, { name: "months", label: "Valid for (months)", type: "number", defaultValue: 12, min: 1, max: 24 }]} />
                  <ResourceActionDialog triggerLabel="Revoke" title={`Revoke ${item.school}'s concession`} description="The school moves off the discounted plan now." endpoint={`/api/super-admin/billing/concessions/${item.id}/revoke`} method="PATCH" variant="menuDanger" submitLabel="Revoke" confirmLabel="Confirm" confirmMessage="The school's price changes immediately." fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]} />
                </ActionMenu>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}

type TrialJourney = {
  trialDays: number;
  running: number;
  schedule: Array<{ key: string; day: number; message: string; channel: string; source: string; sent: number; suppressed: number }>;
  pipeline: Array<{ schoolId: string; school: string; day: number | null; last: string | null; next: string | null; failed: number; wizardDone: number; wizardTotal: number; started: boolean }>;
};

async function TrialsTab({ trialBilling, trialPolicy }: { trialBilling: SuperAdminBillingRow[]; trialPolicy: { days: number; readOnlyDays: number; lockReminderDays: number } }) {
  const now = Date.now();
  const journey = await apiGet<TrialJourney>("/api/super-admin/billing-extras/trial-journey").catch(() => null);

  const trials = trialBilling
    .map((item) => {
      const endsAt = item.trialEndsAt ? new Date(item.trialEndsAt).getTime() : null;
      const msRemaining = endsAt ? endsAt - now : null;
      const daysRemaining = msRemaining !== null ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : null;
      const daysElapsed = daysRemaining !== null ? Math.min(trialPolicy.days, trialPolicy.days - daysRemaining) : null;
      const pct = daysElapsed !== null ? Math.round((Math.max(0, daysElapsed) / trialPolicy.days) * 100) : 0;
      return { ...item, daysRemaining, pct };
    })
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  return (
    <div className="grid gap-5">
      <TableCard
        title={`Trial communication schedule — day 0 to day ${trialPolicy.days + trialPolicy.readOnlyDays}`}
        description="Every message below the lifecycle ones is a template in Communications, not text embedded in code, so it can be edited without a deployment. Attach a template to a trigger there."
        items={journey?.schedule ?? []}
        pageSize={false}
        getRowKey={(row) => row.key}
        actions={<ResourceActionDialog triggerLabel="Check now" title="Check the trial schedule now" description="Sends whatever is due to schools on a trial, or records why it was held back. It also runs by itself every hour." endpoint="/api/super-admin/billing-extras/trial-journey/run" method="POST" variant="secondary" submitLabel="Check now" fields={[]} />}
        emptyState="No trial schedule is available."
        columns={[
          { key: "day", header: "Day", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.day}</span> },
          { key: "message", header: "Message", render: (row) => <span className="text-[12px]">{row.message}</span> },
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "source", header: "Fires from", render: (row) => row.source },
          { key: "sent", header: "Sent", render: (row) => row.sent },
          { key: "suppressed", header: "Suppressed", render: (row) => row.suppressed }
        ]}
        footnote={`${journey?.running ?? 0} trials running against this schedule. Messages are suppressed where they would be absurd — the day 3 import prompt does not fire at a school that has already imported 50 or more students.`}
      />

      <TableCard
        title="Pipeline view — every trial school against the schedule"
        description="Sends completed, upcoming and failed."
        items={journey?.pipeline ?? []}
        pageSize={false}
        getRowKey={(row) => row.schoolId}
        emptyState="No school is on a trial."
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.school}</span> },
          { key: "day", header: "Day", render: (row) => (row.day === null ? "Not started" : row.day) },
          { key: "last", header: "Last sent", render: (row) => row.last ?? <span className="text-[var(--color-text-muted)]">Nothing yet</span> },
          { key: "next", header: "Next scheduled", render: (row) => row.next ?? "—" },
          { key: "failed", header: "Failed", render: (row) => (row.failed ? <span className="font-semibold text-[var(--color-danger)]">{row.failed}</span> : 0) },
          { key: "wizard", header: "Wizard", render: (row) => <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-[#EDF3EF]"><div className="h-1.5 rounded-full" style={{ width: `${(row.wizardDone / row.wizardTotal) * 100}%`, background: row.wizardDone >= row.wizardTotal ? "var(--color-success)" : row.wizardDone <= 2 ? "var(--color-danger)" : "var(--color-warning)" }} /></div><span className="text-[11px]">{row.wizardDone} of {row.wizardTotal}</span></div> }
        ]}
        footnote="A failed send is a failed delivery on the school's own record, so it lands in the contact-quality repair queue under Users → Reviews & Cases rather than disappearing."
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {trials.length === 0 ? (
          <section className="surface-card p-6">
            <div className="empty-state">
              <p className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">No schools currently on trial</p>
              <p className="mt-1 max-w-md text-[11.5px] text-[var(--color-text-secondary)]">
                Trial schools will appear here as they self-onboard.
              </p>
            </div>
          </section>
        ) : (
          <div className="grid gap-3 self-start">
            {trials.map((trial) => {
              const overdue = trial.daysRemaining !== null && trial.daysRemaining < 0;
              const urgent = trial.daysRemaining !== null && trial.daysRemaining <= 2;
              const soon = trial.daysRemaining !== null && trial.daysRemaining <= 5;
              const barColor = overdue || urgent ? "var(--color-danger)" : soon ? "var(--color-warning)" : "var(--color-accent-primary)";
              return (
                <article key={trial.schoolId} className="surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{trial.schoolName}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{trial.plan} tier</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {trial.daysRemaining !== null ? (
                        <StatusPill
                          bg={overdue || urgent ? "var(--color-danger-dim)" : soon ? "var(--color-warning-dim)" : "var(--color-accent-primary-dim)"}
                          fg={overdue || urgent ? "var(--color-danger)" : soon ? "var(--color-warning)" : "var(--color-text-accent)"}
                          label={overdue ? `Overdue ${Math.abs(trial.daysRemaining)}d — still on Trial` : trial.daysRemaining === 0 ? "Expires today" : `${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"} left`}
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
            <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">Automatic trial alerts</p>
            <div className="mt-3 grid gap-2.5">
              {[
                [`${trialPolicy.lockReminderDays} days before the trial ends`, "The owner is told the trial is ending, by email and in-app."],
                ["The day it ends", `The school becomes read-only for ${trialPolicy.readOnlyDays} days and the owner is told the date it will be locked.`],
                [`${trialPolicy.lockReminderDays} days before the lock`, "The owner is reminded the school is about to be locked."],
                [`${trialPolicy.readOnlyDays} days after the trial`, "The school is locked. Nothing is deleted; only support can reopen it."]
              ].map(([when, what]) => (
                <div key={when} className="border-b border-[var(--color-border-muted)] pb-2.5 last:border-b-0 last:pb-0">
                  <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">{when}</p>
                  <p className="mt-0.5 text-[10.5px] leading-5 text-[var(--color-text-muted)]">{what}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">Set in Settings → Platform. Each step is written to the audit log.</p>
          </section>
          <section className="rounded-[12.5px] p-5" style={{ background: "var(--color-bg-subtle)", border: "1px solid var(--color-border-default)" }}>
            <p className="text-[11.5px] font-bold text-[var(--color-text-primary)]">Post-trial behaviour</p>
            <p className="mt-2 text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
              When a trial ends the school moves to a <strong>read-only</strong> window of {trialPolicy.readOnlyDays} days: it can read and export, but every change is refused, and the way out — choosing a plan or paying — stays open. Paying switches editing straight back on. After the window the school is <strong>locked</strong> and cannot sign in until support reopens it. Nothing is ever deleted by this.
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
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Retention risk</h2>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
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
            <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">Churn risk signals</p>
            <p className="mt-1.5 text-[10.5px] text-[var(--color-text-muted)]">Every school starts at 100. Each signal below subtracts its weight; a final score under 50 is flagged high risk.</p>
            <div className="mt-3.5 grid gap-3">
              {churnSignalReference.map((row) => (
                <div key={row.signal} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold leading-5 text-[var(--color-text-primary)]">{row.signal}</p>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
                      {row.weight}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{row.threshold}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">Flagged schools</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">Weekly digest to Finance &amp; CS</p>
            </div>
            <div className="mt-3.5 grid gap-4">
              {flaggedSchools.length === 0 ? (
                <p className="rounded-[9px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[11.5px] text-[var(--color-text-muted)]">
                  No schools currently below the risk threshold.
                </p>
              ) : (
                flaggedSchools.map((school) => (
                  <div key={school.schoolId}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{school.schoolName}</p>
                      <span className="font-[var(--font-mono)] text-[11.5px] font-bold" style={{ color: "var(--color-danger)" }}>
                        {school.score}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                      <div className="h-full rounded-full" style={{ width: `${school.score}%`, background: "var(--color-danger)" }} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
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

type WalletsView = {
  kpis: { heldValue: number; belowFloor: number; alerted: number; autoCount: number; autoValue: number; autoPaid: number; failed: number; failedSchools: number; failing: number; byHand: number; byHandCredits: number; withReason: number };
  rows: Array<{ schoolId: string; school: string; tier: string; sms: number; whatsapp: number; floor: number; smsTone: string; below: boolean; auto: string; autoTone: string; lastTopUp: string | null; lastKind: string | null; burn30: number }>;
  history: Array<{ id: string; at: string; school: string; channel: string; amount: string; trigger: string; gateway: string; reference: string; outcome: string; tone: string }>;
  rate: Array<{ channel: string; cost: string; price: string; margin: { text: string; tone: string } }>;
  providerCost: { sms: number; smsInternational: number; whatsapp: number; email: number };
};

const walletTone: Record<string, { bg: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  info: { bg: "var(--color-info-dim)", fg: "var(--color-info)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

async function WalletsTab({ billing }: { billing: SuperAdminBillingRow[] }) {
  const view = await apiGet<WalletsView>("/api/super-admin/billing-extras/wallets");
  const k = view.kpis;
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));
  const pill = (text: string, tone: string) => <StatusPill bg={(walletTone[tone] ?? walletTone.mute).bg} fg={(walletTone[tone] ?? walletTone.mute).fg} label={text} />;
  const byHandFields = (schoolId?: string) => [
    schoolId
      ? { name: "schoolId", label: "School", type: "select" as const, defaultValue: schoolId, options: schoolOptions.filter((option) => option.value === schoolId) }
      : { name: "schoolId", label: "School", type: "select" as const, options: schoolOptions },
    { name: "channel", label: "Channel", type: "select" as const, defaultValue: "SMS", options: [{ label: "SMS", value: "SMS" }, { label: "WhatsApp", value: "WHATSAPP" }] },
    { name: "credits", label: "Credits to add", type: "number" as const, defaultValue: 1000, min: 1, max: 500000 },
    { name: "reason", label: "Reason (goes in the register)", type: "textarea" as const, placeholder: "e.g. Automatic top-up failed three times; the school has confirmed payment by transfer" }
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-5">
        <StatCard label="Credit held across all schools" value={formatCompactCurrency(k.heldValue, "NGN")} detail="SMS and WhatsApp, unspent, at the price schools pay" icon={CreditCard} tone="dark" />
        <StatCard label="Schools below the message floor" value={k.belowFloor} detail={k.belowFloor ? `Low-balance alert sent to ${k.alerted} in the last 7 days` : "Every wallet is above its floor"} icon={AlertTriangle} tone={k.belowFloor ? "warning" : "success"} />
        <StatCard label="Automatic top-ups this month" value={k.autoCount} detail={`${formatCurrency(k.autoValue, "NGN")} invoiced · ${k.autoPaid} paid`} icon={Repeat2} tone="info" />
        <StatCard label="Automatic top-ups that failed" value={k.failed} detail={k.failed ? `${k.failedSchools} school${k.failedSchools === 1 ? "" : "s"} · needs a manual credit` : "None stopped this month"} icon={AlertTriangle} tone={k.failed ? "danger" : "success"} />
        <StatCard label="Added by hand this term" value={k.byHand} detail={`${k.byHandCredits.toLocaleString("en-NG")} credits · ${k.withReason} with a reason`} icon={DollarSign} tone="info" />
      </section>

      <TableCard
        title="Wallet balances"
        description="Open a school to see its burn rate and its own top-up history. Where the automatic charge has failed, add the balance by hand so messages keep going out."
        items={view.rows}
        getRowKey={(item) => item.schoolId}
        pageSize={8}
        actions={
          <ResourceActionDialog
            triggerLabel="Add balance by hand"
            title="Add balance by hand"
            description="Credit a school's wallet directly. Every one is written to the register with who added it and why."
            endpoint="/api/super-admin/billing-extras/wallets/top-up"
            method="POST"
            variant="primary"
            submitLabel="Add credit"
            fields={byHandFields()}
          />
        }
        footnote="A credit added by hand is a stopgap. It keeps a school’s messages flowing today; it does not fix the payment method that failed."
        columns={[
          { key: "school", header: "School", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.school}</span> },
          { key: "tier", header: "Tier", render: (item) => item.tier },
          { key: "sms", header: "SMS", render: (item) => pill(item.sms.toLocaleString("en-NG"), item.smsTone) },
          { key: "whatsapp", header: "WhatsApp", render: (item) => item.whatsapp.toLocaleString("en-NG") },
          { key: "auto", header: "Automatic top-up", render: (item) => pill(item.auto, item.autoTone) },
          { key: "last", header: "Last top-up", render: (item) => (item.lastTopUp ? `${formatDate(item.lastTopUp)}${item.lastKind ? ` · ${item.lastKind}` : ""}` : "Never"), sortValue: (item) => item.lastTopUp },
          {
            key: "open",
            header: "",
            sortable: false,
            render: (item) => (
              <div className="flex items-center gap-3">
                <ResourceActionDialog
                  triggerLabel="Add balance"
                  title={`Add balance by hand — ${item.school}`}
                  description={`${item.school} spent ${item.burn30.toLocaleString("en-NG")} SMS credits in the last 30 days. Its floor is ${item.floor.toLocaleString("en-NG")}.`}
                  endpoint="/api/super-admin/billing-extras/wallets/top-up"
                  method="POST"
                  variant="textAction"
                  submitLabel="Add credit"
                  fields={byHandFields(item.schoolId)}
                />
                <Link href={`/super-admin/schools/${item.schoolId}` as Route} className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">Open</Link>
              </div>
            )
          }
        ]}
        emptyState="No schools to display."
      />

      <TableCard
        title="Automatic top-up history"
        description="Every charge the platform attempted on a school’s behalf, and every credit a person added instead. This is the register you read when a school says a message never went out."
        items={view.history}
        getRowKey={(item) => item.id}
        pageSize={8}
        emptyState="Nothing has been topped up yet."
        footnote="A failed charge is retried three times, then stops and raises an alert. It never silently keeps trying."
        columns={[
          { key: "when", header: "When", render: (item) => formatDate(item.at), sortValue: (item) => item.at },
          { key: "school", header: "School", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.school}</span> },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "amount", header: "Amount", render: (item) => <span className="font-bold">{item.amount}</span> },
          { key: "trigger", header: "Trigger", render: (item) => <span className="text-[11px] text-[var(--color-text-secondary)]">{item.trigger}</span> },
          { key: "gateway", header: "Gateway", render: (item) => item.gateway },
          { key: "reference", header: "Reference", render: (item) => <span className="font-mono text-[11px]">{item.reference}</span> },
          { key: "outcome", header: "Outcome", render: (item) => pill(item.outcome, item.tone) }
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <TableCard
          title="Provider rate card"
          description="What Nooria pays the provider against what the school pays. The only figure on this tab a school must never see. Super Admin only."
          items={view.rate}
          getRowKey={(item) => item.channel}
          pageSize={false}
          actions={
            <ResourceActionDialog
              triggerLabel="Enter provider costs"
              title="What the provider charges Nooria"
              description="Per message, in naira. The margin on this card is worked out from these — leave a channel at 0 until you know its cost."
              endpoint="/api/super-admin/platform-policy"
              method="PUT"
              variant="secondary"
              submitLabel="Save costs"
              fields={[
                { name: "messaging_providerCostSms", label: "SMS · Nigeria", type: "number", defaultValue: view.providerCost.sms, min: 0, step: 0.01 },
                { name: "messaging_providerCostSmsInternational", label: "SMS · international", type: "number", defaultValue: view.providerCost.smsInternational, min: 0, step: 0.01 },
                { name: "messaging_providerCostWhatsapp", label: "WhatsApp · template", type: "number", defaultValue: view.providerCost.whatsapp, min: 0, step: 0.01 },
                { name: "messaging_providerCostEmail", label: "Email", type: "number", defaultValue: view.providerCost.email, min: 0, step: 0.01 }
              ]}
            />
          }
          footnote="Email is included in every tier, so it never draws on a wallet. Only SMS and WhatsApp spend credit."
          columns={[
            { key: "channel", header: "Channel", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.channel}</span> },
            { key: "cost", header: "Cost to Nooria", render: (item) => item.cost },
            { key: "price", header: "Price to school", render: (item) => item.price },
            { key: "margin", header: "Margin", render: (item) => pill(item.margin.text, item.margin.tone) }
          ]}
        />
        <ReferenceList
          title="When a balance runs low"
          sub="The sequence is automatic and the school is told at each step — nobody at Nooria has to notice first."
          items={[
            { label: "Balance reaches the school’s floor", detail: "In-app notice and an email to the school’s owner, once a week while it stays low", pill: "Step 1", tone: "good" },
            { label: "Automatic charge attempted", detail: "If the school turned automatic top-up on, an invoice for its chosen quantity is issued daily — up to three, then it stops rather than retrying forever", pill: "Step 2", tone: "good" },
            { label: "Charge fails on all three", detail: "Alert to the account manager and to this tab — a person now owns it. Cards cannot be charged from the platform yet, so each “charge” is an invoice; three unpaid is a failure", pill: "Step 3", tone: "warn" },
            { label: "Balance reaches zero", detail: "SMS sends are held, not lost. Email and in-app keep working, so a school is never fully silent", pill: "Step 4", tone: "bad" },
            { label: "Credit added, by charge or by hand", detail: "Sending resumes at the next delivery run — nothing queued is lost", pill: "Recovery", tone: "good" }
          ]}
        />
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
            <h2 className="mt-1 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Subscription plans</h2>
          </div>
          <Link href="/super-admin/feature-flags?tab=plans" className="text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline">
            Open Tier Plans
          </Link>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
          {activePlans.length === 0 ? (
            <p className="rounded-[11px] border border-dashed border-[var(--color-border-default)] px-4 py-6 text-center text-[11.5px] text-[var(--color-text-muted)] md:col-span-2 xl:col-span-3">
              No active plans. Configure one in Feature &amp; Tier Management.
            </p>
          ) : (
            activePlans.map((plan) => {
              const entitlements = planEntitlements(plan.includedModules);
              const featureSummary = entitlements.features.length
                ? entitlements.features.slice(0, 3).join(", ")
                : entitlements.modules.slice(0, 3).join(", ");
              return (
              <article key={plan.id} className="rounded-[12.5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-sm)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{plan.plan}</p>
                    <h3 className="mt-1 truncate text-[13.5px] font-bold text-[var(--color-text-primary)]">{plan.name}</h3>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{plan.slug}</p>
                  </div>
                  <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Active" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Semester</p>
                    <p className="mt-1 font-[var(--font-mono)] text-[13.5px] font-bold text-[var(--color-text-primary)]">{planPriceLabel(plan)}</p>
                    <p className="text-[10.5px] text-[var(--color-text-muted)]">flat rate, per school</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">USD</p>
                    <p className="mt-1 font-[var(--font-mono)] text-[13.5px] font-bold text-[var(--color-text-primary)]">{planUsd(plan)}</p>
                    <p className="text-[10.5px] text-[var(--color-text-muted)]">{plan.subscriberCount} subscriber{plan.subscriberCount === 1 ? "" : "s"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 border-t border-[var(--color-border-default)] pt-3 text-[11px] text-[var(--color-text-secondary)]">
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
        <StatCard label="Active promo codes" value={activeCodeCount} detail={`${codes.length} total code${codes.length === 1 ? "" : "s"} created`} tone="dark" icon={TicketPercent} />
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
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Outstanding"
          value={formatCompactCurrency(report.outstandingReceivables)}
          detail={`${report.unpaidSchoolCount} school${report.unpaidSchoolCount === 1 ? "" : "s"} with an open balance. Full value: ${formatCurrency(report.outstandingReceivables)}.`}
          icon={AlertTriangle}
          tone="dark"
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
          icon={DollarSign}
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
          <h3 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Revenue by tier</h3>
          <div className="mt-4 grid gap-3">
            {report.revenueByTier.map((item) => (
              <div key={item.plan}>
                <div className="flex items-center justify-between text-[11.5px] font-semibold text-[var(--color-text-primary)]">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-[2.5px] bg-[var(--color-accent-primary)]" />
                    {item.plan}
                    <span className="text-[10px] font-medium text-[var(--color-text-muted)]">{subscriberCounts.get(item.plan) ?? 0} subs</span>
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
