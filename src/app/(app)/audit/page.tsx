import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { safeApiGet } from "@/lib/principal/portal";
import type {
  AuditLogView,
  DashboardSummary,
  PermissionGroupView,
  SchoolRoleView,
  StudentRecordView,
  TeacherRecordView
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type AuditPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function tabHref(tab: string) {
  return tab === "log" ? "/audit" : `/audit?tab=${tab}`;
}

const ELEVATED_PERMISSION_KEYS = new Set([
  "roles.assign",
  "roles.edit",
  "roles.delete",
  "roles.create",
  "audit_logs.view"
]);

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/audit"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [overview, financeAuditLogs, students, teachers, roleSummaries, permissionGroups] = await Promise.all([
    apiGet<DashboardSummary>("/api/v1/dashboard/overview"),
    safeApiGet<AuditLogView[]>("/api/v1/bursary/audit-logs", []),
    safeApiGet<StudentRecordView[]>("/api/v1/students", []),
    safeApiGet<TeacherRecordView[]>("/api/v1/teachers", []),
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
  const tab = params.tab ?? "log";

  const tabs = [
    { label: "Log", href: tabHref("log"), active: tab === "log" },
    { label: "Security", href: tabHref("security"), active: tab === "security" },
    { label: "Integrity", href: tabHref("integrity"), active: tab === "integrity" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Audit</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Audit Log, Security & Data Integrity</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every recorded financial change, who currently holds elevated administrative access, and where school
          records need cleanup.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "log" ? <LogTab financeAuditLogs={financeAuditLogs} overview={overview} /> : null}
      {tab === "security" ? <SecurityTab roles={roles} permissionGroups={permissionGroups} /> : null}
      {tab === "integrity" ? <IntegrityTab students={students} teachers={teachers} /> : null}
    </div>
  );
}

function LogTab({
  financeAuditLogs,
  overview
}: {
  financeAuditLogs: AuditLogView[];
  overview: DashboardSummary;
}) {
  const recentActivity = overview.recentActivity ?? [];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Financial change events</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{financeAuditLogs.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Recent account activity</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{recentActivity.length}</p>
        </article>
      </section>

      <TableCard
        title="Financial audit trail"
        description="Every create, edit, and approval action recorded against fees, invoices, and payments."
        items={financeAuditLogs}
        emptyState="No financial audit events have been recorded yet."
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "action",
            header: "Action",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.action}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.entityType}</p>
              </div>
            )
          },
          { key: "actor", header: "By", render: (item) => item.userName ?? "System" },
          { key: "detail", header: "Detail", render: (item) => item.detail ?? "—" },
          { key: "when", header: "When", render: (item) => formatDate(item.timestamp) }
        ]}
      />

      <TableCard
        title="Recent account activity"
        description="Logins and system events surfaced on the school-wide dashboard feed."
        items={recentActivity}
        emptyState="No recent account activity to show."
        getRowKey={(item, index) => `${item.id}-${index}`}
        columns={[
          {
            key: "event",
            header: "Event",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.detail}</p>
              </div>
            )
          },
          { key: "category", header: "Category", render: (item) => item.category },
          { key: "when", header: "When", render: (item) => item.time }
        ]}
      />
    </div>
  );
}

function SecurityTab({ roles, permissionGroups }: { roles: SchoolRoleView[]; permissionGroups: PermissionGroupView[] }) {
  const labelByKey = new Map<string, string>();
  for (const group of permissionGroups) {
    for (const permission of group.permissions) {
      labelByKey.set(permission.key, permission.label);
    }
  }

  const elevatedRoles = roles
    .map((role) => ({
      role,
      elevatedPermissions: (role.permissions ?? []).filter((key) => ELEVATED_PERMISSION_KEYS.has(key))
    }))
    .filter((entry) => entry.elevatedPermissions.length > 0);

  const totalElevatedStaff = elevatedRoles.reduce((sum, entry) => sum + (entry.role.staffCount ?? 0), 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Roles with elevated access</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{elevatedRoles.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Staff with elevated access</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{totalElevatedStaff}</p>
        </article>
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">No dedicated security console yet</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Who can manage roles, permissions, and audit history</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          There is no separate security-settings module — access is governed by role permissions, managed from
          Staff → Permissions. This is a live read-out of which roles can assign roles, edit permissions, or view
          audit logs.
        </p>
      </section>

      <div className="grid gap-3">
        {elevatedRoles.map(({ role, elevatedPermissions }) => (
          <article key={role.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{role.name}</p>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {role.staffCount ?? 0} staff assigned
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {elevatedPermissions.map((key) => (
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
        {elevatedRoles.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-secondary)]">No roles currently hold an elevated administrative permission.</p>
        ) : null}
      </div>
    </div>
  );
}

function IntegrityTab({ students, teachers }: { students: StudentRecordView[]; teachers: TeacherRecordView[] }) {
  const noClass = students.filter((student) => !student.className);
  const noGuardian = students.filter((student) => !student.guardianName);
  const admissionGroups = new Map<string, StudentRecordView[]>();
  for (const student of students) {
    admissionGroups.set(student.admissionNumber, [...(admissionGroups.get(student.admissionNumber) ?? []), student]);
  }
  const duplicateAdmissions = Array.from(admissionGroups.entries()).filter(([, group]) => group.length > 1);
  const staffNoEmail = teachers.filter((teacher) => !teacher.email);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">No class assigned</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: noClass.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>{noClass.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">No guardian on file</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: noGuardian.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>{noGuardian.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Duplicate admission numbers</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: duplicateAdmissions.length > 0 ? "var(--color-danger)" : "var(--color-success)" }}>{duplicateAdmissions.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Staff with no email</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: staffNoEmail.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>{staffNoEmail.length}</p>
        </article>
      </section>

      {duplicateAdmissions.length > 0 ? (
        <TableCard
          title="Duplicate admission numbers"
          description="More than one student record shares the same admission number — likely a data-entry error."
          items={duplicateAdmissions.map(([admissionNumber, group]) => ({ admissionNumber, group }))}
          getRowKey={(item) => item.admissionNumber}
          columns={[
            { key: "admissionNumber", header: "Admission No.", render: (item) => item.admissionNumber },
            { key: "students", header: "Students", render: (item) => item.group.map((s) => s.fullName).join(", ") }
          ]}
        />
      ) : null}

      <TableCard
        title="Students with no class assigned"
        description="These students will not appear correctly in class-scoped attendance, scores, or timetable views."
        items={noClass}
        emptyState="Every student currently has a class assigned."
        getRowKey={(item) => item.id}
        columns={[
          { key: "student", header: "Student", render: (item) => item.fullName },
          { key: "admission", header: "Admission No.", render: (item) => item.admissionNumber }
        ]}
      />

      <TableCard
        title="Staff with no email on file"
        description="These staff cannot receive system notifications or reset their password by email."
        items={staffNoEmail}
        emptyState="Every staff record currently has an email on file."
        getRowKey={(item) => item.id}
        columns={[
          { key: "staff", header: "Staff", render: (item) => item.fullName },
          { key: "designation", header: "Designation", render: (item) => item.designation }
        ]}
      />
    </div>
  );
}
