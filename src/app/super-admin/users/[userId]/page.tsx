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
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
        <Link href="/super-admin/users" className="text-[13px] font-semibold text-[rgba(255,255,255,0.85)] underline">← Back to users</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">User profile</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">{user.name}</h1>
            <p className="mt-2 text-[13px] text-[rgba(255,255,255,0.74)]">{user.email} · {user.role.replaceAll("_", " ")}</p>
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
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">School</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{user.school.name}</p>
          <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">{user.school.plan} · {user.school.status}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Profile type</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{user.profileType}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Last login</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Joined</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{formatDate(user.createdAt)}</p>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Activity</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Role-specific activity (last 90 days)</h2>
          <div className="mt-4 grid gap-2.5">
            {activitySummaryItems(user.activitySummary).map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.label}</span>
                <span className="font-[var(--font-mono)] text-[16px] font-bold text-[var(--color-text-primary)]">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-6">
          <p className="section-eyebrow">Guardians</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Linked accounts</h2>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Student records linked to this parent/guardian account.</p>
          <div className="mt-4 grid gap-2.5">
            {user.linkedAccounts.length === 0 ? (
              <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">No linked student accounts.</p>
            ) : (
              user.linkedAccounts.map((child) => (
                <div key={child.studentId} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{child.studentName}</span>
                  {child.isPrimary ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>
                      Primary
                    </span>
                  ) : null}
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
