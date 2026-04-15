import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherAttendanceEntryView, TeacherClassPortalView, TeacherClassStudentView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherAttendancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, attendance] = await Promise.all([
    apiGet<{ assignedClasses: TeacherClassPortalView[]; students?: TeacherClassStudentView[] }>("/api/v1/teacher-portal/dashboard"),
    apiGet<TeacherAttendanceEntryView[]>("/api/v1/teacher-portal/attendance")
  ]);
  const classSubjectOptions = [
    { label: "Select class", value: "" },
    ...portal.assignedClasses.map((item) => ({
      label: `${formatNigeriaClassName(item.className)} / ${item.subject}`,
      value: item.classId ?? ""
    }))
  ];
  const subjectOptions = [
    { label: "Select subject", value: "" },
    ...portal.assignedClasses.map((item) => ({
      label: `${item.subject} (${formatNigeriaClassName(item.className)})`,
      value: item.subjectId ?? ""
    }))
  ];
  const studentOptions = [
    { label: "Select student", value: "" },
    ...(portal.students ?? []).map((item) => ({
      label: `${item.studentName} (${formatNigeriaClassName(item.className)})`,
      value: item.studentId
    }))
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Attendance</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            Mark only students in classes and subjects assigned to you. Offline drafts are kept on this device until synced.
          </p>
        </section>
        <ResourceForm
          title="Mark attendance"
          description="Select the assigned class, subject, learner, and daily attendance status."
          endpoint="/api/v1/teacher-portal/attendance"
          submitLabel="Save attendance"
          offlineKey="teacher-attendance-drafts"
          fields={[
            { name: "classId", label: "Class", type: "select", required: true, options: classSubjectOptions },
            { name: "subjectId", label: "Subject", type: "select", required: true, options: subjectOptions },
            { name: "studentId", label: "Student", type: "select", required: true, options: studentOptions },
            { name: "date", label: "Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { label: "Present", value: "PRESENT" },
                { label: "Late", value: "LATE" },
                { label: "Absent", value: "ABSENT" },
                { label: "Excused", value: "EXCUSED" }
              ]
            },
            { name: "reason", label: "Reason / note", type: "textarea", placeholder: "Optional absence or lateness note" }
          ]}
        />
      </div>

      <TableCard
        title="Attendance history"
        description="Recent attendance records submitted from your teacher account."
        items={attendance}
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.studentName}</p>
                <p className="text-xs text-ink/55">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "subject", header: "Subject", render: (item) => item.subject ?? "-" },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "None" }
        ]}
      />
    </div>
  );
}
