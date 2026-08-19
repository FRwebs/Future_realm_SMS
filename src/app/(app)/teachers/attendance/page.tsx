import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { NigeriaOperationsDashboardView, StaffClockView } from "@/lib/domain/types";
import { staffAttendanceStatusOptions } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function StaffAttendancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/teachers/attendance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [attendance, dashboard] = await Promise.all([
    apiGet<StaffClockView[]>("/api/v1/nigeria-operations/staff-attendance"),
    apiGet<NigeriaOperationsDashboardView>("/api/v1/nigeria-operations/dashboard")
  ]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">People & Staffing</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Teacher Attendance</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Track resumption time, closing time, lateness, official duty, leave, and manual corrections for staff.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Resumption</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{dashboard.staffAttendance.policy.resumptionTime}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Late today</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{dashboard.staffAttendance.lateToday}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Marked today</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{dashboard.staffAttendance.totalMarkedToday}</p>
          </article>
        </div>
      </section>

      <section className="flex flex-wrap gap-3 surface-card p-5">
        <ResourceActionDialog
          triggerLabel="Edit attendance policy"
          title="Attendance policy"
          description="Set the Nigerian school-day resumption and closing time used for lateness calculations."
          endpoint="/api/v1/nigeria-operations/staff-attendance/policy"
          method="PUT"
          submitLabel="Save policy"
          confirmLabel="Confirm Policy"
          confirmMessage="Confirm this resumption/closing policy before applying it to staff attendance."
          fields={[
            { name: "resumptionTime", label: "Resumption time", required: true, defaultValue: dashboard.staffAttendance.policy.resumptionTime },
            { name: "closingTime", label: "Closing time", required: true, defaultValue: dashboard.staffAttendance.policy.closingTime },
            { name: "graceMinutes", label: "Grace minutes", type: "number", required: true, min: 0, max: 120, defaultValue: dashboard.staffAttendance.policy.graceMinutes },
            { name: "timezone", label: "Timezone", required: true, defaultValue: dashboard.staffAttendance.policy.timezone }
          ]}
        />
        <ResourceActionDialog
          triggerLabel="Attendance correction"
          title="Manual attendance correction"
          description="Authorized correction path for HR/admin when a teacher is on leave, official duty, or missed clock-out."
          endpoint="/api/v1/nigeria-operations/staff-attendance/manual"
          submitLabel="Save correction"
          confirmLabel="Confirm Correction"
          confirmMessage="Confirm the staff member, date, status, and correction note before saving this audit-sensitive action."
          variant="secondary"
          fields={[
            { name: "userId", label: "Teacher user ID", required: true },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "status", label: "Status", type: "select", options: staffAttendanceStatusOptions },
            { name: "checkInAt", label: "Clock-in timestamp", placeholder: "2026-04-13T07:42:00.000Z" },
            { name: "checkOutAt", label: "Clock-out timestamp", placeholder: "2026-04-13T15:35:00.000Z" },
            { name: "notes", label: "Correction note", type: "textarea" }
          ]}
        />
      </section>

      <TableCard
        title="Staff attendance register"
        description="Recent teacher and staff clock records."
        items={attendance}
        columns={[
          { key: "teacher", header: "Teacher", render: (item) => item.teacherName },
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "status", header: "Status", render: (item) => item.status.replaceAll("_", " ") },
          { key: "in", header: "Clock in", render: (item) => (item.checkInAt ? formatDate(item.checkInAt) : "-") },
          { key: "out", header: "Clock out", render: (item) => (item.checkOutAt ? formatDate(item.checkOutAt) : "-") },
          { key: "hours", header: "Hours", render: (item) => (item.totalMinutes ? (item.totalMinutes / 60).toFixed(1) : "-") }
        ]}
        emptyState="No staff attendance records have been captured yet."
      />
    </div>
  );
}
