import { DetailTabs } from "@/components/data-display/detail-tabs";
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
    tab?: string;
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
  if (status === "PRESENT") return { background: "var(--color-success-dim)", color: "var(--color-success)" };
  if (status === "LATE") return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  if (status === "EXCUSED") return { background: "var(--color-info-dim)", color: "var(--color-info)" };
  return { background: "var(--color-danger-dim)", color: "var(--color-danger)" };
}

function percentageColor(value: number) {
  if (value >= 90) return "var(--color-success)";
  if (value >= 75) return "var(--color-warning)";
  return "var(--color-danger)";
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function weekdayLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short" }).format(new Date(value));
}

function tabHref(tab: string) {
  return tab === "mark" ? "/attendance" : `/attendance?tab=${tab}`;
}

async function loadContext(classId: string, status: string) {
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

  const classOptions = [
    { label: "All classes", value: "" },
    ...Array.from(
      new Map(
        students
          .filter((student) => student.classId)
          .map((student) => [student.classId, { label: formatNigeriaClassName(student.className), value: student.classId ?? "" }])
      ).values()
    ).sort((a, b) => a.label.localeCompare(b.label))
  ];

  return { attendance, summary, students, classOptions };
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/attendance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "mark";
  const classId = params.classId ?? "";
  const status = params.status ?? "";
  const search = params.search ?? "";
  const canManageAttendance = canManagePath(session.role, "/attendance");

  const tabs = [
    { label: "Mark Attendance", href: tabHref("mark"), active: tab === "mark" },
    { label: "Compliance", href: tabHref("compliance"), active: tab === "compliance" },
    { label: "Register & Escalations", href: tabHref("register"), active: tab === "register" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Attendance</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Attendance Management</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Mark daily attendance in seconds, track compliance percentages, and review the register for escalation
              follow-up — all from the live school database.
            </p>
          </div>
          {canManageAttendance ? <MarkAttendanceAction /> : null}
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "mark" ? <MarkTab classId={classId} status={status} search={search} /> : null}
      {tab === "compliance" ? <ComplianceTab classId={classId} /> : null}
      {tab === "register" ? <RegisterTab classId={classId} status={status} search={search} /> : null}
    </div>
  );
}

async function MarkAttendanceAction() {
  const students = await apiGet<StudentRecordView[]>("/api/v1/students");
  const markClassOptions = Array.from(
    new Map(
      students
        .filter((student) => student.classId)
        .map((student) => [student.classId, { label: formatNigeriaClassName(student.className), value: student.classId ?? "" }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));
  const studentOptions = [
    { label: "Select student", value: "" },
    ...students.map((student) => ({
      label: `${student.fullName} (${student.admissionNumber}, ${formatNigeriaClassName(student.className)})`,
      value: student.id
    }))
  ];

  return (
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
  );
}

async function MarkTab({ classId, status, search }: { classId: string; status: string; search: string }) {
  const { attendance, classOptions } = await loadContext(classId, status);
  const filtered = attendance.filter(
    (record) =>
      !search ||
      [record.studentName, record.className, record.subject, record.markedByName].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = filtered.filter((record) => dateKey(record.date) === today);
  const selectedClassLabel = classOptions.find((option) => option.value === classId)?.label ?? "All";

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Class context</p>
          <p className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">{selectedClassLabel}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Marked today</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{todayRecords.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Absent today</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: "var(--color-danger)" }}>
            {todayRecords.filter((r) => r.status === "ABSENT").length}
          </p>
        </article>
      </section>

      <FilterToolbar
        action="/attendance"
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Student, class, subject", defaultValue: search },
          { name: "classId", label: "Class", type: "select", defaultValue: classId, options: classOptions },
          { name: "status", label: "Status", type: "select", defaultValue: status, options: [{ label: "All statuses", value: "" }, ...attendanceStatusOptions] }
        ]}
      />

      <TableCard
        title="Today's attendance"
        description="Attendance marked so far today for the selected class context."
        items={todayRecords}
        emptyState="No attendance marked for today yet."
        columns={[
          { key: "studentName", header: "Student", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p><p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}</p></div> },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full px-3 py-1 text-xs font-semibold" style={attendanceTone(item.status)}>{item.status}</span> },
          { key: "markedBy", header: "Marked by", render: (item) => item.markedByName ?? "School staff" }
        ]}
      />
    </div>
  );
}

async function ComplianceTab({ classId }: { classId: string }) {
  const { summary, classOptions } = await loadContext(classId, "");
  const selectedClassLabel = classOptions.find((option) => option.value === classId)?.label ?? "All";
  const belowThreshold = summary.filter((item) => item.percentage < 75).length;
  const averagePct = summary.length ? Math.round(summary.reduce((sum, item) => sum + item.percentage, 0) / summary.length) : 0;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Class context</p>
          <p className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">{selectedClassLabel}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Average attendance</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: percentageColor(averagePct) }}>{averagePct}%</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Below 75% compliance</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: "var(--color-danger)" }}>{belowThreshold}</p>
        </article>
      </section>

      <TableCard
        title="Attendance compliance report"
        description="Current-term morning attendance percentages, sorted from most at-risk learners upward."
        items={summary}
        emptyState={classId ? "No attendance summary exists for this class yet. Mark attendance to build the register." : "No attendance summary exists yet. Mark morning attendance to build the register."}
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.admissionNumber} · {formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "totalDays", header: "Days", render: (item) => item.totalDays },
          { key: "present", header: "Present", render: (item) => item.present },
          { key: "late", header: "Late", render: (item) => item.late },
          { key: "absent", header: "Absent", render: (item) => item.absent },
          { key: "excused", header: "Excused", render: (item) => item.excused },
          { key: "percentage", header: "%", render: (item) => <span className="font-bold" style={{ color: percentageColor(item.percentage) }}>{item.percentage}%</span> }
        ]}
      />
    </div>
  );
}

async function RegisterTab({ classId, status, search }: { classId: string; status: string; search: string }) {
  const { attendance } = await loadContext(classId, status);
  const filtered = attendance.filter(
    (record) =>
      !search ||
      [record.studentName, record.className, record.subject, record.markedByName].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const calendarDays = Array.from(
    filtered.reduce((groups, record) => {
      const key = dateKey(record.date);
      groups.set(key, [...(groups.get(key) ?? []), record]);
      return groups;
    }, new Map<string, AttendanceRecordView[]>())
  )
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 21);
  const escalations = filtered.filter((record) => record.status === "ABSENT" && !record.reason);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-eyebrow">Register</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Attendance calendar</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Date and day-based scan of recent attendance records for the current filter.</p>
          </div>
          <p className="text-[13px] font-semibold text-[var(--color-text-muted)]">{calendarDays.length} day(s)</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {calendarDays.map(([day, records]) => {
            const counts = {
              PRESENT: records.filter((item) => item.status === "PRESENT").length,
              LATE: records.filter((item) => item.status === "LATE").length,
              EXCUSED: records.filter((item) => item.status === "EXCUSED").length,
              ABSENT: records.filter((item) => item.status === "ABSENT").length
            };

            return (
              <article key={day} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="section-eyebrow">{weekdayLabel(day)}</p>
                    <p className="mt-1 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{formatDate(day)}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-muted)]">{records.length} mark(s)</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
                  <span className="rounded-[8px] px-2 py-1.5" style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}>P {counts.PRESENT}</span>
                  <span className="rounded-[8px] px-2 py-1.5" style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>L {counts.LATE}</span>
                  <span className="rounded-[8px] px-2 py-1.5" style={{ background: "var(--color-info-dim)", color: "var(--color-info)" }}>E {counts.EXCUSED}</span>
                  <span className="rounded-[8px] px-2 py-1.5" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>A {counts.ABSENT}</span>
                </div>
                <div className="mt-3 grid gap-1.5">
                  {records.slice(0, 4).map((record) => (
                    <div key={record.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--color-bg-surface)] px-3 py-2 text-[11px]">
                      <span className="truncate font-semibold text-[var(--color-text-primary)]">{record.studentName}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 font-semibold" style={attendanceTone(record.status)}>{record.status}</span>
                    </div>
                  ))}
                  {records.length > 4 ? <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">+{records.length - 4} more record(s)</p> : null}
                </div>
              </article>
            );
          })}
          {calendarDays.length === 0 ? (
            <p className="rounded-[10px] bg-[var(--color-bg-subtle)] p-5 text-[13px] text-[var(--color-text-secondary)]">No attendance records match the current filters.</p>
          ) : null}
        </div>
      </section>

      {escalations.length > 0 ? (
        <section className="rounded-[10px] px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>
          {escalations.length} unexplained absence(s) with no reason recorded — follow up with the guardian.
        </section>
      ) : null}

      <TableCard
        title="Recent attendance"
        description="Daily attendance history for the selected class context and parent alert follow-up."
        items={filtered}
        emptyState="No attendance records match the current class or status filters."
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full px-3 py-1 text-xs font-semibold" style={attendanceTone(item.status)}>{item.status}</span> },
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "markedBy", header: "Marked by", render: (item) => item.markedByName ?? "School staff" },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "None" }
        ]}
      />
    </div>
  );
}
