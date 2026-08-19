import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { safeApiGet } from "@/lib/principal/portal";
import type {
  AdmissionApplicationView,
  DashboardSummary,
  PermissionGroupView,
  ResultApprovalView,
  SchoolRoleView
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ApprovalsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function tabHref(tab: string) {
  return tab === "queue" ? "/approvals" : `/approvals?tab=${tab}`;
}

const RESOLVED_RESULT_STATUSES = new Set(["APPROVED", "RETURNED"]);
const DECIDED_ADMISSION_STATUSES = new Set([
  "APPROVED",
  "CONDITIONALLY_APPROVED",
  "REJECTED",
  "WAITLISTED"
]);
const AWAITING_ADMISSION_STATUSES = new Set(["RECOMMENDED", "SCREENING_COMPLETED"]);

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/approvals"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [overview, resultApprovals, admissions, roleSummaries, permissionGroups] = await Promise.all([
    apiGet<DashboardSummary>("/api/v1/dashboard/overview"),
    safeApiGet<ResultApprovalView[]>("/api/v1/academics/approval-queue", []),
    safeApiGet<AdmissionApplicationView[]>("/api/v1/admissions", []),
    safeApiGet<SchoolRoleView[]>(`/api/v1/school/${session.schoolId}/roles-management/roles`, []),
    safeApiGet<PermissionGroupView[]>(`/api/v1/school/${session.schoolId}/roles-management/permissions`, [])
  ]);

  const roles = await Promise.all(
    roleSummaries.map((summary) =>
      safeApiGet<SchoolRoleView>(
        `/api/v1/school/${session.schoolId}/roles-management/roles/${summary.id}`,
        summary
      )
    )
  );

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "queue";

  const pendingResults = resultApprovals.filter((item) => !RESOLVED_RESULT_STATUSES.has(item.status));
  const resolvedResults = resultApprovals.filter((item) => RESOLVED_RESULT_STATUSES.has(item.status));
  const pendingAdmissions = admissions.filter((item) => AWAITING_ADMISSION_STATUSES.has(item.status));
  const decidedAdmissions = admissions.filter((item) => DECIDED_ADMISSION_STATUSES.has(item.status));
  const leadershipQueue = overview.pendingActions ?? [];

  const badgeCount = pendingResults.length + pendingAdmissions.length + leadershipQueue.length;

  const tabs = [
    { label: "Queue", href: tabHref("queue"), active: tab === "queue", badge: badgeCount || undefined },
    { label: "History", href: tabHref("history"), active: tab === "history" },
    { label: "Rules", href: tabHref("rules"), active: tab === "rules" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Approvals</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Approvals & Workflow Center</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Everything currently waiting on a decision — academic results, admissions, and leadership escalations — in one
          workspace, with a record of what has already been resolved.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "queue" ? (
        <QueueTab pendingResults={pendingResults} pendingAdmissions={pendingAdmissions} leadershipQueue={leadershipQueue} />
      ) : null}
      {tab === "history" ? <HistoryTab resolvedResults={resolvedResults} decidedAdmissions={decidedAdmissions} /> : null}
      {tab === "rules" ? <RulesTab roles={roles} permissionGroups={permissionGroups} /> : null}
    </div>
  );
}

function QueueTab({
  pendingResults,
  pendingAdmissions,
  leadershipQueue
}: {
  pendingResults: ResultApprovalView[];
  pendingAdmissions: AdmissionApplicationView[];
  leadershipQueue: DashboardSummary["pendingActions"];
}) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Academic queue</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{pendingResults.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Admission decisions</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{pendingAdmissions.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Leadership actions</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{(leadershipQueue ?? []).length}</p>
        </article>
      </section>

      <TableCard
        title="Academic approval queue"
        description="Result sheets submitted for review and not yet approved or returned."
        items={pendingResults}
        emptyState="No academic approvals are waiting right now."
        primaryColumnKey="student"
        featuredColumnKeys={["status"]}
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "student",
            header: "Student / Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.className}</p>
              </div>
            )
          },
          { key: "action", header: "Action", render: (item) => item.action },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "date", header: "Submitted", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="Admission decisions"
        description="Applications that have completed screening and are ready for a decision."
        items={pendingAdmissions}
        emptyState="No admission applications are waiting on a decision."
        primaryColumnKey="applicant"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "applicant",
            header: "Applicant",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.applicationNo} · {item.desiredClass}</p>
              </div>
            )
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "date", header: "Submitted", render: (item) => formatDate(item.submittedAt) }
        ]}
      />

      <TableCard
        title="Leadership action queue"
        description="Cross-functional escalations already surfaced on the school-wide dashboard."
        items={leadershipQueue ?? []}
        emptyState="Nothing is waiting in the leadership queue right now."
        primaryColumnKey="title"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "title",
            header: "Request",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.detail}</p>
              </div>
            )
          },
          { key: "tone", header: "Urgency", render: (item) => <StatusBadge status={item.tone.toUpperCase()} /> }
        ]}
      />
    </div>
  );
}

function HistoryTab({
  resolvedResults,
  decidedAdmissions
}: {
  resolvedResults: ResultApprovalView[];
  decidedAdmissions: AdmissionApplicationView[];
}) {
  return (
    <div className="grid gap-5">
      <TableCard
        title="Academic approval history"
        description="Result sheets that have already been approved or returned."
        items={resolvedResults}
        emptyState="No academic approvals have been resolved yet."
        primaryColumnKey="student"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "student",
            header: "Student / Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.className}</p>
              </div>
            )
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "actor", header: "Actioned by", render: (item) => item.actorName },
          { key: "date", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
      />

      <TableCard
        title="Admission decision history"
        description="Applications that already have a final or intermediate decision on file."
        items={decidedAdmissions}
        emptyState="No admission decisions have been recorded yet."
        primaryColumnKey="applicant"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "applicant",
            header: "Applicant",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.applicationNo} · {item.desiredClass}</p>
              </div>
            )
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "date", header: "Decided", render: (item) => (item.decidedAt ? formatDate(item.decidedAt) : "—") }
        ]}
      />
    </div>
  );
}

function RulesTab({ roles, permissionGroups }: { roles: SchoolRoleView[]; permissionGroups: PermissionGroupView[] }) {
  const labelByKey = new Map<string, string>();
  for (const group of permissionGroups) {
    for (const permission of group.permissions) {
      labelByKey.set(permission.key, permission.label);
    }
  }

  const approverRoles = roles
    .map((role) => ({
      role,
      approvalPermissions: (role.permissions ?? []).filter((key) => key.endsWith(".approve"))
    }))
    .filter((entry) => entry.approvalPermissions.length > 0);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">No configurable workflow engine yet</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Who can approve what, from your live role permissions</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          There is no separate approval-rules builder — approval authority is granted the same way as any other
          permission, through Staff → Permissions. This is a live read-out of which roles currently hold an approval
          permission.
        </p>
      </section>

      <div className="grid gap-3">
        {approverRoles.map(({ role, approvalPermissions }) => (
          <article key={role.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{role.name}</p>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {role.staffCount ?? 0} staff assigned
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {approvalPermissions.map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-[var(--color-accent-primary-dim)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-accent)]"
                >
                  {labelByKey.get(key) ?? key}
                </span>
              ))}
            </div>
          </article>
        ))}
        {approverRoles.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-secondary)]">No roles currently hold an approval permission.</p>
        ) : null}
      </div>
    </div>
  );
}
