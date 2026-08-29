import type { ReactNode } from "react";
import { ShieldAlert, Copy, LifeBuoy } from "lucide-react";
import { CaseReviewBoard, type CaseRecord, type CaseSignal, type CaseTypeFilter } from "@/components/data-display/case-review-board";
import { DetailTabs } from "@/components/data-display/detail-tabs";
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
  SuperAdminUserRow
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

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Platform users</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Cross-Platform User Management</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            Search and support every user across all school tenants — resolving account issues schools cannot resolve
            themselves, and keeping the platform accountable for who is using it.
          </p>
        </div>
      </section>

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
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Open cases" value={openCaseCount} detail="Across suspicious activity, duplicates, and in-progress recoveries." icon={ShieldAlert} tone="warning" />
        <StatCard label="Suspicious activity" value={suspiciousFlags.length} detail="Unresolved flags awaiting review." icon={ShieldAlert} tone="danger" />
        <StatCard label="Duplicate accounts" value={duplicateFlags.length} detail="Pending match review." icon={Copy} tone="info" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <p className="max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
          Suspicious activity flags excessive failed logins, simultaneous sessions from different locations, and
          sensitive account actions taken outside business hours. Duplicate accounts are matched by shared phone
          number. Account recovery lists every support-completed recovery for audit.
        </p>
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
      />
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
      <section className="surface-card p-6">
        <p className="section-eyebrow">Cross-school view</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Individual teachers across the platform</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every teacher-role account (Teacher, Subject Teacher, Class Teacher), independent of school — useful for
          spotting the same person working across multiple tenants or for support that needs to reach a teacher
          directly rather than through a school admin.
        </p>
      </section>

      <FilterToolbar
        action="/super-admin/users?tab=teachers"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Name or email", defaultValue: params.search },
          { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: schoolOptions }
        ]}
      />

      <TableCard
        title="Teachers"
        description={`${envelope.pagination?.total ?? teachers.length} teacher account(s) found.`}
        items={teachers}
        columns={[
          { key: "name", header: "Name", render: (item) => item.name },
          { key: "email", header: "Email", render: (item) => item.email },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
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

async function SupportAccessTab() {
  const envelope = await apiGetEnvelope<SuperAdminImpersonationLogRow[]>("/api/super-admin/users/impersonation-log");
  const events = envelope.data ?? [];

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Accountability</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Support access log</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every time a Super Admin accesses the platform as a user (via &quot;Impersonate&quot; from that user&apos;s
          profile) to provide support, it is recorded here immutably — who accessed which account, why, and for how
          long the session token was valid.
        </p>
      </section>

      <TableCard
        title="Support access sessions"
        description="Most recent first."
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
    </div>
  );
}
