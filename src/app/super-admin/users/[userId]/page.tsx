import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminUserProfile } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function activitySummaryItems(summary: SuperAdminUserProfile["activitySummary"]) {
  if (summary.type === "STAFF") {
    return [
      { label: "Score entries submitted (term)", value: summary.scoreEntriesSubmitted },
      { label: "Attendance marked (term)", value: summary.attendanceMarked }
    ];
  }
  if (summary.type === "PARENT") {
    return [{ label: "Notifications received (term)", value: summary.notificationsReceived }];
  }
  return [{ label: "Admin actions taken (term)", value: summary.adminActionsTaken }];
}

export default async function SuperAdminUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await apiGet<SuperAdminUserProfile>(`/api/super-admin/users/${userId}`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/super-admin/users" className="text-sm font-semibold text-brand-700">Back to users</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">User profile</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{user.name}</h1>
            <p className="mt-2 text-sm text-ink/60">{user.email} · {user.role.replaceAll("_", " ")}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={user.status} />
            <ResourceActionDialog
              triggerLabel="Impersonate"
              title={`Impersonate ${user.name}`}
              description="Generate a 30-minute, read-only support session for this user. A reason is required and every session is fully audited."
              endpoint={`/api/super-admin/impersonate/${user.id}`}
              method="POST"
              variant="danger"
              submitLabel="Generate token"
              confirmLabel="Confirm Impersonation"
              confirmMessage="This creates a time-boxed, fully-logged view-as session."
              fields={[{ name: "reason", label: "Reason for impersonation", type: "textarea", required: true }]}
            />
            {user.status === "SUSPENDED" ? (
              <ResourceActionDialog
                triggerLabel="Reinstate"
                title={`Reinstate ${user.name}`}
                description="Restores access for this account."
                endpoint={`/api/super-admin/users/${user.id}/reinstate`}
                method="PATCH"
                variant="secondary"
                submitLabel="Reinstate"
                fields={[]}
              />
            ) : (
              <ResourceActionDialog
                triggerLabel="Suspend"
                title={`Suspend ${user.name}`}
                description="Suspends this account without deleting school records."
                endpoint={`/api/super-admin/users/${user.id}/suspend`}
                method="PATCH"
                variant="secondary"
                submitLabel="Suspend"
                fields={[]}
              />
            )}
            <ResourceActionDialog
              triggerLabel="Account recovery"
              title={`Recover account — ${user.name}`}
              description="For a school admin locked out with no email access. Verify identity by phone before completing this — the verification method is logged."
              endpoint={`/api/super-admin/users/${user.id}/recovery`}
              method="POST"
              variant="secondary"
              submitLabel="Complete recovery"
              confirmLabel="Confirm"
              confirmMessage="This resets the account's password and is fully audited."
              fields={[
                { name: "verificationMethod", label: "Verification details (school name, proprietress name, phone, recent activity)", type: "textarea", required: true },
                { name: "newEmail", label: "New verified email (optional)", type: "email" }
              ]}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">School</p>
          <p className="mt-2 font-semibold text-ink">{user.school.name}</p>
          <p className="mt-1 text-sm text-ink/55">{user.school.plan} · {user.school.status}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Profile type</p>
          <p className="mt-2 font-semibold text-ink">{user.profileType}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Last login</p>
          <p className="mt-2 font-semibold text-ink">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Joined</p>
          <p className="mt-2 font-semibold text-ink">{formatDate(user.createdAt)}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Role-specific activity (last 90 days)</h2>
          <div className="mt-4 grid gap-3">
            {activitySummaryItems(user.activitySummary).map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{item.label}</span>
                <span className="text-lg font-black text-ink">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">Linked accounts</h2>
          <p className="mt-2 text-sm text-ink/60">Student records linked to this parent/guardian account.</p>
          <div className="mt-4 grid gap-2">
            {user.linkedAccounts.length === 0 ? (
              <p className="rounded-2xl bg-sand/60 px-4 py-6 text-center text-sm text-ink/50">No linked student accounts.</p>
            ) : (
              user.linkedAccounts.map((child) => (
                <div key={child.studentId} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                  <span className="text-sm font-semibold text-ink">{child.studentName}</span>
                  {child.isPrimary ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Primary</span> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <TableCard
        title="Last 10 login sessions"
        description="Timestamp, device, and network origin for this user's most recent sessions."
        items={user.recentSessions}
        columns={[
          { key: "started", header: "Started", render: (item) => formatDate(item.startedAt) },
          { key: "activity", header: "Last activity", render: (item) => formatDate(item.lastActivityAt) },
          { key: "device", header: "Device", render: (item) => item.device ?? "Unknown" },
          { key: "ip", header: "IP address", render: (item) => item.ipAddress ?? "Unknown" },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.active ? "ACTIVE" : "ENDED"} /> }
        ]}
        emptyState="No login sessions recorded yet."
      />
    </div>
  );
}
