import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet } from "@/lib/api/server";
import type {
  SuperAdminDepartmentRow,
  SuperAdminInternalMember,
  SuperAdminPermissionTemplateRow,
  SuperAdminTeamActivity
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const roleOptions = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"].map((v) => ({ label: v.replaceAll("_", " "), value: v }));
const accessLevels = ["NONE", "VIEW", "EDIT", "FULL"].map((v) => ({ label: v, value: v }));

function tabHref(tab: string) {
  return tab === "members" ? "/super-admin/internal-team" : `/super-admin/internal-team?tab=${tab}`;
}

export default async function SuperAdminInternalTeamPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "members" } = searchParams ? await searchParams : {};
  const tabs = [
    { label: "Team Members", href: tabHref("members"), active: tab === "members" },
    { label: "Departments", href: tabHref("departments"), active: tab === "departments" },
    { label: "Permission Templates", href: tabHref("templates"), active: tab === "templates" },
    { label: "Activity", href: tabHref("activity"), active: tab === "activity" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Access control centre</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Internal Team & Roles</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Onboard and offboard Future Realm staff, assign departments and role templates, set granular per-module permissions, and grant time-bound access.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "members" ? <MembersTab /> : null}
      {tab === "departments" ? <DepartmentsTab /> : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
    </div>
  );
}

async function MembersTab() {
  const members = await apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team");

  return (
    <TableCard
      title="Internal accounts"
      description="Future Realm platform staff. Offboarding instantly revokes access and terminates all sessions."
      items={members ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="New hire"
          title="Create an internal account"
          description="Creates a platform account with a temporary password. The role's default permission template is applied automatically."
          endpoint="/api/super-admin/internal-team"
          submitLabel="Create account"
          fields={[
            { name: "firstName", label: "First name", required: true },
            { name: "lastName", label: "Last name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "role", label: "Role", type: "select", options: roleOptions },
            { name: "department", label: "Department (optional)" }
          ]}
        />
      }
      columns={[
        { key: "name", header: "Name", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
        { key: "email", header: "Email", render: (item) => item.email },
        { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status === "ACTIVE" ? "success" : item.status === "REVOKED" ? "danger" : "warning"} /> },
        { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Actions for ${item.name}`}>
              <ResourceActionDialog
                triggerLabel="Set module permission"
                title={`Set permission — ${item.name}`}
                description="Set this member's access level for a specific admin-panel module (M1-M12)."
                endpoint="/api/super-admin/internal-team/permission-grid"
                method="POST"
                variant="menu"
                submitLabel="Save permission"
                fields={[
                  { name: "userId", label: "User ID", defaultValue: item.id },
                  { name: "moduleId", label: "Module (e.g. M3, billing)", required: true },
                  { name: "accessLevel", label: "Access level", type: "select", options: accessLevels }
                ]}
              />
              <ResourceActionDialog
                triggerLabel="Grant time-bound access"
                title={`Grant temporary access — ${item.name}`}
                description="Grant access to a module that auto-revokes on the expiry date."
                endpoint="/api/super-admin/internal-team/access-grants"
                method="POST"
                variant="menu"
                submitLabel="Grant access"
                fields={[
                  { name: "userId", label: "User ID", defaultValue: item.id },
                  { name: "moduleId", label: "Module", required: true },
                  { name: "functionId", label: "Function (optional)" },
                  { name: "expiresAt", label: "Expires on", type: "date", required: true }
                ]}
              />
              {item.status !== "REVOKED" ? (
                <ResourceActionDialog
                  triggerLabel="Offboard"
                  title={`Offboard ${item.name}`}
                  description="Immediately revokes all access and terminates active sessions. This cannot be undone from here."
                  endpoint={`/api/super-admin/internal-team/${item.id}`}
                  method="DELETE"
                  variant="menuDanger"
                  submitLabel="Offboard now"
                  confirmLabel="Confirm offboard"
                  confirmMessage="This instantly cuts off all access for this team member."
                  fields={[]}
                />
              ) : null}
            </ActionMenu>
          )
        }
      ]}
      emptyState="No internal team members found."
    />
  );
}

async function DepartmentsTab() {
  const departments = await apiGet<SuperAdminDepartmentRow[]>("/api/super-admin/internal-team/departments");

  return (
    <TableCard
      title="Departments"
      description="Organise the team into departments, each with a lead who can manage permissions within their ceiling."
      items={departments ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="Add / update department"
          title="Add or update a department"
          description="Re-using an existing department name updates its lead."
          endpoint="/api/super-admin/internal-team/departments"
          submitLabel="Save department"
          fields={[
            { name: "name", label: "Department name", required: true, placeholder: "e.g. Customer Success" },
            { name: "leadEmail", label: "Lead email (optional)", type: "email" }
          ]}
        />
      }
      columns={[
        { key: "name", header: "Department", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
        { key: "lead", header: "Lead", render: (item) => item.lead },
        { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
      ]}
      emptyState="No departments created yet."
    />
  );
}

async function TemplatesTab() {
  const templates = await apiGet<SuperAdminPermissionTemplateRow[]>("/api/super-admin/internal-team/permission-templates");

  return (
    <TableCard
      title="Permission templates"
      description="Default permission grids per role, applied automatically when a new account is created."
      items={templates ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="Add / update template"
          title="Add or update a permission template"
          description="Grid is a JSON map of module → access level, e.g. { &quot;M3&quot;: &quot;FULL&quot;, &quot;M6&quot;: &quot;VIEW&quot; }."
          endpoint="/api/super-admin/internal-team/permission-templates"
          submitLabel="Save template"
          fields={[
            { name: "roleName", label: "Role", type: "select", options: roleOptions },
            { name: "defaultGrid", label: "Default grid (JSON)", type: "textarea", parse: "json", required: true, defaultValue: "{\n  \"M2\": \"VIEW\",\n  \"M6\": \"FULL\"\n}" }
          ]}
        />
      }
      columns={[
        { key: "role", header: "Role", render: (item) => item.roleName.replaceAll("_", " ") },
        { key: "modules", header: "Modules set", render: (item) => item.modules },
        { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt) }
      ]}
      emptyState="No permission templates yet."
    />
  );
}

async function ActivityTab() {
  const activity = await apiGet<SuperAdminTeamActivity>("/api/super-admin/internal-team/activity");

  return (
    <section className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Schools onboarded (30d)</p>
          <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{activity.schoolsOnboardedThisMonth}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Team members</p>
          <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{activity.members.length}</p>
        </article>
      </section>

      <TableCard
        title="Team activity (30 days)"
        description="Per-member workload: tickets resolved and audited actions taken."
        items={activity.members}
        columns={[
          { key: "name", header: "Member", render: (item) => item.name },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "tickets", header: "Tickets resolved", render: (item) => item.ticketsResolved },
          { key: "actions", header: "Actions taken", render: (item) => item.actionsTaken },
          { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") }
        ]}
        emptyState="No team activity recorded."
      />
    </section>
  );
}
