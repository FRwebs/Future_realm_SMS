import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherClassPortalView, TeacherClassStudentView, TeacherScoreEntryView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function TeacherScoresPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, scores] = await Promise.all([
    apiGet<{ assignedClasses: TeacherClassPortalView[]; students?: TeacherClassStudentView[] }>("/api/v1/teacher-portal/dashboard"),
    apiGet<TeacherScoreEntryView[]>("/api/v1/teacher-portal/scores")
  ]);
  const classOptions = [
    { label: "Select class", value: "" },
    ...portal.assignedClasses.map((item) => ({ label: `${formatNigeriaClassName(item.className)} / ${item.subject}`, value: item.classId ?? "" }))
  ];
  const subjectOptions = [
    { label: "Select subject", value: "" },
    ...portal.assignedClasses.map((item) => ({ label: `${item.subject} (${formatNigeriaClassName(item.className)})`, value: item.subjectId ?? "" }))
  ];
  const studentOptions = [
    { label: "Select student", value: "" },
    ...(portal.students ?? []).map((item) => ({ label: `${item.studentName} (${formatNigeriaClassName(item.className)})`, value: item.studentId }))
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Score entry</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            Save CA and exam scores for assigned subjects only. Published result sheets remain locked.
          </p>
        </section>
        <ResourceForm
          title="Enter assessment scores"
          description="Continuous assessment is capped at 40 and exam score is capped at 60."
          endpoint="/api/v1/teacher-portal/scores"
          submitLabel="Save score"
          offlineKey="teacher-score-drafts"
          fields={[
            { name: "classId", label: "Class", type: "select", required: true, options: classOptions },
            { name: "subjectId", label: "Subject", type: "select", required: true, options: subjectOptions },
            { name: "studentId", label: "Student", type: "select", required: true, options: studentOptions },
            { name: "continuousAssessment", label: "Continuous assessment", type: "number", required: true, min: 0, max: 40 },
            { name: "exam", label: "Exam", type: "number", required: true, min: 0, max: 60 },
            { name: "teacherComment", label: "Teacher comment", type: "textarea", placeholder: "Optional report comment" }
          ]}
        />
      </div>

      <TableCard
        title="Score sheets"
        description="Subject score entries created from your account."
        items={scores}
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
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "ca", header: "CA", render: (item) => item.continuousAssessment },
          { key: "exam", header: "Exam", render: (item) => item.exam },
          {
            key: "total",
            header: "Total / Grade",
            render: (item) => (
              <div>
                <p>{item.total}</p>
                <p className="text-xs text-ink/55">{item.grade}</p>
              </div>
            )
          },
          { key: "published", header: "Locked", render: (item) => (item.published ? "Yes" : "No") }
        ]}
      />
    </div>
  );
}
