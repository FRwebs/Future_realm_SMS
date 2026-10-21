import { AlertTriangle, Crown, ShieldCheck, Timer, UserCog, Users2 } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { FlowSteps } from "@/components/data-display/flow-steps";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminAccessGrant,
  SuperAdminDepartmentRow,
  SuperAdminInternalMember,
  SuperAdminInternalSession,
  SuperAdminIpAccessRule,
  SuperAdminPermissionGridMatrix,
  SuperAdminPermissionTemplateRow,
  SuperAdminTeamActivity
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";
import { DepartmentsTable } from "./_departments-table";
import { PeopleTable } from "./_people-table";
import { PrivilegesByRoleTable, type RoleBreakdownRow } from "./_roles-table";

const rolePurpose: Record<string, string> = {
  PLATFORM_OWNER: "Highest-tier account — holds every restricted action this system checks for.",
  PLATFORM_ADMIN: "General platform administration.",
  SUPPORT_AGENT: "Handles support tickets and school-facing help requests.",
  SALES_MANAGER: "Manages partner deals, commission and sales-facing records.",
  FINANCE_MANAGER: "Manages billing, invoices and financial records.",
  DEVELOPER: "Engineering — infrastructure, backups and feature flags.",
  SUPER_ADMIN: "Full platform access — bypasses the permission grid, every module, every guarded action."
};

const roleOptions = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "SALES_MANAGER", "FINANCE_MANAGER", "DEVELOPER", "SUPER_ADMIN"].map((v) => ({ label: v.replaceAll("_", " "), value: v }));
const ipRuleTypes = [{ label: "Allow", value: "ALLOW" }, { label: "Deny", value: "DENY" }];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color: fg }}>
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

type Profiles = Record<string, import("./_people-table").PersonProfile>;
type MatrixWithLabels = SuperAdminPermissionGridMatrix & { labels?: Record<string, string> };

export default async function SuperAdminInternalTeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "accounts";
  const [departments, rosterForInvite] = await Promise.all([
    apiGet<SuperAdminDepartmentRow[]>("/api/super-admin/internal-team/departments").catch(() => [] as SuperAdminDepartmentRow[]),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team").catch(() => [] as SuperAdminInternalMember[])
  ]);
  const tabs = [
    { label: "People", href: tabHref("accounts"), active: tab === "accounts" },
    { label: "Roles & Scopes", href: tabHref("roles"), active: tab === "roles" },
    { label: "Activity", href: tabHref("activity"), active: tab === "activity" },
    { label: "Security Settings", href: tabHref("security"), active: tab === "security" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Trust & Control"
        title="Team & Access"
        description="Exactly who on the FutureRealm team can access Platform Admin, and precisely what each person can see and do. New hires are onboarded here, departing members offboarded here."
        action={
          <ResourceActionDialog
            triggerLabel="Invite a team member"
            title="Invite a team member"
            description="Module access, function rights and data scope are three separate decisions."
            endpoint="/api/super-admin/internal-team"
            variant="heroWhite"
            submitLabel="Send invitation"
            fields={[
              { name: "firstName", label: "First name", required: true, section: "Person" },
              { name: "lastName", label: "Last name", required: true, section: "Person" },
              { name: "email", label: "Work email", type: "email", required: true, section: "Person" },
              { name: "departmentId", label: "Department (optional)", type: "select", defaultValue: "", options: [{ label: "None", value: "" }, ...departments.map((d) => ({ label: d.name, value: d.id }))], section: "Person" },
              { name: "managerId", label: "Reports to", type: "select", defaultValue: "", options: [{ label: "Nobody", value: "" }, ...rosterForInvite.filter((m) => m.status === "ACTIVE").map((m) => ({ label: m.name, value: m.id }))], section: "Person" },
              { name: "level", label: "Level", placeholder: "e.g. Lead, Senior, Associate", section: "Person" },
              { name: "staffNumber", label: "Staff identifier", section: "Person" },
              { name: "isExternal", label: "Employment", type: "select", defaultValue: "false", options: [{ label: "Employee", value: "false" }, { label: "External — contractor or partner staff", value: "true" }], section: "Person" },
              { name: "role", label: "Role template", type: "select", options: roleOptions, section: "Access" },
              { name: "scopeStates", label: "Data scope — states (comma-separated)", type: "textarea", placeholder: "Blank for every school", note: "Limits School Accounts to schools in these states. Module access is set afterwards from their Manage menu; their role template applies at once if one exists.", section: "Access" },
              { name: "mfa", label: "Multi-factor authentication", type: "static", disabled: true, placeholder: "Email code at every sign-in", note: "An authenticator app is turned on by the new person from Profile → Sessions & security.", section: "Fixed for everyone" },
              { name: "sessionTimeout", label: "Session timeout", type: "toggle", disabled: true, note: "Real — 8-hour session, and signed out after 30 minutes without a request.", section: "Fixed for everyone" },
              { name: "attribution", label: "Every action attributed", type: "toggle", disabled: true, note: "Real — there are no shared accounts; every change is written to the audit log against the person.", section: "Fixed for everyone" }
            ]}
          />
        }
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
  const [envelope, allMembers, grants, matrix, profiles, departments, headlines] = await Promise.all([
    apiGetEnvelope<SuperAdminInternalMember[]>(`/api/super-admin/internal-team?${query.toString()}`),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team"),
    apiGet<SuperAdminAccessGrant[]>("/api/super-admin/internal-team/access-grants"),
    apiGet<MatrixWithLabels>("/api/super-admin/internal-team/permission-grid"),
    apiGet<Profiles>("/api/super-admin/internal-team/profiles"),
    apiGet<SuperAdminDepartmentRow[]>("/api/super-admin/internal-team/departments"),
    apiGet<{ external: number; privilegeChanges90d: number; openAnomalies: number }>("/api/super-admin/internal-team/headlines")
  ]);
  const moduleOptions = (matrix.modules ?? []).map((id) => ({ label: matrix.labels?.[id] ?? id, value: id }));
  const members = envelope.data ?? [];
  const activeCount = members.filter((m) => m.status === "ACTIVE").length;
  const revokedCount = members.filter((m) => m.status === "REVOKED").length;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const all = allMembers ?? [];
  const superAdminCount = all.filter((m) => m.role === "SUPER_ADMIN").length;
  const suspendedCount = all.filter((m) => m.status === "SUSPENDED").length;
  const onboarded = all
    .filter((m) => m.status !== "REVOKED" && new Date(m.createdAt).getTime() >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const offboarded = all
    .filter((m) => m.status === "REVOKED")
    .sort((a, b) => new Date(b.revokedAt ?? 0).getTime() - new Date(a.revokedAt ?? 0).getTime());

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Internal accounts" value={all.length} detail={`${activeCount} active · ${revokedCount} revoked · ${suspendedCount} suspended`} icon={Users2} tone="dark" />
        <StatCard label="Hold Super Admin" value={superAdminCount} detail="Kept deliberately small" icon={Crown} tone="info" />
        <StatCard label="External accounts" value={headlines.external} detail="Contractors and partner staff — marked on a person's profile" icon={Timer} tone={headlines.external ? "warning" : "neutral"} />
        <StatCard label="Privilege changes (90 days)" value={headlines.privilegeChanges90d} detail="Access-grid, grant, template and profile changes — each one is in the audit log" icon={AlertTriangle} tone="neutral" />
        <StatCard label="Nobody can read a child's record" value={0} detail="No Super Admin endpoint returns individual student data — the only route in is impersonating a school user (see Users → Support Access)" icon={ShieldCheck} tone="success" />
      </section>

      <PeopleTable
        members={members}
        matrix={matrix}
        profiles={profiles}
        departmentOptions={departments.map((d) => ({ label: d.name, value: d.id }))}
        memberOptions={all.filter((m) => m.status === "ACTIVE").map((m) => ({ label: m.name, value: m.id }))}
        moduleOptions={moduleOptions}
        title="Internal accounts"
        description={`Open Manage on anyone to see their full record, every module they hold access to, and to act on their account. ${activeCount} active · ${revokedCount} revoked · ${suspendedCount} suspended. Only Super Admin can create an account; offboarding marks access and sessions revoked in the database immediately, though an already-issued session token can remain valid until it expires.`}
        filterBar={
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
        }
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
        emptyState="No internal team members match the current filters."
      />

      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-eyebrow">Lifecycle</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Onboarding &amp; offboarding</h2>
          <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
            New hires from the last 30 days, and everyone whose access has been revoked. Start a new hire or offboard
            a member from the roster above.
          </p>
        </div>
      </section>

      <FlowSteps
        title="New hire onboarding"
        sub="From account creation to first authenticated login"
        steps={[
          { label: "Super Admin creates account", note: "Only role that can" },
          { label: "Department + role template", note: "Default permissions applied", tone: "good" },
          { label: "Fine-tune permissions", note: "Optional, per person", tone: "good" },
          { label: "Account activated", note: "Activation link sent by email", tone: "good" },
          { label: "First login", note: "Email code every time; authenticator app optional", tone: "good" }
        ]}
      />
      <FlowSteps
        title="Offboarding"
        sub="No delay between departure confirmation and access revocation — this is an operational security requirement"
        steps={[
          { label: "Departure confirmed", note: "HR or Department Lead" },
          { label: "Instant revocation", note: "One action by Super Admin", tone: "bad" },
          { label: "All sessions terminated", note: "Immediately, everywhere", tone: "bad" },
          { label: "Status: Revoked", note: "Account retained, access gone", tone: "warn" },
          { label: "Logged to the audit trail", note: "Who, when, and why", tone: "ink" }
        ]}
      />

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

      <TableCard
        title="Time-bound access grants"
        description="For contractors, advisors, and temporary access — each one auto-expires on its own date. Granted from a member's Manage menu above."
        items={grants ?? []}
        emptyState="No time-bound access grants are active."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "person",
            header: "Person",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.email}</p>
              </div>
            )
          },
          { key: "access", header: "Access granted", render: (item) => `${item.moduleId}${item.functionId ? ` · ${item.functionId}` : ""}` },
          { key: "by", header: "Approved by", render: (item) => item.grantedBy },
          { key: "expires", header: "Expires", render: (item) => (item.expiresAt ? formatDate(item.expiresAt) : "No expiry set") },
          {
            key: "state",
            header: "",
            render: (item) =>
              item.expired ? (
                <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Expired" />
              ) : item.daysLeft !== null && item.daysLeft <= 7 ? (
                <StatusPill bg="var(--color-warning-dim)" fg="var(--color-warning)" label={`${item.daysLeft} days left`} />
              ) : (
                <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label={item.daysLeft !== null ? `${item.daysLeft} days left` : "Open-ended"} />
              )
          }
        ]}
      />
    </div>
  );
}

async function RolesTab() {
  const [templates, matrix] = await Promise.all([
    apiGet<SuperAdminPermissionTemplateRow[]>("/api/super-admin/internal-team/permission-templates"),
    apiGet<MatrixWithLabels>("/api/super-admin/internal-team/permission-grid")
  ]);
  const modules = matrix.modules ?? [];
  const members = matrix.members ?? [];

  const roleBreakdown: RoleBreakdownRow[] = roleOptions.map((option) => {
    const holders = members.filter((member) => member.role === option.value);
    const modulesWithAccess = modules.filter((moduleId) => holders.some((holder) => (holder.access[moduleId] ?? "NONE") !== "NONE"));
    const modulesAtFull = modules.filter((moduleId) => holders.some((holder) => holder.access[moduleId] === "FULL"));
    return {
      role: option.label,
      roleValue: option.value,
      holders: holders.length,
      modulesWithAccess: modulesWithAccess.length,
      modulesAtFull: modulesAtFull.length,
      totalModules: modules.length,
      purpose: rolePurpose[option.value] ?? "Not documented.",
      breadth: option.value === "SUPER_ADMIN" ? "Full" : "Scoped",
      holderNames: holders.map((h) => h.name)
    };
  });

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Roles defined" value={roleOptions.length} detail="Fixed platform roles, not ad-hoc bundles" icon={UserCog} tone="dark" />
        <StatCard label="Actions that can be granted" value={modules.length * 6} detail={`View, export, create, edit, approve, delete — in each of ${modules.length} modules. A level is shorthand for a set; a person can also be given an exact set`} icon={ShieldCheck} tone="neutral" />
        <StatCard label="What Super Admin holds" value="All" detail="Full in every module — the grid never restricts a Super Admin or Platform Owner, so nobody can lock themselves out" icon={ShieldCheck} tone="info" />
        <StatCard label="Modules set to None for someone" value={modules.filter((id) => members.some((m) => m.access[id] === "NONE")).length} detail="Modules at least one person is blocked from entirely" icon={ShieldCheck} tone="neutral" />
        <StatCard label="Actions nobody holds: a child's record" value={0} detail="Not on the list at all — the function does not exist" icon={ShieldCheck} tone="success" />
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">Roles &amp; scopes</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">What each role can do</h2>
        <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
          Role templates define the default permission grid: applied when a new account is created, and used live for anyone with nothing set of their own for a module. The
          access matrix below shows the resulting per-person permissions, which can differ from the template once
          adjusted for an individual.
        </p>
      </section>

      <PrivilegesByRoleTable items={roleBreakdown} />

      <TableCard
        title="Three rules that sit above every cell above"
        description="These are properties of what was built, verified against the real code — not settings that could be toggled off."
        items={[
          { rule: "Nobody can read a child's record", detail: "Not Super Admin, not anyone. No Super Admin endpoint returns individual student data — the function does not exist, so it cannot be granted or escalated to." },
          { rule: "Every change here is logged with a diff", detail: "Permission-grid and access-grant changes are written to the immutable audit log — who changed what, when." },
          { rule: "Both the role and the module grid are checked on every request", detail: "The role on the session decides which endpoints exist for a person; the per-module grid and live time-bound grants then decide what they may do in each module. A grid edit, a revoke, a suspension or an offboard takes effect within seconds, on the person's next request — not at their next sign-in." }
        ]}
        getRowKey={(row) => row.rule}
        columns={[
          { key: "rule", header: "Rule", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.rule}</span> },
          { key: "detail", header: "Why it's true here", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.detail}</span> }
        ]}
      />

      <TableCard
        title="The three dimensions"
        description="What this system checks, and where, for an internal team member."
        items={[
          { dimension: "Role", question: "Which of the seven platform roles is this person?", enforcedWhere: "Set on the account at creation; embedded in their session token and checked by every guarded endpoint on every request.", state: "Real" as const },
          { dimension: "Module access", question: "Can this person open a given module at all?", enforcedWhere: "Every Back Office request is checked against the person's grid row for the module it belongs to, else their role template: None is refused, View allows reading only, Edit allows changes, and deleting needs Full. The sidebar hides what is None. Nothing set means the role's own rules, as before.", state: "Real" as const },
          { dimension: "Time-bound access", question: "Is a temporary grant still valid?", enforcedWhere: "A live grant raises the person to Edit in that module while it lasts; the same check ignores it the moment it expires or is revoked.", state: "Real" as const },
          { dimension: "Data scope (regional/school row-level)", question: "Of the records a function can touch, which ones belong to this person?", enforcedWhere: "A person's data scope (a list of states, on their profile) limits School Accounts — the list and each school's page — to schools in those states. Other modules still show the whole platform, so scope is a limit on schools, not on every record.", state: "Recorded only" as const }
        ]}
        getRowKey={(row) => row.dimension}
        columns={[
          { key: "dimension", header: "Dimension", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.dimension}</span> },
          { key: "question", header: "Question it answers", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.question}</span> },
          { key: "enforcedWhere", header: "Enforced where", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.enforcedWhere}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone =
                row.state === "Real"
                  ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
                  : row.state === "Recorded only"
                    ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }
                    : { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" };
              return <StatusPill bg={tone.bg} fg={tone.fg} label={row.state} />;
            }
          }
        ]}
      />

      <TableCard
        title="Permission templates"
        description="Default permission grids per role, applied automatically when a new account is created."
        items={templates ?? []}
        actions={
          <ResourceActionDialog
            triggerLabel="Add / update template"
            title="Add or update a permission template"
            description="Grid is a JSON map of module id → access level, e.g. { &quot;support&quot;: &quot;FULL&quot;, &quot;billing&quot;: &quot;VIEW&quot; }. Module ids: schools, migration, billing, partners, users, communications, support, curriculum, plans, infrastructure, security, team, analytics, settings."
            endpoint="/api/super-admin/internal-team/permission-templates"
            submitLabel="Save template"
            fields={[
              { name: "roleName", label: "Role", type: "select", options: roleOptions },
              { name: "defaultGrid", label: "Default grid (JSON)", type: "textarea", parse: "json", required: true, defaultValue: "{\n  \"support\": \"FULL\",\n  \"schools\": \"VIEW\"\n}" }
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
        title="Module access at a glance"
        description="What each person holds in each Back Office module — their own setting, else their role's template. A dash means nothing is set, so the role's own rules apply. Change a cell from “Set module permission” on a person in People."
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
                <p className="text-[10px] font-normal text-[var(--color-text-muted)]">{member.role.replaceAll("_", " ")}</p>
              </>
            )
          },
          ...modules.map((moduleId) => ({
            key: moduleId,
            header: matrix.labels?.[moduleId] ?? moduleId,
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

function formatNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(1)}K`;
  return `₦${amount.toLocaleString()}`;
}

async function ActivityTab() {
  const activity = await apiGet<SuperAdminTeamActivity>("/api/super-admin/internal-team/activity");
  const totalTickets = activity.members.reduce((sum, m) => sum + m.ticketsResolved, 0);
  const totalActions = activity.members.reduce((sum, m) => sum + m.actionsTaken, 0);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const idleMembers = activity.members.filter((m) => !m.lastLoginAt || new Date(m.lastLoginAt).getTime() < sevenDaysAgo);
  const activeCount = activity.members.length - idleMembers.length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Tickets resolved (30d)" value={totalTickets} detail="Across the whole team — not a week window, but the real one this system aggregates" icon={ShieldCheck} tone="dark" />
        <StatCard label="Schools onboarded (30d)" value={activity.schoolsOnboardedThisMonth} detail="Onboarding team" icon={Users2} tone="info" />
        <StatCard label="Revenue reconciled (30d)" value={formatNaira(activity.totalRevenueReconciled)} detail="Sum of successful payments recorded by an internal account" icon={Crown} tone="success" />
        <StatCard label="Admin actions logged (30d)" value={totalActions} detail="Audited actions taken" icon={UserCog} tone="success" />
        <StatCard
          label="Team members active"
          value={`${activeCount} of ${activity.members.length}`}
          detail={idleMembers.length > 0 ? `${idleMembers.map((m) => m.name.split(" ")[0]).join(", ")} · 7+ days idle` : "Everyone signed in this week"}
          icon={Timer}
          tone={idleMembers.length ? "warning" : "neutral"}
        />
      </section>

      <TableCard
        title="Team activity"
        description="Drawn from the real audit log and ticket/payment records, filtered by person, over the last 30 days."
        items={activity.members}
        columns={[
          { key: "name", header: "Team member", render: (item) => item.name },
          { key: "department", header: "Department", render: () => <span className="text-[var(--color-text-muted)]">Not tracked</span> },
          { key: "actions", header: "Actions", render: (item) => item.actionsTaken },
          { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
          {
            key: "primary",
            header: "Primary activity",
            render: (item) => {
              const parts: string[] = [];
              if (item.ticketsResolved > 0) parts.push(`${item.ticketsResolved} tickets resolved`);
              if (item.revenueReconciled > 0) parts.push(`${formatNaira(item.revenueReconciled)} reconciled`);
              return <span className="text-[11px] text-[var(--color-text-secondary)]">{parts.length > 0 ? parts.join(" · ") : "Nothing recorded this window"}</span>;
            }
          },
          {
            key: "standing",
            header: "Standing",
            render: (item) => {
              const idle = !item.lastLoginAt || new Date(item.lastLoginAt).getTime() < sevenDaysAgo;
              return (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={idle ? { background: "var(--color-warning-dim)", color: "var(--color-warning)" } : { background: "var(--color-success-dim)", color: "var(--color-success)" }}
                >
                  {idle ? "Idle" : "Active"}
                </span>
              );
            }
          }
        ]}
        emptyState="No team activity recorded."
      />
    </div>
  );
}

type AnomalyRow = { id: string; person: string; kind: string; detail: string; detectedAt: string; status: string; reviewedBy: string | null; reviewedAt: string | null; note: string | null };
const ANOMALY_LABEL: Record<string, string> = { OUT_OF_HOURS: "Outside working hours", NEW_DEVICE: "Unfamiliar device", LARGE_EXPORT: "Large export", TWO_PLACES: "Two places at once" };

async function SecurityTab() {
  const [sessions, ipRules, anomalies] = await Promise.all([
    apiGet<SuperAdminInternalSession[]>("/api/super-admin/internal-team/sessions"),
    apiGet<SuperAdminIpAccessRule[]>("/api/super-admin/internal-team/ip-rules"),
    apiGet<AnomalyRow[]>("/api/super-admin/internal-team/anomalies")
  ]);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Security settings</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Sessions &amp; network access</h2>
        <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
          Every currently active sign-in session for a Platform Admin account, and the IP allow/deny rules that gate
          access to the platform admin panel.
        </p>
      </section>

      <TableCard
        title="Internal security requirements — what's actually enforced"
        description="Verified against the real account and session code, not stated as intent."
        items={[
          { requirement: "Multi-factor authentication", spec: "A one-time code is emailed at every Back Office sign-in (when mail is configured), and an authenticator app can be turned on from Profile → Sessions & security. Not yet mandatory to set up the app.", state: "Enforced" },
          { requirement: "Session timeout", spec: "An 8-hour session, and a Back Office session ends after 30 minutes without a request (PLATFORM_IDLE_MINUTES).", state: "Enforced" },
          { requirement: "Panel address", spec: "Served from the same app and domain as every other portal — /super-admin routes, not a separate non-public address. Access is gated by role and by the module grid on each request, not by the URL being secret.", state: "Partial" },
          { requirement: "Address restriction (IP allow/deny list)", spec: "Enforced at sign-in for every internal account against the rules below — a Deny match blocks it, and any Allow rule existing switches to allow-list-only mode. Exact address only.", state: "Enforced" },
          { requirement: "Password policy", spec: "8 characters minimum, no reuse of the last three — enforced when a password is set or reset. No complexity or breach-list check.", state: "Partial" },
          { requirement: "Credential sharing / anomaly detection", spec: "Real — a sign-in outside 06:00–22:00 Lagos time, from an unfamiliar device, or while the account is active from another address raises a flag at once; a scan every 15 minutes flags large exports. See Anomaly flags below.", state: "Enforced" },
          { requirement: "Device registration", spec: "A known-device list is kept from each person's own sign-in record (open Manage on a person). A first-time device is flagged and the owner emailed; it is not blocked, because the emailed code already gates sign-in.", state: "Partial" }
        ]}
        getRowKey={(row) => row.requirement}
        columns={[
          { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
          { key: "spec", header: "What actually happens", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone =
                row.state === "Enforced"
                  ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
                  : row.state === "Partial"
                    ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }
                    : row.state === "Recorded only"
                    ? { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" }
                    : { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
              return <StatusPill bg={tone.bg} fg={tone.fg} label={row.state} />;
            }
          }
        ]}
      />

      <TableCard
        title="Anomaly flags"
        description="Raised automatically when a Back Office account behaves unusually, and reviewed by a Super Admin. A flag the reviewer escalates becomes a security incident."
        items={anomalies}
        getRowKey={(row) => row.id}
        emptyState="Nothing has been flagged."
        actions={<ResourceActionDialog triggerLabel="Scan now" title="Scan for large exports" description="Looks back over the last 20 minutes of the audit trail. It runs by itself every 15 minutes." endpoint="/api/super-admin/internal-team/anomalies/scan" method="POST" variant="secondary" submitLabel="Scan" fields={[]} />}
        columns={[
          { key: "person", header: "Person", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.person}</span> },
          { key: "flag", header: "Flag", render: (row) => <div><p className="font-semibold">{ANOMALY_LABEL[row.kind] ?? row.kind}</p><p className="text-[11.5px] text-[var(--color-text-secondary)]">{row.detail}</p></div> },
          { key: "when", header: "When", render: (row) => formatDate(row.detectedAt) },
          { key: "outcome", header: "Outcome", render: (row) => (row.status === "OPEN" ? <span className="text-[var(--color-warning)] font-semibold">Open</span> : <span className="text-[12px]">{row.status === "ESCALATED" ? "Escalated" : "Reviewed"} by {row.reviewedBy ?? "—"}{row.note ? ` — ${row.note}` : ""}</span>) },
          {
            key: "actions",
            header: "",
            render: (row) =>
              row.status === "OPEN" ? (
                <ResourceActionDialog triggerLabel="Review" title={`Review — ${ANOMALY_LABEL[row.kind] ?? row.kind}`} description={row.detail} endpoint={`/api/super-admin/internal-team/anomalies/${row.id}/review`} method="POST" variant="textAction" submitLabel="Record review" fields={[{ name: "outcome", label: "Outcome", type: "select", defaultValue: "BENIGN", options: [{ label: "Explained — nothing to do", value: "BENIGN" }, { label: "Escalate to a security incident", value: "ESCALATE" }] }, { name: "note", label: "What you found", type: "textarea", required: true }]} />
              ) : null
          }
        ]}
      />

      <TableCard
        title="Active sessions"
        description={`${sessions.length} active session${sessions.length === 1 ? "" : "s"} across the internal team. Revoking ends a session on the next request it makes.`}
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
                  description="Marks this session revoked in the database. Note: the device's existing token isn't independently re-checked per request, so it can remain usable until it naturally expires rather than ending instantly."
                  endpoint={`/api/super-admin/internal-team/sessions/${item.id}/revoke`}
                  method="PATCH"
                  variant="menuDanger"
                  submitLabel="Revoke session"
                  confirmLabel="Confirm revoke"
                  confirmMessage="This marks the session revoked immediately in the database, though the device's token can remain valid until it expires."
                  fields={[]}
                />
              </ActionMenu>
            )
          }
        ]}
      />

      <TableCard
        title="IP access rules"
        description="Enforced at sign-in for every internal account (see the requirements table above). A Deny rule blocks that exact address; adding any Allow rule switches every internal account to allow-list-only mode, so add your own address as Allow before relying on that."
        items={ipRules}
        emptyState="No IP access rules configured — every address can currently sign in to an internal account."
        actions={
          <ResourceActionDialog
            triggerLabel="Add IP rule"
            title="Add or update an IP access rule"
            description="Adding a rule for an IP address + type combination that already exists updates its reason. Exact address only — there's no CIDR/range matching."
            endpoint="/api/super-admin/internal-team/ip-rules"
            submitLabel="Save rule"
            fields={[
              { name: "ipAddress", label: "IP address", required: true, placeholder: "e.g. 197.210.54.12" },
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
  const [departments, departmentMembers] = await Promise.all([
    apiGet<SuperAdminDepartmentRow[]>("/api/super-admin/internal-team/departments"),
    apiGet<Record<string, string[]>>("/api/super-admin/internal-team/department-members")
  ]);

  return (
    <DepartmentsTable
      members={departmentMembers}
      items={departments ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="New department"
          title="New department"
          description="Re-using an existing department name updates it instead of creating a new one."
          endpoint="/api/super-admin/internal-team/departments"
          submitLabel="Save department"
          fields={[
            { name: "name", label: "Department name", required: true, placeholder: "e.g. Customer Success", section: "Identity" },
            { name: "leadEmail", label: "Lead email (optional)", type: "email", section: "Identity" },
            {
              name: "permissionCeiling",
              label: "Permission ceiling (JSON, optional)",
              type: "textarea",
              parse: "json",
              placeholder: '{\n  "support": "EDIT",\n  "users": "VIEW"\n}',
              note: "Enforced — caps what the department's lead can grant to its members.",
              section: "Ceiling"
            }
          ]}
        />
      }
    />
  );
}
