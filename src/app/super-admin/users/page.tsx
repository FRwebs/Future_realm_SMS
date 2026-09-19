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
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
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
      <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">{note}</p>
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
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
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
            className="whitespace-nowrap rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]"
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

      <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
        <p className="text-[14px] font-semibold text-[#0D2315]">Multi-school memberships — not built</p>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">
          This system's account model gives every user exactly one <code className="rounded bg-[var(--color-bg-subtle)] px-1 py-0.5 text-[11px]">schoolId</code>, and email addresses are
          globally unique. A guardian with children at two schools, or a teacher employed by two, needs a
          separate account and a separate email at each — there is no single account holding several
          independent school memberships, and no plan to add one without a data-model change.
        </p>
      </section>
    </div>
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
        { label: "MFA status", value: "Not tracked by this system" }
      ],
      signals,
      evidence: (ctx?.loginAttempts ?? []).map((attempt) => ({
        name: `${attempt.success ? "Successful" : "Failed"} login${attempt.reason ? ` — ${attempt.reason}` : ""} (${attempt.ipAddress ?? "unknown IP"}${attempt.device ? `, ${attempt.device}` : ""})`,
        who: formatDate(attempt.createdAt)
      })),
      checks: [
        { label: "Account locked / suspended pending review", done: ctx ? !ctx.isActive : false, who: ctx?.suspendedAt ? `Suspended ${formatDate(ctx.suspendedAt)}` : undefined },
        { label: "Password reset issued", done: ctx?.passwordResetRequired ?? false },
        { label: "School contacted", done: false, who: "Not tracked by this system" }
      ],
      history: [],
      decisions: (
        <>
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
        { label: "Same school tenant", done: sameSchool ?? false, who: sameSchool === undefined ? "Not tracked by this system" : sameSchool ? undefined : "Different schools" }
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
        <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
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

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[var(--color-bg-ink)] text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-[var(--color-text-primary)]">Case queue</p>
            <p className="text-[12px] text-[var(--color-text-muted)]">Signals are scanned, selected, and resolved from one review surface.</p>
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

      <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
        <p className="text-[14px] font-semibold text-[#0D2315]">Contact quality repair — not tracked</p>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">
          This system does not aggregate guardian notification-delivery failures into a per-school queue for
          correction, because delivery itself isn&apos;t tracked at that level yet — the notification pipeline has no
          real send/failure log to build one from. The cases below are the reviews this system can actually back
          with real signals: suspicious activity, duplicate accounts, and account recovery.
        </p>
      </section>
    </div>
  );
}

async function IndividualTeachersTab({ params }: { params: Record<string, string | undefined> }) {
  const query = new URLSearchParams({ role: "teacher", limit: "100" });
  for (const key of ["search", "schoolId", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const [envelope, schoolsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminUserRow[]>(`/api/super-admin/users?${query.toString()}`),
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
  ]);
  const teachers = envelope.data ?? [];
  const schoolOptions = [
    { label: "All schools", value: "" },
    ...(schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }))
  ];

  return (
    <div className="grid gap-5">
      <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
        <p className="text-[14px] font-semibold text-[#0D2315]">Individual, non-customer teachers — not representable</p>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">
          Every account in this system belongs to exactly one onboarded school — there is no concept of a teacher
          using the platform independently of a paying customer, and so no cluster of unaffiliated teachers naming
          the same non-customer school to route to Sales or a partner. What follows is simply every real teacher
          account on the platform today, all of them already at a customer school.
        </p>
      </section>

      <TableCard
        title="Teachers"
        items={teachers}
        filterBar={
          <FilterToolbar
            action="/super-admin/users?tab=teachers"
            resultCount={envelope.pagination?.total}
            controls={[
              { name: "search", label: "Search", type: "search", placeholder: "Name or email", defaultValue: params.search },
              { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: schoolOptions }
            ]}
          />
        }
        columns={[
          { key: "name", header: "Name", render: (item) => item.name },
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "role", header: "Role", render: (item) => roleLabel(item.role) },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") },
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
              </ActionMenu>
            )
          }
        ]}
        emptyState="No teacher accounts match the current filters."
      />
    </div>
  );
}

const flowToneStyle: Record<"good" | "warn" | "bad" | "ink" | "plain", { bg: string; fg: string; bd: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", bd: "#CFE4DB" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", bd: "#F2E4C6" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", bd: "#F3E0E0" },
  ink: { bg: "#0D2315", fg: "#fff", bd: "#0D2315" },
  plain: { bg: "#fff", fg: "var(--color-text-primary)", bd: "var(--color-border-default)" }
};

function FlowSteps({ title, sub, steps }: { title: string; sub: string; steps: Array<{ label: string; note: string; tone?: "good" | "warn" | "bad" | "ink" }> }) {
  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-6">
      <p className="text-[14px] font-semibold text-[#0D2315]">{title}</p>
      <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-[var(--color-text-muted)]">{sub}</p>
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "plain"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] max-w-[190px] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug" style={{ color: step.tone === "ink" ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}>{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
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
        <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Support access controls</p>
        <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">The portal being entered holds a school&apos;s own records — this states plainly what actually stops or logs a session, not what would be nice to claim.</p>
      </div>
      <div className="grid gap-0 p-5">
        {rows.map((row) => (
          <div key={row.control} className="grid grid-cols-[1fr_2fr_auto] items-start gap-4 border-b border-[var(--color-border-muted)] py-3 last:border-b-0">
            <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{row.control}</p>
            <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{row.spec}</p>
            <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: stateStyle[row.state].bg, color: stateStyle[row.state].fg }}>
              {stateStyle[row.state].label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

async function SupportAccessTab() {
  const envelope = await apiGetEnvelope<SuperAdminImpersonationLogRow[]>("/api/super-admin/users/impersonation-log");
  const events = envelope.data ?? [];

  return (
    <div className="grid gap-5">
      <ControlSpecTable
        rows={[
          { control: "Default mode", spec: "The mockup's design intent is read-only, no action on the user's behalf. This system issues a full session token as that user's real role — nothing currently blocks a write during an impersonated session.", state: "not-built" },
          { control: "Elevation to act", spec: "A separate escalation step, with a school administrator's recorded confirmation before anything beyond read-only. No such escalation flow exists.", state: "not-built" },
          { control: "Maximum duration", spec: "30 minutes, expiring automatically regardless of activity.", state: "enforced" },
          { control: "Reason", spec: "Recorded before the session starts — a session cannot begin without one.", state: "enforced" },
          { control: "Session logging", spec: "Written to this platform's own audit log. There is no separate, mirrored entry in a school's own audit surface — one log, not two.", state: "partial" },
          { control: "Blocked contexts", spec: "No access into a school with an unresolved dispute, and none into a guardian account under a safeguarding restriction. Neither concept is tracked, so neither gate exists.", state: "not-built" }
        ]}
      />

      <TableCard
        title="Support access log"
        description="Every impersonation session recorded on this platform's audit log."
        items={events}
        emptyState="No support access sessions recorded yet."
        columns={[
          { key: "by", header: "Accessed by", render: (item) => (
            <span className="inline-flex items-center gap-1.5"><LifeBuoy className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />{item.impersonatedBy}</span>
          ) },
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

      <FlowSteps
        title="Support access session — how one starts and ends"
        sub="Time-boxed and reason-gated by design; the read-only and dual-logging guarantees below are the mockup's intent, not yet this system's behavior."
        steps={[
          { label: "Reason logged", note: "Required before the session can start", tone: "good" },
          { label: "Session starts", note: "Full role access — not currently read-only", tone: "warn" },
          { label: "Auto-expires", note: "At 30 minutes regardless of activity", tone: "good" },
          { label: "Logged to the audit trail", note: "Pages viewed and actions taken are not itemized — only that a session ran", tone: "ink" }
        ]}
      />
    </div>
  );
}

