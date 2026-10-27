import { AlertTriangle, Calendar, CreditCard, DollarSign, Repeat2, TrendingUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { BarList } from "@/components/data-display/bar-list";
import { ReferenceList } from "@/components/data-display/reference-list";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBillingRow,
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

const billingRules = (trialDays: number) => [
  `Trials run ${trialDays} days automatically at signup, with every feature unlocked and no card required`,
  "A school moves to Grace Period on the first missed payment, then Suspended if it lapses further",
  "Notification credits (SMS and WhatsApp) are bought separately as usage-based bundles, and their revenue is tracked apart from subscriptions",
  "Student count is confirmed at the start of each term — the system recommends but never auto-changes tiers",
  "Pricing on this module is the live rate card used by onboarding, billing and upgrades"
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
  return `₦${plan.monthlyPrice.toLocaleString("en-US")}`;
}

/** The dollar price at the term's fixed rate. Without a rate fixed for the term there is nothing honest to show. */
function planUsd(plan: SuperAdminPlanRow, naira: number) {
  const slug = plan.slug.toLowerCase();
  if (slug === "trial") return "Free";
  if (slug === "ngo-mission") return "90% off";
  return naira > 0 ? `$${(plan.monthlyPrice / naira).toFixed(2)}` : "—";
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

function planAddOns(plan: SuperAdminPlanRow) {
  const entitlements = planEntitlements(plan.includedModules);
  const list = entitlements.features.length ? entitlements.features : entitlements.modules;
  const extras = [plan.apiAccess ? "API access" : null, plan.customBranding ? "Custom branding" : null].filter((item): item is string => Boolean(item));
  const all = [...new Set([...list.filter((item) => !/students?\b|any size|certificate required/i.test(item)).slice(0, 3), ...extras])];
  return all.length ? all.join(", ") : "Core modules";
}

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
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
  const currencies = await apiGet<{ term: string | null; rates?: { usd: number } }>("/api/super-admin/billing-extras/currencies").catch(() => ({ term: null, rates: { usd: 0 } }));
  const termLabel = currencies.term;
  const usdRate = currencies.rates?.usd ?? 0;
  const lastMonth = revenue.monthlyRevenue[revenue.monthlyRevenue.length - 1];
  const reconciledMonth = lastMonth ? { month: lastMonth.month, amount: lastMonth.amount } : null;
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
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 03"
        title="Subscriptions & Billing"
        description="The commercial relationship, and the line between invoiced and received."
        action={
          <ResourceActionDialog
            triggerLabel="Create invoice run"
            title="Create invoice run"
            description="Raises drafts for a term. Nothing is sent until each invoice is issued."
            endpoint="/api/super-admin/billing/invoices/run"
            method="POST"
            variant="heroWhite"
            submitLabel="Create draft run"
            confirmLabel="Confirm"
            confirmMessage="This drafts a real invoice for every matching school. Nothing is sent to a school yet — drafts still need to be reviewed and sent individually."
            note="Each draft is priced from the school’s own current plan, in the school’s own currency."
            impact={{
              label: "This run will produce",
              rows: [
                ["One draft per school", "Every active school in scope, priced from its own plan — a school with no active price is skipped and named in the result"],
                ["Nothing is sent", "Each draft is reviewed and issued one at a time from the Invoices tab"],
                ["Commission liability", "Accrues only as payments reconcile, never on issue"]
              ]
            }}
            fields={[
              { name: "term", label: "Term", type: "static", placeholder: termLabel ?? "The current term", section: "Period and scope" },
              {
                name: "schoolIds",
                label: "Scope",
                type: "multiselect",
                section: "Period and scope",
                note: "Leave nothing chosen to target every eligible active school.",
                options: schoolsForRecommendations
                  .filter((school) => school.status === "ACTIVE" || school.status === "GRACE_PERIOD" || school.status === "TRIAL")
                  .map((school) => ({ label: school.name, value: school.id }))
              },
              { name: "dueAt", label: "Payment due date", type: "date", section: "Period and scope", note: "Blank uses the platform’s invoice terms" },
              { name: "note", label: "Note (shown only on the invoice record)", type: "text", section: "Period and scope" },
              { name: "excludeTrial", label: "Schools in a trial", type: "switch", on: true, note: "No invoice until conversion", section: "Exclusions" },
              { name: "excludeGracePeriod", label: "Schools in grace period", type: "switch", on: true, note: "Chased on the existing invoice instead", section: "Exclusions" },
              { name: "excludeUnverified", label: "Schools not yet verified", type: "switch", on: false, note: "Their registration has not been checked in Reviews & Cases", section: "Exclusions" }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

{activeTab === "overview" ? (
        <>
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Reconciled (month)" value={formatCompactCurrency(reconciledMonth?.amount ?? 0)} detail={reconciledMonth ? `Payments recorded in ${reconciledMonth.month}` : "No payments recorded yet"} icon={Repeat2} tone="dark" />
            <StatCard label="Run rate" value={formatCompactCurrency(revenue.arr)} detail="Current-term billing across the year" icon={TrendingUp} tone="success" />
            <StatCard label="ARPU per school" value={formatCompactCurrency(arpu)} detail={`Across ${revenue.totalPaidSchools} paying school${revenue.totalPaidSchools === 1 ? "" : "s"}`} icon={DollarSign} tone="info" />
            <StatCard label="Churn last term" value={`${churnRatePct}%`} detail={`${notRenewedCount} of ${report.activeSchoolCount} did not renew`} icon={AlertTriangle} tone="warning" />
            <StatCard label="Renewal pipeline" value={formatCompactCurrency(report.mrr)} detail={`Next term · ${report.activeSchoolCount} schools`} icon={Calendar} tone="success" />
            <StatCard label="Credit revenue" value={formatCompactCurrency(report.notificationCreditRevenue)} detail={`${report.creditRevenueSharePct}% of platform revenue`} icon={CreditCard} tone="accent" />
          </section>

          <section className="grid items-start gap-[14px] xl:grid-cols-[1fr_1.25fr]">
            <BarList
              title="Revenue split by tier"
              items={schoolsWithRevenue.map((item, index) => {
                const tierMrr = (planByTier.get(item.plan)?.monthlyPrice ?? 0) * item.count;
                return { label: `${planLabel(item.plan)} · ${item.count} subscription${item.count === 1 ? "" : "s"}`, value: formatCompactCurrency(tierMrr), pct: (tierMrr / maxTierMrr) * 100, tone: (["ink", "teal", "mid", "soft"] as const)[Math.min(index, 3)] };
              })}
              empty="No active paid subscriptions yet."
              footer={
                <>
                  <p className="text-[12.5px] font-semibold text-(--color-text-primary)">Additional billing rules</p>
                  <ul className="mt-2 grid gap-2">
                    {billingRules(trialPolicy.days).map((rule) => (
                      <li key={rule} className="flex gap-2 text-[11.5px] leading-normal text-[#435048]">
                        <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#435048]" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </>
              }
            />
          <TableCard
            title="Subscription structure"
            description="Per term · the tier follows the student count confirmed each term"
            items={activePlans}
            emptyState="No active plans. Configure one in Plans & Features."
            getRowKey={(plan) => plan.id}
            columns={[
              { key: "tier", header: "Tier", render: (plan) => <span className="font-bold text-(--color-text-primary)">{planLabel(plan.plan)}</span> },
              { key: "range", header: "Student range", render: (plan) => studentRangeLabel(plan) },
              { key: "naira", header: "Naira", render: (plan) => planPriceLabel(plan) },
              { key: "usd", header: "USD", render: (plan) => planUsd(plan, usdRate) },
              { key: "addons", header: "Key add-ons unlocked", render: (plan) => planAddOns(plan) }
            ]}
          />
          </section>

          <TableCard
            title={`Tier recommendations — ${termLabel ?? "this term"} rollover`}
            description="Student counts were confirmed at term start. The system recommends; it never applies a tier change by itself."
            footnote={`${tierRecommendations.length} recommendation${tierRecommendations.length === 1 ? "" : "s"} · accept or dismiss per school. Dismissing asks for a reason and keeps the school on its current tier until someone decides otherwise. Nothing here changes a price by itself.`}
            items={tierRecommendations}
            emptyState="No school's real headcount currently mismatches its tier."
            getRowKey={(row) => row.school.id}
            columns={[
              {
                key: "school",
                header: "School",
                render: (row) => (
                  <div>
                    <p className="font-bold text-(--color-text-primary)">{row.school.name}</p>
                    <p className="text-[11.5px] text-[#5f6e65]">{[row.school.city, row.school.state].filter(Boolean).join(", ") || "—"}</p>
                  </div>
                )
              },
              { key: "confirmed", header: "Confirmed", render: (row) => row.school.totalStudents.toLocaleString() },
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
                  <span className="font-bold" style={{ color: row.termlyDifference >= 0 ? "var(--color-success)" : "var(--color-warning)" }}>
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
                    return <span className="text-[11.5px] text-[#5f6e65]" title={dismissed.reason}>Dismissed by {dismissed.by} · {dismissed.reason}</span>;
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
        </>
      
      ) : null}

      {activeTab === "invoices" ? <InvoicesTab billing={billing} params={params} allInvoices={allInvoices} /> : null}
      {activeTab === "trials" ? <TrialsTab trialBilling={trialBilling} trialPolicy={trialPolicy} /> : null}
      {activeTab === "wallets" ? <WalletsTab billing={billing} /> : null}
      {activeTab === "pricing" ? <PricingPromotionsTab billing={billing} /> : null}
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
    <div className="grid gap-[14px]">
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
            <Link href="/super-admin/billing?tab=invoices" className="text-[11.5px] font-semibold text-(--color-text-accent) hover:underline">
              Clear
            </Link>
          ) : null}
        </form>
      }
      actions={
        <ResourceActionDialog
          triggerLabel="Draft invoice"
          title="Draft a new invoice"
          description="Create a draft invoice for a school. It is not visible to the school until it is reviewed and sent."
          endpoint="/api/super-admin/billing/invoices"
          method="POST"
          submitLabel="Create draft"
          note="A draft can be edited or cancelled freely; once sent, it can only be cancelled with a reason."
          impact={{ label: "On saving", rows: [["A draft invoice", "Numbered, in the school’s own currency, and not yet sent to anyone"], ["The school sees nothing", "Until you send it from the Invoices list"]] }}
          fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "Who is being billed" },
            { name: "amount", label: "Amount (₦)", type: "number", required: true, section: "The amount" },
            { name: "taxAmount", label: "Tax (₦)", type: "number", defaultValue: 0, section: "The amount" },
            { name: "dueAt", label: "Due date", type: "date", section: "The amount", note: "Blank uses the platform’s invoice terms" },
            { name: "note", label: "Internal note", type: "textarea", section: "Note", note: "Shown only on the invoice record, never to the school" }
          ]}
        />
      }
      columns={[
        { key: "invoiceNo", header: "Invoice", render: (item) => item.invoiceNo },
        { key: "school", header: "School", render: (item) => item.schoolName },
        { key: "students", header: "Students", render: (item) => (item.students ?? 0).toLocaleString() },
        { key: "amount", header: "Amount", render: (item) => <div><p className="font-semibold text-(--color-text-primary)">{formatCurrency(item.totalAmount)}</p>{item.amountPaid > 0 && item.amountPaid < item.totalAmount ? <p className="text-[10.5px] text-(--color-text-muted)">{formatCurrency(item.amountPaid)} paid</p> : null}</div> },
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
                  title="Send this invoice to the school"
                  description="The invoice already exists. This is the act of putting it in front of the people who pay it."
                  endpoint={`/api/super-admin/billing/invoices/${item.id}/send`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Send invoice"
                  note="A draft becomes issued the moment it is sent — this cannot be undone."
                  fields={[
                    { name: "invoice", label: "Invoice", type: "static", placeholder: `${item.invoiceNo} · ${item.schoolName}`, section: "What is being sent" },
                    { name: "amount", label: "Amount", type: "static", placeholder: formatCurrency(item.totalAmount), section: "What is being sent" },
                    { name: "due", label: "Due", type: "static", placeholder: formatDate(item.dueAt), section: "What is being sent" },
                    { name: "channel", label: "Goes to", type: "static", placeholder: "The school owner’s email", section: "Who receives it" }
                  ]}
                />
              ) : null}
              {item.status !== "VOID" && item.status !== "PAID" && item.status !== "DRAFT" ? (
                <ResourceActionDialog
                  triggerLabel="Send a reminder"
                  title="Send a payment reminder"
                  description="A reminder outside the automatic sequence, because someone decided this school needs it now."
                  endpoint="/api/super-admin/billing-extras/invoices/remind"
                  method="POST"
                  variant="menu"
                  submitLabel="Send reminder"
                  note="Reminders are administrative, not commercial, so they go out regardless of marketing consent."
                  impact={{ label: "What happens", rows: [["The school is reminded", "By email to the owner and in-app to its owner and bursar"], ["The chase is on record", "The invoice’s history says who sent it, so nobody chases twice"]] }}
                  fields={[
                    { name: "invoiceIds", label: "Invoice", type: "select", parse: "csv", defaultValue: item.id, options: [{ label: `${item.invoiceNo} · ${item.schoolName}`, value: item.id }], section: "Which invoice" },
                    { name: "outstanding", label: "Outstanding", type: "static", placeholder: formatCurrency(item.totalAmount - item.amountPaid), section: "Which invoice" },
                    { name: "dueDate", label: "Due", type: "static", placeholder: formatDate(item.dueAt), section: "Which invoice" }
                  ]}
                />
              ) : null}
              {item.status !== "VOID" && item.status !== "PAID" ? (
                <ResourceActionDialog
                  triggerLabel="Record payment"
                  title="Record a payment"
                  description="A transfer has landed. This is the act of tying it to an invoice, a school and a person."
                  endpoint={`/api/super-admin/billing/invoices/${item.id}/payments`}
                  method="POST"
                  variant="menu"
                  submitLabel="Record payment"
                  note="You record it. Someone else reconciles it against the bank statement — the same person cannot do both."
                  impact={{
                    label: "What this produces",
                    rows: [
                      ["A payment awaiting reconciliation", "A second person matches it to the bank statement before it reads Reconciled"],
                      ["Invoice status", "Moves to Paid when the amounts recorded cover the total, otherwise to Partially Paid"],
                      ["The account", "A school that was suspended or in grace period is reactivated once the invoice is paid in full"]
                    ]
                  }}
                  fields={[
                    { name: "school", label: "School", type: "static", placeholder: item.schoolName, section: "Which school, which invoice" },
                    { name: "invoice", label: "Invoice", type: "static", placeholder: `${item.invoiceNo} · ${formatCurrency(item.totalAmount)}`, section: "Which school, which invoice" },
                    { name: "total", label: "Invoice total", type: "static", placeholder: formatCurrency(item.totalAmount), section: "Which school, which invoice" },
                    { name: "paid", label: "Already paid", type: "static", placeholder: formatCurrency(item.amountPaid), section: "Which school, which invoice" },
                    { name: "payerName", label: "Name of the person who paid", required: true, placeholder: "e.g. Mrs. Ifeoma Nwachukwu", section: "Who paid it" },
                    { name: "payerRole", label: "Their role at the school", placeholder: "e.g. Bursar", section: "Who paid it" },
                    { name: "onBehalfOf", label: "Paying on behalf of", placeholder: "Leave blank if the school itself", section: "Who paid it", note: "An NGO or partner sometimes pays for a school — say so here" },
                    { name: "receiptEmail", label: "Contact for the receipt", type: "email", section: "Who paid it" },
                    { name: "amount", label: "Amount received (₦)", type: "number", required: true, defaultValue: Math.max(0, item.totalAmount - item.amountPaid), section: "The money" },
                    { name: "paidOn", label: "Date received", type: "date", section: "The money" },
                    { name: "method", label: "Method", type: "select", options: [{ label: "Bank transfer", value: "BANK_TRANSFER" }, { label: "POS", value: "POS" }, { label: "Cash", value: "CASH" }], section: "The money" },
                    { name: "reference", label: "Bank reference / receipt no.", required: true, section: "The money", note: "Required — it is what ties the money to this invoice" }
                  ]}
                />
              ) : null}
              {item.status !== "VOID" && item.status !== "PAID" ? (
                <ResourceActionDialog
                  triggerLabel="Cancel invoice"
                  title={`Cancel invoice ${item.invoiceNo}`}
                  description="Void this invoice. The reason is kept with it permanently."
                  note="A cancelled invoice can no longer be paid or chased."
                  endpoint={`/api/super-admin/billing/invoices/${item.id}/cancel`}
                  method="PATCH"
                  variant="menuDanger"
                  submitLabel="Cancel invoice"
                  confirmLabel="Confirm"
                  confirmMessage="This voids the invoice permanently."
                  fields={[{ name: "reason", label: "Why it is being cancelled", type: "textarea", required: true, section: "Reason" }]}
                />
              ) : null}
            </ActionMenu>
          )
        }
      ]}
      emptyState="No invoices drafted yet."
        />
      </div>

      <div className="grid items-start gap-[14px] xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="What each status means"
          description="Six states, and only these six. A school and Future Realm read the same word for the same thing."
          items={invoiceStatusReference}
          pageSize={false}
          getRowKey={(row) => row.status}
          columns={[
            { key: "status", header: "Status", render: (row) => { const tone = invoiceStatusTone[row.status.toUpperCase().replace(/\s+/g, "_")] ?? invoiceStatusTone.DRAFT; return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{row.status}</span>; } },
            { key: "meaning", header: "Meaning", render: (row) => <span className="text-[12px] text-(--color-text-secondary)">{row.meaning}</span> }
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
            { key: "school", header: "School", render: (item) => <span className="font-semibold text-(--color-text-primary)">{item.schoolName}</span> },
            { key: "invoice", header: "Invoice", render: (item) => item.invoiceNo ?? "—" },
            { key: "amount", header: "Amount", render: (item) => formatCurrency(item.amount) },
            { key: "recordedBy", header: "Recorded by", render: (item) => item.recordedBy },
            { key: "reference", header: "Bank reference", render: (item) => <span className="font-(--font-mono) text-[11px]">{item.reference}</span> },
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
            { key: "school", header: "School", render: (item) => <div><p className="font-bold text-(--color-text-primary)">{item.school}</p><p className="text-[10px] text-(--color-text-muted)">{item.kind === "NGO" ? "NGO" : "Mission"}{item.state ? ` · ${item.state}` : ""}</p><p className="text-[10px] text-(--color-text-muted)">{item.evidence ?? "No evidence recorded"}{item.evidenceRef ? ` · ${item.evidenceRef}` : ""}{item.verifiedAt ? ` · verified ${new Date(item.verifiedAt).toLocaleDateString("en-GB")} by ${item.verifiedBy ?? "—"}` : ""}</p></div> },
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

  const dormancy = (await apiGet<{ dormancy?: { dormantDays: number; noticeDays: number } }>("/api/super-admin/platform-policy").catch(() => null))?.dormancy;
  const wizardByUser = new Map((journey?.pipeline ?? []).map((row) => [row.schoolId, row.wizardTotal > 0 ? row.wizardDone / row.wizardTotal : 0]));
  const engagement = (schoolId: string) => {
    const share = wizardByUser.get(schoolId) ?? 0;
    return share >= 2 / 3 ? "High" : share >= 1 / 3 ? "Medium" : "Low";
  };

  return (
    <div className="grid gap-[14px]">
      <div className="grid items-start gap-[14px] xl:grid-cols-[1.7fr_1fr]">
      <TableCard
        title="Trials in progress"
        description="Every school still inside its trial, nearest the end first"
        items={trials}
        pageSize={false}
        getRowKey={(trial) => trial.schoolId}
        emptyState="No schools currently on trial. Trial schools will appear here as they self-onboard."
        columns={[
          { key: "school", header: "School", render: (trial) => <span className="font-bold text-(--color-text-primary)">{trial.schoolName}</span> },
          {
            key: "day",
            header: "Trial day",
            render: (trial) => (
              <div className="flex items-center gap-[10px]">
                <span className="whitespace-nowrap">{trial.daysRemaining === null ? "—" : `Day ${Math.min(trialPolicy.days, Math.max(0, trialPolicy.days - trial.daysRemaining))} of ${trialPolicy.days}`}</span>
                <div className="h-[5px] w-[56px] overflow-hidden rounded-full bg-[#EDF3EF]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, trial.pct)}%`, background: trial.daysRemaining !== null && trial.daysRemaining <= 2 ? "#DB5555" : trial.daysRemaining !== null && trial.daysRemaining <= 7 ? "#D9A22C" : "#12796A" }} />
                </div>
              </div>
            )
          },
          {
            key: "remaining",
            header: "Days remaining",
            render: (trial) => (
              <span className="font-bold" style={{ color: trial.daysRemaining !== null && trial.daysRemaining <= 2 ? "#DB5555" : "var(--color-text-primary)" }}>
                {trial.daysRemaining === null ? "—" : trial.daysRemaining < 0 ? `Overdue ${Math.abs(trial.daysRemaining)} days` : `${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"}`}
              </span>
            )
          },
          { key: "engagement", header: "Engagement", render: (trial) => <StatusBadge status={engagement(trial.schoolId)} /> },
          {
            key: "action",
            header: "Action",
            render: (trial) => (
              <ResourceActionDialog
                triggerLabel="Extend trial"
                title={`Extend trial for ${trial.schoolName}`}
                description="Add trial days and move billing due date forward. The reason and the admin who approved it are logged."
                endpoint={`/api/super-admin/billing/${trial.schoolId}/extend-trial`}
                method="POST"
                variant="textAction"
                submitLabel="Extend trial"
                fields={[{ name: "days", label: "Days", type: "number", defaultValue: 14, min: 1, max: 365 }]}
              />
            )
          }
        ]}
        footnote="Engagement is how much of the school's setup wizard is done: High is two-thirds or more, Medium a third or more, otherwise Low."
      />

      <div className="grid gap-[14px]">
      <ReferenceList
        title="Automatic trial alerts"
        items={[
          { label: `${trialPolicy.lockReminderDays} days before the trial ends`, detail: "The owner is told the trial is ending, by email and in-app", tone: "warn" },
          { label: "The day it ends", detail: `The school becomes read-only for ${trialPolicy.readOnlyDays} days and the owner is told the date it will be locked`, tone: "warn" },
          { label: `${trialPolicy.lockReminderDays} days before the lock`, detail: "The owner is reminded the school is about to be locked", tone: "warn" },
          { label: `${trialPolicy.readOnlyDays} days after the trial`, detail: "The school is locked. Nothing is deleted; only support can reopen it", tone: "bad" },
          ...(dormancy ? [{ label: `${dormancy.dormantDays} days without a login`, detail: `Account moves to Dormant · web address released ${dormancy.noticeDays} days after notice`, tone: "bad" as const }] : []),
          { label: "Trial extended", detail: "Logged with the reason and the admin who approved it", tone: "good" }
        ]}
      />

      <section className="rounded-[14px] border border-(--color-border-default) bg-(--color-bg-subtle) px-5 py-4">
        <h3 className="text-[12.5px] font-semibold text-(--color-text-primary)">Post-trial behaviour</h3>
        <p className="mt-1 text-pretty text-[12.5px] leading-[1.6] text-[#435048]">
          At day {trialPolicy.days} the school moves to Trial Ended — read-only for {trialPolicy.readOnlyDays} days, then locked at day {trialPolicy.days + trialPolicy.readOnlyDays}. Data is retained in full, never deleted, and restored instantly on conversion.
        </p>
      </section>
      </div>
      </div>

      <TableCard
        title={`Trial communication schedule — day 0 to day ${trialPolicy.days + trialPolicy.readOnlyDays}`}
        description="Every message below the lifecycle ones is a template in Communications, not text embedded in code, so it can be edited without a deployment. Attach a template to a trigger there."
        items={journey?.schedule ?? []}
        pageSize={false}
        getRowKey={(row) => row.key}
        actions={<ResourceActionDialog triggerLabel="Check now" title="Check the trial schedule now" description="Sends whatever is due to schools on a trial, or records why it was held back. It also runs by itself every hour." endpoint="/api/super-admin/billing-extras/trial-journey/run" method="POST" variant="secondary" submitLabel="Check now" fields={[]} />}
        emptyState="No trial schedule is available."
        columns={[
          { key: "day", header: "Day", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.day}</span> },
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
          { key: "school", header: "School", render: (row) => <span className="font-bold text-(--color-text-primary)">{row.school}</span> },
          { key: "day", header: "Day", render: (row) => (row.day === null ? "Not started" : row.day) },
          { key: "last", header: "Last sent", render: (row) => row.last ?? <span className="text-(--color-text-muted)">Nothing yet</span> },
          { key: "next", header: "Next scheduled", render: (row) => row.next ?? "—" },
          { key: "failed", header: "Failed", render: (row) => (row.failed ? <span className="font-semibold text-danger">{row.failed}</span> : 0) },
          { key: "wizard", header: "Wizard", render: (row) => <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-[#EDF3EF]"><div className="h-1.5 rounded-full" style={{ width: `${(row.wizardDone / row.wizardTotal) * 100}%`, background: row.wizardDone >= row.wizardTotal ? "var(--color-success)" : row.wizardDone <= 2 ? "var(--color-danger)" : "var(--color-warning)" }} /></div><span className="text-[11px]">{row.wizardDone} of {row.wizardTotal}</span></div> }
        ]}
        footnote="A failed send is a failed delivery on the school's own record, so it lands in the contact-quality repair queue under Users → Reviews & Cases rather than disappearing."
      />

    </div>
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
  const byHandFields = (row?: WalletsView["rows"][number]) => [
    row
      ? { name: "schoolId", label: "School", type: "select" as const, defaultValue: row.schoolId, options: schoolOptions.filter((option) => option.value === row.schoolId), section: "Which school, and which channel" }
      : { name: "schoolId", label: "School", type: "select" as const, options: schoolOptions, section: "Which school, and which channel" },
    { name: "channel", label: "Channel", type: "select" as const, defaultValue: "SMS", options: [{ label: "SMS credits", value: "SMS" }, { label: "WhatsApp credits", value: "WHATSAPP" }], section: "Which school, and which channel" },
    ...(row
      ? [
          { name: "balance", label: "Balance now", type: "static" as const, placeholder: `${row.sms.toLocaleString("en-NG")} SMS · ${row.whatsapp.toLocaleString("en-NG")} WhatsApp`, section: "Which school, and which channel" },
          { name: "burn", label: "Spend, last 30 days", type: "static" as const, placeholder: `${row.burn30.toLocaleString("en-NG")} SMS credits · floor ${row.floor.toLocaleString("en-NG")}`, section: "Which school, and which channel" }
        ]
      : []),
    { name: "credits", label: "Credits to add", type: "number" as const, defaultValue: 1000, min: 1, max: 500000, section: "How much", note: "Matching what the failed automatic charge would have bought is the usual choice" },
    { name: "reason", label: "Why it is being added", type: "textarea" as const, required: true, placeholder: "e.g. Automatic charge failed three times; the school has confirmed payment by transfer", section: "Why it is being added", note: "Goes in the register beside your name" },
    { name: "tellSchool", label: "Tell the school the credit was added", type: "switch" as const, on: true, note: "In-app to its owner and by email, with the amount and the reason", section: "Alongside the credit" }
  ];
  const byHandNote = "A credit added by hand is a stopgap. It keeps messages flowing today; it does not fix the payment method that failed.";
  const byHandImpact = { label: "On saving", rows: [["Credit is available immediately", "Anything held for this school sends at the next delivery run"], ["Written to the wallet register", "Shown as “Added by hand” against your name, with your reason"]] as Array<[string, string]> };

  return (
    <div className="grid gap-[14px]">
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
            title="Add wallet balance by hand"
            description="For a school whose automatic charge failed. Credit goes on now; the payment method is fixed separately."
            note={byHandNote}
            impact={byHandImpact}
            endpoint="/api/super-admin/billing-extras/wallets/top-up"
            method="POST"
            variant="primary"
            submitLabel="Add the credit"
            fields={byHandFields()}
          />
        }
        footnote="A credit added by hand is a stopgap. It keeps a school’s messages flowing today; it does not fix the payment method that failed."
        columns={[
          { key: "school", header: "School", render: (item) => <span className="font-bold text-(--color-text-primary)">{item.school}</span> },
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
                  title="Add wallet balance by hand"
                  description={`${item.school}: for when the automatic charge failed. Credit goes on now; the payment method is fixed separately.`}
                  note={byHandNote}
                  impact={byHandImpact}
                  endpoint="/api/super-admin/billing-extras/wallets/top-up"
                  method="POST"
                  variant="textAction"
                  submitLabel="Add the credit"
                  fields={byHandFields(item)}
                />
                <Link href={`/super-admin/schools/${item.schoolId}` as Route} className="text-[11.5px] font-semibold text-(--color-text-accent) hover:underline">Open</Link>
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
          { key: "school", header: "School", render: (item) => <span className="font-bold text-(--color-text-primary)">{item.school}</span> },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "amount", header: "Amount", render: (item) => <span className="font-bold">{item.amount}</span> },
          { key: "trigger", header: "Trigger", render: (item) => <span className="text-[11px] text-(--color-text-secondary)">{item.trigger}</span> },
          { key: "gateway", header: "Gateway", render: (item) => item.gateway },
          { key: "reference", header: "Reference", render: (item) => <span className="font-mono text-[11px]">{item.reference}</span> },
          { key: "outcome", header: "Outcome", render: (item) => pill(item.outcome, item.tone) }
        ]}
      />

      <div className="grid items-start gap-[14px] xl:grid-cols-[1.4fr_1fr]">
        <TableCard
          title="Provider rate card"
          description="What FutureRealm pays the provider against what the school pays. The only figure on this tab a school must never see. Super Admin only."
          items={view.rate}
          getRowKey={(item) => item.channel}
          pageSize={false}
          actions={
            <ResourceActionDialog
              triggerLabel="Enter provider costs"
              title="What the provider charges FutureRealm"
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
            { key: "channel", header: "Channel", render: (item) => <span className="font-bold text-(--color-text-primary)">{item.channel}</span> },
            { key: "cost", header: "Cost to FutureRealm", render: (item) => item.cost },
            { key: "price", header: "Price to school", render: (item) => item.price },
            { key: "margin", header: "Margin", render: (item) => pill(item.margin.text, item.margin.tone) }
          ]}
        />
        <ReferenceList
          title="When a balance runs low"
          sub="The sequence is automatic and the school is told at each step — nobody at FutureRealm has to notice first."
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

async function PricingPromotionsTab({ billing }: { billing: SuperAdminBillingRow[] }) {
  const codes = (await apiGetEnvelope<SuperAdminPromoCodeRow[]>("/api/super-admin/billing/promo-codes")).data ?? [];
  const schoolOptions = billing.map((item) => ({ label: item.schoolName, value: item.schoolId }));
  const now = Date.now();
  const stateOf = (code: SuperAdminPromoCodeRow) => (code.expiresAt && new Date(code.expiresAt).getTime() < now ? "Expired" : code.isActive ? "Active" : "Inactive");
  const activeCodes = codes.filter((code) => stateOf(code) === "Active");
  const totalRedemptions = codes.reduce((sum, code) => sum + code.uses, 0);
  const totalDiscountIssued = codes.reduce((sum, code) => sum + code.totalDiscountIssued, 0);
  const totalSchoolsConverted = codes.reduce((sum, code) => sum + code.schoolsConverted, 0);
  const campaignCount = new Set(activeCodes.map((code) => code.campaignName ?? code.code)).size;
  const stat = (label: string, value: string, sub: string) => (
    <div key={label}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#5f6e65]">{label}</p>
      <p className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-(--color-text-primary)">{value}</p>
      <p className="mt-0.5 text-[11.5px] text-[#5f6e65]">{sub}</p>
    </div>
  );

  return (
    <TableCard
      title="Promo codes"
      description="Discount codes, the campaign each belongs to, and how they have been used."
      items={codes}
      getRowKey={(code) => code.id}
      emptyState="No promo codes created yet."
      footnote={
        <div className="grid gap-4 md:grid-cols-3">
          {stat("Total redemptions", totalRedemptions.toLocaleString(), `Across ${campaignCount} active campaign${campaignCount === 1 ? "" : "s"}`)}
          {stat("Total discount issued", formatCurrency(totalDiscountIssued), "Across all codes")}
          {stat("Schools converted via codes", totalSchoolsConverted.toLocaleString(), "Schools that paid after redeeming a code")}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <ResourceActionDialog
            triggerLabel="Apply a code"
            title="Apply a promo code to a school"
            description="Applies the code's discount to one school's account."
            endpoint="/api/super-admin/billing/promo-codes/apply"
            method="POST"
            variant="secondary"
            submitLabel="Apply code"
            fields={[
              { name: "code", label: "Code", type: "select", required: true, options: codes.map((code) => ({ label: code.code, value: code.code })) },
              { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
              { name: "reason", label: "Reason", type: "textarea", required: true }
            ]}
          />
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
        </div>
      }
      columns={[
        { key: "code", header: "Code", render: (code) => <span className="font-bold text-(--color-text-primary)">{code.code}</span> },
        { key: "discount", header: "Discount", render: (code) => (code.type === "PERCENTAGE" ? `${code.value}% off` : `${formatCurrency(code.value)} flat`) },
        { key: "campaign", header: "Campaign", render: (code) => code.campaignName ?? "—" },
        { key: "redemptions", header: "Redemptions", render: (code) => `${code.uses} / ${code.maxUses ?? "—"}` },
        { key: "validTo", header: "Valid to", render: (code) => (code.expiresAt ? formatDate(code.expiresAt) : "No expiry") },
        { key: "status", header: "Status", render: (code) => <StatusBadge status={stateOf(code)} /> }
      ]}
    />
  );
}
