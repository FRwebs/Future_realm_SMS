import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminDepartmentRow,
  SuperAdminInternalMember,
  SuperAdminInternalSession,
  SuperAdminIpAccessRule,
  SuperAdminPermissionGridMatrix,
  SuperAdminPermissionTemplateRow,
  SuperAdminTeamActivity
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const roleOptions = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"].map((v) => ({ label: v.replaceAll("_", " "), value: v }));
const accessLevels = ["NONE", "VIEW", "EDIT", "FULL"].map((v) => ({ label: v, value: v }));
const ipRuleTypes = [{ label: "Allow", value: "ALLOW" }, { label: "Deny", value: "DENY" }];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function accessTone(level: string) {
  if (level === "FULL") return { bg: "var(--color-success-dim)", fg: "var(--color-success)" };
  if (level === "EDIT") return { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" };
  if (level === "VIEW") return { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
  return { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" };
}

function ipRuleTone(type: string) {
  return type === "DENY" ? { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" } : { bg: "var(--color-success-dim)", fg: "var(--color-success)" };
}

function tabHref(tab: string) {
  return tab === "accounts" ? "/super-admin/internal-team" : `/super-admin/internal-team?tab=${tab}`;
}

export default async function SuperAdminInternalTeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "accounts";
  const tabs = [
    { label: "People", href: tabHref("accounts"), active: tab === "accounts" },
    { label: "Roles & Scopes", href: tabHref("roles"), active: tab === "roles" },
    { label: "Activity", href: tabHref("activity"), active: tab === "activity" },
    { label: "Security Settings", href: tabHref("security"), active: tab === "security" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Access control centre"
        title="Team & Access"
        description="Exactly who on the FutureRealm team can access Platform Admin, and precisely what each person can see and do. New hires are onboarded here, departing members offboarded here."
      />

      <DetailTabs tabs={tabs} />

      {tab === "accounts" ? <PeopleTab params={params} /> : null}
      {tab === "roles" ? <RolesTab /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
      {tab === "security" ? <SecurityTab /> : null}
      {tab === "departments" ? <DepartmentsTab /> : null}
    </div>
  );
}

async function PeopleTab({ params }: { params: Record<string, string | undefined> }) {
  const query = new URLSearchParams();
  for (const key of ["search", "role", "status"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const [envelope, allMembers] = await Promise.all([
    apiGetEnvelope<SuperAdminInternalMember[]>(`/api/super-admin/internal-team?${query.toString()}`),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team")
  ]);
  const members = envelope.data ?? [];
  const activeCount = members.filter((m) => m.status === "ACTIVE").length;
  const revokedCount = members.filter((m) => m.status === "REVOKED").length;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const onboarded = (allMembers ?? [])
    .filter((m) => m.status !== "REVOKED" && new Date(m.createdAt).getTime() >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const offboarded = (allMembers ?? [])
    .filter((m) => m.status === "REVOKED")
    .sort((a, b) => new Date(b.revokedAt ?? 0).getTime() - new Date(a.revokedAt ?? 0).getTime());

  return (
    <div className="grid gap-5">
      <FilterToolbar
        action="/super-admin/internal-team"
        resultCount={members.length}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Name or email", defaultValue: params.search },
          { name: "role", label: "Role", type: "select", defaultValue: params.role, options: [{ label: "All roles", value: "" }, ...roleOptions] },
          { name: "status", label: "Status", type: "select", defaultValue: params.status, options: [
            { label: "Any status", value: "" },
            { label: "Active", value: "ACTIVE" },
            { label: "Suspended", value: "SUSPENDED" },
            { label: "Revoked", value: "REVOKED" }
          ] }
        ]}
      />

      <TableCard
        title="Internal accounts"
        description={`${activeCount} active · ${revokedCount} revoked. Only Super Admin can create an account; offboarding instantly revokes access and terminates all sessions.`}
        items={members}
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
          {
            key: "name",
            header: "Team member",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.email}</p>
              </div>
            )
          },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status === "ACTIVE" ? "success" : item.status === "REVOKED" ? "danger" : "warning"} /> },
          {
            key: "actions",
            header: "",
            render: (item) => (
              <ActionMenu triggerLabel={`Manage ${item.name}`} triggerText="Manage" align="right">
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
        emptyState="No internal team members match the current filters."
      />

      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-eyebrow">Lifecycle</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Onboarding &amp; offboarding</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            New hires from the last 30 days, and everyone whose access has been revoked. Start a new hire or offboard
            a member from the roster above.
          </p>
        </div>
      </section>

      <TableCard
        title="Recently onboarded (30 days)"
        description="Newest first."
        items={onboarded}
        emptyState="No new hires in the last 30 days."
        columns={[
          { key: "name", header: "Name", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} tone={item.status === "ACTIVE" ? "success" : "warning"} /> },
          { key: "joined", header: "Joined", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="Offboarded"
        description="Most recently offboarded first."
        items={offboarded}
        emptyState="No team members have been offboarded."
        columns={[
          { key: "name", header: "Name", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "offboarded", header: "Offboarded", render: (item) => (item.revokedAt ? formatDate(item.revokedAt) : "—") }
        ]}
      />
    </div>
  );
}

async function RolesTab() {
  const [templates, matrix] = await Promise.all([
    apiGet<SuperAdminPermissionTemplateRow[]>("/api/super-admin/internal-team/permission-templates"),
    apiGet<SuperAdminPermissionGridMatrix>("/api/super-admin/internal-team/permission-grid")
  ]);
  const modules = matrix.modules ?? [];
  const members = matrix.members ?? [];

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Roles &amp; scopes</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What each role can do</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Role templates define the reusable default permission grid applied when a new account is created. The
          access matrix below shows the resulting per-person permissions, which can differ from the template once
          adjusted for an individual.
        </p>
      </section>

      <TableCard
        title="How access is actually enforced — the real dimensions"
        description="What this system checks, and where, for an internal team member."
        items={[
          { dimension: "Role", question: "Which of the seven platform roles is this person?", enforcedWhere: "Set on the account at creation; drives the default permission template and most endpoint guards.", state: "Real" },
          { dimension: "Module access", question: "Can this person open a given module at all?", enforcedWhere: "The per-module permission grid (People → Set module permission), checked server-side.", state: "Real" },
          { dimension: "Time-bound access", question: "Is a temporary grant still valid?", enforcedWhere: "Access grants with an expiry date (People → Grant time-bound access).", state: "Real" },
          { dimension: "Data scope (regional/school row-level)", question: "Of the records a function can touch, which ones belong to this person?", enforcedWhere: "Not built for internal team members — no per-region or per-portfolio row filter exists; a role either sees the full platform or is gated at the module level, nothing in between.", state: "Not built" }
        ]}
        getRowKey={(row) => row.dimension}
        columns={[
          { key: "dimension", header: "Dimension", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.dimension}</span> },
          { key: "question", header: "Question it answers", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.question}</span> },
          { key: "enforcedWhere", header: "Enforced where", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.enforcedWhere}</span> },
          { key: "state", header: "State", render: (row) => <StatusPill bg={row.state === "Real" ? "var(--color-success-dim)" : "var(--color-bg-subtle)"} fg={row.state === "Real" ? "var(--color-success)" : "var(--color-text-muted)"} label={row.state} /> }
        ]}
      />

      <TableCard
        title="Role templates"
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
        emptyState="No role templates yet."
      />

      <TableCard
        title="Access matrix"
        description="Every module a permission has been explicitly set for, across every internal team member. Set or change a cell from the &quot;Set module permission&quot; action on a member in People."
        items={members}
        getRowKey={(member) => member.id}
        primaryColumnKey="member"
        emptyState="No module permissions have been set yet."
        columns={[
          {
            key: "member",
            header: "Member",
            headerClassName: "sticky left-0 z-[1] bg-[color-mix(in_srgb,var(--color-bg-subtle)_92%,transparent)]",
            cellClassName: "sticky left-0 bg-[var(--color-bg-surface)]",
            render: (member) => (
              <>
                <span className="font-semibold text-[var(--color-text-primary)]">{member.name}</span>
                <p className="text-[11px] font-normal text-[var(--color-text-muted)]">{member.role.replaceAll("_", " ")}</p>
              </>
            )
          },
          ...modules.map((moduleId) => ({
            key: moduleId,
            header: moduleId,
            render: (member: SuperAdminPermissionGridMatrix["members"][number]) => {
              const level = member.access[moduleId];
              const tone = accessTone(level ?? "NONE");
              return <StatusPill bg={tone.bg} fg={tone.fg} label={level ?? "—"} />;
            }
          }))
        ]}
      />
    </div>
  );
}

async function ActivityTab() {
  const activity = await apiGet<SuperAdminTeamActivity>("/api/super-admin/internal-team/activity");

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Schools onboarded (30d)</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{activity.schoolsOnboardedThisMonth}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Team members</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{activity.members.length}</p>
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
    </div>
  );
}

async function SecurityTab() {
  const [sessions, ipRules] = await Promise.all([
    apiGet<SuperAdminInternalSession[]>("/api/super-admin/internal-team/sessions"),
    apiGet<SuperAdminIpAccessRule[]>("/api/super-admin/internal-team/ip-rules")
  ]);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Security settings</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Sessions &amp; network access</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every currently active sign-in session for a Platform Admin account, and the IP allow/deny rules that gate
          access to the platform admin panel.
        </p>
      </section>

      <TableCard
        title="Active sessions"
        description={`${sessions.length} active session${sessions.length === 1 ? "" : "s"} across the internal team. Revoking a session logs that device out immediately.`}
        items={sessions}
        emptyState="No active internal-team sessions right now."
        columns={[
          {
            key: "member",
            header: "Team member",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.email}</p>
              </div>
            )
          },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "ip", header: "IP address", render: (item) => item.ipAddress ?? "—" },
          { key: "device", header: "Device", render: (item) => item.device ?? "—" },
          { key: "lastActivity", header: "Last activity", render: (item) => formatDate(item.lastActivityAt) },
          { key: "expires", header: "Expires", render: (item) => formatDate(item.expiresAt) },
          {
            key: "actions",
            header: "",
            render: (item) => (
              <ActionMenu triggerLabel={`Manage session for ${item.name}`} triggerText="Manage" align="right">
                <ResourceActionDialog
                  triggerLabel="Revoke session"
                  title={`Revoke session — ${item.name}`}
                  description="Immediately ends this session and logs the device out."
                  endpoint={`/api/super-admin/internal-team/sessions/${item.id}/revoke`}
                  method="PATCH"
                  variant="menuDanger"
                  submitLabel="Revoke session"
                  confirmLabel="Confirm revoke"
                  confirmMessage="This immediately logs the device out."
                  fields={[]}
                />
              </ActionMenu>
            )
          }
        ]}
      />

      <TableCard
        title="IP access rules"
        description="Allow or deny rules for platform admin sign-in, checked at login."
        items={ipRules}
        emptyState="No IP access rules configured — access is not restricted by IP."
        actions={
          <ResourceActionDialog
            triggerLabel="Add IP rule"
            title="Add or update an IP access rule"
            description="Adding a rule for an IP address + type combination that already exists updates its reason."
            endpoint="/api/super-admin/internal-team/ip-rules"
            submitLabel="Save rule"
            fields={[
              { name: "ipAddress", label: "IP address", required: true, placeholder: "e.g. 197.210.0.0" },
              { name: "type", label: "Type", type: "select", options: ipRuleTypes },
              { name: "reason", label: "Reason (optional)" }
            ]}
          />
        }
        columns={[
          { key: "ip", header: "IP address", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.ipAddress}</span> },
          {
            key: "type",
            header: "Type",
            render: (item) => {
              const tone = ipRuleTone(item.type);
              return <StatusPill bg={tone.bg} fg={tone.fg} label={item.type} />;
            }
          },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "—" },
          { key: "created", header: "Added", render: (item) => formatDate(item.createdAt) },
          {
            key: "actions",
            header: "",
            render: (item) => (
              <ActionMenu triggerLabel={`Manage rule for ${item.ipAddress}`} triggerText="Manage" align="right">
                <ResourceActionDialog
                  triggerLabel="Delete rule"
                  title={`Delete IP rule — ${item.ipAddress}`}
                  description="Removes this IP access rule."
                  endpoint={`/api/super-admin/internal-team/ip-rules/${item.id}`}
                  method="DELETE"
                  variant="menuDanger"
                  submitLabel="Delete rule"
                  confirmLabel="Confirm delete"
                  confirmMessage="This removes the rule immediately."
                  fields={[]}
                />
              </ActionMenu>
            )
          }
        ]}
      />
    </div>
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
        { key: "name", header: "Department", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "lead", header: "Lead", render: (item) => item.lead },
        { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
      ]}
      emptyState="No departments created yet."
    />
  );
}
