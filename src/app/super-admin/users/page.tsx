import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminUserRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const tabs = [
  { label: "All Users", value: "" },
  { label: "Parents", value: "parent" },
  { label: "Teachers", value: "teacher" },
  { label: "Students", value: "student" },
  { label: "School Admins", value: "school_admin" }
];

export default async function SuperAdminUsersPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const key of ["search", "role", "schoolId", "status", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<SuperAdminUserRow[]>(`/api/super-admin/users?${query.toString()}`);
  const users = envelope.data ?? [];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Platform users</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Users</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Search and support every user across all school tenants.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const href = (tab.value ? `/super-admin/users?role=${tab.value}` : "/super-admin/users") as Route;
            const active = (params.role ?? "") === tab.value;
            return (
              <Link key={tab.label} href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-ink text-white" : "bg-sand/70 text-ink"}`}>
                {tab.label}
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
              <div className="flex flex-wrap gap-2">
                <Link className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-ink/10" href={`/super-admin/users/${item.id}`}>View Profile</Link>
                <ResourceActionDialog
                  triggerLabel="Reset Password"
                  title={`Reset password for ${item.name}`}
                  description="Generate a temporary password and require the user to change it on next support handoff."
                  endpoint={`/api/super-admin/users/${item.id}/reset-password`}
                  method="PATCH"
                  variant="secondary"
                  submitLabel="Reset password"
                  confirmLabel="Confirm Reset"
                  confirmMessage="This audit-sensitive action will invalidate the current password."
                  fields={[]}
                />
                <ResourceActionDialog
                  triggerLabel="Suspend"
                  title={`Suspend ${item.name}`}
                  description="Suspends this user account without deleting school records."
                  endpoint={`/api/super-admin/users/${item.id}/suspend`}
                  method="PATCH"
                  variant="danger"
                  submitLabel="Suspend user"
                  confirmLabel="Confirm Suspend"
                  fields={[]}
                />
                <ResourceActionDialog
                  triggerLabel="Delete"
                  title={`Soft-delete ${item.name}`}
                  description="Soft-deletes this user account without removing historical school records."
                  endpoint={`/api/super-admin/users/${item.id}`}
                  method="DELETE"
                  variant="danger"
                  submitLabel="Delete user"
                  confirmLabel="Confirm Delete"
                  fields={[]}
                />
              </div>
            )
          }
        ]}
        emptyState="No users match the current filters."
      />
    </div>
  );
}
