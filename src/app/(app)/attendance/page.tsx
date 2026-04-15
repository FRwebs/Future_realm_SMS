import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { AttendanceRecordView } from "@/lib/domain/types";
import {
  attendanceStatusOptions,
  formatNigeriaClassName,
  getNigeriaClassLabel,
  nigerianClassFieldOptions,
  nigerianClassOptions,
  normalizeNigeriaClassValue
} from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type AttendancePageProps = {
  searchParams?: Promise<{
    className?: string;
    status?: string;
    search?: string;
  }>;
};

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/attendance")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [attendance, params] = await Promise.all([
    apiGet<AttendanceRecordView[]>("/api/v1/attendance"),
    searchParams ? searchParams : Promise.resolve({ className: "", status: "", search: "" })
  ]);
  const className = normalizeNigeriaClassValue(params.className) ?? "";
  const classNameLabel = className ? getNigeriaClassLabel(className) : "";
  const status = params.status ?? "";
  const search = params.search ?? "";
  const filteredAttendance = attendance.filter((record) =>
    (!className || normalizeNigeriaClassValue(record.className) === className) &&
    (!status || record.status === status) &&
    (!search || [record.studentName, record.className, record.subject].join(" ").toLowerCase().includes(search.toLowerCase()))
  );
  const canManageAttendance = canManagePath(session.role, "/attendance");
  const presentish = filteredAttendance.filter((record) => ["PRESENT", "LATE", "EXCUSED"].includes(record.status)).length;
  const absent = filteredAttendance.filter((record) => record.status === "ABSENT").length;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Attendance</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Class attendance register</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Select JSS/SSS class context first, then mark or review records for the right learners, subject, and staff workflow.
            </p>
          </div>
          {canManageAttendance ? (
            <ResourceActionDialog
              triggerLabel="Save attendance"
              title="Attendance capture"
              description="Mark class attendance quickly, save drafts offline when needed, and sync later."
              endpoint="/api/v1/attendance"
              submitLabel="Save attendance"
              offlineKey="attendance-drafts"
              confirmLabel="Confirm Attendance"
              confirmMessage="Confirm the class, learner, and attendance status before saving."
              fields={[
                { name: "studentName", label: "Student name", required: true, placeholder: "Daniel Yusuf" },
                { name: "className", label: "Class", type: "select", required: true, options: nigerianClassFieldOptions },
                { name: "subject", label: "Subject", required: true, placeholder: "Mathematics" },
                { name: "status", label: "Status", type: "select", options: attendanceStatusOptions },
                { name: "reason", label: "Reason / note", type: "textarea", placeholder: "Optional late or absence note" }
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Class context</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{classNameLabel || "All"}</p>
        </article>
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Present / late / excused</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{presentish}</p>
        </article>
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Absent</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{absent}</p>
        </article>
      </section>

      <FilterToolbar
        action="/attendance"
        title="Class-aware attendance filters"
        description="Switch class context quickly. Teachers see allowed actions through their role-specific pages; admins can use broader class filtering here."
        activeSummary={[classNameLabel ? `Class: ${classNameLabel}` : "", status ? `Status: ${status}` : "", search ? `Search: ${search}` : ""].filter(Boolean)}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Student, class, subject", defaultValue: search },
          { name: "className", label: "Class", type: "select", defaultValue: className, options: nigerianClassOptions },
          { name: "status", label: "Status", type: "select", defaultValue: status, options: [{ label: "All statuses", value: "" }, ...attendanceStatusOptions] }
        ]}
      />

      <TableCard
        title="Recent attendance"
        description="Daily attendance history for the selected class context and parent alert follow-up."
        items={filteredAttendance}
        emptyState="No attendance records match the current class or status filters."
        columns={[
          { key: "studentName", header: "Student", render: (item) => <div><p className="font-semibold text-ink">{item.studentName}</p><p className="text-xs text-ink/55">{formatNigeriaClassName(item.className)}</p></div> },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "None" }
        ]}
      />
    </div>
  );
}
