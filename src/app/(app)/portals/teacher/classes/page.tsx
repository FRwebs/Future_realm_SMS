import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherClassPortalView, TeacherClassStudentView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function TeacherClassesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const portal = await apiGet<{
    assignedClasses: TeacherClassPortalView[];
    students?: TeacherClassStudentView[];
  }>("/api/v1/teacher-portal/dashboard");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My classes and subjects</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Only class and subject assignments linked to your teacher account are shown here.
        </p>
      </section>

      <TableCard
        title="Assigned teaching load"
        description="Classes, subjects, learners, and the next operational action."
        items={portal.assignedClasses}
        columns={[
          {
            key: "class",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{formatNigeriaClassName(item.className)}</p>
                <p className="text-xs text-ink/55">{item.subject}</p>
              </div>
            )
          },
          { key: "learners", header: "Learners", render: (item) => item.learners },
          { key: "pendingScores", header: "Pending scores", render: (item) => item.pendingScores },
          { key: "nextAction", header: "Next action", render: (item) => item.nextAction }
        ]}
      />

      <TableCard
        title="Student list"
        description="Basic learner identifiers needed for attendance and score entry."
        items={portal.students ?? []}
        columns={[
          { key: "studentName", header: "Student", render: (item) => item.studentName },
          { key: "admissionNumber", header: "Admission no.", render: (item) => item.admissionNumber },
          { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "studentId", header: "Student ID", render: (item) => item.studentId }
        ]}
      />
    </div>
  );
}
