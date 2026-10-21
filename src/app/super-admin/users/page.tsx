import type { ReactNode } from "react";
import {
  Copy,
  GraduationCap,
  KeyRound,
  LifeBuoy,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UsersRound
} from "lucide-react";
import { CaseReviewBoard, type CaseRecord, type CaseSignal, type CaseTypeFilter } from "@/components/data-display/case-review-board";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { FlowSteps } from "@/components/data-display/flow-steps";
import { ReferenceList } from "@/components/data-display/reference-list";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminAccountRecoveryRow,
  SuperAdminDuplicateFlagRow,
  SuperAdminImpersonationLogRow,
  SuperAdminSchoolRow,
  SuperAdminSuspiciousActivityRow,
  SuperAdminUserCaseReviewContext,
  SuperAdminUserRow,
  SuperAdminUserStats
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function caseInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function timeAgo(value?: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DecisionAction({ action, note }: { action: ReactNode; note: string }) {
  return (
    <div className="grid gap-1.5">
      {action}
      <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{note}</p>
    </div>
  );
}

const roleTabs = [
  { label: "All Users", value: "" },
  { label: "Parents", value: "parent" },
  { label: "Teachers", value: "teacher" },
  { label: "Students", value: "student" },
  { label: "School Admins", value: "school_admin" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ");
}


function tabHref(tab: string) {
  return tab === "directory" ? "/super-admin/users" : `/super-admin/users?tab=${tab}`;
}

export default async function SuperAdminUsersPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab =
    params.tab === "reviews" ? "reviews" :
    params.tab === "teachers" ? "teachers" :
    params.tab === "support" ? "support" : "directory";

  // Fetched on every load (not just when the "Reviews & Cases" tab is active) because the tab badge
  // needs a real open-case count regardless of which tab is currently selected.
  const [suspiciousEnvelope, duplicatesEnvelope, recoveryEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminSuspiciousActivityRow[]>("/api/super-admin/users/suspicious-activity"),
    apiGetEnvelope<SuperAdminDuplicateFlagRow[]>("/api/super-admin/users/duplicates"),
    apiGetEnvelope<SuperAdminAccountRecoveryRow[]>("/api/super-admin/users/recovery")
  ]);
  const suspiciousFlags = suspiciousEnvelope.data ?? [];
  const duplicateFlags = duplicatesEnvelope.data ?? [];
  const recoveryRecords = recoveryEnvelope.data ?? [];
  const openRecoveryCount = recoveryRecords.filter((record) => !record.completedAt).length;
  const openCaseCount = suspiciousFlags.length + duplicateFlags.length + openRecoveryCount;

  const pageTabs = [
    { label: "Directory", href: tabHref("directory"), active: tab === "directory" },
    { label: "Reviews & Cases", href: tabHref("reviews"), active: tab === "reviews", badge: openCaseCount },
    { label: "Individual Teachers", href: tabHref("teachers"), active: tab === "teachers" },
    { label: "Support Access", href: tabHref("support"), active: tab === "support" }
  ];

  // Same filters the Directory tab's table is currently showing, so the export always
  // matches what's on screen rather than silently exporting the full unfiltered registry.
  const exportQuery = new URLSearchParams();
  for (const key of ["search", "role", "schoolId", "status", "lastLogin"]) {
    if (params[key]) exportQuery.set(key, params[key] as string);
  }

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Operations"
        title="Users"
        description="One account, many schools. Review identities, recover access, and keep sensitive user support actions accountable."
        action={
          <a
            href={`/api/super-admin/users/export?${exportQuery.toString()}`}
            className="whitespace-nowrap rounded-full bg-white px-5 py-3 text-[11.5px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]"
          >
            Export registry
          </a>
        }
      />

      <DetailTabs tabs={pageTabs} />

      {tab === "directory" ? <DirectoryTab params={params} /> : null}
      {tab === "reviews" ? (
        <ReviewsAndCasesTab
          suspiciousFlags={suspiciousFlags}
          duplicateFlags={duplicateFlags}
          recoveryRecords={recoveryRecords}
          openCaseCount={openCaseCount}
        />
      ) : null}
      {tab === "teachers" ? <IndividualTeachersTab params={params} /> : null}
      {tab === "support" ? <SupportAccessTab /> : null}
    </div>
  );
}

async function DirectoryTab({ params }: { params: Record<string, string | undefined> }) {
  const query = new URLSearchParams();
  for (const key of ["search", "role", "schoolId", "status", "lastLogin", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const [envelope, schoolsEnvelope, statsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminUserRow[]>(`/api/super-admin/users?${query.toString()}`),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGetEnvelope<SuperAdminUserStats>("/api/super-admin/users/stats")
  ]);
  const users = envelope.data ?? [];
  const stats = statsEnvelope.data;
  const schoolOptions = [
    { label: "All schools", value: "" },
    ...(schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }))
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total user accounts" value={stats?.totalUsers ?? 0} detail={`Across ${stats?.activeSchools ?? 0} active schools`} icon={UsersRound} tone="dark" />
        <StatCard label="School admins" value={stats?.schoolAdmins ?? 0} detail={`${stats?.adminsPerSchoolAvg ?? 0} per school average`} icon={ShieldCheck} tone="info" />
        <StatCard label="Teachers" value={stats?.teachers ?? 0} detail={`${stats?.teachersLoggedInWeekPct ?? 0}% logged in this week`} icon={GraduationCap} tone="success" />
        <StatCard label="Parents & students" value={stats?.parentsAndStudents ?? 0} detail={`${stats?.parentsAndStudentsActivatedPct ?? 0}% have logged in at least once`} icon={UserCheck} tone="info" />
        <StatCard label="Suspended accounts" value={stats?.suspended ?? 0} detail="Restricted platform-wide" icon={ShieldAlert} tone={stats?.suspended ? "warning" : "neutral"} />
      </section>

      <TableCard
        title="Global user registry"
        description="Searchable by name, email, role, school or account status."
        items={users}
        filterBar={
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
              ] },
              { name: "lastLogin", label: "Last login", type: "select", defaultValue: params.lastLogin, options: [
                { label: "Any", value: "" },
                { label: "Today", value: "TODAY" },
                { label: "This week", value: "WEEK" },
                { label: "Last 30 days", value: "30D" },
                { label: "Never", value: "NEVER" }
              ] }
            ]}
          />
        }
        columns={[
          {
            key: "name",
            header: "User",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.email}</p>
              </div>
            )
          },
          { key: "role", header: "Role", render: (item) => roleLabel(item.role) },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "lastDevice", header: "Device (last used)", render: (item) => item.lastDevice ?? "Not recorded" },
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

      <MembershipsSection />
    </div>
  );
}

type MembershipView = {
  kpis: { multi: number; multiPct: number; guardians: number; teachers: number; owners: number; examiners: number };
  rows: Array<{ id: string; name: string; contact: string; memberships: number; roles: string[]; lastActive: string | null }>;
  items: Array<{ id: string; person: string; school: string; role: string; expiresAt: string | null }>;
};

async function MembershipsSection() {
  const [view, schoolsEnvelope] = await Promise.all([
    apiGet<MembershipView>("/api/super-admin/users/insights/memberships").catch(() => null),
    apiGetEnvelope<Array<{ id: string; name: string }>>("/api/super-admin/schools?limit=100").catch(() => ({ data: [] as Array<{ id: string; name: string }> }))
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const k = view?.kpis;
  return (
    <>
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Accounts with 2+ memberships" value={k?.multi ?? 0} detail={`${k?.multiPct ?? 0}% of all accounts`} icon={UsersRound} tone="dark" />
        <StatCard label="Guardians across schools" value={k?.guardians ?? 0} detail="Children at different schools" icon={UserCheck} tone="neutral" />
        <StatCard label="Teachers at two schools" value={k?.teachers ?? 0} detail="Independent role and permissions at each" icon={GraduationCap} tone="neutral" />
        <StatCard label="Proprietors of several schools" value={k?.owners ?? 0} detail="Owner at more than one account" icon={ShieldCheck} tone="neutral" />
        <StatCard label="External examiners" value={k?.examiners ?? 0} detail="Memberships that end on a date" icon={KeyRound} tone="neutral" />
      </section>

      <TableCard
        title="Multi-school memberships"
        description="One person, many school memberships. A person keeps the school their account was made in and can be given a role in others; they switch between them from the profile menu without signing in again. Each membership has its own role, permissions and record access."
        actions={
          <ResourceActionDialog triggerLabel="Add a membership" title="Add a person to a school" description="Gives an existing account a role at another school. They switch to it from the menu under their name, and are told by email." endpoint="/api/v1/memberships" method="POST" variant="secondary" submitLabel="Add" fields={[
            { name: "email", label: "Their account email", type: "email", required: true },
            { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
            { name: "role", label: "Role at that school", type: "select", required: true, options: ["SUBJECT_TEACHER", "CLASS_TEACHER", "HEAD_OF_DEPARTMENT", "EXAMINATION_OFFICER", "BURSAR", "ADMINISTRATOR", "PRINCIPAL", "PARENT"].map((value) => ({ label: value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), value })) },
            { name: "expiresAt", label: "Ends on (blank = no end)", type: "date" },
            { name: "note", label: "Note", type: "textarea" }
          ]} />
        }
        items={view?.rows ?? []}
        getRowKey={(row) => row.id}
        pageSize={8}
        emptyState="No person holds an account at more than one school yet."
        columns={[
          { key: "user", header: "User", render: (row) => <div><p className="font-semibold text-[var(--color-text-primary)]">{row.name}</p><p className="text-xs text-[var(--color-text-muted)]">{row.contact}</p></div> },
          { key: "memberships", header: "Memberships", render: (row) => row.memberships },
          { key: "roles", header: "Roles held", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.roles.join(" · ")}</span> },
          { key: "last", header: "Last active", render: (row) => (row.lastActive ? formatDate(row.lastActive) : "Never") },
          { key: "open", header: "", render: (row) => <ActionMenuLink href={`/super-admin/users/${row.id}`}>Open</ActionMenuLink> }
        ]}
        footnote="Leaving one school does not affect any other membership. Audit entries always record which school's account an action occurred under."
      />

      <TableCard
        title="Memberships given"
        description="Every school a person was added to, beyond the one their account was made in."
        items={view?.items ?? []}
        getRowKey={(row) => row.id}
        pageSize={8}
        emptyState="No membership has been given yet."
        columns={[
          { key: "person", header: "Person", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.person}</span> },
          { key: "school", header: "School", render: (row) => row.school },
          { key: "role", header: "Role", render: (row) => row.role },
          { key: "ends", header: "Ends", render: (row) => (row.expiresAt ? formatDate(row.expiresAt) : "No end date") },
          { key: "remove", header: "", sortable: false, render: (row) => <ResourceActionDialog triggerLabel="Remove" title={`Remove ${row.person} from ${row.school}`} description="They are signed out of that school at once. Their other schools are not affected." endpoint={`/api/v1/memberships/${row.id}/remove`} method="POST" variant="textActionDanger" submitLabel="Remove" confirmLabel="Confirm" fields={[]} /> }
        ]}
      />

      <ReferenceList
        title="What a membership record carries"
        sub="Independently, per school"
        items={[
          { label: "Role at that school", detail: "A teacher at one and a guardian at another is normal", tone: "teal" },
          { label: "Permission set and data scope", detail: "Set by that school, not inherited from another", tone: "teal" },
          { label: "The school-issued identifier", detail: "Alongside the single platform reference", tone: "teal" },
          { label: "Joined and left dates", detail: "Leaving is a membership event, never an account event", tone: "warn" },
          { label: "Removal requires school admin confirmation", detail: "Support Lead action, never unilateral", tone: "bad" }
        ]}
      />
    </>
  );
}

async function ReviewsAndCasesTab({
  suspiciousFlags,
  duplicateFlags,
  recoveryRecords,
  openCaseCount
}: {
  suspiciousFlags: SuperAdminSuspiciousActivityRow[];
  duplicateFlags: SuperAdminDuplicateFlagRow[];
  recoveryRecords: SuperAdminAccountRecoveryRow[];
  openCaseCount: number;
}) {
  const contextEnvelope = await apiGetEnvelope<SuperAdminUserCaseReviewContext>("/api/super-admin/user-case-review-context");
  const caseContext = contextEnvelope.data;
  const suspiciousContextById = new Map((caseContext?.suspicious ?? []).map((entry) => [entry.flagId, entry]));
  const duplicateContextById = new Map((caseContext?.duplicates ?? []).map((entry) => [entry.flagId, entry]));
  const recoveryContextById = new Map((caseContext?.recovery ?? []).map((entry) => [entry.recordId, entry]));

  const suspiciousCases: CaseRecord[] = suspiciousFlags.map((flag) => {
    const ctx = suspiciousContextById.get(flag.id);
    const signals: CaseSignal[] = [{ text: flag.detail ?? flag.flagType.replaceAll("_", " "), tone: "bad" }];
    if (ctx && !ctx.isActive) signals.push({ text: "Account already suspended", tone: "warn" });
    if (ctx?.passwordResetRequired) signals.push({ text: "Password reset already required on next login", tone: "good" });

    return {
      id: `susp-${flag.id}`,
      subject: flag.userName,
      meta: flag.userEmail,
      type: "suspicious",
      initials: caseInitials(flag.userName),
      assignee: "Unassigned",
      age: timeAgo(flag.detectedAt),
      facts: [
        { label: "User", value: `${flag.userName} (${flag.userEmail})` },
        { label: "School", value: ctx?.schoolName ?? "Unknown" },
        { label: "Last login", value: ctx?.lastLoginAt ? formatDate(ctx.lastLoginAt) : "Never logged in" },
        { label: "MFA status", value: ctx?.mfa ?? "Unknown" }
      ],
      signals,
      evidence: (ctx?.loginAttempts ?? []).map((attempt) => ({
        name: `${attempt.success ? "Successful" : "Failed"} login${attempt.reason ? ` — ${attempt.reason}` : ""} (${attempt.ipAddress ?? "unknown IP"}${attempt.device ? `, ${attempt.device}` : ""})`,
        who: formatDate(attempt.createdAt)
      })),
      checks: [
        { label: "Account locked / suspended pending review", done: ctx ? !ctx.isActive : false, who: ctx?.suspendedAt ? `Suspended ${formatDate(ctx.suspendedAt)}` : undefined },
        { label: "Password reset issued", done: ctx?.passwordResetRequired ?? false },
        { label: "School contacted", done: Boolean(ctx?.contacted), who: ctx?.contacted ? `${ctx.contacted.by} · ${ctx.contacted.how} · ${formatDate(ctx.contacted.at)} — ${ctx.contacted.note}` : "Not yet — record it below when someone has been in touch" }
      ],
      history: [],
      decisions: (
        <>
          <DecisionAction
            note="Writes down that somebody has been in touch with the school about this account."
            action={
              <ResourceActionDialog
                triggerLabel="Record contact with the school"
                title="Record contact with the school"
                description="This becomes a fact on the case — who, how and what was said — and ticks “School contacted”."
                endpoint="/api/super-admin/user-case-review-context/contacts"
                method="POST"
                variant="secondary"
                submitLabel="Record"
                fields={[
                  { name: "flagId", label: "Flag", type: "select", defaultValue: flag.id, options: [{ label: flag.userName, value: flag.id }] },
                  { name: "schoolId", label: "School", type: "select", defaultValue: ctx?.schoolId ?? "", options: [{ label: ctx?.schoolName ?? "The school", value: ctx?.schoolId ?? "" }] },
                  { name: "how", label: "How", type: "select", defaultValue: "Phone", options: ["Phone", "Email", "In person", "In-app message"].map((value) => ({ label: value, value })) },
                  { name: "note", label: "What was said, and to whom", type: "textarea", required: true }
                ]}
              />
            }
          />
          <DecisionAction
            note="Marks this flag reviewed with no action needed."
            action={
              <ResourceActionDialog
                triggerLabel="Dismiss flag"
                title="Dismiss flag"
                description="Mark this flag as reviewed with no action needed."
                endpoint={`/api/super-admin/users/suspicious-activity/${flag.id}/resolve`}
                method="PATCH"
                variant="secondary"
                submitLabel="Dismiss"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "DISMISS", options: [{ label: "Dismiss", value: "DISMISS" }] }]}
              />
            }
          />
          <DecisionAction
            note="Resolves the flag and forces a password reset for this user."
            action={
              <ResourceActionDialog
                triggerLabel="Force password reset"
                title="Force password reset"
                description="Resolves the flag and forces a password reset for this user."
                endpoint={`/api/super-admin/users/suspicious-activity/${flag.id}/resolve`}
                method="PATCH"
                variant="primary"
                submitLabel="Force reset"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "FORCE_RESET", options: [{ label: "Force password reset", value: "FORCE_RESET" }] }]}
              />
            }
          />
          <DecisionAction
            note="Resolves the flag and suspends this account pending investigation."
            action={
              <ResourceActionDialog
                triggerLabel="Suspend pending investigation"
                title="Suspend account"
                description="Resolves the flag and suspends this account pending investigation."
                endpoint={`/api/super-admin/users/suspicious-activity/${flag.id}/resolve`}
                method="PATCH"
                variant="danger"
                submitLabel="Suspend"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "SUSPEND", options: [{ label: "Suspend account", value: "SUSPEND" }] }]}
              />
            }
          />
        </>
      )
    };
  });

  const duplicateCases: CaseRecord[] = duplicateFlags.map((flag) => {
    const ctx = duplicateContextById.get(flag.id);
    const sameSchool = ctx ? ctx.userA.schoolId === ctx.userB.schoolId : undefined;
    const signals: CaseSignal[] = [{ text: `Matched on: ${flag.matchCriteria}`, tone: "warn" }];

    return {
      id: `dup-${flag.id}`,
      subject: `${flag.userA.name} ↔ ${flag.userB.name}`,
      meta: `${flag.userA.email} · ${flag.userB.email}`,
      type: "duplicates",
      initials: caseInitials(flag.userA.name),
      assignee: "Unassigned",
      age: timeAgo(flag.createdAt),
      facts: [
        { label: "Account A", value: `${flag.userA.name} (${flag.userA.email})${flag.userA.phone ? ` · ${flag.userA.phone}` : ""}` },
        { label: "Account B", value: `${flag.userB.name} (${flag.userB.email})${flag.userB.phone ? ` · ${flag.userB.phone}` : ""}` },
        { label: "Match basis", value: flag.matchCriteria },
        { label: "Schools", value: ctx ? `${ctx.userA.schoolName} / ${ctx.userB.schoolName}` : "Unknown" }
      ],
      signals,
      evidence: [],
      checks: [
        { label: "Match basis confirmed", done: true, who: flag.matchCriteria },
        { label: "Same school tenant", done: sameSchool ?? false, who: sameSchool === undefined ? "Unknown — the case has no school context" : sameSchool ? undefined : "Different schools" }
      ],
      history: [],
      decisions: (
        <>
          <DecisionAction
            note={`Keeps ${flag.userA.name} and deactivates ${flag.userB.name}.`}
            action={
              <ResourceActionDialog
                triggerLabel={`Keep ${flag.userA.name}`}
                title="Merge accounts"
                description={`Keep ${flag.userA.name} and deactivate ${flag.userB.name}.`}
                endpoint={`/api/super-admin/users/duplicates/${flag.id}/resolve`}
                method="PATCH"
                variant="secondary"
                submitLabel="Merge"
                fields={[
                  { name: "action", label: "Action", type: "select", defaultValue: "MERGE", options: [{ label: "Merge", value: "MERGE" }] },
                  { name: "keepUserId", label: "Keep user ID", defaultValue: flag.userA.id }
                ]}
              />
            }
          />
          <DecisionAction
            note={`Keeps ${flag.userB.name} and deactivates ${flag.userA.name}.`}
            action={
              <ResourceActionDialog
                triggerLabel={`Keep ${flag.userB.name}`}
                title="Merge accounts"
                description={`Keep ${flag.userB.name} and deactivate ${flag.userA.name}.`}
                endpoint={`/api/super-admin/users/duplicates/${flag.id}/resolve`}
                method="PATCH"
                variant="secondary"
                submitLabel="Merge"
                fields={[
                  { name: "action", label: "Action", type: "select", defaultValue: "MERGE", options: [{ label: "Merge", value: "MERGE" }] },
                  { name: "keepUserId", label: "Keep user ID", defaultValue: flag.userB.id }
                ]}
              />
            }
          />
          <DecisionAction
            note="These are not duplicate accounts."
            action={
              <ResourceActionDialog
                triggerLabel="Dismiss"
                title="Dismiss duplicate flag"
                description="These are not duplicate accounts."
                endpoint={`/api/super-admin/users/duplicates/${flag.id}/resolve`}
                method="PATCH"
                variant="secondary"
                submitLabel="Dismiss"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "DISMISS", options: [{ label: "Dismiss", value: "DISMISS" }] }]}
              />
            }
          />
          <DecisionAction
            note="Flags this pair for the school's own admin to resolve."
            action={
              <ResourceActionDialog
                triggerLabel="Escalate to school"
                title="Escalate to school admin"
                description="Flag this pair for the school's own admin to resolve."
                endpoint={`/api/super-admin/users/duplicates/${flag.id}/resolve`}
                method="PATCH"
                variant="danger"
                submitLabel="Escalate"
                fields={[{ name: "action", label: "Action", type: "select", defaultValue: "ESCALATE", options: [{ label: "Escalate", value: "ESCALATE" }] }]}
              />
            }
          />
        </>
      )
    };
  });

  const openRecoveryCount = recoveryRecords.filter((record) => !record.completedAt).length;

  const recoveryCases: CaseRecord[] = recoveryRecords.map((record) => {
    const ctx = recoveryContextById.get(record.id);
    const completed = Boolean(record.completedAt);
    const signals: CaseSignal[] = [
      completed
        ? { text: "Recovery completed — password reset and user notified", tone: "good" }
        : { text: "Recovery not yet completed", tone: "warn" }
    ];
    if (record.newEmail) signals.push({ text: `Inbox recovery included an email change to ${record.newEmail}`, tone: "warn" });

    return {
      id: `rec-${record.id}`,
      subject: record.userName,
      meta: record.userEmail,
      type: "recovery",
      initials: caseInitials(record.userName),
      assignee: "Unassigned",
      age: timeAgo(record.createdAt),
      facts: [
        { label: "User", value: `${record.userName} (${record.userEmail})` },
        { label: "School", value: ctx?.schoolName ?? "Unknown" },
        { label: "Verified via", value: record.verificationMethod },
        { label: "New email", value: record.newEmail ?? "No email change" }
      ],
      signals,
      evidence: [],
      checks: [
        { label: "Identity verified", done: true, who: record.verificationMethod },
        { label: "Temporary password issued", done: completed },
        { label: "User notified by email", done: completed }
      ],
      history: [
        { what: `${completed ? "Completed" : "Initiated"} by ${record.verifiedBy}`, when: formatDate(record.completedAt ?? record.createdAt) }
      ],
      decisions: (
        <p className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
          No further action is available on this record — the temporary password and notification are issued the
          moment a recovery is created, so there is nothing left pending here. To recover a different account, use
          &quot;Recover account&quot; from the Directory tab.
        </p>
      )
    };
  });

  const allCases: CaseRecord[] = [...suspiciousCases, ...duplicateCases, ...recoveryCases];
  const typeFilters: CaseTypeFilter[] = [
    { label: "All open", value: "all", count: allCases.length },
    { label: "Suspicious activity", value: "suspicious", count: suspiciousCases.length },
    { label: "Duplicate accounts", value: "duplicates", count: duplicateCases.length },
    { label: "Account recovery", value: "recovery", count: recoveryCases.length }
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Open cases" value={openCaseCount} detail="Across suspicious activity, duplicates, and in-progress recoveries." icon={ShieldAlert} tone="dark" />
        <StatCard label="Suspicious activity" value={suspiciousFlags.length} detail="Unresolved flags awaiting review." icon={ShieldAlert} tone="danger" />
        <StatCard label="Duplicate accounts" value={duplicateFlags.length} detail="Pending match review." icon={Copy} tone="info" />
        <StatCard label="Recoveries" value={recoveryRecords.length} detail={`${openRecoveryCount} still open`} icon={KeyRound} tone="success" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[12.5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[11.5px] bg-[var(--color-bg-ink)] text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11.5px] font-extrabold text-[var(--color-text-primary)]">Case queue</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Signals are scanned, selected, and resolved from one review surface.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ResourceActionDialog
            triggerLabel="Run suspicious activity scan"
            title="Recalculate suspicious activity"
            description="Scan for new suspicious activity signals across all users."
            endpoint="/api/super-admin/users/suspicious-activity/recalculate"
            method="POST"
            variant="secondary"
            submitLabel="Run scan"
            fields={[]}
          />
          <ResourceActionDialog
            triggerLabel="Run duplicate scan"
            title="Recalculate duplicate accounts"
            description="Scan for new potential duplicate accounts."
            endpoint="/api/super-admin/users/duplicates/recalculate"
            method="POST"
            variant="secondary"
            submitLabel="Run scan"
            fields={[]}
          />
        </div>
      </section>

      <CaseReviewBoard
        types={typeFilters}
        cases={allCases}
        emptyState="No open cases right now. Run a scan to check for new suspicious activity or duplicate accounts."
        footerNote="Suspicious activity and duplicate accounts are detected by periodic scans; account recovery cases are logged the moment support completes a recovery."
        searchPlaceholder="Search a subject, type or assignee"
      />

      <RepairQueue />
    </div>
  );
}

type RepairView = {
  rows: Array<{ schoolId: string; school: string; guardians: number; unreachable: number; sharePct: number; channels: string[]; firstFailed: string | null; state: string; problems: number; topReason: string | null; hasManager: boolean }>;
  kpis: { unreachable: number; unreachablePct: number; schoolsAffected: number; routed: number; corrected: number; above15: number };
};
const REPAIR_STATE: Record<string, { label: string; bg: string; fg: string }> = {
  OPEN: { label: "Not yet routed", bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  ROUTED: { label: "Routed to school", bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  AM_NOTIFIED: { label: "AM notified", bg: "var(--color-danger-dim)", fg: "var(--color-danger)" }
};

async function RepairQueue() {
  const view = await apiGet<RepairView>("/api/super-admin/user-case-review-context/repair-queue").catch(() => null);
  const k = view?.kpis;
  const rows = view?.rows ?? [];
  return (
    <>
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Users with repeated failures" value={(k?.unreachable ?? 0).toLocaleString()} detail={`${k?.unreachablePct ?? 0}% of contactable accounts`} icon={ShieldAlert} tone="dark" />
        <StatCard label="Schools affected" value={k?.schoolsAffected ?? 0} detail="Grouped for routing" icon={UsersRound} tone="neutral" />
        <StatCard label="Routed to schools" value={k?.routed ?? 0} detail="We never edit a guardian's details ourselves" icon={UserCheck} tone="neutral" />
        <StatCard label="Corrected this month" value={k?.corrected ?? 0} detail="Guardian record updates in the schools asked" icon={ShieldCheck} tone="success" />
        <StatCard label="Schools above 15% unreachable" value={k?.above15 ?? 0} detail="Surfaced to their Account Manager" icon={LifeBuoy} tone={k?.above15 ? "warning" : "neutral"} />
      </section>

      <TableCard
        title="Contact quality repair queue"
        description="Delivery failures collect here rather than evaporating into a campaign report. Routed to the school for correction — the school holds the relationship and the correct data."
        items={rows}
        pageSize={false}
        getRowKey={(row) => row.schoolId}
        emptyState="Every school's guardian contacts are reachable, and nothing has failed to send in the last 30 days."
        selection={{
          noun: "school",
          nounPlural: "schools",
          actions: [
            { label: "Route to the schools for correction", kind: "primary", endpoint: "/api/super-admin/user-case-review-context/contact-quality/route", idsField: "schoolIds" },
            { label: "Notify the Account Managers", endpoint: "/api/super-admin/user-case-review-context/contact-quality/route", idsField: "schoolIds", extra: { notifyManagers: true } },
            { label: "Export the affected contacts", endpoint: "/api/super-admin/user-case-review-context/contact-quality/export", method: "DOWNLOAD", idsField: "schoolIds" }
          ]
        }}
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.school}</span> },
          { key: "unreachable", header: "Unreachable", render: (row) => `${row.unreachable} guardian${row.unreachable === 1 ? "" : "s"}${row.problems > row.unreachable ? ` · ${row.problems - row.unreachable} failed sends` : ""}` },
          { key: "share", header: "Share of guardians", render: (row) => <div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-[#EDF3EF]"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, row.sharePct * 4)}%`, background: row.sharePct >= 15 ? "var(--color-danger)" : "var(--color-success)" }} /></div><span className="text-[11.5px] font-semibold">{row.sharePct}%</span></div> },
          { key: "channel", header: "Channel", render: (row) => (row.channels.length ? row.channels.join(" + ") : "—") },
          { key: "first", header: "First failed", render: (row) => (row.firstFailed ? formatDate(row.firstFailed) : "—") },
          { key: "state", header: "State", render: (row) => <StatusPill bg={REPAIR_STATE[row.state].bg} fg={REPAIR_STATE[row.state].fg} label={REPAIR_STATE[row.state].label} /> },
          { key: "act", header: "", render: (row) => (row.problems ? <ResourceActionDialog triggerLabel="Open" title={`Ask ${row.school} to correct its contacts`} description="Sends the owner an in-app note with the counts, and records that it was sent." endpoint={`/api/super-admin/user-case-review-context/contact-quality/${row.schoolId}/notify`} method="POST" variant="textAction" submitLabel="Send" fields={[]} /> : null) }
        ]}
        footnote="A school with a high proportion of unreachable guardians is surfaced to its Account Manager — a school whose parents cannot be reached is not receiving the product's core value, whatever the adoption figures say. A phone is unreachable when no carrier can take it."
      />
    </>
  );
}

type TeacherView = {
  clusters: Array<{ name: string; location: string | null; teachers: number; activityScore: number; activity: string; onPlatform: string; deal: { id: string; label: string } | null; approach: { id: string; status: string } | null; teacherIds: string[] }>;
  teachers: Array<{ id: string; name: string; email: string; role: string; school: string | null; city: string | null; subjects: string[]; activity: string; whatsapp: boolean; contacted: string | null }>;
  counts: { accounts: number; schoolsNamed: number; whatsapp: number; neverContacted: number };
  approaches: Array<{ id: string; schoolName: string; status: string; teachers: number; note: string | null; createdAt: string }>;
  deals: Array<{ id: string; label: string }>;
};

const ACTIVITY_TONE: Record<string, { bg: string; fg: string }> = {
  High: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  Medium: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  Low: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

async function IndividualTeachersTab({ params }: { params: Record<string, string | undefined> }) {
  const view = await apiGet<TeacherView>("/api/super-admin/users/insights/teachers");
  const q = (params.search ?? "").toLowerCase();
  const teachers = view.teachers.filter((t) => !q || `${t.name} ${t.school ?? ""} ${t.city ?? ""} ${t.subjects.join(" ")}`.toLowerCase().includes(q));
  const messageFields = [
    { name: "subject", label: "Subject", required: true },
    { name: "channel", label: "Channel", type: "select" as const, defaultValue: "EMAIL", options: [{ label: "Email", value: "EMAIL" }, { label: "SMS", value: "SMS" }], note: "WhatsApp is not connected, so a teacher's WhatsApp opt-in is recorded but nothing is sent on it." },
    { name: "body", label: "Message", type: "textarea" as const, required: true, placeholder: "End with a question, not a booking.", note: "Write to the teacher personally — never to their school." }
  ];

  return (
    <div className="grid gap-5">
      <TableCard
        title="School clusters — ranked by cluster strength"
        description="Three teachers naming one school is a materially warmer lead than three teachers at three schools. Sales and Onboarding roles and above."
        items={view.clusters}
        getRowKey={(row) => row.name}
        pageSize={8}
        emptyState="No individual teacher has named a school yet."
        columns={[
          { key: "school", header: "Named school", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.name}</span> },
          { key: "location", header: "Location", render: (row) => row.location ?? <span className="text-[var(--color-text-muted)]">Not given</span> },
          { key: "teachers", header: "Teachers", render: (row) => row.teachers },
          { key: "activity", header: "Combined activity", render: (row) => <StatusPill bg={ACTIVITY_TONE[row.activity].bg} fg={ACTIVITY_TONE[row.activity].fg} label={`${row.activity} · ${row.activityScore}`} /> },
          { key: "platform", header: "On platform?", render: (row) => row.onPlatform },
          { key: "deal", header: "Partner deal", render: (row) => (row.deal ? <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label={row.deal.label} /> : row.approach?.status === "ROUTED" ? <StatusPill bg="var(--color-accent-primary-dim)" fg="var(--color-text-accent)" label="Routed" /> : <StatusPill bg="var(--color-warning-dim)" fg="var(--color-warning)" label="Unregistered" />) },
          {
            key: "act",
            header: "",
            render: (row) =>
              row.deal ? (
                <ResourceActionDialog triggerLabel="Route" title={`Route ${row.name} under its registered deal`} description="Introductions go through a registered deal, so attribution is settled before the introduction rather than argued about afterwards." endpoint="/api/super-admin/users/insights/teachers/route" method="POST" variant="textAction" submitLabel="Route" fields={[{ name: "approachId", label: "Approach list entry", type: "select", required: true, options: view.approaches.filter((a) => a.schoolName.toLowerCase() === row.name.toLowerCase()).map((a) => ({ label: `${a.schoolName} — ${a.teachers} teachers`, value: a.id })) }, { name: "dealId", label: "Registered deal", type: "select", required: true, defaultValue: row.deal.id, options: view.deals.map((d) => ({ label: d.label, value: d.id })) }]} />
              ) : (
                <ResourceActionDialog triggerLabel="Add to list" title={`Add ${row.name} to the approach list`} description="Keeps the school for someone to approach. Nothing is sent to the school." endpoint="/api/super-admin/users/insights/teachers/approach" method="POST" variant="textAction" submitLabel="Add" fields={[{ name: "schoolName", label: "School", defaultValue: row.name }, { name: "teacherIds", label: "Teachers", type: "multiselect", defaultValue: row.teacherIds, options: view.teachers.filter((t) => row.teacherIds.includes(t.id)).map((t) => ({ label: t.name, value: t.id })) }, { name: "note", label: "Note", type: "textarea" }]} />
              )
          }
        ]}
        footnote="Routing to a partner happens only under a registered deal in Partners & Commission, so that attribution is established before the introduction rather than after."
      />

      <TableCard
        title="Individual teachers"
        description={`Teachers using Nooria on their own. Their school is not a customer — which makes each of them a way in. ${view.counts.accounts} accounts · ${view.counts.schoolsNamed} schools named · ${view.counts.whatsapp} opted in to WhatsApp · ${view.counts.neverContacted} never contacted.`}
        items={teachers}
        getRowKey={(row) => row.id}
        pageSize={8}
        emptyState="No teacher has signed up on their own yet."
        actions={<ResourceActionDialog triggerLabel="Bulk message" title="Message individual teachers" description="Goes to every teacher on this list you have not unticked — by email or SMS, personally, from the platform." endpoint="/api/super-admin/users/insights/teachers/message" method="POST" variant="primary" submitLabel="Queue messages" fields={[{ name: "teacherIds", label: "Teachers", type: "multiselect", required: true, defaultValue: view.teachers.map((t) => t.id), options: view.teachers.map((t) => ({ label: `${t.name}${t.school ? ` — ${t.school}` : ""}`, value: t.id })) }, ...messageFields]} />}
        filterBar={<FilterToolbar action="/super-admin/users?tab=teachers" resultCount={teachers.length} controls={[{ name: "search", label: "Search a teacher, school, city or subject", type: "search", placeholder: "Search a teacher, school, city or subject", defaultValue: params.search }]} />}
        selection={{
          noun: "teacher",
          nounPlural: "teachers",
          actions: [
            { label: "Add to a school-approach list", endpoint: "/api/super-admin/users/insights/teachers/approach-selected", idsField: "teacherIds" }
          ]
        }}
        columns={[
          { key: "teacher", header: "Teacher", render: (row) => <div><p className="font-semibold text-[var(--color-text-primary)]">{row.name}</p><p className="text-xs text-[var(--color-text-muted)]">{row.role}</p></div> },
          { key: "school", header: "Claimed school", render: (row) => row.school ?? <span className="text-[var(--color-text-muted)]">None named</span> },
          { key: "city", header: "City", render: (row) => row.city ?? "—" },
          { key: "subjects", header: "Subjects", render: (row) => <span className="text-[12px]">{row.subjects.join(", ") || "—"}</span> },
          { key: "activity", header: "Activity", render: (row) => <StatusPill bg={ACTIVITY_TONE[row.activity].bg} fg={ACTIVITY_TONE[row.activity].fg} label={row.activity} /> },
          { key: "contacted", header: "Contacted", render: (row) => (row.contacted ? formatDate(row.contacted) : "Never") },
          { key: "open", header: "", render: (row) => <ActionMenuLink href={`/super-admin/users/${row.id}`}>Open</ActionMenuLink> }
        ]}
        footnote="No student-level data appears in any column, export or aggregate on this screen, because the individual tier cannot hold it. What is here is the teacher, their subjects and how to reach them."
      />

      <ReferenceList
        title="How we use this list"
        sub="A teacher is not a lead to be harvested. They are a colleague who already chose us, and the approach has to read that way."
        items={[
          { label: "A cluster is the argument, not the individual", detail: "Seven teachers at one school using Nooria unprompted is a sentence a Proprietor cannot ignore. One teacher is not.", pill: "Approach", tone: "good" },
          { label: "Message the teacher, never the school, from here", detail: "Writing to a Principal about a teacher's private account would break the trust that made this list exist", pill: "Rule", tone: "bad" },
          { label: "WhatsApp only where they opted in", detail: "A teacher who has not opted in cannot be written to on WhatsApp — there is no override. (WhatsApp itself is not connected yet.)", pill: "Consent", tone: "bad" },
          { label: "Ask before you introduce", detail: "Every message ends with a question, not a booking. A teacher who feels used stops using the product", pill: "Tone", tone: "warn" },
          { label: "Route through a registered deal if a partner is involved", detail: "Attribution is settled before the introduction, never after", pill: "Attribution", tone: "teal" }
        ]}
      />
    </div>
  );
}

function ControlSpecTable({ rows }: { rows: Array<{ control: string; spec: string; state: "enforced" | "not-built" | "partial" }> }) {
  const stateStyle = {
    enforced: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Enforced" },
    partial: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Partially enforced" },
    "not-built": { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Not built" }
  } as const;

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">Support access controls</p>
        <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">The portal being entered holds a school&apos;s own records — this states plainly what actually stops or logs a session, not what would be nice to claim.</p>
      </div>
      <div className="grid gap-0 p-5">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-4 border-b border-[#E6EEE9] pb-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8C9A92]">
          <span>Control</span>
          <span>Specification</span>
          <span>State</span>
        </div>
        {rows.map((row) => (
          <div key={row.control} className="grid grid-cols-[1fr_2fr_auto] items-start gap-4 border-b border-[var(--color-border-muted)] py-3 last:border-b-0">
            <p className="text-[11.5px] font-bold text-[var(--color-text-primary)]">{row.control}</p>
            <p className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">{row.spec}</p>
            <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: stateStyle[row.state].bg, color: stateStyle[row.state].fg }}>
              {stateStyle[row.state].label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

type Elevation = { id: string; school: string; target: string; summary: string | null; requestedBy: string; requestedAt: string; status: string; decidedBy: string | null; decidedAt: string | null; note: string | null; usable: boolean };
type Restriction = { id: string; guardian: string; email: string; school: string; since: string; note: string | null };

async function SupportAccessTab() {
  const [envelope, elevations, restrictions] = await Promise.all([
    apiGetEnvelope<SuperAdminImpersonationLogRow[]>("/api/super-admin/users/impersonation-log"),
    apiGet<Elevation[]>("/api/super-admin/users/support-access/elevations").catch(() => [] as Elevation[]),
    apiGet<Restriction[]>("/api/super-admin/users/support-access/restrictions").catch(() => [] as Restriction[])
  ]);
  const events = envelope.data ?? [];

  return (
    <div className="grid gap-5">
      <ControlSpecTable
        rows={[
          { control: "Default mode", spec: "Read-only. A session opened without the school's approval can look at everything but every change is refused, whatever the person's role.", state: "enforced" },
          { control: "Elevation to act", spec: "The agent requests approval below; it lands in the school's own Approvals queue and in-app. Once the school's leadership approves, the approval (valid 24 hours, usable once) can be entered when starting the session, which is then allowed to make changes.", state: "enforced" },
          { control: "Maximum duration", spec: "30 minutes, expiring automatically regardless of activity.", state: "enforced" },
          { control: "Reason", spec: "Recorded before the session starts — a session cannot begin without one.", state: "enforced" },
          { control: "Session logging", spec: "Written to this platform's audit log and against the school, and the school's leadership is told in-app that a session has begun and whether it can change anything.", state: "enforced" },
          { control: "Blocked contexts", spec: "No session can start into a school with an unresolved ownership dispute (objection raised or frozen) or an open web-address dispute, nor into a guardian account carrying a safeguarding restriction (below).", state: "enforced" }
        ]}
      />

      <TableCard
        title="Requests to act"
        description="Every request a support agent has made to a school's leadership to make changes on a user's account, and what the school decided."
        items={elevations}
        getRowKey={(row) => row.id}
        emptyState="No request to act has been made."
        actions={
          <ResourceActionDialog
            triggerLabel="Request approval to act"
            title="Ask the school's leadership for approval to act"
            description="The owner, proprietor and principal are told in-app, and the request appears in the school's Approvals queue. Until they approve, support can only look."
            endpoint="/api/super-admin/users/support-access/elevations"
            method="POST"
            variant="secondary"
            submitLabel="Send request"
            fields={[
              { name: "email", label: "School user's email", type: "email", required: true },
              { name: "reason", label: "What needs doing, and why", type: "textarea", required: true, note: "The school reads this word for word." }
            ]}
          />
        }
        columns={[
          { key: "school", header: "School", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.school}</span> },
          { key: "target", header: "Account", render: (row) => row.target },
          { key: "summary", header: "Asked", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.summary}</span> },
          { key: "when", header: "Requested", render: (row) => formatDate(row.requestedAt) },
          { key: "status", header: "School's answer", render: (row) => <div><StatusPill bg={row.usable ? "var(--color-success-dim)" : row.status === "PENDING" ? "var(--color-warning-dim)" : "var(--color-bg-subtle)"} fg={row.usable ? "var(--color-success)" : row.status === "PENDING" ? "var(--color-warning)" : "var(--color-text-muted)"} label={row.usable ? "Approved — usable" : row.status.charAt(0) + row.status.slice(1).toLowerCase()} />{row.decidedBy ? <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{row.decidedBy}{row.decidedAt ? ` · ${formatDate(row.decidedAt)}` : ""}{row.note ? ` — ${row.note}` : ""}</p> : null}</div> },
          { key: "ref", header: "Approval reference", render: (row) => (row.usable ? <span className="select-all font-[var(--font-mono)] text-[11px]">{row.id}</span> : <span className="text-[var(--color-text-muted)]">—</span>) }
        ]}
      />

      <TableCard
        title="Safeguarding restrictions"
        description="A guardian account under a restriction cannot be opened by anyone from the platform. Placing one needs a recorded basis; only a Super Admin can lift it."
        items={restrictions}
        getRowKey={(row) => row.id}
        emptyState="No guardian account is restricted."
        actions={
          <ResourceActionDialog
            triggerLabel="Restrict a guardian account"
            title="Restrict a guardian account"
            description="Blocks every support session into this account until the restriction is lifted."
            endpoint="/api/super-admin/users/support-access/restrictions"
            method="POST"
            variant="secondary"
            submitLabel="Place restriction"
            confirmLabel="Confirm"
            confirmMessage="Nobody from the platform will be able to open this account."
            fields={[
              { name: "email", label: "Guardian's sign-in email", type: "email", required: true },
              { name: "note", label: "Basis for the restriction", type: "textarea", required: true }
            ]}
          />
        }
        columns={[
          { key: "g", header: "Guardian", render: (row) => <div><p className="font-semibold text-[var(--color-text-primary)]">{row.guardian}</p><p className="text-[11px] text-[var(--color-text-muted)]">{row.email}</p></div> },
          { key: "school", header: "School", render: (row) => row.school },
          { key: "since", header: "Since", render: (row) => formatDate(row.since) },
          { key: "note", header: "Basis", render: (row) => <span className="text-[12px] text-[var(--color-text-secondary)]">{row.note}</span> },
          { key: "lift", header: "", render: (row) => <ResourceActionDialog triggerLabel="Lift" title={`Lift the restriction — ${row.guardian}`} description="Support sessions into this account become possible again." endpoint={`/api/super-admin/users/support-access/restrictions/${row.id}/lift`} method="POST" variant="textActionDanger" submitLabel="Lift restriction" confirmLabel="Confirm" fields={[{ name: "note", label: "Why it is being lifted", type: "textarea", required: true }]} /> }
        ]}
      />

      <TableCard
        title="Support access log"
        description="Every session, with the mirrored entry in the school's own log. Initiate: Support Agent and above — always logged, no exceptions, no suppression."
        items={events}
        getRowKey={(item) => item.id}
        emptyState="No support access sessions recorded yet."
        columns={[
          { key: "by", header: "Agent", render: (item) => <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)]"><LifeBuoy className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />{item.impersonatedBy}</span> },
          { key: "target", header: "Target user", render: (item) => <div><p>{item.targetRole ? roleLabel(item.targetRole) : "User"} — {item.schoolName}</p><p className="text-[11px] text-[var(--color-text-muted)]">{item.targetEmail}</p></div> },
          { key: "reason", header: "Reason", render: (item) => <span className="text-[12px] text-[var(--color-text-secondary)]">{item.reason ?? "—"}</span> },
          { key: "duration", header: "Duration", render: (item) => (item.blocked ? "—" : item.windowEnded ? "30 min — auto-expired" : "In progress · 30 min max") },
          { key: "mode", header: "Mode", render: (item) => (item.blocked ? <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Blocked" /> : item.elevated ? <StatusPill bg="var(--color-warning-dim)" fg="var(--color-warning)" label="Elevated" /> : <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Read-only" />) },
          { key: "school", header: "School log", render: (item) => (item.blocked ? <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label={/safeguarding/i.test(item.blocked) ? "Safeguarding restriction" : "Open dispute"} /> : item.elevated && item.confirmedBy ? <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label={`Confirmed by ${item.confirmedBy}`} /> : <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Visible" />) }
        ]}
        footnote="Anything beyond read-only requires a school administrator's recorded confirmation first. The school sees the same record we do, immediately."
      />

      <FlowSteps
        title="Support access session"
        sub="Dual-logged by design, to us and to the school"
        steps={[
          { label: "Agent requests view-as", note: "Reason required — no reason, no session" },
          { label: "Eligibility checked", note: "Blocked on open dispute or safeguarding restriction", tone: "bad" },
          { label: "Session starts", note: "Read-only, hard 30-minute limit", tone: "good" },
          { label: "Entry written to the school's log", note: "Visible immediately to Proprietor and Principal", tone: "ink" },
          { label: "Needs to act?", note: "Super Admin escalation + school confirmation", tone: "warn" },
          { label: "Session ends", note: "Manually, or automatically at 30 minutes" },
          { label: "Full record to both logs", note: "Platform audit log and the school's own log", tone: "good" }
        ]}
      />

      <FlowSteps
        title="Support access session — how one starts and ends"
        sub="Every view-as session is time-boxed, mirrored to the school and fully auditable"
        steps={[
          { label: "Reason logged", note: "Before the session can start" },
          { label: "Session starts", note: "Maximum 30 minutes", tone: "ink" },
          { label: "Read-only by default", note: "Editing needs Super Admin escalation", tone: "warn" },
          { label: "Auto-expires", note: "At 30 min regardless of activity", tone: "warn" },
          { label: "Logged to audit trail", note: "Pages viewed, actions taken", tone: "good" }
        ]}
      />

      <TableCard
        title="Support access log — last 7 days"
        description="Immutable — visible to Super Admin and the acting agent's Department Lead."
        items={events.filter((item) => Date.now() - new Date(item.startedAt).getTime() < 7 * 86_400_000)}
        getRowKey={(item) => `w-${item.id}`}
        emptyState="No session in the last 7 days."
        columns={[
          { key: "admin", header: "Admin", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.impersonatedBy}</p><p className="text-[11px] capitalize text-[var(--color-text-muted)]">{item.agentRole ?? ""}</p></div> },
          { key: "target", header: "Target user", render: (item) => <div><p>{item.targetEmail}</p><p className="text-[11px] text-[var(--color-text-muted)]">{item.schoolName}</p></div> },
          { key: "reason", header: "Reason", render: (item) => <span className="text-[12px] text-[var(--color-text-secondary)]">{item.reason ?? "—"}</span> },
          { key: "duration", header: "Duration", render: (item) => (item.blocked ? "—" : item.windowEnded ? "30 min · expired" : "In progress") },
          { key: "mode", header: "Mode", render: (item) => (item.blocked ? <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Blocked" /> : item.elevated ? <StatusPill bg="var(--color-warning-dim)" fg="var(--color-warning)" label="Write escalated" /> : <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Read-only" />) }
        ]}
      />
    </div>
  );
}
