import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const planOptions = [
  { label: "Basic", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Professional", value: "PROFESSIONAL" },
  { label: "Custom", value: "CUSTOM" },
  { label: "Enterprise", value: "ENTERPRISE" }
];

const schoolTypeOptions = [
  { label: "Mixed / Combined", value: "MIXED" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Secondary", value: "SECONDARY" },
  { label: "College", value: "COLLEGE" }
];

export default async function SuperAdminSchoolsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", params.page);
  const envelope = await apiGetEnvelope<SuperAdminSchoolRow[]>(`/api/super-admin/schools?${query.toString()}`);
  const schools = envelope.data ?? [];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Tenant management</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Schools</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Create, update, suspend, activate, and soft-delete school tenants across the platform.</p>
          </div>
          <ResourceActionDialog
            triggerLabel="Add New School"
            title="Create school tenant"
            description="Create a school account and initial administrator. The admin receives a temporary seed password."
            endpoint="/api/super-admin/schools"
            submitLabel="Create school"
            confirmLabel="Confirm Create"
            confirmMessage="Confirm this new tenant and administrator account before creating it."
            fields={[
              { name: "name", label: "School Name", required: true },
              { name: "ownerName", label: "Owner Full Name", required: true },
              { name: "ownerEmail", label: "Owner Email", type: "email", required: true },
              { name: "ownerPhone", label: "Owner Phone" },
              { name: "adminName", label: "Initial Admin Name" },
              { name: "adminEmail", label: "Initial Admin Email", type: "email" },
              { name: "plan", label: "Subscription Plan", type: "select", options: planOptions },
              { name: "category", label: "School Type", type: "select", options: schoolTypeOptions },
              { name: "country", label: "Country", defaultValue: "Nigeria" },
              { name: "state", label: "State" },
              { name: "city", label: "City" },
              { name: "address", label: "Address", type: "textarea" },
              { name: "trialEndDate", label: "Trial End Date", type: "date" }
            ]}
          />
        </div>
      </section>

      <FilterToolbar
        action="/super-admin/schools"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "search", label: "Search schools", type: "search", placeholder: "Search by school name", defaultValue: params.search },
          { name: "status", label: "Status", type: "select", defaultValue: params.status, options: [
            { label: "Any status", value: "" },
            { label: "Active", value: "ACTIVE" },
            { label: "Trial", value: "TRIAL" },
            { label: "Grace period", value: "GRACE_PERIOD" },
            { label: "Suspended", value: "SUSPENDED" },
            { label: "Archived", value: "ARCHIVED" }
          ] }
        ]}
      />

      <TableCard
        title="All schools"
        description={`${envelope.pagination?.total ?? schools.length} tenant(s) found.`}
        items={schools}
        columns={[
          { key: "name", header: "School Name", render: (item) => <Link className="font-semibold text-brand-700" href={`/super-admin/schools/${item.id}`}>{item.name}</Link> },
          { key: "location", header: "State", render: (item) => item.state ?? "—" },
          { key: "plan", header: "Plan", render: (item) => item.plan },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "students", header: "Total Students", render: (item) => item.totalStudents },
          { key: "churn", header: "Churn Risk", render: (item) => `${item.healthScore ?? 70}%` },
          { key: "renewal", header: "Renewal Date", render: (item) => (item.nextBillingAt ? formatDate(item.nextBillingAt) : "—") },
          { key: "created", header: "Date Created", render: (item) => formatDate(item.createdAt) },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <ActionMenu triggerLabel={`Actions for ${item.name}`}>
                <ActionMenuLink href={`/super-admin/schools/${item.id}`}>View</ActionMenuLink>
                <ResourceActionDialog
                  triggerLabel="Edit"
                  title={`Edit ${item.name}`}
                  description="Update school name or plan. Status changes require a logged reason — use the Change status action below."
                  endpoint={`/api/super-admin/schools/${item.id}`}
                  method="PATCH"
                  variant="menu"
                  submitLabel="Save changes"
                  fields={[
                    { name: "name", label: "School Name", defaultValue: item.name },
                    { name: "plan", label: "Plan", type: "select", options: planOptions, defaultValue: item.plan }
                  ]}
                />
                <ResourceActionDialog
                  triggerLabel="Change status"
                  title={`Change status — ${item.name}`}
                  description="Every status change requires a logged reason and is written to the audit trail."
                  endpoint={`/api/super-admin/schools/${item.id}/status`}
                  method="PATCH"
                  variant={item.status === "SUSPENDED" ? "menu" : "menuDanger"}
                  submitLabel="Update status"
                  confirmLabel="Confirm"
                  confirmMessage="This changes tenant access for all school users and is fully audited."
                  fields={[
                    { name: "status", label: "New status", type: "select", defaultValue: item.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED", options: [
                      { label: "Trial Active", value: "TRIAL" },
                      { label: "Active", value: "ACTIVE" },
                      { label: "Grace Period", value: "GRACE_PERIOD" },
                      { label: "Suspended", value: "SUSPENDED" },
                      { label: "Deactivated / Closed", value: "ARCHIVED" }
                    ] },
                    { name: "reason", label: "Reason", type: "textarea", required: true }
                  ]}
                />
                <ResourceActionDialog
                  triggerLabel="Delete"
                  title={`Soft-delete ${item.name}`}
                  description="Soft-deletes the school tenant and disables associated users without hard-deleting records."
                  endpoint={`/api/super-admin/schools/${item.id}`}
                  method="DELETE"
                  variant="menuDanger"
                  submitLabel="Delete school"
                  confirmLabel="Confirm Delete"
                  confirmMessage="This will hide the tenant and disable its users. Records remain in the database for audit recovery."
                  fields={[]}
                />
              </ActionMenu>
            )
          }
        ]}
        emptyState="No schools match the current filters."
      />
    </div>
  );
}
