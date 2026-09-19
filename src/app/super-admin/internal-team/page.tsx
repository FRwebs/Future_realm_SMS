import { AlertTriangle, Crown, ShieldCheck, Timer, UserCog, Users2 } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
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
              { name: "department", label: "Department (optional)", section: "Person" },
              {
                name: "reportsTo",
                label: "Reports to",
                type: "static",
                placeholder: "Not tracked",
                note: "No manager/reports-to field exists on an internal account.",
                section: "Person"
              },
              { name: "role", label: "Role template", type: "select", options: roleOptions, section: "Access" },
              {
                name: "dataScope",
                label: "Data scope",
                type: "static",
                placeholder: "Full access by default",
                note: "Not set at creation — narrow it afterwards from this person's Manage menu (Set module permission / Grant time-bound access).",
                section: "Access"
              },
              {
                name: "mfa",
                label: "Multi-factor authentication",
                type: "toggle",
                disabled: true,
                note: "Not enforced — the welcome email says MFA is required, but no verification step exists anywhere in this codebase.",
                section: "Fixed for everyone"
              },
              {
                name: "sessionTimeout",
                label: "Session timeout",
                type: "toggle",
                disabled: true,
                note: "Real, but not 30-minutes-idle — every login gets a fixed 8-hour session regardless of activity.",
                section: "Fixed for everyone"
              },
              { name: "attribution", label: "Every action attributed", type: "toggle", disabled: true, note: "Real — there are no shared accounts.", section: "Fixed for everyone" }
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
  const [envelope, allMembers, grants, matrix] = await Promise.all([
    apiGetEnvelope<SuperAdminInternalMember[]>(`/api/super-admin/internal-team?${query.toString()}`),
    apiGet<SuperAdminInternalMember[]>("/api/super-admin/internal-team"),
    apiGet<SuperAdminAccessGrant[]>("/api/super-admin/internal-team/access-grants"),
    apiGet<SuperAdminPermissionGridMatrix>("/api/super-admin/internal-team/permission-grid")
  ]);
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
        <StatCard label="External accounts" value="N/A" detail="Not tracked — no internal/external distinction exists on an account; every role is treated as an employee" icon={Timer} tone="neutral" />
        <StatCard label="Privilege changes this term" value="N/A" detail="Not tracked as a term-scoped aggregate — each permission-grid or access-grant change is in the audit log individually" icon={AlertTriangle} tone="neutral" />
        <StatCard label="Nobody can read a child's record" value={0} detail="No Super Admin endpoint returns individual student data — the only route in is impersonating a school user (see Users → Support Access)" icon={ShieldCheck} tone="success" />
      </section>

      <PeopleTable
        members={members}
        matrix={matrix}
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
    apiGet<SuperAdminPermissionGridMatrix>("/api/super-admin/internal-team/permission-grid")
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
        <StatCard label="Actions that can be granted" value="N/A" detail="Not tracked — this system has no per-action grant within a module, only whole-module levels" icon={ShieldCheck} tone="neutral" />
        <StatCard label="Actions Super Admin holds" value="All" detail="Enforced by role check, not by grid entries — Super Admin bypasses the permission grid entirely" icon={ShieldCheck} tone="info" />
        <StatCard label="Actions the narrowest role holds" value="N/A" detail="Not tracked — no per-action model exists to measure this against" icon={ShieldCheck} tone="neutral" />
        <StatCard label="Actions nobody holds: a child's record" value={0} detail="Not on the list at all — the function does not exist" icon={ShieldCheck} tone="success" />
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">Roles &amp; scopes</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What each role can do</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Role templates define the reusable default permission grid applied when a new account is created. The
          access matrix below shows the resulting per-person permissions, which can differ from the template once
          adjusted for an individual.
        </p>
      </section>

      <PrivilegesByRoleTable items={roleBreakdown} />

      <TableCard
        title="Three rules that sit above every cell in the matrix"
        description="These are properties of what was built, verified against the real code — not settings that could be toggled off."
        items={[
          { rule: "Nobody can read a child's record", detail: "Not Super Admin, not anyone. No Super Admin endpoint returns individual student data — the function does not exist, so it cannot be granted or escalated to." },
          { rule: "Every change here is logged with a diff", detail: "Permission-grid and access-grant changes are written to the immutable audit log — who changed what, when." },
          { rule: "Role is the only privilege actually checked per request", detail: "The per-module grid above and time-bound grants are real, stored records, but no request guard reads them — only the broad role embedded in the session token is enforced. A role change, a permission-grid edit, or a revoke/offboard takes effect on that person's next login, not mid-session — their existing session token stays valid until it naturally expires." }
        ]}
        getRowKey={(row) => row.rule}
        columns={[
          { key: "rule", header: "Rule", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.rule}</span> },
          { key: "detail", header: "Why it's true here", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.detail}</span> }
        ]}
      />

      <TableCard
        title="How access is actually enforced — the real dimensions"
        description="What this system checks, and where, for an internal team member."
        items={[
          { dimension: "Role", question: "Which of the seven platform roles is this person?", enforcedWhere: "Set on the account at creation; embedded in their session token and checked by every guarded endpoint on every request.", state: "Real" as const },
          { dimension: "Module access", question: "Can this person open a given module at all?", enforcedWhere: "The per-module permission grid (People → Set module permission) is stored, but no endpoint guard reads it — only role is actually checked.", state: "Recorded only" as const },
          { dimension: "Time-bound access", question: "Is a temporary grant still valid?", enforcedWhere: "Access grants with an expiry date (People → Grant time-bound access) are stored, but nothing checks them at request time — same gap as module access.", state: "Recorded only" as const },
          { dimension: "Data scope (regional/school row-level)", question: "Of the records a function can touch, which ones belong to this person?", enforcedWhere: "Not built for internal team members — no per-region or per-portfolio row filter exists; a role either sees the full platform or is gated at the module level, nothing in between.", state: "Not built" as const }
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
              return <span className="text-[12px] text-[var(--color-text-secondary)]">{parts.length > 0 ? parts.join(" · ") : "Nothing recorded this window"}</span>;
            }
          },
          {
            key: "standing",
            header: "Standing",
            render: (item) => {
              const idle = !item.lastLoginAt || new Date(item.lastLoginAt).getTime() < sevenDaysAgo;
              return (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
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
        title="Internal security requirements — what's actually enforced"
        description="Verified against the real account and session code, not stated as intent."
        items={[
          { requirement: "Multi-factor authentication", spec: "Mandatory for every internal account, no exceptions.", state: "Not built" },
          { requirement: "Session timeout", spec: "A fixed 8-hour session from login — not a 30-minute idle timeout; activity doesn't reset the clock.", state: "Partial" },
          { requirement: "Panel address", spec: "Served from the same app and domain as every other portal — /super-admin routes, not a separate non-public address. Access is gated by role check on each request, not by the URL being secret.", state: "Partial" },
          { requirement: "Address restriction (IP allow/deny list)", spec: "The rules below are real, stored records — but no login check reads them. Adding a Deny rule today doesn't block anything.", state: "Recorded only" },
          { requirement: "Password policy", spec: "8 characters minimum, enforced when a password is set or reset — no complexity or breach-list check, and no reuse history.", state: "Partial" },
          { requirement: "Credential sharing / anomaly detection", spec: "No concurrent-session or unusual-location flagging for internal accounts.", state: "Not built" },
          { requirement: "Device registration", spec: "No known-device list; nothing distinguishes a first-time device from a familiar one.", state: "Not built" }
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
                row.state === "Partial"
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
        description="Raised automatically, reviewed weekly by Super Admin — in the mockup. No anomaly-detection system exists in this codebase: nothing about access outside working hours, an unusually large export, or an unrecognised device is ever flagged, so there is nothing real to show here."
        items={[]}
        columns={[
          { key: "person", header: "Person", render: () => null },
          { key: "flag", header: "Flag", render: () => null },
          { key: "when", header: "When", render: () => null },
          { key: "outcome", header: "Outcome", render: () => null }
        ]}
        emptyState="No anomaly-detection record exists in this codebase — there is no model for it, so there is nothing real to show here."
      />

      <TableCard
        title="Active sessions"
        description={`${sessions.length} active session${sessions.length === 1 ? "" : "s"} across the internal team. Revoking marks a session revoked in the database immediately; the device's own token can remain usable until it naturally expires.`}
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
        description="Stored allow/deny rules — not currently checked at login (see the requirements table above). Kept here so the intended policy is on record."
        items={ipRules}
        emptyState="No IP access rules configured."
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
    <DepartmentsTable
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
              placeholder: '{\n  "M3": "VIEW"\n}',
              note: "Stored, but nothing in this codebase reads it back today.",
              section: "Ceiling"
            }
          ]}
        />
      }
    />
  );
}
