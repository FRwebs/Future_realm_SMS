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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">People & Staffing</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Teacher Attendance</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Track resumption time, closing time, lateness, official duty, leave, and manual corrections for staff.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Resumption</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{dashboard.staffAttendance.policy.resumptionTime}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Late today</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{dashboard.staffAttendance.lateToday}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Marked today</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{dashboard.staffAttendance.totalMarkedToday}</p>
          </article>
        </div>
      </section>

      <section className="flex flex-wrap gap-3 rounded-[2rem] border border-white/50 bg-white/90 p-5 shadow-panel">
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
