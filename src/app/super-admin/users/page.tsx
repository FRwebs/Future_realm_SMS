import Link from "next/link";
import type { Route } from "next";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminDuplicateFlagRow, SuperAdminSuspiciousActivityRow, SuperAdminUserRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const roleTabs = [
  { label: "All Users", value: "" },
  { label: "Parents", value: "parent" },
  { label: "Teachers", value: "teacher" },
  { label: "Students", value: "student" },
  { label: "School Admins", value: "school_admin" }
];

function tabHref(tab: string) {
  return tab === "overview" ? "/super-admin/users" : `/super-admin/users?tab=${tab}`;
}

export default async function SuperAdminUsersPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "overview";
  const query = new URLSearchParams();
  for (const key of ["search", "role", "schoolId", "status", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<SuperAdminUserRow[]>(`/api/super-admin/users?${query.toString()}`);
  const users = envelope.data ?? [];

  const pageTabs = [
    { label: "All Users", href: tabHref("overview"), active: tab === "overview" },
    { label: "Suspicious Activity", href: tabHref("suspicious"), active: tab === "suspicious" },
    { label: "Duplicate Accounts", href: tabHref("duplicates"), active: tab === "duplicates" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Platform users</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Users</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Search and support every user across all school tenants.</p>
      </section>

      <DetailTabs tabs={pageTabs} />

      {tab === "overview" ? (
        <>
          <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <div className="flex flex-wrap gap-2">
              {roleTabs.map((roleTab) => {
                const href = (roleTab.value ? `/super-admin/users?role=${roleTab.value}` : "/super-admin/users") as Route;
                const active = (params.role ?? "") === roleTab.value;
                return (
                  <Link key={roleTab.label} href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-ink text-white" : "bg-sand/70 text-ink"}`}>
                    {roleTab.label}
                  </Link>
                );
              })}
            </div>
          </section>

          <FilterToolbar
            action="/super-admin/users"
            resultCount={envelope.pagination?.total}
            controls={[
              { name: "search", label: "Global search", type: "search", placeholder: "Name or email", defaultValue: params.search },
              { name: "schoolId", label: "School ID", type: "search", placeholder: "Optional school ID", defaultValue: params.schoolId },
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
      ) : null}

      {tab === "suspicious" ? <SuspiciousActivityTab /> : null}
      {tab === "duplicates" ? <DuplicateAccountsTab /> : null}
    </div>
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
