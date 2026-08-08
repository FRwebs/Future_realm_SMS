import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet } from "@/lib/api/server";
import type {
  SuperAdminBrandingAssetRow,
  SuperAdminFeatureFlagRow,
  SuperAdminFeatureOverrideRow,
  SuperAdminTierFeatureRow
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const rolloutOptions = [
  { label: "Off", value: "OFF" },
  { label: "Pilot", value: "PILOT" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Full", value: "FULL" }
];
const yesNo = [{ label: "Yes", value: "true" }, { label: "No", value: "false" }];

function tabHref(tab: string) {
  return tab === "flags" ? "/super-admin/feature-flags" : `/super-admin/feature-flags?tab=${tab}`;
}

export default async function SuperAdminFeatureFlagsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "flags" } = searchParams ? await searchParams : {};

  const tabs = [
    { label: "Flags & Rollout", href: tabHref("flags"), active: tab === "flags" },
    { label: "Tier Matrix", href: tabHref("tiers"), active: tab === "tiers" },
    { label: "School Overrides", href: tabHref("overrides"), active: tab === "overrides" },
    { label: "Branding", href: tabHref("branding"), active: tab === "branding" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Release controls</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Feature & Tier Management</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Tier-feature matrix, staged feature-flag rollouts with instant rollback, per-school overrides, and Elite custom branding.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "flags" ? <FlagsTab /> : null}
      {tab === "tiers" ? <TierMatrixTab /> : null}
      {tab === "overrides" ? <OverridesTab /> : null}
      {tab === "branding" ? <BrandingTab /> : null}
    </div>
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
        { key: "name", header: "Flag", render: (item) => <div><p className="font-semibold text-ink">{item.name}</p><p className="text-xs text-ink/50">{item.key}</p></div> },
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

async function TierMatrixTab() {
  const features = await apiGet<SuperAdminTierFeatureRow[]>("/api/super-admin/feature-flags/tier-matrix");
  const check = (on: boolean) => (on ? <span className="font-bold text-emerald-700">✓</span> : <span className="text-rose-600">✕</span>);

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
        { key: "name", header: "Feature", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
        { key: "starter", header: "Starter", render: (item) => check(item.starterAccess) },
        { key: "standard", header: "Standard", render: (item) => check(item.standardAccess) },
        { key: "elite", header: "Elite", render: (item) => check(item.eliteAccess) }
      ]}
    />
  );
}

async function OverridesTab() {
  const overrides = await apiGet<SuperAdminFeatureOverrideRow[]>("/api/super-admin/feature-flags/overrides");

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
            { name: "schoolId", label: "School ID", required: true },
            { name: "flagId", label: "Feature flag ID", required: true },
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
              <span className="text-xs text-ink/50">{item.approvedBy ? `by ${item.approvedBy}` : item.status}</span>
            )
        }
      ]}
    />
  );
}

async function BrandingTab() {
  const assets = await apiGet<SuperAdminBrandingAssetRow[]>("/api/super-admin/feature-flags/branding");

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
            { name: "schoolId", label: "School ID", required: true },
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
            <span className="inline-block h-4 w-4 rounded-full border border-ink/10" style={{ backgroundColor: item.primaryColour }} />
            <span className="inline-block h-4 w-4 rounded-full border border-ink/10" style={{ backgroundColor: item.secondaryColour }} />
            <span className="text-xs text-ink/60">{item.primaryColour} / {item.secondaryColour}</span>
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
