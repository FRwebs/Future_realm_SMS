import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminSchoolDetail } from "@/lib/domain/types";
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

function tabHref(schoolId: string, tab: string) {
  return tab === "overview" ? `/super-admin/schools/${schoolId}` : `/super-admin/schools/${schoolId}?tab=${tab}`;
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

  const tabs = [
    { label: "Overview", href: tabHref(schoolId, "overview"), active: tab === "overview" },
    { label: "Configuration", href: tabHref(schoolId, "configuration"), active: tab === "configuration" },
    { label: "Usage", href: tabHref(schoolId, "usage"), active: tab === "usage" },
    { label: "Subscription", href: tabHref(schoolId, "subscription"), active: tab === "subscription" },
    { label: "Activity Log", href: tabHref(schoolId, "activity"), active: tab === "activity" }
  ];

  const canClose = Boolean(school.dataExportedAt);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/super-admin/schools" className="text-sm font-semibold text-brand-700">Back to schools</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Tenant profile</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{school.name}</h1>
            <p className="mt-2 text-sm text-ink/60">{school.slug} · Created {formatDate(school.createdAt)}</p>
            {school.statusReason ? <p className="mt-1 text-xs text-ink/50">Last status reason: {school.statusReason}</p> : null}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={school.status} />
            <StatusBadge status={school.billingStatus} />
            <span className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink">{school.plan}</span>
            {school.prioritySupport ? <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">Priority support</span> : null}
          </div>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "overview" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {Object.entries(school.counts).map(([label, value]) => (
              <article key={label} className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">{label}</p>
                <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Contact & ownership</h2>
                  <p className="mt-2 text-sm text-ink/60">{school.ownerName} · {school.ownerEmail} · {school.ownerPhone ?? "No phone on file"}</p>
                  <p className="mt-1 text-sm text-ink/50">{[school.address, school.city, school.state, school.country].filter(Boolean).join(", ")}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-sand/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Account manager</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{school.accountManager ? `${school.accountManager.name} · ${school.accountManager.email}` : "Unassigned"}</p>
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
              {!canClose ? <p className="mt-3 text-xs text-ink/45">A full data export is required before this school can be deactivated or closed.</p> : null}
            </section>

            <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">School contacts</h2>
                  <p className="mt-2 text-sm text-ink/60">Secondary contacts beyond the primary owner.</p>
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
                {school.contacts.length === 0 ? <p className="rounded-2xl bg-sand/60 px-4 py-6 text-center text-sm text-ink/50">No additional contacts recorded.</p> : null}
                {school.contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{contact.name} {contact.isPrimary ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Primary</span> : null}</p>
                      <p className="text-xs text-ink/50">{contact.role} · {contact.email ?? "no email"} · {contact.phone ?? "no phone"}</p>
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
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary-700">Read-only — owned by the school</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">Academic configuration</h2>
          <p className="mt-2 text-sm text-ink/60">Configuration belongs to the school; Future Realm admins can view but not edit it here.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "Academic sessions", value: school.configuration.academicSessionCount },
              { label: "Terms configured", value: school.configuration.termCount },
              { label: "Active grading scheme", value: school.configuration.activeGradingScheme ?? "Not set" },
              { label: "Pass mark", value: school.configuration.passMark ?? "—" },
              { label: "Class levels", value: school.configuration.classLevelCount },
              { label: "Class rooms / arms", value: school.configuration.classRoomCount },
              { label: "Subjects", value: school.configuration.subjectCount }
            ].map((item) => (
              <article key={item.label} className="rounded-[1.25rem] border border-slate-100 bg-sand/55 p-4">
                <p className="text-xs font-bold text-slate-500">{item.label}</p>
                <p className="mt-2 font-[var(--font-heading)] text-xl font-black text-ink">{item.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "usage" ? (
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Usage & engagement</h2>
          <p className="mt-2 text-sm text-ink/60">Module adoption and recent activity for this tenant.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "Modules adopted", value: `${school.usage.moduleAdoptionCount} / ${school.usage.moduleTotal}` },
              { label: "Last activity", value: school.usage.lastActivityAt ? formatDate(school.usage.lastActivityAt) : "No activity yet" },
              { label: "Notification volume (30d)", value: school.usage.notificationVolumeLast30Days },
              { label: "Support tickets raised", value: school.usage.supportTicketCount },
              { label: "Logins (last 30 days)", value: school.usage.loginCountLast30Days },
              { label: "Storage used", value: `${school.healthScore}% health score` }
            ].map((item) => (
              <article key={item.label} className="rounded-[1.25rem] border border-slate-100 bg-sand/55 p-4">
                <p className="text-xs font-bold text-slate-500">{item.label}</p>
                <p className="mt-2 font-[var(--font-heading)] text-xl font-black text-ink">{item.value}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {Object.entries(school.featureFlags).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl bg-sand/60 p-4 text-sm">
                <span className="font-semibold text-ink">{moduleLabels[key] ?? key}</span>
                <span className={enabled ? "text-emerald-700" : "text-rose-700"}>{enabled ? "Enabled" : "Disabled"}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "subscription" ? (
        <>
          <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Subscription & billing</h2>
                <p className="mt-2 text-sm text-ink/60">Plan, trial, and billing status for this tenant.</p>
              </div>
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
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { label: "Plan", value: school.plan },
                { label: "Billing status", value: school.billingStatus },
                { label: "Trial ends", value: school.trialEndsAt ? formatDate(school.trialEndsAt) : "Not on trial" },
                { label: "Last payment", value: school.lastPaymentAt ? formatDate(school.lastPaymentAt) : "None recorded" },
                { label: "Next billing date", value: school.nextBillingAt ? formatDate(school.nextBillingAt) : "—" }
              ].map((item) => (
                <article key={item.label} className="rounded-[1.25rem] border border-slate-100 bg-sand/55 p-4">
                  <p className="text-xs font-bold text-slate-500">{item.label}</p>
                  <p className="mt-2 font-[var(--font-heading)] text-xl font-black text-ink">{item.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Data export & closure</h2>
            <p className="mt-2 text-sm text-ink/60">
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
