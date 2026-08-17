import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminAccountRecoveryRow,
  SuperAdminDuplicateFlagRow,
  SuperAdminImpersonationLogRow,
  SuperAdminSchoolRow,
  SuperAdminSuspiciousActivityRow,
  SuperAdminUserRow
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const roleTabs = [
  { label: "All Users", value: "" },
  { label: "Parents", value: "parent" },
  { label: "Teachers", value: "teacher" },
  { label: "Students", value: "student" },
  { label: "School Admins", value: "school_admin" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "registry" ? "/super-admin/users" : `/super-admin/users?tab=${tab}`;
}

export default async function SuperAdminUsersPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "registry";

  const pageTabs = [
    { label: "Global Registry", href: tabHref("registry"), active: tab === "registry" },
    { label: "Suspicious Activity", href: tabHref("suspicious"), active: tab === "suspicious" },
    { label: "Duplicate Review", href: tabHref("duplicates"), active: tab === "duplicates" },
    { label: "Account Recovery", href: tabHref("recovery"), active: tab === "recovery" },
    { label: "Impersonation Log", href: tabHref("impersonation"), active: tab === "impersonation" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Platform users</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Cross-Platform User Management</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Search and support every user across all school tenants — resolving account issues schools cannot resolve
          themselves, and keeping the platform accountable for who is using it.
        </p>
      </section>

      <DetailTabs tabs={pageTabs} />

      {tab === "registry" ? <RegistryTab params={params} /> : null}
      {tab === "suspicious" ? <SuspiciousActivityTab /> : null}
      {tab === "duplicates" ? <DuplicateAccountsTab /> : null}
      {tab === "recovery" ? <RecoveryTab /> : null}
      {tab === "impersonation" ? <ImpersonationLogTab /> : null}
    </div>
  );
}

async function RegistryTab({ params }: { params: Record<string, string | undefined> }) {
  const query = new URLSearchParams();
  for (const key of ["search", "role", "schoolId", "status", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const [envelope, schoolsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminUserRow[]>(`/api/super-admin/users?${query.toString()}`),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const users = envelope.data ?? [];
  const schoolOptions = [
    { label: "All schools", value: "" },
    ...(schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }))
  ];

  return (
    <>
      <FilterToolbar
        action="/super-admin/users"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "search", label: "Global search", type: "search", placeholder: "Name or email", defaultValue: params.search },
          { name: "role", label: "Role", type: "select", defaultValue: params.role, options: roleTabs.map((roleTab) => ({ label: roleTab.label, value: roleTab.value })) },
          { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: schoolOptions },
          { name: "status", label: "Status", type: "select", defaultValue: params.status, options: [
            { label: "Any status", value: "" },
            { label: "Active", value: "ACTIVE" },
            { label: "Suspended", value: "SUSPENDED" }
          ] }
        ]}
      />

      <TableCard
        title="Platform users"
        description={`${envelope.pagination?.total ?? users.length} user(s) found.`}
        items={users}
        columns={[
          { key: "name", header: "Name", render: (item) => item.name },
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "joined", header: "Date Joined", render: (item) => formatDate(item.createdAt) },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <ActionMenu triggerLabel={`Actions for ${item.name}`}>
                <ActionMenuLink href={`/super-admin/users/${item.id}`}>View profile</ActionMenuLink>
                <ResourceActionDialog
                  triggerLabel="Reset Password"
                  title={`Reset password for ${item.name}`}
                  description="Generate a temporary password and require the user to change it on next support handoff."
                  endpoint={`/api/super-admin/users/${item.id}/reset-password`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Reset password"
                  confirmLabel="Confirm Reset"
                  confirmMessage="This audit-sensitive action will invalidate the current password."
                  fields={[]}
                />
                <ResourceActionDialog
                  triggerLabel="Recover account"
                  title={`Recover account — ${item.name}`}
                  description="Verify the user's identity, then restore access with a temporary password. Logged for audit."
                  endpoint={`/api/super-admin/users/${item.id}/recovery`}
                  method="POST"
                  variant="menu"
                  submitLabel="Complete recovery"
                  confirmLabel="Confirm"
                  confirmMessage="This resets the user's password immediately."
                  fields={[
                    { name: "verificationMethod", label: "Identity verified via", required: true, placeholder: "e.g. School admin phone confirmation" },
                    { name: "newEmail", label: "New email (if recovering a lost inbox)", type: "email" }
                  ]}
                />
                {item.status === "SUSPENDED" ? (
                  <ResourceActionDialog
                    triggerLabel="Reinstate"
                    title={`Reinstate ${item.name}`}
                    description="Restores access for this account after a suspension is resolved."
                    endpoint={`/api/super-admin/users/${item.id}/reinstate`}
                    method="PATCH"
                    variant="menu"
                    submitLabel="Reinstate user"
                    confirmLabel="Confirm"
                    fields={[]}
                  />
                ) : (
                  <ResourceActionDialog
                    triggerLabel="Suspend"
                    title={`Suspend ${item.name}`}
                    description="Suspends this user account without deleting school records."
                    endpoint={`/api/super-admin/users/${item.id}/suspend`}
                    method="PATCH"
                    variant="menuDanger"
                    submitLabel="Suspend user"
                    confirmLabel="Confirm Suspend"
                    fields={[]}
                  />
                )}
                <ResourceActionDialog
                  triggerLabel="Delete"
                  title={`Soft-delete ${item.name}`}
                  description="Soft-deletes this user account without removing historical school records."
                  endpoint={`/api/super-admin/users/${item.id}`}
                  method="DELETE"
                  variant="menuDanger"
                  submitLabel="Delete user"
                  confirmLabel="Confirm Delete"
                  fields={[]}
                />
              </ActionMenu>
            )
          }
        ]}
        emptyState="No users match the current filters."
      />
    </>
  );
}

async function SuspiciousActivityTab() {
  const envelope = await apiGetEnvelope<SuperAdminSuspiciousActivityRow[]>("/api/super-admin/users/suspicious-activity");
  const flags = envelope.data ?? [];

  return (
    <TableCard
      title="Suspicious activity"
      description="Excessive failed logins, simultaneous sessions from different locations, and sensitive account actions taken outside business hours."
      items={flags}
      actions={
        <ResourceActionDialog
          triggerLabel="Run scan now"
          title="Recalculate suspicious activity"
          description="Scan for new suspicious activity signals across all users."
          endpoint="/api/super-admin/users/suspicious-activity/recalculate"
          method="POST"
          submitLabel="Run scan"
          fields={[]}
        />
      }
      columns={[
        { key: "user", header: "User", render: (item) => `${item.userName} (${item.userEmail})` },
        { key: "type", header: "Flag type", render: (item) => item.flagType.replaceAll("_", " ") },
        { key: "detail", header: "Detail", render: (item) => item.detail ?? "-" },
        { key: "detected", header: "Detected", render: (item) => formatDate(item.detectedAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Resolve flag for ${item.userName}`}>
              <ResourceActionDialog
                triggerLabel="Dismiss flag"
                title="Dismiss flag"
                description="Mark this flag as reviewed with no action needed."
                endpoint={`/api/super-admin/users/suspicious-activity/${item.id}/resolve`}
                method="PATCH"
                variant="menu"
                submitLabel="Dismiss"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "DISMISS", options: [{ label: "Dismiss", value: "DISMISS" }] }]}
              />
              <ResourceActionDialog
                triggerLabel="Force password reset"
                title="Force password reset"
                description="Resolves the flag and forces a password reset for this user."
                endpoint={`/api/super-admin/users/suspicious-activity/${item.id}/resolve`}
                method="PATCH"
                variant="menu"
                submitLabel="Force reset"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "FORCE_RESET", options: [{ label: "Force password reset", value: "FORCE_RESET" }] }]}
              />
              <ResourceActionDialog
                triggerLabel="Suspend pending investigation"
                title="Suspend account"
                description="Resolves the flag and suspends this account pending investigation."
                endpoint={`/api/super-admin/users/suspicious-activity/${item.id}/resolve`}
                method="PATCH"
                variant="menuDanger"
                submitLabel="Suspend"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "SUSPEND", options: [{ label: "Suspend account", value: "SUSPEND" }] }]}
              />
            </ActionMenu>
          )
        }
      ]}
      emptyState="No suspicious activity flagged. Run a scan to check for new signals."
    />
  );
}

async function DuplicateAccountsTab() {
  const envelope = await apiGetEnvelope<SuperAdminDuplicateFlagRow[]>("/api/super-admin/users/duplicates");
  const flags = envelope.data ?? [];

  return (
    <TableCard
      title="Duplicate accounts"
      description="Accounts sharing the same phone number. Merge keeps one account and deactivates the other; the deactivated account's records are preserved for audit."
      items={flags}
      actions={
        <ResourceActionDialog
          triggerLabel="Run scan now"
          title="Recalculate duplicate accounts"
          description="Scan for new potential duplicate accounts."
          endpoint="/api/super-admin/users/duplicates/recalculate"
          method="POST"
          submitLabel="Run scan"
          fields={[]}
        />
      }
      columns={[
        { key: "a", header: "Account A", render: (item) => `${item.userA.name} (${item.userA.email})` },
        { key: "b", header: "Account B", render: (item) => `${item.userB.name} (${item.userB.email})` },
        { key: "criteria", header: "Match", render: (item) => item.matchCriteria },
        { key: "created", header: "Flagged", render: (item) => formatDate(item.createdAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel="Resolve duplicate">
              <ResourceActionDialog
                triggerLabel={`Keep ${item.userA.name}`}
                title="Merge accounts"
                description={`Keep ${item.userA.name} and deactivate ${item.userB.name}.`}
                endpoint={`/api/super-admin/users/duplicates/${item.id}/resolve`}
                method="PATCH"
                variant="menu"
                submitLabel="Merge"
                fields={[
                  { name: "action", label: "Action", type: "select", defaultValue: "MERGE", options: [{ label: "Merge", value: "MERGE" }] },
                  { name: "keepUserId", label: "Keep user ID", defaultValue: item.userA.id }
                ]}
              />
              <ResourceActionDialog
                triggerLabel={`Keep ${item.userB.name}`}
                title="Merge accounts"
                description={`Keep ${item.userB.name} and deactivate ${item.userA.name}.`}
                endpoint={`/api/super-admin/users/duplicates/${item.id}/resolve`}
                method="PATCH"
                variant="menu"
                submitLabel="Merge"
                fields={[
                  { name: "action", label: "Action", type: "select", defaultValue: "MERGE", options: [{ label: "Merge", value: "MERGE" }] },
                  { name: "keepUserId", label: "Keep user ID", defaultValue: item.userB.id }
                ]}
              />
              <ResourceActionDialog
                triggerLabel="Dismiss"
                title="Dismiss duplicate flag"
                description="These are not duplicate accounts."
                endpoint={`/api/super-admin/users/duplicates/${item.id}/resolve`}
                method="PATCH"
                variant="menu"
                submitLabel="Dismiss"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "DISMISS", options: [{ label: "Dismiss", value: "DISMISS" }] }]}
              />
              <ResourceActionDialog
                triggerLabel="Escalate to school"
                title="Escalate to school admin"
                description="Flag this pair for the school's own admin to resolve."
                endpoint={`/api/super-admin/users/duplicates/${item.id}/resolve`}
                method="PATCH"
                variant="menuDanger"
                submitLabel="Escalate"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "ESCALATE", options: [{ label: "Escalate", value: "ESCALATE" }] }]}
              />
            </ActionMenu>
          )
        }
      ]}
      emptyState="No duplicate accounts flagged. Run a scan to check for new matches."
    />
  );
}

async function RecoveryTab() {
  const envelope = await apiGetEnvelope<SuperAdminAccountRecoveryRow[]>("/api/super-admin/users/recovery");
  const records = envelope.data ?? [];

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Support-assisted recovery</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Account recovery history</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every account recovered by support is logged here — who verified identity, how, and when. Start a new
          recovery from the &quot;Recover account&quot; action on a user in the Global Registry.
        </p>
      </section>

      <TableCard
        title="Recovery records"
        description="Most recent first."
        items={records}
        emptyState="No account recoveries have been completed yet."
        columns={[
          { key: "user", header: "User", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.userName}</p><p className="text-xs text-[var(--color-text-muted)]">{item.userEmail}</p></div> },
          { key: "method", header: "Verified via", render: (item) => item.verificationMethod },
          { key: "newEmail", header: "New email", render: (item) => item.newEmail ?? "—" },
          { key: "verifiedBy", header: "Verified by", render: (item) => item.verifiedBy },
          { key: "completed", header: "Completed", render: (item) => (item.completedAt ? formatDate(item.completedAt) : "In progress") }
        ]}
      />
    </div>
  );
}

async function ImpersonationLogTab() {
  const envelope = await apiGetEnvelope<SuperAdminImpersonationLogRow[]>("/api/super-admin/users/impersonation-log");
  const events = envelope.data ?? [];

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Accountability</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Impersonation log</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every time a Super Admin views the platform as a user (from that user&apos;s profile), it is recorded here
          immutably — who impersonated whom, why, and for how long the session token was valid.
        </p>
      </section>

      <TableCard
        title="Impersonation sessions"
        description="Most recent first."
        items={events}
        emptyState="No impersonation sessions recorded yet."
        columns={[
          { key: "by", header: "Impersonated by", render: (item) => item.impersonatedBy },
          { key: "target", header: "Target user", render: (item) => item.targetEmail },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "—" },
          {
            key: "duration",
            header: "Session length",
            render: (item) => (item.maxAgeSeconds ? <StatusPill bg="var(--color-warning-dim)" fg="var(--color-warning)" label={`${Math.round(item.maxAgeSeconds / 60)} min max`} /> : "—")
          },
          { key: "started", header: "Started", render: (item) => formatDate(item.startedAt) }
        ]}
      />
    </div>
  );
}
