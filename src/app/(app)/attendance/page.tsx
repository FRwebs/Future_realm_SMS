import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AttendanceRecordView, StudentRecordView } from "@/lib/domain/types";
import { attendanceStatusOptions, formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type AttendancePageProps = {
  searchParams?: Promise<{
    classId?: string;
    status?: string;
    search?: string;
  }>;
};

type AttendanceSummaryRecord = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percentage: number;
};

function attendanceTone(status: AttendanceRecordView["status"]) {
  if (status === "PRESENT") return "bg-emerald-100 text-emerald-800";
  if (status === "LATE") return "bg-amber-100 text-amber-800";
  if (status === "EXCUSED") return "bg-sky-100 text-sky-800";
  return "bg-rose-100 text-rose-800";
}

function percentageTone(value: number) {
  if (value >= 90) return "text-emerald-700";
  if (value >= 75) return "text-amber-700";
  return "text-rose-700";
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function weekdayLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short" }).format(new Date(value));
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/attendance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : { classId: "", status: "", search: "" };
  const classId = params.classId ?? "";
  const status = params.status ?? "";
  const search = params.search ?? "";

  const attendanceQuery = new URLSearchParams();
  const summaryQuery = new URLSearchParams();
  if (classId) {
    attendanceQuery.set("classId", classId);
    summaryQuery.set("classId", classId);
  }
  if (status) attendanceQuery.set("status", status);

  const [attendance, summary, students] = await Promise.all([
    apiGet<AttendanceRecordView[]>(`/api/v1/attendance${attendanceQuery.size ? `?${attendanceQuery.toString()}` : ""}`),
    apiGet<AttendanceSummaryRecord[]>(`/api/v1/attendance/summary${summaryQuery.size ? `?${summaryQuery.toString()}` : ""}`),
    apiGet<StudentRecordView[]>("/api/v1/students")
  ]);

  const filteredAttendance = attendance.filter(
    (record) =>
      !search ||
      [record.studentName, record.className, record.subject, record.markedByName]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const canManageAttendance = canManagePath(session.role, "/attendance");
  const presentish = filteredAttendance.filter((record) => ["PRESENT", "LATE", "EXCUSED"].includes(record.status)).length;
  const absent = filteredAttendance.filter((record) => record.status === "ABSENT").length;
  const calendarDays = Array.from(
    filteredAttendance.reduce((groups, record) => {
      const key = dateKey(record.date);
      groups.set(key, [...(groups.get(key) ?? []), record]);
      return groups;
    }, new Map<string, AttendanceRecordView[]>())
  )
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 21);
  const classOptions = [
    { label: "All classes", value: "" },
    ...Array.from(
      new Map(
        students
          .filter((student) => student.classId)
          .map((student) => [
            student.classId,
            { label: formatNigeriaClassName(student.className), value: student.classId ?? "" }
          ])
      ).values()
    ).sort((a, b) => a.label.localeCompare(b.label))
  ];
  const markClassOptions = classOptions.filter((option) => option.value);
  const studentOptions = [
    { label: "Select student", value: "" },
    ...students.map((student) => ({
      label: `${student.fullName} (${student.admissionNumber}, ${formatNigeriaClassName(student.className)})`,
      value: student.id
    }))
  ];
  const selectedClassLabel = classOptions.find((option) => option.value === classId)?.label ?? "All";

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Attendance</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Class attendance register</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Review Nigerian daily attendance by class, term, learner, and marked-by staff member. Records are loaded from the school database.
            </p>
          </div>
          {canManageAttendance ? (
            <ResourceActionDialog
              triggerLabel="Mark attendance"
              title="Morning attendance"
              description="Select an enrolled learner and save today's morning attendance status."
              endpoint="/api/v1/attendance"
              submitLabel="Save attendance"
              offlineKey="attendance-drafts"
              confirmLabel="Confirm Attendance"
              confirmMessage="Confirm the class, learner, date, and attendance status before saving."
              fields={[
                { name: "classId", label: "Class", type: "select", required: true, options: markClassOptions },
                { name: "studentId", label: "Student", type: "select", required: true, options: studentOptions },
                { name: "date", label: "Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
                { name: "status", label: "Status", type: "select", required: true, options: attendanceStatusOptions },
                { name: "reason", label: "Reason / note", type: "textarea", placeholder: "Optional late or absence note" }
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Class context</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{selectedClassLabel}</p>
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
        description="Switch class context quickly and review morning attendance without relying on placeholder data."
        activeSummary={[classId ? `Class: ${selectedClassLabel}` : "", status ? `Status: ${status}` : "", search ? `Search: ${search}` : ""].filter(Boolean)}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Student, class, subject", defaultValue: search },
          { name: "classId", label: "Class", type: "select", defaultValue: classId, options: classOptions },
          { name: "status", label: "Status", type: "select", defaultValue: status, options: [{ label: "All statuses", value: "" }, ...attendanceStatusOptions] }
        ]}
      />

      <TableCard
        title="Attendance summary report"
        description="Current-term morning attendance percentages, sorted from most at-risk learners upward."
        items={summary}
        emptyState={classId ? "No attendance summary exists for this class yet. Mark attendance to build the register." : "No attendance summary exists yet. Mark morning attendance to build the register."}
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.studentName}</p>
                <p className="text-xs text-ink/55">
                  {item.admissionNumber} · {formatNigeriaClassName(item.className)}
                </p>
              </div>
            )
          },
          { key: "totalDays", header: "Days", render: (item) => item.totalDays },
          { key: "present", header: "Present", render: (item) => item.present },
          { key: "late", header: "Late", render: (item) => item.late },
          { key: "absent", header: "Absent", render: (item) => item.absent },
          { key: "excused", header: "Excused", render: (item) => item.excused },
          {
            key: "percentage",
            header: "%",
            render: (item) => <span className={`font-bold ${percentageTone(item.percentage)}`}>{item.percentage}%</span>
          }
        ]}
      />

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Attendance calendar</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">
              Date and day-based scan of recent attendance records for the current filter.
            </p>
          </div>
          <p className="text-sm font-semibold text-ink/55">{calendarDays.length} day(s)</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {calendarDays.map(([day, records]) => {
            const counts = {
              PRESENT: records.filter((item) => item.status === "PRESENT").length,
              LATE: records.filter((item) => item.status === "LATE").length,
              EXCUSED: records.filter((item) => item.status === "EXCUSED").length,
              ABSENT: records.filter((item) => item.status === "ABSENT").length,
            };

            return (
              <article key={day} className="rounded-[1.5rem] border border-ink/8 bg-sand/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">{weekdayLabel(day)}</p>
                    <p className="mt-1 font-[var(--font-heading)] text-xl font-bold text-ink">{formatDate(day)}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/65">{records.length} mark(s)</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                  <span className="rounded-2xl bg-emerald-100 px-2 py-2 text-emerald-800">P {counts.PRESENT}</span>
                  <span className="rounded-2xl bg-amber-100 px-2 py-2 text-amber-800">L {counts.LATE}</span>
                  <span className="rounded-2xl bg-sky-100 px-2 py-2 text-sky-800">E {counts.EXCUSED}</span>
                  <span className="rounded-2xl bg-rose-100 px-2 py-2 text-rose-800">A {counts.ABSENT}</span>
                </div>
                <div className="mt-4 grid gap-2">
                  {records.slice(0, 4).map((record) => (
                    <div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3 py-2 text-xs">
                      <span className="truncate font-semibold text-ink">{record.studentName}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${attendanceTone(record.status)}`}>{record.status}</span>
                    </div>
                  ))}
                  {records.length > 4 ? <p className="text-xs font-semibold text-ink/45">+{records.length - 4} more record(s)</p> : null}
                </div>
              </article>
            );
          })}
          {calendarDays.length === 0 ? (
            <p className="rounded-2xl bg-sand/60 p-5 text-sm text-ink/65">No attendance records match the current filters.</p>
          ) : null}
        </div>
      </section>

      <TableCard
        title="Recent attendance"
        description="Daily attendance history for the selected class context and parent alert follow-up."
        items={filteredAttendance}
        emptyState="No attendance records match the current class or status filters."
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.studentName}</p>
                <p className="text-xs text-ink/55">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          {
            key: "status",
            header: "Status",
            render: (item) => <span className={`rounded-full px-3 py-1 text-xs font-semibold ${attendanceTone(item.status)}`}>{item.status}</span>
          },
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "markedBy", header: "Marked by", render: (item) => item.markedByName ?? "School staff" },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "None" }
        ]}
      />
    </div>
  );
}
