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
  SuperAdminPlanLifecycleRow,
  SuperAdminPlanRow,
  SuperAdminProductAdoption,
  SuperAdminSchoolRow,
  SuperAdminTierFeatureRow
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

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

const rolloutOptions = [
  { label: "Off", value: "OFF" },
  { label: "Pilot", value: "PILOT" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Full", value: "FULL" }
];
const yesNo = [{ label: "Yes", value: "true" }, { label: "No", value: "false" }];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
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

  const tabs = [
    { label: "Plans", href: tabHref("plans"), active: tab === "plans" },
    { label: "Feature Matrix", href: tabHref("matrix"), active: tab === "matrix" },
    { label: "Plan Exceptions", href: tabHref("exceptions"), active: tab === "exceptions", badge: exceptionsCount },
    { label: "Rollout", href: tabHref("rollout"), active: tab === "rollout" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Platform"
        title="Plans & Features"
        description="Central control over what each subscription tier can access — pricing, the tier-feature matrix, per-school exceptions such as overrides and Elite custom branding, and staged feature-flag / plan rollouts. None of it requires a code deployment."
        action={
          <ResourceActionDialog
            triggerLabel="New feature flag"
            title="New feature flag"
            description="A capability ships in stages, with exit criteria and a way back."
            endpoint="/api/super-admin/feature-flags"
            variant="heroWhite"
            submitLabel="Create flag"
            fields={[
              { name: "name", label: "Flag name", required: true, section: "The capability" },
              { name: "key", label: "Key", required: true, placeholder: "module.feature-name", section: "The capability" },
              {
                name: "area",
                label: "Area",
                type: "static",
                placeholder: "Not tracked",
                note: "No area/module field exists on a flag — group is read from its key prefix elsewhere in the UI.",
                section: "The capability"
              },
              {
                name: "owner",
                label: "Owner",
                type: "static",
                placeholder: "Not tracked",
                note: "Not stored — no owner field exists on a feature flag.",
                section: "The capability"
              },
              {
                name: "stage",
                label: "Stage",
                type: "static",
                placeholder: "Off",
                note: "Every new flag starts at Off. Move it to Pilot, Partial or Full from its row on the Rollout tab.",
                section: "First stage"
              },
              {
                name: "pilotSchools",
                label: "Pilot schools",
                type: "static",
                placeholder: "None yet — named at the next stage",
                note: "Pilot schools are chosen when the flag is advanced to Pilot, not at creation.",
                section: "First stage"
              },
              {
                name: "exitCriteria",
                label: "Exit criteria",
                type: "static",
                placeholder: "Not stored",
                note: "No exit-criteria field exists — stage advances are a manual judgment call today.",
                section: "First stage"
              },
              { name: "tierStarter", label: "Starter", type: "toggle", disabled: true, note: "Tier availability isn't set at creation — see the Feature Matrix tab.", section: "Tier availability" },
              { name: "tierStandard", label: "Standard", type: "toggle", disabled: true, section: "Tier availability" },
              { name: "tierElite", label: "Elite", type: "toggle", disabled: true, section: "Tier availability" },
              { name: "tierNgo", label: "NGO / Mission", type: "toggle", disabled: true, section: "Tier availability" },
              { name: "tierTrial", label: "Trial", type: "toggle", disabled: true, note: "Every feature is unlocked in a trial, platform-wide — not configurable per flag.", section: "Tier availability" },
              { name: "pilotSchoolsTold", label: "Pilot schools are told", type: "toggle", disabled: true, note: "Not built — pilot schools aren't notified when added.", section: "Tier availability" }
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

async function PlansTab() {
  const [plans, migrations, churn, adoption] = await Promise.all([
    apiGet<SuperAdminPlanRow[]>("/api/super-admin/plans"),
    apiGet<SuperAdminPlanLifecycleRow[]>("/api/super-admin/feature-flags/lifecycle"),
    apiGet<SuperAdminChurnAnalysis>("/api/super-admin/analytics/churn"),
    apiGet<SuperAdminProductAdoption>("/api/super-admin/analytics/product-adoption")
  ]);
  const activePlans = (plans ?? []).filter((plan) => plan.isActive);
  const archivedPlans = (plans ?? []).filter((plan) => !plan.isActive);
  const totalSchools = (plans ?? []).reduce((sum, plan) => sum + plan.subscriberCount, 0);

  const tierColumns = adoption?.tierColumns ?? [];
  const heatmapByTier = adoption?.heatmapByTier ?? [];
  const churnByTier = new Map((churn?.byTier ?? []).map((row) => [row.plan, row]));
  const planHealth = tierColumns
    .filter((tier) => tier.schoolCount > 0)
    .map((tier, tierIndex) => {
      const adoptionValues = heatmapByTier.map((row) => row.cells[tierIndex]).filter((value): value is number => value !== null);
      const adoptionIndex = adoptionValues.length > 0 ? Math.round(adoptionValues.reduce((sum, value) => sum + value, 0) / adoptionValues.length) : null;
      const churnRow = churnByTier.get(tier.plan);
      const churnPct = churnRow?.ratePct ?? 0;
      const verdict =
        churnPct >= 8
          ? "High churn for this tier — worth reviewing pricing or entitlements"
          : adoptionIndex === null
            ? "Not enough module-adoption data to call this yet"
            : adoptionIndex < 40
              ? "Low module adoption relative to other tiers"
              : "No churn or adoption concern flagged";
      return { tier: tier.plan, schools: tier.schoolCount, adoptionIndex, churnPct, verdict };
    });

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active plans" value={activePlans.length} detail="Selectable for new signups" icon={Layers} tone="dark" />
        <StatCard label="Archived plans" value={archivedPlans.length} detail="No longer selectable" icon={Archive} tone="neutral" />
        <StatCard label="Schools across all plans" value={totalSchools.toLocaleString()} detail="Sum of subscribers per plan" icon={School} tone="info" />
        <StatCard label="Plan migrations recorded" value={(migrations ?? []).length} detail="Schools that have changed tier" icon={Repeat2} tone="success" />
        <StatCard label="Draft / legacy plan states" value="N/A" detail="Not tracked — a plan here is simply active or archived; there's no draft, legacy, or migration-window lifecycle." icon={Clock3} tone="neutral" />
      </section>

      <PlanCardGrid plans={plans ?? []} actions={<PlanCreateDialog />} />

      <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">One currency, not five</p>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            Every plan above is authored and billed in Naira only — there is no USD anchor price, no per-country exchange
            rate, and no multi-currency conversion layer anywhere in this system. A school outside Nigeria isn&apos;t
            possible today: onboarding hard-codes the country to Nigeria (see Curriculum &amp; Academics&apos;
            portability review), so the question of pricing a school in Ghanaian cedis or Kenyan shillings doesn&apos;t
            yet arise in practice.
          </p>
        </div>
      </section>

      <TableCard
        title="Plan health by tier — what real usage shows"
        description="Grouped by the platform's five billing tiers (Basic/Standard/Professional/Enterprise/Custom), not by the individual named plans above — churn and adoption are tracked at the tier level, not per plan row. Schools with too few data points to matter are omitted."
        items={planHealth}
        getRowKey={(row) => row.tier}
        columns={[
          { key: "tier", header: "Tier", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.tier}</span> },
          { key: "schools", header: "Schools", render: (row) => row.schools },
          { key: "adoption", header: "Adoption index", render: (row) => (row.adoptionIndex === null ? <span className="text-[var(--color-text-muted)]">Not enough data</span> : `${row.adoptionIndex}%`) },
          { key: "churn", header: "Churn rate", render: (row) => `${row.churnPct}%` },
          { key: "upgrade", header: "Upgrade rate", render: () => <span className="text-[var(--color-text-muted)]">Not tracked — no record links a school's previous tier to its next one</span> },
          { key: "verdict", header: "Verdict", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.verdict}</span> }
        ]}
        emptyState="No tier has enough schools yet to compute adoption or churn."
      />
    </div>
  );
}

async function TierMatrixTab() {
  const features = await apiGet<SuperAdminTierFeatureRow[]>("/api/super-admin/feature-flags/tier-matrix");

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">These three tiers aren&apos;t the same three tiers a school is actually billed on</p>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            A real subscription plan&apos;s tier is one of five values — Basic, Standard, Professional, Enterprise, or
            Custom (see the Plans tab). This matrix is a separate, hardcoded record with exactly three fixed columns —
            Starter, Standard, Elite — and nothing in the code maps one system to the other. In practice that means two
            of the five real billing tiers, Professional and Custom, have no feature-access row here at all: a school on
            the &quot;Trial&quot; plan (Professional tier) or &quot;NGO / Mission&quot; plan (Custom tier) isn&apos;t
            represented in this table by name or by tier, even though real schools are on those plans today.
          </p>
        </div>
      </section>
      <FeatureMatrixTable
        items={features ?? []}
        actions={
          <ResourceActionDialog
            triggerLabel="Add / update feature"
            title="Add or update a matrix feature"
            description="Define which tiers a feature is available on. Re-using an existing feature name updates its row."
            endpoint="/api/super-admin/feature-flags/tier-matrix"
            submitLabel="Save feature"
            fields={[
              { name: "name", label: "Feature name", required: true, placeholder: "e.g. WhatsApp notifications" },
              { name: "module", label: "Module", required: true, placeholder: "e.g. Communications" },
              { name: "starterAccess", label: "Starter tier", type: "select", defaultValue: "false", options: yesNo },
              { name: "standardAccess", label: "Standard tier", type: "select", defaultValue: "false", options: yesNo },
              { name: "eliteAccess", label: "Elite tier", type: "select", defaultValue: "true", options: yesNo }
            ]}
          />
        }
      />
      <TableCard
        title="Editing the matrix — what actually happens"
        description="Verified against the real update code, not stated as intent."
        items={[
          { requirement: "The change stages as a new version", spec: "Not built — saving a cell updates the TierFeature row in place immediately. There is no version history and no separate draft/published state to approve first.", state: "bad" },
          { requirement: "Removing a feature in active use requires a migration plan", spec: "Not built — the system never checks which schools are actively using a feature before a save turns its access off.", state: "bad" },
          { requirement: "Adding a feature applies at next renewal, or immediately with a logged reason", spec: "Partial — every save takes effect immediately for every school on that tier; there's no renewal-timing option, but the change is written to the audit log.", state: "warn" },
          { requirement: "A new feature must exist in a registry first", spec: "Not applicable — there is no separate feature registry; typing a new feature name into the form and saving creates the row directly.", state: "mute" }
        ]}
        getRowKey={(row) => row.requirement}
        columns={[
          { key: "requirement", header: "What the mockup describes", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
          { key: "spec", header: "What actually happens", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }, mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "N/A" } }[row.state as "good" | "warn" | "bad" | "mute"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
    </div>
  );
}

const flowToneStyle: Record<"good" | "warn" | "bad" | "ink" | "plain", { bg: string; fg: string; bd: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", bd: "#CFE4DB" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", bd: "#F2E4C6" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", bd: "#F3E0E0" },
  ink: { bg: "#0D2315", fg: "#fff", bd: "#0D2315" },
  plain: { bg: "#fff", fg: "var(--color-text-primary)", bd: "var(--color-border-default)" }
};

function FlowSteps({ title, sub, steps }: { title: string; sub: string; steps: Array<{ label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" }> }) {
  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[14px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function RolloutTab() {
  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Rollout</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Feature flag & plan rollout</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          How changes reach schools over time: staged feature-flag rollouts with instant rollback, and the history of
          schools migrating between subscription tiers.
        </p>
      </section>
      <FlowSteps
        title="Feature flag rollout — the real stages"
        sub="A flag moves through these states; the percentage in Partial is whatever a Super Admin sets, not a fixed step. There's no automatic 7-day monitoring window or written exit criterion — advancing a stage is a manual decision every time."
        steps={[
          { label: "Off", note: "Default for a new flag" },
          { label: "Pilot", note: "Named schools only", tone: "warn" },
          { label: "Partial", note: "An arbitrary rollout percentage", tone: "warn" },
          { label: "Full", note: "Enabled platform-wide", tone: "good" },
          { label: "Instant rollback", note: "Any stage, back to Off immediately", tone: "bad" }
        ]}
      />
      <FlagsSection />
      <LifecycleSection />
    </div>
  );
}

async function LifecycleSection() {
  const migrations = await apiGet<SuperAdminPlanLifecycleRow[]>("/api/super-admin/feature-flags/lifecycle");

  return (
    <div className="grid gap-5">
      <TableCard
        title="Recent tier changes"
        description={`${(migrations ?? []).length} tier change(s) recorded, most recent first.`}
        items={migrations ?? []}
        emptyState="No tier migrations recorded yet. Change a school's plan from its profile to see it here."
        columns={[
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "to", header: "Migrated to", render: (item) => <StatusPill bg="var(--color-accent-primary-dim)" fg="var(--color-text-accent)" label={item.toPlan} /> },
          { key: "by", header: "Changed by", render: (item) => item.changedBy },
          { key: "when", header: "Changed", render: (item) => formatDate(item.changedAt) }
        ]}
      />
      <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">What happens to a school&apos;s data when its plan changes — nothing</p>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            Changing a school&apos;s plan updates that one field and writes an audit-log entry — that&apos;s the entire
            operation. Nothing locks, hides, or marks read-only any record a school built while on a higher plan, and
            nothing restores anything on upgrade, because nothing was ever touched on downgrade. A school can keep using
            a feature its new plan doesn&apos;t include until something else (like the Feature Matrix or an override)
            actually blocks it — there is no automatic entitlement enforcement tied to a plan change itself.
          </p>
        </div>
      </section>

      <TableCard
        title="Grandfathering rules — none of these are enforced by the system"
        description="A mature plan-lifecycle would protect schools from surprise price or entitlement changes. Checked against the real update code, not the aspiration."
        items={[
          { rule: "A price a school agreed to is honoured until renewal", spec: "Not built — editing a plan's price changes it for every subscriber immediately, including schools already on it. There's no per-school price lock.", state: "bad" },
          { rule: "30 days' notice before any renewal price change", spec: "Not built — no notice mechanism exists for a price edit at all.", state: "bad" },
          { rule: "Legacy plans stay open to their existing schools indefinitely", spec: "Partial — archiving a plan (isActive: false) only blocks new signups; schools already on it keep their subscription, but there's no formal 'legacy' state distinct from active/archived.", state: "warn" },
          { rule: "An archive requires zero schools on the plan first", spec: "Not built — a plan with active subscribers can be archived directly; nothing blocks it or prompts a migration first.", state: "bad" },
          { rule: "Entitlement removals need a migration plan", spec: "Not built — see the Feature Matrix tab's own disclosure: a feature can be switched off for a tier with no check for who's using it.", state: "bad" }
        ]}
        getRowKey={(row) => row.rule}
        columns={[
          { key: "rule", header: "Rule", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.rule}</span> },
          { key: "spec", header: "What actually happens", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "warn" | "bad"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />

      <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">Plan version history — not built</p>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            A plan record has no version number, no effective-from/effective-to dates, and no change log of its own —
            editing a plan&apos;s price or entitlements overwrites that row in place. The only record that a plan ever
            changed is a generic audit-log entry (actor, timestamp, and the new values), not a queryable version history
            with an approver or an effective date. &quot;Recent tier changes&quot; above tracks which school moved to
            which plan — it does not track how the plans themselves have changed over time.
          </p>
        </div>
      </section>
    </div>
  );
}

async function ExceptionsTab() {
  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Exceptions</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Per-school exceptions to the standard tier</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Where a school departs from its plan&apos;s default rules — a feature flag granted or restricted outside the
          tier-feature matrix, or custom branding applied to the live account. One queue, one case anatomy — the same
          review pattern used for Schools and Users.
        </p>
      </section>
      <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
        <div className="border-b border-[#E6EEE9] px-5 py-4">
          <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">What an exception is</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">What&apos;s real about each of these today, not just the concept.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {[
            { label: "Added — the school has something its plan does not include", detail: "Real. Recorded as a GRANTED override, reviewed and approved before it takes effect.", tone: "good" },
            { label: "Removed — the school has lost something its plan does include", detail: "Real as a RESTRICTED override, but there's no automatic non-payment trigger — a person creates the restriction by hand today.", tone: "warn" },
            { label: "Waiting — someone has asked and nobody has decided", detail: "Real. A PENDING override sits in the case queue above until approved or rejected.", tone: "warn" },
            { label: "Every exception carries an end date", detail: "Enforced at creation — the form requires an expiry date. Nothing then acts on that date (see the table below).", tone: "good" },
            { label: "The plan itself never changes from an exception", detail: "True by construction — an override is its own record, separate from the TierFeature matrix and the plan row.", tone: "good" }
          ].map((item) => {
            const dot = { good: "var(--color-success)", warn: "var(--color-warning)" }[item.tone];
            return (
              <div key={item.label} className="flex items-start gap-3 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 sm:last:border-b sm:odd:border-b">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
                <div>
                  <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <ExceptionsCaseBoard />
      <TableCard
        title="What happens when an override expires — not automated"
        description="Every override has a required expiry date, but nothing in this system acts on it. There is no scheduled job anywhere in the backend at all, at any interval — an expiry date is only ever checked once, at creation, to confirm it's in the future."
        items={[
          { step: "Before expiry", what: "Nothing — no notice is sent to the account manager, the school, or anyone else at any day count.", state: "bad" },
          { step: "On the expiry date", what: "Nothing — access doesn't stop. The override stays exactly as it was until a human opens this page and revokes it.", state: "bad" },
          { step: "After expiry, before revoked", what: "The case shows as a live data-integrity problem: still marked Approved with an expiry date in the past, flagged in red on this page until someone acts on it.", state: "warn" },
          { step: "On manual revoke", what: "A Super Admin or Product Lead revokes it by hand, with a required reason — the only real path back to a clean state.", state: "good" }
        ]}
        getRowKey={(row) => row.step}
        columns={[
          { key: "step", header: "Step", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.step}</span> },
          { key: "what", header: "What actually happens", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.what}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Real" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "warn" | "bad"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
            }
          }
        ]}
      />
      <TableCard
        title="Branding review — what's actually checked"
        description="Elite-tier custom branding, verified against the real submission and approval code, not the form's own copy."
        items={[
          { requirement: "Logo format and minimum width", spec: "Not enforced — the field accepts any text, not even a URL format check. The submission form's own label (\"PNG, min 300px\") describes a rule the backend never checks.", state: "bad" },
          { requirement: "Brand colours as hex codes", spec: "Enforced — both colour fields are validated against a hex-colour pattern before they can be saved.", state: "good" },
          { requirement: "Contrast check", spec: "Not built — no code compares the two colours for print contrast.", state: "bad" },
          { requirement: "Quality / appropriateness review", spec: "Approval is a bare status change — clicking Approve sets the status field and records who approved it; no automated check of the logo or colours runs at any point.", state: "bad" },
          { requirement: "Preview with sample data before going live", spec: "Not built on this page — there's no rendered preview step between approval and applying branding to the school's live account.", state: "bad" }
        ]}
        getRowKey={(row) => row.requirement}
        columns={[
          { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
          { key: "spec", header: "What actually happens", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "bad"];
              return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
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
          title={`Approve override for ${item.schoolName}`}
          description="Approve this feature override request."
          endpoint={`/api/super-admin/feature-flags/overrides/${item.id}/approve`}
          method="PATCH"
          variant="secondary"
          submitLabel="Approve"
          confirmLabel="Confirm"
          fields={[]}
        />
        <ResourceActionDialog
          triggerLabel="Reject"
          title={`Reject override for ${item.schoolName}`}
          description="Reject this pending override request. A reason is required and recorded on the case history."
          endpoint={`/api/super-admin/feature-flag-extras/overrides/${item.id}/reject`}
          method="PATCH"
          variant="danger"
          submitLabel="Reject override"
          confirmLabel="Confirm rejection"
          fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
        />
      </>
    );
  }
  if (item.status === "APPROVED") {
    return (
      <ResourceActionDialog
        triggerLabel="Revoke"
        title={`Revoke override for ${item.schoolName}`}
        description="Immediately disables this override. A reason is required and recorded on the case history."
        endpoint={`/api/super-admin/feature-flag-extras/overrides/${item.id}/revoke`}
        method="PATCH"
        variant="danger"
        submitLabel="Revoke override"
        confirmLabel="Confirm revoke"
        confirmMessage="This disables the override for this school immediately."
        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
      />
    );
  }
  return <p className="text-[12px] text-[var(--color-text-muted)]">Closed — {item.status.toLowerCase()}, no further action.</p>;
}

function brandingDecisions(item: SuperAdminBrandingAssetRow): ReactNode {
  if (item.status === "PENDING") {
    return (
      <ResourceActionDialog
        triggerLabel="Approve"
        title={`Approve branding for ${item.schoolName}`}
        description="Mark these assets as reviewed and approved for quality."
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
        title={`Apply branding for ${item.schoolName}`}
        description="Applies the approved logo and colours to the school's live account."
        endpoint={`/api/super-admin/feature-flags/branding/${item.id}/apply`}
        method="PATCH"
        variant="secondary"
        submitLabel="Apply now"
        confirmLabel="Confirm apply"
        confirmMessage="This updates the school's live branding immediately."
        fields={[]}
      />
    );
  }
  return <p className="text-[12px] text-[var(--color-text-muted)]">Closed — {item.status.toLowerCase()}, no further action.</p>;
}

async function ExceptionsCaseBoard() {
  const [overrides, branding, flags, schoolsEnvelope, plans, caseHistory] = await Promise.all([
    apiGet<SuperAdminFeatureOverrideRow[]>("/api/super-admin/feature-flags/overrides"),
    apiGet<SuperAdminBrandingAssetRow[]>("/api/super-admin/feature-flags/branding"),
    apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/feature-flags"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGet<SuperAdminPlanRow[]>("/api/super-admin/plans"),
    apiGet<SuperAdminFeatureFlagCaseHistory>("/api/super-admin/feature-flag-extras/case-history")
  ]);

  const schools = schoolsEnvelope.data ?? [];
  const schoolOptions = schools.map((school) => ({ label: school.name, value: school.id }));
  const flagOptions = (flags ?? []).map((flag) => ({ label: flag.name, value: flag.id }));
  const schoolById = new Map(schools.map((school) => [school.id, school]));
  const planCatalog = plans ?? [];
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

  const brandingCases: CaseRecord[] = brandingRows.map((item) => {
    const school = schoolById.get(item.schoolId);
    const planRecord = school ? planCatalog.find((plan) => plan.plan === school.plan && plan.isActive) : undefined;
    const signals: CaseRecord["signals"] = [];
    if (planRecord && !planRecord.customBranding) {
      signals.push({
        text: `${school?.name ?? item.schoolName} is on the ${planRecord.name} plan, which does not include custom branding — data-integrity issue.`,
        tone: "bad"
      });
    }
    if (!item.logoUrl) {
      signals.push({ text: "No logo URL provided — colour-only branding.", tone: "warn" });
    }

    const history = (caseHistory?.branding?.[item.id] ?? []).map((event) => ({ what: event.what, when: formatDate(event.when) }));

    return {
      id: item.id,
      subject: school?.name ?? item.schoolName,
      meta: `Custom branding · ${item.appliedTo.replaceAll("_", " ")}`,
      type: "custom-branding",
      initials: initialsFrom(school?.name ?? item.schoolName),
      assignee: item.status === "PENDING" ? "Awaiting Super Admin review" : item.approvedBy ?? "Super Admin",
      age: formatAge(item.createdAt),
      slaTone: "neutral",
      facts: [
        { label: "School", value: school?.name ?? item.schoolName },
        { label: "School tier", value: school?.plan ?? "Unknown" },
        { label: "Applies to", value: item.appliedTo.replaceAll("_", " ") },
        { label: "Colours", value: `${item.primaryColour} / ${item.secondaryColour}` },
        { label: "Logo", value: item.logoUrl ? "Provided" : "Not provided" }
      ],
      signals,
      evidence: item.logoUrl ? [{ name: item.logoUrl, who: school?.name ?? item.schoolName }] : [],
      checks: [
        { label: "Brand colours submitted", done: true },
        { label: "Logo provided", done: Boolean(item.logoUrl) },
        { label: "Reviewed by Super Admin", done: item.status !== "PENDING", who: item.approvedBy ?? undefined },
        { label: "Applied to live account", done: item.status === "APPLIED", who: item.appliedAt ? formatDate(item.appliedAt) : undefined }
      ],
      history,
      decisions: brandingDecisions(item)
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
    { label: "All open", value: "all", count: activeOverrideCount + activeBrandingCount },
    { label: "Feature override", value: "feature-override", count: activeOverrideCount },
    { label: "Custom branding", value: "custom-branding", count: activeBrandingCount }
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
  const revokedCount = overrideRows.filter((item) => item.status === "REJECTED" || item.status === "REVOKED").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Exceptions in force" value={activeOverrideCount + activeBrandingCount} detail={`${activeOverrideCount} override(s) · ${activeBrandingCount} branding`} icon={ShieldCheck} tone="dark" />
        <StatCard label="Waiting on a decision" value={waitingCount} detail="Pending overrides and branding" icon={Clock3} tone={waitingCount ? "warning" : "neutral"} />
        <StatCard label="Ending in the next 30 days" value={endingSoonCount} detail="Approved overrides nearing expiry" icon={ShieldAlert} tone={endingSoonCount ? "warning" : "neutral"} />
        <StatCard label="Granted more than twice this year" value={repeatedFlagCount} detail="A flag repeatedly overridden may belong on the plan" icon={Repeat2} tone={repeatedFlagCount ? "warning" : "neutral"} />
        <StatCard label="Revoked or rejected" value={revokedCount} detail="Not tracked as non-payment specifically" icon={Undo2} tone="neutral" />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ResourceActionDialog
          triggerLabel="Request override"
          title="Request a per-school feature override"
          description="Grant or restrict a specific flag for one school. Requires an expiry date and approval."
          endpoint="/api/super-admin/feature-flags/overrides"
          submitLabel="Request override"
          variant="secondary"
          fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
            { name: "flagId", label: "Feature flag", type: "select", required: true, options: flagOptions },
            { name: "overrideStatus", label: "Type", type: "select", defaultValue: "GRANTED", options: [{ label: "Grant access", value: "GRANTED" }, { label: "Restrict access", value: "RESTRICTED" }] },
            { name: "reason", label: "Reason", type: "textarea", required: true },
            { name: "expiryDate", label: "Expiry date", type: "date", required: true }
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
            { name: "logoUrl", label: "Logo URL (no format or size check is enforced)" },
            { name: "primaryColour", label: "Primary colour (hex)", required: true, placeholder: "#25593f" },
            { name: "secondaryColour", label: "Secondary colour (hex)", required: true, placeholder: "#c28c3d" }
          ]}
        />
      </div>
      <CaseReviewBoard
        types={types}
        cases={[...overrideCases, ...brandingCases]}
        emptyState="No feature overrides or branding exceptions on record."
        footerNote={`${overrideRows.length} override(s) · ${brandingRows.length} branding asset(s), most recent first.`}
        searchPlaceholder="Search a subject, type or assignee"
      />
    </div>
  );
}

async function FlagsSection() {
  const flags = await apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/feature-flags");

  return (
    <div className="grid gap-5">
    <TableCard
      title="Feature flags"
      description="Staged rollout: Off → Pilot → Partial → Full, with an instant platform-wide rollback at any stage. “In stage” is a proxy, not a precise measurement — there's no field recording when a flag entered its current stage, so this reads the row's last-updated time instead, which also moves on an unrelated edit."
      items={flags ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="Create Flag"
          title="Create feature flag"
          description="Use a stable key such as results.new-broadsheet or fees.paystack-v2."
          endpoint="/api/super-admin/feature-flags"
          submitLabel="Create Flag"
          fields={[
            { name: "key", label: "Flag Key", required: true, placeholder: "module.feature-name" },
            { name: "name", label: "Display Name", required: true },
            { name: "description", label: "Description", type: "textarea" }
          ]}
        />
      }
      emptyState="No feature flags have been configured."
      columns={[
        { key: "name", header: "Flag", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p><p className="text-xs text-[var(--color-text-muted)]">{item.key}</p></div> },
        { key: "rollout", header: "Rollout", render: (item) => <StatusBadge status={item.rolloutStatus} tone={item.rolloutStatus === "FULL" ? "success" : item.rolloutStatus === "OFF" ? "neutral" : "warning"} /> },
        { key: "pct", header: "Percent", render: (item) => `${item.rolloutPercent}%` },
        { key: "pilot", header: "Pilot schools", render: (item) => item.pilotSchoolCount },
        { key: "inStage", header: "In stage", render: (item) => `${formatAge(item.stageEnteredAt)}${daysBetween(new Date(item.stageEnteredAt).getTime(), Date.now()) > 30 ? " · review overdue" : ""}` },
        { key: "overrides", header: "Overrides", render: (item) => item.overrides },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Actions for ${item.name}`}>
              <ResourceActionDialog
                triggerLabel="Update rollout"
                title={`Update rollout — ${item.name}`}
                description="Advance the staged rollout. Full rollout enables the flag platform-wide."
                endpoint={`/api/super-admin/feature-flags/${item.id}/rollout`}
                method="PATCH"
                variant="menu"
                submitLabel="Update rollout"
                fields={[
                  { name: "rolloutStatus", label: "Rollout stage", type: "select", defaultValue: item.rolloutStatus, options: rolloutOptions },
                  { name: "rolloutPercent", label: "Percent (for Partial)", type: "number", defaultValue: item.rolloutPercent, min: 0, max: 100 }
                ]}
              />
              <ResourceActionDialog
                triggerLabel="Instant rollback"
                title={`Roll back ${item.name}`}
                description="Immediately disables this feature platform-wide."
                endpoint={`/api/super-admin/feature-flags/${item.id}/rollback`}
                method="POST"
                variant="menuDanger"
                submitLabel="Roll back now"
                confirmLabel="Confirm rollback"
                confirmMessage="This disables the feature for every school immediately."
                fields={[]}
              />
            </ActionMenu>
          )
        }
      ]}
    />
    <TableCard
      title="What every stage would record — mostly not built"
      description="Checked against the real feature-flag schema and update code, not the aspiration."
      items={[
        { field: "The exit criterion, in measurable terms", spec: "Not built — a flag has no field for a written exit criterion anywhere in the schema.", state: "bad" },
        { field: "The observation window (minimum 7 days per stage)", spec: "Not built — advancing a stage is a manual action with no minimum-duration check.", state: "bad" },
        { field: "The owner accountable for the decision", spec: "Not built — a flag records who created it, not a named owner for the current stage.", state: "bad" },
        { field: "The rollback trigger", spec: "Real, but manual — \"Instant rollback\" is a real one-click action available at every stage; there's no automatic trigger condition, a person decides to click it.", state: "warn" },
        { field: "The date the stage began", spec: "Not built — see the table above: what's shown as \"In stage\" is the row's last-updated timestamp, not a true per-stage start date.", state: "bad" }
      ]}
      getRowKey={(row) => row.field}
      columns={[
        { key: "field", header: "What the mockup describes", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.field}</span> },
        { key: "spec", header: "What actually happens", render: (row) => <span className="text-[12.5px] text-[var(--color-text-secondary)]">{row.spec}</span> },
        {
          key: "state",
          header: "State",
          render: (row) => {
            const tone = { good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" }, warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partial" }, bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" } }[row.state as "good" | "warn" | "bad"];
            return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
          }
        }
      ]}
    />
    </div>
  );
}

