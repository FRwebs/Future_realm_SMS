import type { ReactNode } from "react";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminSchoolDetail, SuperAdminSchoolGroup } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const moduleLabels: Record<string, string> = {
  transport: "Transport",
  library: "Library",
  hostel: "Hostel",
  fees: "Fees",
  "e-learning": "E-learning",
  messaging: "Messaging",
  report_cards: "Report cards"
};

const statusOptions = [
  { label: "Trial Active", value: "TRIAL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Grace Period", value: "GRACE_PERIOD" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Deactivated / Closed", value: "ARCHIVED" },
  { label: "Deleted", value: "DELETED" }
];

const planTierOptions = ["BASIC", "STANDARD", "PROFESSIONAL", "ENTERPRISE", "CUSTOM"].map((value) => ({ label: value, value }));

function tabHref(schoolId: string, tab: string) {
  return tab === "overview" ? `/super-admin/schools/${schoolId}` : `/super-admin/schools/${schoolId}?tab=${tab}`;
}

function FieldList({ fields }: { fields: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
      {fields.map((field, index) => (
        <div
          key={field.label}
          className={`flex items-center justify-between gap-4 px-4 py-3 ${index % 2 === 1 ? "bg-[var(--color-bg-subtle)]" : "bg-[var(--color-bg-surface)]"}`}
        >
          <dt className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">{field.label}</dt>
          <dd className="text-right text-[13px] font-semibold text-[var(--color-text-primary)]">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TogglePill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        background: enabled ? "var(--color-success-dim)" : "var(--color-bg-subtle)",
        color: enabled ? "var(--color-success)" : "var(--color-text-muted)"
      }}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export default async function SuperAdminSchoolDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ schoolId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { schoolId } = await params;
  const { tab = "overview" } = searchParams ? await searchParams : {};
  const school = await apiGet<SuperAdminSchoolDetail>(`/api/super-admin/schools/${schoolId}`);
  const groupsEnvelope = await apiGetEnvelope<SuperAdminSchoolGroup[]>("/api/super-admin/schools/groups");
  const availableGroups = groupsEnvelope.data ?? [];

  const tabs = [
    { label: "Overview", href: tabHref(schoolId, "overview"), active: tab === "overview" },
    { label: "Configuration", href: tabHref(schoolId, "configuration"), active: tab === "configuration" },
    { label: "Usage", href: tabHref(schoolId, "usage"), active: tab === "usage" },
    { label: "Subscription", href: tabHref(schoolId, "subscription"), active: tab === "subscription" },
    { label: "Activity Log", href: tabHref(schoolId, "activity"), active: tab === "activity" }
  ];

  const canClose = Boolean(school.dataExportedAt);

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6">
        <Link href="/super-admin/schools" className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          ← Back to schools
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Tenant profile</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">{school.name}</h1>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{school.slug} · Created {formatDate(school.createdAt)}</p>
            {school.statusReason ? <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Last status reason: {school.statusReason}</p> : null}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={school.status} />
            <StatusBadge status={school.billingStatus} />
            <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--color-text-primary)]">
              {school.plan}
            </span>
            {school.prioritySupport ? (
              <span
                className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
                style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
              >
                Priority support
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            {Object.entries(school.counts).map(([label, value]) => (
              <article key={label} className="surface-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
                <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <section className="surface-card p-6">
              <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Contact & ownership</h2>
              <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                {school.ownerName} · {school.ownerEmail} · {school.ownerPhone ?? "No phone on file"}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {[school.address, school.city, school.state, school.country].filter(Boolean).join(", ")}
              </p>

              <div className="mt-5 rounded-[10px] bg-[var(--color-bg-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Account manager</p>
                    <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {school.accountManager ? `${school.accountManager.name} · ${school.accountManager.email}` : "Unassigned"}
                    </p>
                  </div>
                  <ResourceActionDialog
                    triggerLabel="Assign"
                    title="Assign account manager"
                    description="Set the internal platform team member accountable for this school relationship."
                    endpoint={`/api/super-admin/schools/${school.id}/account-manager`}
                    method="POST"
                    variant="secondary"
                    submitLabel="Assign manager"
                    fields={[{ name: "accountManagerEmail", label: "Team member email", type: "email", required: true }]}
                  />
                </div>
              </div>

              <div className="mt-3 rounded-[10px] bg-[var(--color-bg-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">School group</p>
                    <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {school.schoolGroup ? school.schoolGroup.name : "Not linked to a group"}
                    </p>
                  </div>
                  {school.schoolGroup ? (
                    <ResourceActionDialog
                      triggerLabel="Unlink"
                      title={`Remove from ${school.schoolGroup.name}`}
                      description="This school will no longer roll up to the group's billing or aggregate reporting."
                      endpoint={`/api/super-admin/schools/${school.id}/group`}
                      method="DELETE"
                      variant="secondary"
                      submitLabel="Unlink"
                      confirmLabel="Confirm"
                      confirmMessage="This removes the school from its group."
                      fields={[]}
                    />
                  ) : availableGroups.length > 0 ? (
                    <ResourceActionDialog
                      triggerLabel="Link to group"
                      title="Link to a school group"
                      description="Linking never merges student or result data — only billing and account management can roll up to the group."
                      endpoint={`/api/super-admin/schools/${school.id}/group`}
                      method="POST"
                      variant="secondary"
                      submitLabel="Link school"
                      fields={[
                        { name: "schoolGroupId", label: "Group", type: "select", required: true, options: availableGroups.map((group) => ({ label: group.name, value: group.id })) }
                      ]}
                    />
                  ) : (
                    <Link href="/super-admin/schools?tab=groups" className="btn-link text-[12.5px]">
                      Create a group first
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ResourceActionDialog
                  triggerLabel={school.prioritySupport ? "Remove priority flag" : "Flag for priority support"}
                  title="Priority support flag"
                  description="Priority-flagged schools are surfaced first in the support queue."
                  endpoint={`/api/super-admin/schools/${school.id}`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Save"
                  fields={[{ name: "prioritySupport", label: "Priority support", type: "select", defaultValue: school.prioritySupport ? "false" : "true", options: [{ label: "Enabled", value: "true" }, { label: "Disabled", value: "false" }] }]}
                />
                <ResourceActionDialog
                  triggerLabel="Change status"
                  title="Change tenant status"
                  description="Every status change requires a logged reason and is written to the audit trail."
                  endpoint={`/api/super-admin/schools/${school.id}/status`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Update status"
                  confirmLabel="Confirm"
                  confirmMessage="This changes tenant access for all school users and is fully audited."
                  fields={[
                    { name: "status", label: "New status", type: "select", defaultValue: school.status, options: statusOptions },
                    { name: "reason", label: "Reason", type: "textarea", required: true }
                  ]}
                />
              </div>
              {!canClose ? <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">A full data export is required before this school can be deactivated or closed.</p> : null}
            </section>

            <section className="surface-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">School contacts</h2>
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Secondary contacts beyond the primary owner.</p>
                </div>
                <ResourceActionDialog
                  triggerLabel="Add contact"
                  title="Add school contact"
                  description="Add a secondary contact for this school."
                  endpoint={`/api/super-admin/schools/${school.id}/contacts`}
                  method="POST"
                  variant="secondary"
                  submitLabel="Add contact"
                  fields={[
                    { name: "name", label: "Full name", required: true },
                    { name: "role", label: "Role", required: true, placeholder: "e.g. Vice Principal" },
                    { name: "phone", label: "Phone" },
                    { name: "email", label: "Email", type: "email" },
                    { name: "isPrimary", label: "Primary contact", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] }
                  ]}
                />
              </div>
              <div className="mt-4 grid gap-2">
                {school.contacts.length === 0 ? (
                  <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">No additional contacts recorded.</p>
                ) : null}
                {school.contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                        {contact.name}
                        {contact.isPrimary ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{contact.role} · {contact.email ?? "no email"} · {contact.phone ?? "no phone"}</p>
                    </div>
                    <ResourceActionDialog
                      triggerLabel="Remove"
                      title={`Remove ${contact.name}`}
                      description="Remove this contact from the school profile."
                      endpoint={`/api/super-admin/schools/${school.id}/contacts/${contact.id}`}
                      method="DELETE"
                      variant="menuDanger"
                      submitLabel="Remove contact"
                      confirmLabel="Confirm"
                      confirmMessage="This removes the contact permanently."
                      fields={[]}
                    />
                  </div>
                ))}
              </div>
            </section>
          </section>

          <TableCard
            title="School admins"
            description="Administrators and leaders attached to this tenant."
            items={school.admins}
            columns={[
              { key: "name", header: "Name", render: (item) => item.name },
              { key: "email", header: "Email", render: (item) => item.email },
              { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
              { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
              { key: "joined", header: "Joined", render: (item) => formatDate(item.createdAt) }
            ]}
          />
        </>
      ) : null}

      {tab === "configuration" ? (
        <section className="surface-card p-6">
          <p className="section-eyebrow">Read-only — owned by the school</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Academic configuration</h2>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Configuration belongs to the school; Future Realm admins can view but not edit it here.</p>
          <div className="mt-5">
            <FieldList
              fields={[
                { label: "Academic sessions", value: school.configuration.academicSessionCount },
                { label: "Terms configured", value: school.configuration.termCount },
                { label: "Active grading scheme", value: school.configuration.activeGradingScheme ?? "Not set" },
                { label: "Pass mark", value: school.configuration.passMark ?? "—" },
                { label: "Class levels", value: school.configuration.classLevelCount },
                { label: "Class rooms / arms", value: school.configuration.classRoomCount },
                { label: "Subjects", value: school.configuration.subjectCount }
              ]}
            />
          </div>
        </section>
      ) : null}

      {tab === "usage" ? (
        <section className="surface-card p-6">
          <p className="section-eyebrow">Usage — module adoption and activity</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Usage & engagement</h2>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Module adoption and recent activity for this tenant.</p>
          <div className="mt-5">
            <FieldList
              fields={[
                { label: "Modules adopted", value: `${school.usage.moduleAdoptionCount} / ${school.usage.moduleTotal}` },
                { label: "Last activity", value: school.usage.lastActivityAt ? formatDate(school.usage.lastActivityAt) : "No activity yet" },
                { label: "Notification volume (30d)", value: school.usage.notificationVolumeLast30Days },
                { label: "Support tickets raised", value: school.usage.supportTicketCount },
                { label: "Logins (last 30 days)", value: school.usage.loginCountLast30Days },
                { label: "Health score", value: `${school.healthScore}%` }
              ]}
            />
          </div>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Feature modules</p>
          <div className="mt-3 grid gap-2">
            {Object.entries(school.featureFlags).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{moduleLabels[key] ?? key}</span>
                <TogglePill enabled={enabled} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "subscription" ? (
        <>
          <section className="surface-card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="section-eyebrow">Subscription & billing</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Plan and billing status</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <ResourceActionDialog
                  triggerLabel="Change plan"
                  title={`Change subscription tier — ${school.name}`}
                  description="Migrates this school to a different subscription tier. The change is recorded in Lifecycle & Migration."
                  endpoint={`/api/super-admin/schools/${school.id}`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Change plan"
                  confirmLabel="Confirm migration"
                  confirmMessage={`This changes ${school.name}'s billing tier immediately.`}
                  fields={[{ name: "plan", label: "New tier", type: "select", defaultValue: school.plan, options: planTierOptions }]}
                />
                <ResourceActionDialog
                  triggerLabel="Update features"
                  title="School feature flags"
                  description="Paste a JSON object to enable or disable modules for this tenant."
                  endpoint={`/api/super-admin/schools/${school.id}/features`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Save features"
                  fields={[
                    { name: "features", label: "Feature JSON", type: "textarea", parse: "json", defaultValue: JSON.stringify(school.featureFlags, null, 2) }
                  ]}
                />
              </div>
            </div>
            <div className="mt-5">
              <FieldList
                fields={[
                  { label: "Plan", value: school.plan },
                  { label: "Billing status", value: school.billingStatus },
                  { label: "Trial ends", value: school.trialEndsAt ? formatDate(school.trialEndsAt) : "Not on trial" },
                  { label: "Last payment", value: school.lastPaymentAt ? formatDate(school.lastPaymentAt) : "None recorded" },
                  { label: "Next billing date", value: school.nextBillingAt ? formatDate(school.nextBillingAt) : "—" }
                ]}
              />
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Data export & closure</h2>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
              {school.dataExportedAt
                ? `Full data export completed ${formatDate(school.dataExportedAt)}. This school can now be deactivated or closed.`
                : "A full export of students, staff, and finance records is required before this school can be deactivated or closed."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/api/super-admin/schools/${school.id}/export`} className="btn-secondary px-5">Download full data export</a>
            </div>
          </section>
        </>
      ) : null}

      {tab === "activity" ? (
        <TableCard
          title="Activity log"
          description="Immutable audit trail scoped to this school — logins, publications, notifications, and admin actions."
          items={school.activityLog}
          columns={[
            { key: "time", header: "Timestamp", render: (item) => formatDate(item.timestamp) },
            { key: "actor", header: "Actor", render: (item) => item.superAdmin },
            { key: "action", header: "Action", render: (item) => item.action.replaceAll("_", " ") },
            { key: "target", header: "Target", render: (item) => item.target }
          ]}
          emptyState="No audit activity recorded for this school yet."
        />
      ) : null}
    </div>
  );
}
