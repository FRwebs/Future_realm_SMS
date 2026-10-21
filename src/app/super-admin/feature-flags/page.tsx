import { FlowSteps } from "@/components/data-display/flow-steps";
import { ReferenceList } from "@/components/data-display/reference-list";
import type { ReactNode } from "react";
import { Archive, Clock3, Layers, Repeat2, School, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";

import { type CaseRecord, type CaseTypeFilter, CaseReviewBoard } from "@/components/data-display/case-review-board";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PlanCreateDialog } from "@/components/super-admin/plan-action-dialogs";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import { FeatureMatrixTable } from "./_feature-matrix-table";
import { PlanCardGrid } from "./_plan-cards";
import type {
  SuperAdminBrandingAssetRow,
  SuperAdminChurnAnalysis,
  SuperAdminFeatureFlagCaseHistory,
  SuperAdminFeatureFlagRow,
  SuperAdminFeatureOverrideRow,
  SuperAdminInternalMember,
  SuperAdminPlanLifecycleRow,
  SuperAdminPlanRow,
  SuperAdminProductAdoption,
  SuperAdminSchoolRow
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

function daysBetween(fromMs: number, toMs: number) {
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

function formatAge(createdAt: string) {
  const days = daysBetween(new Date(createdAt).getTime(), Date.now());
  if (days <= 0) return "Today";
  return days === 1 ? "1d" : `${days}d`;
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

type PlansOverview = {
  versions: Array<{ id: string; plan: string; version: number; summary: string; by: string; at: string }>;
  prices: Array<{ id: string; plan: string; planId: string; oldMonthly: number; newMonthly: number; oldAnnual: number; newAnnual: number; announcedAt: string; effectiveAt: string; status: string; told: number; reason: string | null; by: string }>;
  rates: Array<{ tier: string; upgrades: number; downgrades: number }>;
  noticeDays: number;
};

type MatrixView = {
  tiers: Array<{ tier: string; schools: number }>;
  features: Array<{ id: string; name: string; module: string; featureKey: string | null; enforcedAt: string | null; version: number; access: Record<string, boolean>; updatedAt: string }>;
  registry: Array<{ key: string; name: string; module: string; enforcedAt: string | null }>;
  changes: Array<{ id: string; feature: string; kind: string; before: Record<string, boolean> | null; after: Record<string, boolean>; reason: string; migrationPlan: string | null; affectedSchools: number; by: string; at: string }>;
};

type StageRow = { id: string; flag: string; key: string; from: string; to: string; percent: number; note: string | null; by: string; at: string };

const TIER_LABEL: Record<string, string> = { BASIC: "Basic", STANDARD: "Standard", PROFESSIONAL: "Professional", ENTERPRISE: "Enterprise", CUSTOM: "Custom" };

const rolloutOptions = [
  { label: "Off", value: "OFF" },
  { label: "Pilot", value: "PILOT" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Full", value: "FULL" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "plans" ? "/super-admin/feature-flags" : `/super-admin/feature-flags?tab=${tab}`;
}

export default async function SuperAdminFeatureFlagsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const validTabs = new Set(["plans", "matrix", "exceptions", "rollout"]);
  const tab = validTabs.has(params.tab ?? "") ? (params.tab as string) : "plans";

  // Fetched once here (in addition to inside ExceptionsTab) purely to compute the "Exceptions"
  // tab badge, which must be visible regardless of which tab is currently active.
  const [overridesForBadge, brandingForBadge] = await Promise.all([
    apiGet<SuperAdminFeatureOverrideRow[]>("/api/super-admin/feature-flags/overrides"),
    apiGet<SuperAdminBrandingAssetRow[]>("/api/super-admin/feature-flags/branding")
  ]);
  const now = Date.now();
  const activeOverrideCount = (overridesForBadge ?? []).filter(
    (item) => item.status === "APPROVED" && (!item.expiryDate || new Date(item.expiryDate).getTime() > now)
  ).length;
  const activeBrandingCount = (brandingForBadge ?? []).filter((item) => item.status === "APPLIED").length;
  const exceptionsCount = activeOverrideCount + activeBrandingCount;

  const members = await apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team").catch(() => [] as SuperAdminInternalMember[]);

  const tabs = [
    { label: "Plans", href: tabHref("plans"), active: tab === "plans" },
    { label: "Feature Matrix", href: tabHref("matrix"), active: tab === "matrix" },
    { label: "Plan Exceptions", href: tabHref("exceptions"), active: tab === "exceptions", badge: exceptionsCount },
    { label: "Rollout", href: tabHref("rollout"), active: tab === "rollout" }
  ];

  return (
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 08"
        title="Plans & Features"
        description="Commercial packaging held apart from product capability."
        action={
          <ResourceActionDialog
            triggerLabel="New feature flag"
            title="New feature flag"
            description="A capability ships in stages, with exit criteria and a way back. Every flag starts Off."
            endpoint="/api/super-admin/plans-features/flags"
            variant="heroWhite"
            submitLabel="Create flag"
            note="Every flag carries an instant platform-wide rollback from its own row on the Rollout tab." fields={[
              { name: "name", label: "Flag name", required: true, section: "The capability" },
              { name: "key", label: "Key", required: true, placeholder: "module.feature-name", section: "The capability" },
              { name: "area", label: "Area", placeholder: "e.g. Report Cards, Fees, Communications", section: "The capability" },
              { name: "ownerId", label: "Owner", type: "select", defaultValue: "", options: [{ label: "Nobody yet", value: "" }, ...members.filter((m) => m.status === "ACTIVE" || !m.status).map((m) => ({ label: `${m.name} · ${m.role.replaceAll("_", " ").toLowerCase()}`, value: m.id }))], note: "The person accountable for deciding when each stage is done.", section: "The capability" },
              { name: "description", label: "What it does", type: "textarea", section: "The capability" },
              { name: "exitCriteria", label: "Exit criteria", type: "textarea", placeholder: "In measurable terms — e.g. no new support tickets for 7 days and PDF generation under 4s", note: "Required before the flag can leave Off.", section: "First stage" },
              { name: "observationDays", label: "Observation window (days per stage)", type: "number", defaultValue: 7, min: 0, max: 90, note: "How long a flag must sit in a stage before it can move up. A Super Admin can waive it with a reason.", section: "First stage" },
              { name: "stage", label: "Stage", type: "static", placeholder: "Off", note: "Move it to Pilot, Partial or Full from its row on the Rollout tab. Pilot schools are named and told then.", section: "First stage" }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "plans" ? <PlansTab /> : null}
      {tab === "matrix" ? <TierMatrixTab /> : null}
      {tab === "exceptions" ? <ExceptionsTab /> : null}
      {tab === "rollout" ? <RolloutTab /> : null}
    </div>
  );
}

type Currencies = {
  term: string | null; anchor: "NGN" | "USD"; source: string; ratesFor: string; shockPercent: number; refreshConfigured: boolean;
  rates: { usd: number; ghs: number; kes: number; gbp: number };
  usdPrices: { STANDARD: number; PREMIUM: number; ELITE: number };
  pending: { ratesFor: string; ngnPerUsd: number; ngnPerGhs: number; ngnPerKes: number; ngnPerGbp: number; moved: string; source: string; proposedBy: string; at: string } | null;
  tiers: Array<{ key: string; name: string; ngn: number; usd: number | null; ghs: number | null; kes: number | null; gbp: number | null }>;
};

async function PlansTab() {
  const [plans, migrations, currencies, churn, adoption, overview] = await Promise.all([
    apiGet<SuperAdminPlanRow[]>("/api/super-admin/plans"),
    apiGet<SuperAdminPlanLifecycleRow[]>("/api/super-admin/feature-flags/lifecycle"),
    apiGet<Currencies>("/api/super-admin/billing-extras/currencies"),
    apiGet<SuperAdminChurnAnalysis>("/api/super-admin/analytics/churn"),
    apiGet<SuperAdminProductAdoption>("/api/super-admin/analytics/product-adoption"),
    apiGet<PlansOverview>("/api/super-admin/plans-features/plans")
  ]);
  const ratesByTier = new Map((overview?.rates ?? []).map((row) => [row.tier, row]));
  const tierColumns = adoption?.tierColumns ?? [];
  const heatmapByTier = adoption?.heatmapByTier ?? [];
  const churnByTier = new Map((churn?.byTier ?? []).map((row) => [row.plan, row]));
  const planHealth = tierColumns
    .filter((tier) => tier.schoolCount > 0)
    .map((tier, tierIndex) => {
      const adoptionValues = heatmapByTier.map((row) => row.cells[tierIndex]).filter((value): value is number => value !== null);
      const adoptionIndex = adoptionValues.length > 0 ? Math.round(adoptionValues.reduce((sum, value) => sum + value, 0) / adoptionValues.length) : null;
      const churnPct = churnByTier.get(tier.plan)?.ratePct ?? 0;
      const verdict = churnPct >= 8 ? "High churn for this tier — worth reviewing pricing or entitlements" : adoptionIndex === null ? "Not enough module-adoption data to call this yet" : adoptionIndex < 40 ? "Low module adoption relative to other tiers" : "No churn or adoption concern flagged";
      return { tier: tier.plan, schools: tier.schoolCount, adoptionIndex, churnPct, verdict };
    });
  const termAgo = Date.now() - 120 * 86_400_000;
  const changesThisTerm = (migrations ?? []).filter((row) => new Date(row.changedAt).getTime() >= termAgo).length;
  const fx = (value: number | null, symbol: string) => (value === null ? <span className="text-[var(--color-text-muted)]">Set the rate</span> : `${symbol}${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`);
  const planRates = { usd: currencies.rates.usd, ghs: currencies.rates.ghs, kes: currencies.rates.kes, gbp: currencies.rates.gbp, shockPercent: currencies.shockPercent };
  const legacyCount = (plans ?? []).filter((plan) => plan.lifecycle === "LEGACY").length;
  const draftCount = (plans ?? []).filter((plan) => plan.lifecycle === "DRAFT").length;
  const activePlans = (plans ?? []).filter((plan) => plan.isActive);
  const totalSchools = (plans ?? []).reduce((sum, plan) => sum + plan.subscriberCount, 0);

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-[11px] md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Published plans" value={activePlans.length} detail={activePlans.map((plan) => plan.name).join(", ") || "None"} icon={Layers} tone="dark" />
        <StatCard label="Draft plans" value={draftCount} detail="Not yet offered to anyone" icon={Clock3} tone="neutral" />
        <StatCard label="Legacy plans (closed to new sales)" value={legacyCount} detail="Kept for the schools already on them" icon={Archive} tone="neutral" />
        <StatCard label="Schools on a plan" value={totalSchools.toLocaleString()} detail={`Across ${activePlans.length + legacyCount} live and legacy plans`} icon={School} tone="info" />
        <StatCard label="Plan changes this term" value={changesThisTerm} detail="Schools that changed tier in the last 120 days" icon={Repeat2} tone="success" />
      </section>

      <PlanCardGrid plans={plans ?? []} rates={planRates} actions={<PlanCreateDialog rates={planRates} />} />

      {currencies.pending ? (
        <section className="rounded-[14px] px-5 py-4" style={{ background: "var(--color-warning-dim)", border: "1px solid var(--color-warning)" }}>
          <p className="text-[11.5px] font-bold" style={{ color: "var(--color-warning)" }}>New rates for {currencies.pending.ratesFor} are held for Finance</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-secondary)]">{currencies.pending.proposedBy} proposed ₦{currencies.pending.ngnPerUsd.toLocaleString("en-NG")} per dollar ({currencies.pending.source}). It moved {currencies.pending.moved}, past the {currencies.shockPercent}% guard. Nothing changes until it is decided; the current rates stay in force.</p>
          <div className="mt-3 flex gap-2">
            <ResourceActionDialog triggerLabel="Approve the new rates" title="Approve the held rates" description="The new rates take effect now and stay fixed for the whole term. Every school is invoiced at them from here." endpoint="/api/super-admin/billing-extras/pricing/decide" method="POST" variant="secondary" submitLabel="Approve the rates" recorded={{ line: `You · approved the held rates for ${currencies.pending.ratesFor}`, before: "Held for Finance", after: "In force" }} fields={[{ name: "approve", label: "Decision", type: "hidden", defaultValue: "true" }, { name: "reason", label: "Reason", type: "textarea", required: true }]} />
            <ResourceActionDialog triggerLabel="Reject them" title="Reject the held rates" description="The current rates stay in force for the term. The proposal is closed with your reason." endpoint="/api/super-admin/billing-extras/pricing/decide" method="POST" variant="danger" submitLabel="Reject the rates" recorded={{ line: `You · rejected the held rates for ${currencies.pending.ratesFor}`, before: "Held for Finance", after: "Rejected" }} fields={[{ name: "approve", label: "Decision", type: "hidden", defaultValue: "false" }, { name: "reason", label: "Reason", type: "textarea", required: true }]} />
          </div>
        </section>
      ) : null}

      <TableCard
        title="One price, five currencies"
        description={`${currencies.anchor === "USD" ? "Each tier is authored once in US dollars; its naira price follows at the rate fixed for the term." : "Each tier is priced in naira per student per term; the other currencies are what that comes to at the rates fixed for the term."}${currencies.ratesFor ? ` Rates fixed for ${currencies.ratesFor}${currencies.source ? ` · ${currencies.source}` : ""}.` : ""} A school is always invoiced in its own currency.`}
        items={currencies.tiers}
        getRowKey={(row) => row.name}
        pageSize={false}
        actions={
          <div className="flex flex-wrap gap-2">
            {currencies.refreshConfigured ? <ResourceActionDialog triggerLabel="Fetch from the rate provider" title="Fetch the term's rates" description="Takes the rates from the provider set up for this deployment and fixes them for the current term. A move beyond the guard is held for Finance." endpoint="/api/super-admin/billing-extras/pricing/refresh" method="POST" variant="secondary" submitLabel="Fetch" fields={[]} /> : null}
            <ResourceActionDialog
              triggerLabel="Set the term's rates"
              title="Fix the term’s rates"
              description={`How many naira one unit of each currency is worth. Fixed when the term opens and never moved inside it. A move of more than ${currencies.shockPercent}% on any currency is held for Finance to decide.`}
              endpoint="/api/super-admin/billing-extras/pricing/rates"
              method="POST"
              variant="secondary"
              submitLabel="Save rates"
              note="A school is invoiced at the rate in force when the term opened. A currency shock is not a price rise."
              impact={{ label: "On saving", rows: [["Local prices follow", "Every figure in the table is worked out again from these rates"], ["Fixed for the term", "A second set cannot be saved for the same term"], ["A big move is held", `Anything beyond ${currencies.shockPercent}% on any currency waits for Finance to decide`]] }}
              fields={[
                { name: "ratesFor", label: "Term these rates are fixed for", defaultValue: currencies.term ?? "", placeholder: "e.g. Term 1 · 2026/27", section: "Which term" },
                { name: "ngnPerUsd", label: "₦ per US dollar", type: "number", defaultValue: currencies.rates.usd, min: 0, step: 0.01, section: "What one unit is worth in naira" },
                { name: "ngnPerGhs", label: "₦ per Ghana cedi", type: "number", defaultValue: currencies.rates.ghs, min: 0, step: 0.01, section: "What one unit is worth in naira" },
                { name: "ngnPerKes", label: "₦ per Kenya shilling", type: "number", defaultValue: currencies.rates.kes, min: 0, step: 0.01, section: "What one unit is worth in naira" },
                { name: "ngnPerGbp", label: "₦ per pound sterling", type: "number", defaultValue: currencies.rates.gbp, min: 0, step: 0.01, section: "What one unit is worth in naira" }
              ]}
            />
            <ResourceActionDialog
              triggerLabel="Author prices in US dollars"
              title="Price the tiers once, in US dollars"
              description="Each tier’s naira price becomes its dollar price at the term’s rate, rounded to the nearest 50 kobo — so a rate change moves every tier together."
              note="Choose Naira to go back to the built-in naira prices."
              endpoint="/api/super-admin/billing-extras/pricing/usd"
              method="POST"
              variant="secondary"
              submitLabel="Save pricing"
              fields={[
                { name: "anchor", label: "Plans are priced in", type: "select", defaultValue: currencies.anchor, options: [{ label: "Naira (built-in prices)", value: "NGN" }, { label: "US dollars", value: "USD" }], section: "The anchor" },
                { name: "STANDARD", label: "Standard — $ per student per term", type: "number", defaultValue: currencies.usdPrices.STANDARD, min: 0, step: 0.01, section: "The price you set" },
                { name: "PREMIUM", label: "Premium — $ per student per term", type: "number", defaultValue: currencies.usdPrices.PREMIUM, min: 0, step: 0.01, section: "The price you set" },
                { name: "ELITE", label: "Elite — $ per student per term", type: "number", defaultValue: currencies.usdPrices.ELITE, min: 0, step: 0.01, section: "The price you set" },
                { name: "reason", label: "Why this is changing", type: "textarea", required: true, section: "Reason" }
              ]}
            />
          </div>
        }
        footnote="The rate is fixed when the term opens and never moves inside it — a live rate would mean two schools in the same country paying differently in the same week."
        columns={[
          { key: "tier", header: "Tier", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.name}</span> },
          { key: "ngn", header: "Nigeria (₦)", render: (row) => `₦${row.ngn.toLocaleString("en-NG")}` },
          { key: "usd", header: "USD", render: (row) => fx(row.usd, "$") },
          { key: "ghs", header: "Ghana", render: (row) => fx(row.ghs, "GH₵") },
          { key: "kes", header: "Kenya", render: (row) => fx(row.kes, "KSh ") },
          { key: "gbp", header: "UK", render: (row) => fx(row.gbp, "£") }
        ]}
      />

      <TableCard
        title="Plan health — is each tier doing its job?"
        description="Grouped by the platform’s five billing tiers; churn and adoption are tracked per tier, not per named plan. Tiers with no schools are left out."
        items={planHealth}
        getRowKey={(row) => row.tier}
        pageSize={false}
        emptyState="No tier has enough schools yet to compute adoption or churn."
        footnote="Moves are counted from tier changes that recorded where the school came from — changes made before that was kept are not in the count."
        columns={[
          { key: "tier", header: "Tier", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.tier}</span> },
          { key: "schools", header: "Schools", render: (row) => row.schools },
          { key: "adoption", header: "Adoption index", render: (row) => (row.adoptionIndex === null ? <span className="text-[var(--color-text-muted)]">Not enough data</span> : `${row.adoptionIndex}%`) },
          { key: "churn", header: "Churn rate", render: (row) => `${row.churnPct}%` },
          {
            key: "moves",
            header: "Moves (180 days)",
            render: (row) => {
              const moves = ratesByTier.get(row.tier);
              if (!moves || (moves.upgrades === 0 && moves.downgrades === 0)) return <span className="text-[var(--color-text-muted)]">None recorded</span>;
              return <span>{moves.upgrades} up · {moves.downgrades} down</span>;
            }
          },
          { key: "verdict", header: "Verdict", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.verdict}</span> }
        ]}
      />

      <ReferenceList
        title="Why the dollar is the anchor"
        sub="A single local-currency figure quietly prices other countries in or out"
        items={[
          { label: "The price is authored once", detail: "Change the dollar price and every local figure follows, in one act, with one approval", tone: "teal" },
          { label: "No country inherits another’s currency", detail: "A Ghanaian school is never priced by whatever the naira happens to be worth that month", tone: "teal" },
          { label: "Margin is legible in one place", detail: "Cost and price sit in the same unit, so a thin tier is visible before it is a problem", tone: "teal" },
          { label: "Bursars still read their own currency", detail: "A school is invoiced in its own currency, at the rate fixed when the term opened", tone: "good" }
        ]}
      />
    </div>
  );
}

async function TierMatrixTab() {
  const view = await apiGet<MatrixView>("/api/super-admin/plans-features/matrix");
  const missing = view.registry.filter((row) => !view.features.some((feature) => feature.featureKey === row.key));

  return (
    <div className="grid gap-[14px]">
      <FeatureMatrixTable
        view={view}
        actions={
          missing.length === 0 ? null : (
          <ResourceActionDialog
            triggerLabel="Add a feature"
            title="Add a feature to the matrix"
            description="Choose a feature the product knows how to gate and set which of the five billing tiers have it. It is kept in the change log."
            note="A feature must exist in the registry first — the registry is part of the product, so a feature is added to it when the product can honour it."
            endpoint="/api/super-admin/plans-features/matrix"
            submitLabel="Save access"
            fields={[
              { name: "featureKey", label: "Feature", type: "select", required: true, options: missing.map((row) => ({ label: `${row.name} — ${row.module}${row.enforcedAt ? "" : " (catalogue only)"}`, value: row.key })), note: "A feature has to be in the registry before it can have a row. Only features marked with a place the product enforces them change what a school can do.", section: "Feature" },
              ...view.tiers.map((tier) => ({ name: tier.tier, label: TIER_LABEL[tier.tier] ?? tier.tier, type: "switch" as const, on: false, note: `${tier.schools} school${tier.schools === 1 ? "" : "s"} on this tier`, section: "Which tiers have it" })),
              { name: "reason", label: "Why this is changing", type: "textarea", required: true, section: "Reason" },
              { name: "migrationPlan", label: "Migration plan (needed when taking access away from schools)", type: "textarea", placeholder: "What those schools are offered instead, and when they are told", note: "If any school is on a tier that loses the feature, this is required — and those schools are told in the app.", section: "Reason" }
            ]}
          />
          )
        }
      />
      <TableCard
        title="Editing the matrix — what actually happens"
        description="Checked against the real save code."
        items={[
          { requirement: "Every change is recorded as a new version", spec: "Real — each save bumps the feature's version and writes a change-log row with before, after, the reason, the schools affected and who made it (below).", state: "good" },
          { requirement: "Removing a feature in active use requires a migration plan", spec: "Enforced — the save counts the schools on the tiers losing access and refuses without a written migration plan; those schools are then told in the app.", state: "good" },
          { requirement: "Adding a feature needs a logged reason", spec: "Enforced — a reason is required on every change. Access takes effect immediately for every school on the tier; there is no renewal-timing option.", state: "warn" },
          { requirement: "A new feature must exist in a registry first", spec: "Enforced — only registry features can be given a row. The registry is part of the product, so a feature is added to it when the product can honour it.", state: "good" },
          { requirement: "The product reads the matrix", spec: "Partial — custom branding is checked against it when a school's branding is submitted or applied. The other registry features are catalogue only until the product has something to gate (marked below).", state: "warn" }
        ]}
        getRowKey={(row) => row.requirement}
        columns={[
          { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
          { key: "spec", header: "Specification", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" } }[row.state as "good" | "warn"];
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
      <TableCard
        title="Matrix change log"
        description="Every change to who may use a feature, newest first."
        items={view.changes}
        getRowKey={(row) => row.id}
        columns={[
          { key: "at", header: "When", render: (row) => formatDate(row.at) },
          { key: "feature", header: "Feature", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.feature}</span> },
          { key: "kind", header: "Change", render: (row) => <StatusBadge status={row.kind} tone={row.kind === "ACCESS_REMOVED" ? "danger" : row.kind === "ADDED" ? "success" : "warning"} /> },
          { key: "tiers", header: "On", render: (row) => <span className="text-[11px]">{Object.entries(row.after).filter(([tier, on]) => on !== Boolean(row.before?.[tier])).map(([tier, on]) => `${on ? "+" : "−"}${TIER_LABEL[tier] ?? tier}`).join(" ") || "Created"}</span> },
          { key: "schools", header: "Schools affected", render: (row) => row.affectedSchools },
          { key: "reason", header: "Reason", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.reason}{row.migrationPlan ? ` — Migration: ${row.migrationPlan}` : ""}</span> },
          { key: "by", header: "By", render: (row) => row.by }
        ]}
        emptyState="No change has been made to the matrix since it began to be logged."
      />
    </div>
  );
}

async function RolloutTab() {
  return (
    <div className="grid gap-[14px]">
      <FlowSteps
        title="Feature flag rollout control"
        sub="A flag moves up one stage at a time. Each stage has an observation window (7 days by default) before it can move up — a Super Admin can waive it by saying why — and the person moving it names the exit criterion that was met. Moving down, or rolling back, is always allowed."
        steps={[
          { label: "Flag created", note: "Off by default" },
          { label: "Pilot group", note: "Named schools only", tone: "warn" },
          { label: "Monitor", note: "Observation window, 7 days by default", tone: "warn" },
          { label: "Partial rollout", note: "A percentage of schools", tone: "good" },
          { label: "Monitor", note: "Second observation window", tone: "good" },
          { label: "Full rollout", note: "Platform-wide", tone: "good" },
          { label: "Instant rollback", note: "Any stage · back to Off at once", tone: "bad" }
        ]}
      />
      <FlagsSection />
      <LifecycleSection />
      <PlanChangesSection />
    </div>
  );
}

async function PlanChangesSection() {
  const overview = await apiGet<PlansOverview>("/api/super-admin/plans-features/plans");
  return (
    <div className="grid gap-[14px]">
      <TableCard
        title="Price changes"
        description={`A plan that schools are on cannot be repriced in place. A change is announced to every school on it, waits out ${overview?.noticeDays ?? 30} days' notice, and is applied automatically on its date.`}
        items={overview?.prices ?? []}
        getRowKey={(row) => row.id}
        columns={[
          { key: "plan", header: "Plan", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.plan}</span> },
          { key: "price", header: "Monthly price", render: (row) => `${formatCurrency(row.oldMonthly)} → ${formatCurrency(row.newMonthly)}` },
          { key: "announced", header: "Announced", render: (row) => `${formatDate(row.announcedAt)} · ${row.told} school${row.told === 1 ? "" : "s"} told` },
          { key: "effective", header: "Takes effect", render: (row) => formatDate(row.effectiveAt) },
          { key: "by", header: "By", render: (row) => row.by },
          { key: "status", header: "State", render: (row) => <StatusBadge status={row.status} tone={row.status === "APPLIED" ? "success" : row.status === "SCHEDULED" ? "warning" : "neutral"} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) =>
              row.status === "SCHEDULED" ? (
                <ResourceActionDialog triggerLabel="Cancel" title={`Cancel the ${row.plan} price change`} description="The plan keeps its current price. Schools that were told are not sent a correction automatically." endpoint={`/api/super-admin/plans-features/price-changes/${row.id}/cancel`} method="POST" variant="textActionDanger" submitLabel="Cancel change" confirmLabel="Confirm" fields={[]} />
              ) : (
                <span className="text-[11px] text-[var(--color-text-muted)]">—</span>
              )
          }
        ]}
        emptyState="No price change has been scheduled. Use “Price” on a plan card to schedule one."
      />

      <TableCard
        title="Plan version history"
        description="Every change to a plan — price, limits, entitlements, lifecycle — with who made it and when it took effect."
        items={overview?.versions ?? []}
        getRowKey={(row) => row.id}
        columns={[
          { key: "plan", header: "Plan", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.plan}</span> },
          { key: "version", header: "Version", render: (row) => `v${row.version}` },
          { key: "summary", header: "What changed", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.summary}</span> },
          { key: "by", header: "By", render: (row) => row.by },
          { key: "at", header: "Effective", render: (row) => formatDate(row.at) }
        ]}
        emptyState="No plan has changed since versions began to be kept."
      />
    </div>
  );
}

type PriceLockRow = { schoolId: string; school: string; plan: string; tier: string; heldAt: number; until: string; reason: string | null };

async function LifecycleSection() {
  const [migrations, priceLocks] = await Promise.all([
    apiGet<SuperAdminPlanLifecycleRow[]>("/api/super-admin/feature-flags/lifecycle"),
    apiGet<PriceLockRow[]>("/api/super-admin/plans-features/price-locks").catch(() => [] as PriceLockRow[])
  ]);

  return (
    <div className="grid gap-[14px]">
      <FlowSteps
        title="Plan lifecycle"
        sub="Every plan moves through these states in one direction only — nothing skips a stage"
        steps={[
          { label: "Draft", note: "Editable freely · invisible to sales" },
          { label: "Published", note: "Sellable · assignable", tone: "good" },
          { label: "New version scheduled", note: "30 days’ notice · old version honoured until it takes effect", tone: "warn" },
          { label: "Legacy", note: "Closed to new sales · existing schools kept", tone: "warn" },
          { label: "Migration on archive", note: "Schools moved, recorded and told", tone: "warn" },
          { label: "Archived", note: "Zero schools · read-only record", tone: "ink" }
        ]}
      />
      <TableCard
        title="Scheduled plan migrations"
        description={`Every school moving between plans, and when — no school is ever moved silently. ${(migrations ?? []).length} recorded, most recent first.`}
        items={migrations ?? []}
        emptyState="No tier migrations recorded yet. Change a school's plan from its profile to see it here."
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "to", header: "Migrated to", render: (item) => <StatusPill bg="var(--color-accent-primary-dim)" fg="var(--color-text-accent)" label={item.toPlan} /> },
          { key: "by", header: "Changed by", render: (item) => item.changedBy },
          { key: "when", header: "Changed", render: (item) => formatDate(item.changedAt) }
        ]}
      />
      <section className="overflow-hidden rounded-[14px] border border-[var(--color-border-default)] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">What happens to a school when its plan changes</p>
        </div>
        <div className="p-5">
          <p className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
            The school&apos;s plan field changes and the move is written to the audit log with where it came from and where it went. What the
            school may use is worked out live from the feature matrix each time it is asked — so a feature that the new plan does not include
            stops being available the next time the product checks (today that is custom branding). Nothing a school built is locked,
            hidden or deleted on a downgrade, and nothing needs restoring on an upgrade.
          </p>
        </div>
      </section>

      <TableCard
        title="Schools holding an older price"
        description="A school pinned to the price it agreed, until the start of its next term. Releasing one makes the current price apply to it at once."
        items={priceLocks}
        pageSize={false}
        getRowKey={(row) => row.schoolId}
        emptyState="No school is holding an older price. One appears here whenever a scheduled price change lands on a plan that has schools on it."
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.school}</span> },
          { key: "plan", header: "Plan", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.plan}</span> },
          { key: "held", header: "Held at", render: (row) => <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">{formatCurrency(row.heldAt)}</span>, sortValue: (row) => row.heldAt },
          { key: "until", header: "Until", render: (row) => <span className="text-[var(--color-text-secondary)]">{new Date(row.until).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>, sortValue: (row) => row.until },
          { key: "reason", header: "Why", render: (row) => <span className="text-[11px] text-[var(--color-text-muted)]">{row.reason ?? "—"}</span> },
          {
            key: "release",
            header: "",
            render: (row) => (
              <ResourceActionDialog
                triggerLabel="Release"
                title={`Release the held price — ${row.school}`}
                description="The school stops holding its old price and is charged the plan's current price from its next invoice."
                endpoint={`/api/super-admin/plans-features/price-locks/${row.schoolId}/release`}
                variant="secondary"
                submitLabel="Release the price"
                confirmLabel="Release it"
                confirmMessage="This school was promised its old price until it renews. Releasing it early changes what the next invoice asks for."
                fields={[
                  { name: "_school", label: "School", type: "static", placeholder: row.school, section: "What you are releasing" },
                  { name: "_held", label: "Currently held at", type: "static", placeholder: formatCurrency(row.heldAt), section: "What you are releasing" },
                  { name: "_until", label: "Was due to run until", type: "static", placeholder: new Date(row.until).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), section: "What you are releasing" },
                  { name: "_reason", label: "Why it was held", type: "static", placeholder: row.reason ?? "Not recorded", section: "What you are releasing", full: true }
                ]}
                impact={{
                  label: "On releasing",
                  rows: [
                    ["Charged at the current price", "From the next invoice raised for this school — anything already invoiced is unchanged."],
                    ["The school is not told automatically", "Releasing a price early is a conversation to have first; nothing on this screen has it for you."],
                    ["Logged against the subscription", "With the price it was holding and who released it."]
                  ]
                }}
                note="A held price exists because the school was told it would keep it. Release it only when the school has agreed."
              />
            )
          }
        ]}
      />

      <TableCard
        title="Grandfathering rules"
        description="How schools are protected from surprise price or entitlement changes. Checked against the real code."
        items={[
          { rule: "A price a school agreed to is honoured until it has been told", spec: "Enforced — a plan with schools on it cannot be repriced in place. A change is scheduled, every school on the plan is told in the app, and the new price applies only on the date, which must be at least 30 days out.", state: "good" },
          { rule: "30 days' notice before any price change", spec: "Enforced — the schedule refuses an earlier date for a plan that has schools on it; a plan with none can be repriced at once.", state: "good" },
          { rule: "Legacy plans stay open to their existing schools indefinitely", spec: "Enforced — Legacy closes a plan to new schools and keeps it for those on it. Activating a replacement for a tier moves the old plan to Legacy automatically if schools are still on it.", state: "good" },
          { rule: "An archive requires zero schools on the plan first", spec: "Enforced — a plan with schools on it can be archived only by choosing a plan to move them to; they are moved, recorded and told. The old Archive button is refused while schools are on the plan.", state: "good" },
          { rule: "Entitlement removals need a migration plan", spec: "Enforced — see the Feature Matrix tab: removing access from a tier that has schools on it needs a written migration plan, and those schools are told.", state: "good" },
          { rule: "A school keeps the price it agreed until it renews", spec: "Enforced — when a scheduled change lands, every school already on that plan is pinned to the price it was sold, until the start of its next term. They pick the new price up when they renew, not part-way through a term they have already been invoiced for. A school holding a price is listed below.", state: "good" }
        ]}
        getRowKey={(row) => row.rule}
        columns={[
          { key: "rule", header: "Rule", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.rule}</span> },
          { key: "spec", header: "Specification", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Not built" } }[row.state as "good" | "warn"];
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
    </div>
  );
}

async function ExceptionsTab() {
  return (
    <div className="grid gap-[14px]">
      <ReferenceList
        title="What an exception is"
        sub="A school’s plan decides what it can reach. An exception is a deliberate, recorded departure from that — in either direction."
        items={[
          { label: "Added — the school has something its plan does not include", detail: "Recorded as a granted override, reviewed and approved before it takes effect", pill: "Added", tone: "good" },
          { label: "Removed — the school has lost something its plan does include", detail: "Recorded as a restriction. A person creates it by hand; nothing removes a feature automatically", pill: "Removed", tone: "bad" },
          { label: "Waiting — someone has asked and nobody has decided", detail: "A pending override sits in the case queue until it is approved or rejected", pill: "Waiting", tone: "warn" },
          { label: "Every exception carries an end date", detail: "The form requires one, and an hourly job ends the exception on that date", pill: "Always", tone: "teal" },
          { label: "The plan itself never changes", detail: "An override is its own record, separate from the plan and the feature matrix", pill: "Rule", tone: "mute" }
        ]}
      />
      <ExceptionsCaseBoard />
      <TableCard
        title="What happens when an exception ends"
        description="Every exception has a required end date, and an hourly job acts on it. Nothing is deleted: a school losing a feature never loses what it built with the feature."
        items={[
          { step: "Before expiry", what: "The case board shows it under “Ending in the next 30 days”. No reminder is sent ahead of the date.", state: "warn" },
          { step: "On the expiry date", what: "Within the hour the override is marked Expired, access it granted (or restricted) stops applying, an audit entry is written, and the school's leadership is told in the app.", state: "good" },
          { step: "After expiry", what: "The case closes as Expired. Entitlement checks ignore it from that moment, so the school falls back to what its plan includes.", state: "good" },
          { step: "On manual revoke", what: "A Super Admin or Product Lead can still revoke it early, with a required reason.", state: "good" }
        ]}
        getRowKey={(row) => row.step}
        columns={[
          { key: "step", header: "Step", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.step}</span> },
          { key: "what", header: "Specification", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.what}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Real" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" } }[row.state as "good" | "warn"];
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
      <TableCard
        title="Branding requirements"
        description="Custom branding, verified against the real submission and approval code. The school's plan must include custom branding (or hold an approved exception) at both submit and apply."
        items={[
          { requirement: "Logo format", spec: "Enforced — the logo must be a secure (https) link to a PNG, JPG, SVG or WebP file. Minimum width is not checked: the file is not fetched.", state: "good" },
          { requirement: "Brand colours as hex codes", spec: "Enforced — both colour fields are validated against a hex-colour pattern before they can be saved.", state: "good" },
          { requirement: "Contrast check", spec: "Enforced — the primary colour must reach 3:1 contrast against white (WCAG) so headings can be read on printed paper; a lighter colour is refused with its ratio.", state: "good" },
          { requirement: "Quality / appropriateness review", spec: "Approval is a bare status change — clicking Approve sets the status field and records who approved it; no automated check of the logo or colours runs at any point.", state: "bad" },
          { requirement: "Preview with sample data before going live", spec: "Not built on this page — there's no rendered preview step between approval and applying branding to the school's live account.", state: "bad" }
        ]}
        getRowKey={(row) => row.requirement}
        columns={[
          { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
          { key: "spec", header: "Specification", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "bad"];
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
    </div>
  );
}

function overrideDecisions(item: SuperAdminFeatureOverrideRow): ReactNode {
  if (item.status === "PENDING") {
    return (
      <>
        <ResourceActionDialog
          triggerLabel="Approve"
          title="Grant plan exception"
          description={`${item.schoolName} gains ${item.flagName ?? "this feature"} immediately, above what its plan includes, until the end date on the request. It is logged against your name.`}
          recorded={{ line: `You · Grant plan exception · ${item.schoolName}`, before: "Waiting on a decision", after: "In force" }}
          endpoint={`/api/super-admin/feature-flags/overrides/${item.id}/approve`}
          method="PATCH"
          variant="secondary"
          submitLabel="Approve"
          fields={[]}
        />
        <ResourceActionDialog
          triggerLabel="Reject"
          title="Decline plan exception"
          description={`${item.schoolName} does not gain the feature. The request is closed with your reason on the case history.`}
          recorded={{ line: `You · Decline plan exception · ${item.schoolName}`, before: "Waiting on a decision", after: "Declined" }}
          endpoint={`/api/super-admin/feature-flag-extras/overrides/${item.id}/reject`}
          method="PATCH"
          variant="danger"
          submitLabel="Decline exception"
          fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
        />
      </>
    );
  }
  if (item.status === "APPROVED") {
    return (
      <ResourceActionDialog
        triggerLabel="Revoke"
        title="End plan exception"
        description={`Access stops today rather than on the end date. What ${item.schoolName} built with the feature stays, and becomes read-only.`}
        recorded={{ line: `You · End plan exception · ${item.schoolName}`, before: item.expiryDate ? `In force until ${formatDate(item.expiryDate)}` : "In force", after: "Ended today" }}
        endpoint={`/api/super-admin/feature-flag-extras/overrides/${item.id}/revoke`}
        method="PATCH"
        variant="danger"
        submitLabel="End it now"
        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
      />
    );
  }
  return <p className="text-[11px] text-[var(--color-text-muted)]">Closed — {item.status.toLowerCase()}, no further action.</p>;
}

function brandingDecisions(item: SuperAdminBrandingAssetRow): ReactNode {
  if (item.status === "PENDING") {
    return (
      <ResourceActionDialog
        triggerLabel="Approve"
        title={`Approve the branding for ${item.schoolName}`}
        description="The logo and colours are marked reviewed and approved. They are not applied to the school’s live account until you apply them."
        recorded={{ line: `You · Approve branding · ${item.schoolName}`, before: "Waiting for review", after: "Approved" }}
        endpoint={`/api/super-admin/feature-flags/branding/${item.id}/approve`}
        method="PATCH"
        variant="secondary"
        submitLabel="Approve"
        fields={[]}
      />
    );
  }
  if (item.status === "APPROVED") {
    return (
      <ResourceActionDialog
        triggerLabel="Apply to live account"
        title={`Apply the branding for ${item.schoolName}`}
        description="The approved logo and colours go onto the school’s live account now — its report cards and portal change at once."
        recorded={{ line: `You · Apply branding · ${item.schoolName}`, before: "Approved", after: "Applied" }}
        endpoint={`/api/super-admin/feature-flags/branding/${item.id}/apply`}
        method="PATCH"
        variant="secondary"
        submitLabel="Apply now"
        fields={[]}
      />
    );
  }
  return <p className="text-[11px] text-[var(--color-text-muted)]">Closed — {item.status.toLowerCase()}, no further action.</p>;
}

async function ExceptionsCaseBoard() {
  const [overrides, branding, flags, schoolsEnvelope, caseHistory] = await Promise.all([
    apiGet<SuperAdminFeatureOverrideRow[]>("/api/super-admin/feature-flags/overrides"),
    apiGet<SuperAdminBrandingAssetRow[]>("/api/super-admin/feature-flags/branding"),
    apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/feature-flags"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGet<SuperAdminFeatureFlagCaseHistory>("/api/super-admin/feature-flag-extras/case-history")
  ]);

  const schools = schoolsEnvelope.data ?? [];
  const schoolOptions = schools.map((school) => ({ label: school.name, value: school.id }));
  const flagOptions = (flags ?? []).map((flag) => ({ label: flag.name, value: flag.id }));
  const schoolById = new Map(schools.map((school) => [school.id, school]));
  const now = Date.now();

  const overrideRows = overrides ?? [];
  const brandingRows = branding ?? [];

  const overrideCases: CaseRecord[] = overrideRows.map((item) => {
    const school = schoolById.get(item.schoolId);
    const signals: CaseRecord["signals"] = [];
    if (!item.expiryDate) {
      signals.push({ text: "No expiry date set — overrides must not be granted without an expiry.", tone: "bad" });
    } else if (new Date(item.expiryDate).getTime() < now && item.status === "APPROVED") {
      signals.push({ text: `Expired on ${formatDate(item.expiryDate)} but is still marked Approved.`, tone: "bad" });
    }

    let sla: string;
    let slaTone: NonNullable<CaseRecord["slaTone"]>;
    if (!item.expiryDate) {
      sla = "No expiry set";
      slaTone = "bad";
    } else {
      const daysLeft = daysBetween(now, new Date(item.expiryDate).getTime());
      sla = daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`;
      slaTone = daysLeft < 0 ? "bad" : daysLeft <= 7 ? "warn" : "good";
    }

    const history = (caseHistory?.overrides?.[item.id] ?? []).map((event) => ({ what: event.what, when: formatDate(event.when) }));

    return {
      id: item.id,
      subject: item.flagName,
      meta: `${school?.name ?? item.schoolName} · ${item.overrideStatus === "GRANTED" ? "Grants" : "Restricts"} access`,
      type: "feature-override",
      initials: initialsFrom(school?.name ?? item.schoolName),
      assignee: item.status === "PENDING" ? "Awaiting Product Lead / Super Admin" : item.approvedBy ?? item.requestedBy,
      age: formatAge(item.createdAt),
      sla,
      slaTone,
      facts: [
        { label: "School", value: school?.name ?? item.schoolName },
        { label: "School tier", value: school?.plan ?? "Unknown" },
        { label: "Capability", value: `${item.flagName} (${item.flagKey})` },
        { label: "Type", value: item.overrideStatus === "GRANTED" ? "Grant access" : "Restrict access" },
        { label: "Requested by", value: item.requestedBy },
        { label: "Expiry", value: item.expiryDate ? formatDate(item.expiryDate) : "Not set" }
      ],
      signals,
      evidence: item.reason ? [{ name: item.reason, who: item.requestedBy }] : [],
      checks: [
        { label: "Reason recorded", done: Boolean(item.reason), who: item.requestedBy },
        { label: "Expiry date set", done: Boolean(item.expiryDate) },
        { label: "Reviewed by Product Lead / Super Admin", done: item.status !== "PENDING", who: item.approvedBy ?? undefined }
      ],
      history,
      decisions: overrideDecisions(item)
    };
  });


  // The "types" pill counts mirror the Exceptions tab badge's own open/active definition
  // (see the badge computation above SuperAdminFeatureFlagsPage): an override is "open" while
  // APPROVED and not expired, branding is "open" once APPLIED to the school's live account.
  // The case list itself stays the full queue (pending, approved, rejected, applied, revoked)
  // so nothing that could previously be reviewed from the flat tables disappears here.
  const activeOverrideCount = overrideRows.filter(
    (item) => item.status === "APPROVED" && (!item.expiryDate || new Date(item.expiryDate).getTime() > now)
  ).length;
  const activeBrandingCount = brandingRows.filter((item) => item.status === "APPLIED").length;

  const types: CaseTypeFilter[] = [
    { label: "All open", value: "all", count: activeOverrideCount },
    { label: "Feature override", value: "feature-override", count: activeOverrideCount }
  ];

  const waitingCount = overrideRows.filter((item) => item.status === "PENDING").length + brandingRows.filter((item) => item.status === "PENDING").length;
  const endingSoonCount = overrideRows.filter((item) => {
    if (item.status !== "APPROVED" || !item.expiryDate) return false;
    const daysLeft = daysBetween(now, new Date(item.expiryDate).getTime());
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const overridesByFlagThisYear = new Map<string, number>();
  for (const item of overrideRows) {
    if (new Date(item.createdAt).getTime() < yearStart) continue;
    overridesByFlagThisYear.set(item.flagKey, (overridesByFlagThisYear.get(item.flagKey) ?? 0) + 1);
  }
  const repeatedFlagCount = Array.from(overridesByFlagThisYear.values()).filter((count) => count > 2).length;
  const revokedCount = overrideRows.filter((item) => item.status === "REJECTED" || item.status === "REVOKED" || item.status === "EXPIRED").length;

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-[11px] md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Exceptions in force" value={activeOverrideCount + activeBrandingCount} detail={`${activeOverrideCount} override(s) · ${activeBrandingCount} branding`} icon={ShieldCheck} tone="dark" />
        <StatCard label="Waiting on a decision" value={waitingCount} detail="Pending overrides and branding" icon={Clock3} tone={waitingCount ? "warning" : "neutral"} />
        <StatCard label="Ending in the next 30 days" value={endingSoonCount} detail="Approved overrides nearing expiry" icon={ShieldAlert} tone={endingSoonCount ? "warning" : "neutral"} />
        <StatCard label="Granted more than twice this year" value={repeatedFlagCount} detail="A flag repeatedly overridden may belong on the plan" icon={Repeat2} tone={repeatedFlagCount ? "warning" : "neutral"} />
        <StatCard label="Revoked, rejected or expired" value={revokedCount} detail="Closed without being used to the end" icon={Undo2} tone="neutral" />
      </section>

      <CaseReviewBoard
        title="Exceptions by school"
        toolbar={
          <>
        <ResourceActionDialog
          triggerLabel="Grant an exception"
          title="Grant a plan exception"
          description="Give one school something its plan does not include — or take something away — deliberately, with a reason and an end date."
          endpoint="/api/super-admin/feature-flags/overrides"
          submitLabel="Request override"
          variant="secondary"
          note="Every exception needs an end date, and a decision from someone other than the person who asked." impact={{ label: "On approval", rows: [["The school gains it from that day", "Above what its plan includes, until the end date"], ["The plan is untouched", "An override is its own record, separate from the plan and the feature matrix"], ["Ends on the date you set", "Access stops; what the school built with it stays, read-only"]] }} fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "Who and what" },
            { name: "flagId", label: "Feature", type: "select", required: true, options: flagOptions, section: "Who and what" },
            { name: "overrideStatus", label: "Direction", type: "select", defaultValue: "GRANTED", options: [{ label: "Added — above the plan", value: "GRANTED" }, { label: "Removed — below the plan", value: "RESTRICTED" }], note: "Added usually closes a sale or holds a renewal; removed is almost always non-payment", section: "Who and what" },
            { name: "reason", label: "Reason", type: "textarea", required: true, placeholder: "Who asked, why, and what it is holding — in words someone else can judge", section: "Why, in words someone else can judge" },
            { name: "expiryDate", label: "End date", type: "date", required: true, note: "Required. The system will not save an exception without one", section: "When it ends" },
            { name: "afterwards", label: "What happens then", type: "locked", note: "Access stops. Everything the school built with it stays, read-only", section: "When it ends" }
          ]}
        />
        <ResourceActionDialog
          triggerLabel="Submit branding"
          title="Submit branding assets"
          description="Record a school's logo URL and brand colours for review."
          endpoint="/api/super-admin/feature-flags/branding"
          submitLabel="Submit for review"
          variant="secondary"
          fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
            { name: "logoUrl", label: "Logo URL (https link to a PNG, JPG, SVG or WebP)" },
            { name: "primaryColour", label: "Primary colour (hex)", required: true, placeholder: "#25593f" },
            { name: "secondaryColour", label: "Secondary colour (hex)", required: true, placeholder: "#c28c3d" }
          ]}
        />
          </>
        }
        types={types}
        cases={overrideCases}
        emptyState="No plan exceptions on record. A feature given to one school above its plan, or taken away from it, appears here."
        footerNote={`${overrideRows.length} exception${overrideRows.length === 1 ? "" : "s"}, most recent first.`}
        searchPlaceholder="Search a school, feature or assignee"
      />

      <TableCard
        title="Custom branding queue"
        description="Assets are reviewed for quality and appropriateness before they are applied to a school’s live account."
        items={brandingRows}
        getRowKey={(row) => row.id}
        emptyState="No school has submitted branding."
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.schoolName}</span> },
          { key: "logo", header: "Logo", render: (row) => (row.logoUrl ? <a href={row.logoUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--color-text-accent)] hover:underline">View logo</a> : <span className="text-[var(--color-text-muted)]">None supplied</span>) },
          { key: "colours", header: "Brand colours", render: (row) => <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[4px] border border-[#DEE8E2]" style={{ background: row.primaryColour }} />{row.primaryColour}<span className="h-3.5 w-3.5 rounded-[4px] border border-[#DEE8E2]" style={{ background: row.secondaryColour }} />{row.secondaryColour}</span> },
          { key: "applied", header: "Applied to", render: (row) => row.appliedTo },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "decision", header: "", sortable: false, render: (row) => (row.status === "PENDING" || row.status === "APPROVED" ? brandingDecisions(row) : null) }
        ]}
      />
    </div>
  );
}

async function FlagsSection() {
  const [flags, history, members, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/plans-features/flags"),
    apiGet<StageRow[]>("/api/super-admin/plans-features/stage-history"),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team").catch(() => [] as SuperAdminInternalMember[]),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const memberOptions = [{ label: "Nobody yet", value: "" }, ...members.map((m) => ({ label: `${m.name} · ${m.role.replaceAll("_", " ").toLowerCase()}`, value: m.id }))];

  return (
    <div className="grid gap-[14px]">
      <TableCard
        title="Active feature flags"
        description="Staged rollout: Off → Pilot → Partial → Full, with an instant platform-wide rollback at any stage. “In stage” is measured from the day the flag entered its current stage, against that flag's own observation window."
        items={flags ?? []}
        actions={
          <ResourceActionDialog
            triggerLabel="New flag"
            title="New feature flag"
            description="A capability ships in stages, with exit criteria and a way back. Every flag starts Off."
            endpoint="/api/super-admin/plans-features/flags"
            submitLabel="Create flag"
            note="Every flag carries an instant platform-wide rollback from its own row."
            fields={[
              { name: "name", label: "Flag name", required: true, section: "The capability" },
              { name: "key", label: "Key", required: true, placeholder: "module.feature-name", note: "Lowercase, dot-separated, permanent once created — code and audit records refer to it", section: "The capability" },
              { name: "area", label: "Area", placeholder: "e.g. Report Cards", section: "The capability" },
              { name: "ownerId", label: "Owner", type: "select", defaultValue: "", options: memberOptions, note: "The person accountable for deciding when each stage is done", section: "The capability" },
              { name: "description", label: "What it does", type: "textarea", section: "The capability" },
              { name: "exitCriteria", label: "Exit criteria", type: "textarea", placeholder: "In measurable terms — what must be true before this moves on", note: "Required before the flag can leave Off", section: "First stage" },
              { name: "observationDays", label: "Observation window (days per stage)", type: "number", defaultValue: 7, min: 0, max: 90, section: "First stage" },
              { name: "stage", label: "Stage", type: "static", placeholder: "Off", section: "First stage" }
            ]}
          />
        }
        emptyState="No feature flags have been configured."
        columns={[
          { key: "name", header: "Flag", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p><p className="text-xs text-[var(--color-text-muted)]">{item.key}{item.area ? ` · ${item.area}` : ""}</p></div> },
          { key: "owner", header: "Owner", render: (item) => item.owner ?? <span className="text-[var(--color-text-muted)]">Nobody yet</span> },
          { key: "rollout", header: "Rollout", render: (item) => <StatusBadge status={item.rolloutStatus} tone={item.rolloutStatus === "FULL" ? "success" : item.rolloutStatus === "OFF" ? "neutral" : "warning"} /> },
          { key: "pct", header: "Percent", render: (item) => `${item.rolloutPercent}%` },
          { key: "pilot", header: "Pilot schools", render: (item) => item.pilotSchoolCount },
          {
            key: "inStage",
            header: "In stage",
            render: (item) => (
              <div>
                <p>{item.daysInStage ?? 0}d of {item.observationDays ?? 7}d window</p>
                <p className={(item.windowOpensIn ?? 0) > 0 || item.rolloutStatus === "FULL" ? "text-[10px] text-[var(--color-text-muted)]" : "text-[10px] font-semibold text-[var(--color-success)]"}>
                  {item.rolloutStatus === "FULL" ? "At the last stage" : (item.windowOpensIn ?? 0) > 0 ? `Can move up in ${item.windowOpensIn}d` : "Ready to move up"}
                </p>
              </div>
            )
          },
          { key: "overrides", header: "Overrides", render: (item) => item.overrides },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <ActionMenu triggerLabel={`Actions for ${item.name}`}>
                <ResourceActionDialog
                  triggerLabel="Update rollout"
                  title={`Move ${item.name} to the next stage`}
                  description={`A flag moves one stage at a time. Moving up needs the stage’s ${item.observationDays ?? 7}-day window to have run and the exit criterion you met written below.`}
                  note="Moving down, or rolling back, is always allowed."
                  impact={{ label: "On saving", rows: [["The stage is recorded", "With who moved it, the date the stage began, and what was said to be met"], ["Pilot schools are told", "In the app, when they are added to a Pilot"], ["The window restarts", "The observation window is counted from today, in the new stage"]] }}
                  endpoint={`/api/super-admin/plans-features/flags/${item.id}/advance`}
                  method="POST"
                  variant="menu"
                  submitLabel="Update rollout"
                  fields={[
                    { name: "current", label: "Now", type: "static", placeholder: `${item.rolloutStatus} · ${item.rolloutPercent}% · ${item.daysInStage ?? 0} days in stage`, section: "Stage" },
                    { name: "rolloutStatus", label: "Move to", type: "select", defaultValue: item.rolloutStatus, options: rolloutOptions, section: "Stage" },
                    { name: "rolloutPercent", label: "Percent (for Partial)", type: "number", defaultValue: item.rolloutPercent, min: 0, max: 100, section: "Stage" },
                    { name: "pilotSchoolIds", label: "Pilot schools (for Pilot)", type: "multiselect", options: schoolOptions, defaultValue: item.pilotSchoolIds ?? [], section: "Stage" },
                    { name: "note", label: "Exit criterion met", type: "textarea", placeholder: item.exitCriteria ?? "Required when moving up past Pilot", section: "Evidence" },
                    { name: "skipWindowReason", label: "Waive the observation window (Super Admin only)", type: "textarea", placeholder: "Leave empty unless moving up early — say why", section: "Evidence" }
                  ]}
                />
                <ResourceActionDialog
                  triggerLabel="Edit flag"
                  title={`Edit flag · ${item.name}`}
                  description="Who owns it, what it is part of, and what has to be true for each stage to be finished."
                  note="Every stage carries a written exit criterion — a rollout with none is a rollout nobody can decide about."
                  endpoint={`/api/super-admin/plans-features/flags/${item.id}`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Save"
                  fields={[
                    { name: "area", label: "Area", defaultValue: item.area ?? "", section: "The capability" },
                    { name: "ownerId", label: "Owner", type: "select", defaultValue: item.ownerId ?? "", options: memberOptions, section: "The capability" },
                    { name: "exitCriteria", label: "Exit criteria", type: "textarea", defaultValue: item.exitCriteria ?? "", section: "Stage rules" },
                    { name: "observationDays", label: "Observation window (days)", type: "number", defaultValue: item.observationDays ?? 7, min: 0, max: 90, section: "Stage rules" }
                  ]}
                />
                <ResourceActionDialog
                  triggerLabel="Instant rollback"
                  title={`Roll back ${item.name}`}
                  description="The feature is disabled for every school immediately and its pilot schools are cleared. The reason is kept in the stage history."
                  recorded={{ line: `You · Roll back ${item.name}`, before: `${item.rolloutStatus} · ${item.rolloutPercent}%`, after: "Off" }}
                  endpoint={`/api/super-admin/plans-features/flags/${item.id}/rollback`}
                  method="POST"
                  variant="menuDanger"
                  submitLabel="Roll back now"
                  fields={[{ name: "reason", label: "Why it is being rolled back", type: "textarea", required: true }]}
                />
              </ActionMenu>
            )
          }
        ]}
      />
      <TableCard
        title="What every stage records"
        description="Checked against the real feature-flag schema and update code."
        items={[
          { field: "The exit criterion, in measurable terms", spec: "Real — written on the flag, required before it can leave Off, and shown in the update dialog.", state: "good" },
          { field: "The observation window (minimum 7 days per stage)", spec: "Enforced — a flag cannot move up before its window has run; a Super Admin can waive it by writing why, and the waiver is recorded.", state: "good" },
          { field: "The owner accountable for the decision", spec: "Real — a named team member on the flag.", state: "good" },
          { field: "The rollback trigger", spec: "Real, but manual — “Instant rollback” is one click with a recorded reason; no condition fires it automatically, a person decides.", state: "warn" },
          { field: "The date the stage began", spec: "Real — stamped when the flag changes stage (not when a percentage changes), and every stage is kept in the history below.", state: "good" }
        ]}
        getRowKey={(row) => row.field}
        columns={[
          { key: "field", header: "Field", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.field}</span> },
          { key: "spec", header: "Specification", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" } }[row.state as "good" | "warn"];
              return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
      <TableCard
        title="Stage history"
        description="Every stage change across every flag, newest first — who moved it, what they said was met."
        items={history ?? []}
        getRowKey={(row) => row.id}
        columns={[
          { key: "at", header: "When", render: (row) => formatDate(row.at) },
          { key: "flag", header: "Flag", render: (row) => <div><p className="font-semibold text-[var(--color-text-primary)]">{row.flag}</p><p className="text-[10px] text-[var(--color-text-muted)]">{row.key}</p></div> },
          { key: "move", header: "Move", render: (row) => (row.from === row.to ? row.to : `${row.from} → ${row.to}${row.to === "PARTIAL" ? ` (${row.percent}%)` : ""}`) },
          { key: "note", header: "Note", render: (row) => <span className="text-[11px] text-[var(--color-text-secondary)]">{row.note ?? "—"}</span> },
          { key: "by", header: "By", render: (row) => row.by }
        ]}
        emptyState="No flag has changed stage yet."
      />
    </div>
  );
}
