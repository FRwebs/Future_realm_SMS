import type { ReactNode } from "react";

import { type CaseRecord, type CaseTypeFilter, CaseReviewBoard } from "@/components/data-display/case-review-board";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PlanCreateDialog, PlanEditDialog } from "@/components/super-admin/plan-action-dialogs";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminBrandingAssetRow,
  SuperAdminFeatureFlagCaseHistory,
  SuperAdminFeatureFlagRow,
  SuperAdminFeatureOverrideRow,
  SuperAdminPlanLifecycleRow,
  SuperAdminPlanRow,
  SuperAdminSchoolRow,
  SuperAdminTierFeatureRow
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
    { label: "Exceptions", href: tabHref("exceptions"), active: tab === "exceptions", badge: exceptionsCount },
    { label: "Rollout", href: tabHref("rollout"), active: tab === "rollout" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Release controls"
        title="Plans & Features"
        description="Central control over what each subscription tier can access — pricing, the tier-feature matrix, per-school exceptions such as overrides and Elite custom branding, and staged feature-flag / plan rollouts. None of it requires a code deployment."
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
  const plans = await apiGet<SuperAdminPlanRow[]>("/api/super-admin/plans");

  return (
    <TableCard
      title="Plans"
      description="Pricing, limits, and entitlements for every subscription tier. New subscriptions and upgrades use these terms."
      items={plans ?? []}
      actions={<PlanCreateDialog />}
      emptyState="No subscription plans configured yet — build one to get started."
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

async function TierMatrixTab() {
  const features = await apiGet<SuperAdminTierFeatureRow[]>("/api/super-admin/feature-flags/tier-matrix");
  const check = (on: boolean) => (on ? <span className="font-bold text-[var(--color-success)]">✓</span> : <span className="text-[var(--color-danger)]">✕</span>);

  return (
    <TableCard
      title="Feature matrix"
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
      <FlagsSection />
      <LifecycleSection />
    </div>
  );
}

async function LifecycleSection() {
  const migrations = await apiGet<SuperAdminPlanLifecycleRow[]>("/api/super-admin/feature-flags/lifecycle");

  return (
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
      <ExceptionsCaseBoard />
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

  return (
    <div className="grid gap-4">
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
            { name: "logoUrl", label: "Logo URL (PNG, min 300px)" },
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
      />
    </div>
  );
}

async function FlagsSection() {
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

