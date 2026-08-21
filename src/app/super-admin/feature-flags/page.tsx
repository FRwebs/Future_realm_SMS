import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PlanCreateDialog, PlanEditDialog } from "@/components/super-admin/plan-action-dialogs";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBrandingAssetRow,
  SuperAdminFeatureFlagRow,
  SuperAdminFeatureOverrideRow,
  SuperAdminPlanLifecycleRow,
  SuperAdminPlanRow,
  SuperAdminSchoolRow,
  SuperAdminTierFeatureRow
} from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

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
  const { tab = "plans" } = searchParams ? await searchParams : {};

  const tabs = [
    { label: "Tier Plans", href: tabHref("plans"), active: tab === "plans" },
    { label: "Plan Builder", href: tabHref("builder"), active: tab === "builder" },
    { label: "Tier-Feature Matrix", href: tabHref("matrix"), active: tab === "matrix" },
    { label: "Lifecycle & Migration", href: tabHref("lifecycle"), active: tab === "lifecycle" },
    { label: "School Overrides", href: tabHref("overrides"), active: tab === "overrides" },
    { label: "Feature Flags", href: tabHref("flags"), active: tab === "flags" },
    { label: "Custom Branding", href: tabHref("branding"), active: tab === "branding" }
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Release controls</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Feature & Tier Management</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            Central control over what each subscription tier can access — pricing, staged feature-flag rollouts with instant
            rollback, per-school overrides, and Elite custom branding. None of it requires a code deployment.
          </p>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "plans" ? <PlansTab /> : null}
      {tab === "builder" ? <PlanBuilderTab /> : null}
      {tab === "matrix" ? <TierMatrixTab /> : null}
      {tab === "lifecycle" ? <LifecycleTab /> : null}
      {tab === "overrides" ? <OverridesTab /> : null}
      {tab === "flags" ? <FlagsTab /> : null}
      {tab === "branding" ? <BrandingTab /> : null}
    </div>
  );
}

async function PlansTab() {
  const plans = await apiGet<SuperAdminPlanRow[]>("/api/super-admin/plans");

  return (
    <TableCard
      title="Tier plans"
      description="Pricing, limits, and entitlements for every subscription tier. New subscriptions and upgrades use these terms."
      items={plans ?? []}
      emptyState="No subscription plans configured yet — start in Plan Builder."
      columns={[
        {
          key: "plan",
          header: "Plan",
          render: (item) => (
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.plan} · {item.slug}</p>
            </div>
          )
        },
        {
          key: "pricing",
          header: "Pricing",
          render: (item) => (
            <div>
              <p className="font-[var(--font-mono)] font-semibold text-[var(--color-text-primary)]">{formatCurrency(item.monthlyPrice)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">per student / semester</p>
            </div>
          )
        },
        {
          key: "limits",
          header: "Limits",
          render: (item) => (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {item.studentLimit ? `${item.studentLimit.toLocaleString()} students` : "Unlimited students"}
              {" · "}
              {item.staffLimit ? `${item.staffLimit.toLocaleString()} staff` : "Unlimited staff"}
            </p>
          )
        },
        { key: "support", header: "Support", render: (item) => item.supportTier },
        {
          key: "capabilities",
          header: "Capabilities",
          render: (item) => (
            <div className="flex flex-wrap gap-1.5">
              {item.apiAccess ? <StatusPill bg="var(--color-info-dim)" fg="var(--color-info)" label="API" /> : null}
              {item.customBranding ? <StatusPill bg="var(--color-accent-primary-dim)" fg="var(--color-text-accent)" label="Branding" /> : null}
            </div>
          )
        },
        { key: "subscribers", header: "Subscribers", render: (item) => item.subscriberCount },
        {
          key: "status",
          header: "Status",
          render: (item) =>
            item.isActive ? (
              <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Active" />
            ) : (
              <StatusPill bg="var(--color-bg-subtle)" fg="var(--color-text-muted)" label="Archived" />
            )
        },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Plan actions for ${item.name}`}>
              <PlanEditDialog plan={item} variant="menu" />
              <ResourceActionDialog
                triggerLabel={item.isActive ? "Archive" : "Reactivate"}
                title={`${item.isActive ? "Archive" : "Reactivate"} ${item.name}`}
                description={
                  item.isActive
                    ? "Archived plans stay on existing subscriptions but can no longer be selected for new signups or upgrades."
                    : "Reactivating makes this plan selectable again for new signups and upgrades."
                }
                endpoint={`/api/super-admin/plans/${item.id}/toggle`}
                method="PATCH"
                variant={item.isActive ? "menuDanger" : "menu"}
                submitLabel={item.isActive ? "Archive plan" : "Reactivate plan"}
                confirmLabel="Confirm"
                fields={[]}
              />
            </ActionMenu>
          )
        }
      ]}
    />
  );
}

async function PlanBuilderTab() {
  const plans = await apiGet<SuperAdminPlanRow[]>("/api/super-admin/plans");

  return (
    <div className="grid gap-5">
      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-eyebrow">Plan builder</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Build a new subscription plan</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Define pricing, usage limits, support tier, and entitlements for a new plan. It appears immediately in Tier Plans
            and becomes selectable for new school signups and upgrades.
          </p>
        </div>
        <PlanCreateDialog />
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">Reference</p>
        <h3 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Existing plans</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <div key={plan.id} className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{plan.plan}</p>
              <p className="mt-1 font-semibold text-[var(--color-text-primary)]">{plan.name}</p>
              <p className="mt-1 font-[var(--font-mono)] text-[13px] text-[var(--color-text-secondary)]">{formatCurrency(plan.monthlyPrice)} / semester</p>
            </div>
          ))}
          {(plans ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">No plans yet — the one you build here will show up first.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

async function TierMatrixTab() {
  const features = await apiGet<SuperAdminTierFeatureRow[]>("/api/super-admin/feature-flags/tier-matrix");
  const check = (on: boolean) => (on ? <span className="font-bold text-[var(--color-success)]">✓</span> : <span className="text-[var(--color-danger)]">✕</span>);

  return (
    <TableCard
      title="Tier-feature matrix"
      description="Which features are available on each subscription tier. Changes apply to new subscriptions and upgrades."
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
      emptyState="No matrix features defined yet."
      columns={[
        { key: "module", header: "Module", render: (item) => item.module },
        { key: "name", header: "Feature", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "starter", header: "Starter", render: (item) => check(item.starterAccess) },
        { key: "standard", header: "Standard", render: (item) => check(item.standardAccess) },
        { key: "elite", header: "Elite", render: (item) => check(item.eliteAccess) }
      ]}
    />
  );
}

async function LifecycleTab() {
  const migrations = await apiGet<SuperAdminPlanLifecycleRow[]>("/api/super-admin/feature-flags/lifecycle");

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Tier migration history</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Lifecycle & migration</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every time a school&apos;s subscription tier is changed on its profile, it is recorded here — who changed it, to
          which tier, and when.
        </p>
      </section>

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
    </div>
  );
}

async function OverridesTab() {
  const [overrides, flags, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminFeatureOverrideRow[]>("/api/super-admin/feature-flags/overrides"),
    apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/feature-flags"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const flagOptions = (flags ?? []).map((flag) => ({ label: flag.name, value: flag.id }));

  return (
    <TableCard
      title="Per-school feature overrides"
      description="Sales can request an override (with a mandatory expiry); Product Lead / Super Admin approve before it takes effect."
      items={overrides ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="Request override"
          title="Request a per-school feature override"
          description="Grant or restrict a specific flag for one school. Requires an expiry date and approval."
          endpoint="/api/super-admin/feature-flags/overrides"
          submitLabel="Request override"
          fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
            { name: "flagId", label: "Feature flag", type: "select", required: true, options: flagOptions },
            { name: "overrideStatus", label: "Type", type: "select", defaultValue: "GRANTED", options: [{ label: "Grant access", value: "GRANTED" }, { label: "Restrict access", value: "RESTRICTED" }] },
            { name: "reason", label: "Reason", type: "textarea", required: true },
            { name: "expiryDate", label: "Expiry date", type: "date", required: true }
          ]}
        />
      }
      emptyState="No feature overrides requested."
      columns={[
        { key: "school", header: "School", render: (item) => item.schoolName },
        { key: "flag", header: "Flag", render: (item) => item.flagName },
        { key: "type", header: "Type", render: (item) => item.overrideStatus },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
        { key: "expiry", header: "Expires", render: (item) => (item.expiryDate ? formatDate(item.expiryDate) : "-") },
        { key: "requested", header: "Requested by", render: (item) => item.requestedBy },
        {
          key: "actions",
          header: "Actions",
          render: (item) =>
            item.status === "PENDING" ? (
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
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">{item.approvedBy ? `by ${item.approvedBy}` : item.status}</span>
            )
        }
      ]}
    />
  );
}

async function FlagsTab() {
  const flags = await apiGet<SuperAdminFeatureFlagRow[]>("/api/super-admin/feature-flags");

  return (
    <TableCard
      title="Feature flags"
      description="Staged rollout: Off → Pilot → Partial → Full, with an instant platform-wide rollback at any stage."
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
  );
}

async function BrandingTab() {
  const [assets, schoolsEnvelope] = await Promise.all([
    apiGet<SuperAdminBrandingAssetRow[]>("/api/super-admin/feature-flags/branding"),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));

  return (
    <TableCard
      title="Custom branding (Elite tier)"
      description="Review a school's logo and brand colours, approve them, then apply to their live account (Super Admin confirms)."
      items={assets ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="Submit branding"
          title="Submit branding assets"
          description="Record an Elite school's logo URL and brand colours for review."
          endpoint="/api/super-admin/feature-flags/branding"
          submitLabel="Submit for review"
          fields={[
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
            { name: "logoUrl", label: "Logo URL (PNG, min 300px)" },
            { name: "primaryColour", label: "Primary colour (hex)", required: true, placeholder: "#25593f" },
            { name: "secondaryColour", label: "Secondary colour (hex)", required: true, placeholder: "#c28c3d" }
          ]}
        />
      }
      emptyState="No branding assets submitted."
      columns={[
        { key: "school", header: "School", render: (item) => item.schoolName },
        { key: "colours", header: "Colours", render: (item) => (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-full border border-[var(--color-border-default)]" style={{ backgroundColor: item.primaryColour }} />
            <span className="inline-block h-4 w-4 rounded-full border border-[var(--color-border-default)]" style={{ backgroundColor: item.secondaryColour }} />
            <span className="text-xs text-[var(--color-text-muted)]">{item.primaryColour} / {item.secondaryColour}</span>
          </span>
        ) },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
        { key: "created", header: "Submitted", render: (item) => formatDate(item.createdAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Actions for ${item.schoolName}`}>
              {item.status === "PENDING" ? (
                <ResourceActionDialog
                  triggerLabel="Approve"
                  title={`Approve branding for ${item.schoolName}`}
                  description="Mark these assets as reviewed and approved for quality."
                  endpoint={`/api/super-admin/feature-flags/branding/${item.id}/approve`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Approve"
                  fields={[]}
                />
              ) : null}
              {item.status === "APPROVED" ? (
                <ResourceActionDialog
                  triggerLabel="Apply to live account"
                  title={`Apply branding for ${item.schoolName}`}
                  description="Applies the approved logo and colours to the school's live account."
                  endpoint={`/api/super-admin/feature-flags/branding/${item.id}/apply`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Apply now"
                  confirmLabel="Confirm apply"
                  confirmMessage="This updates the school's live branding immediately."
                  fields={[]}
                />
              ) : null}
            </ActionMenu>
          )
        }
      ]}
    />
  );
}
