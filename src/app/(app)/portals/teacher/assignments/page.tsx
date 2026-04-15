import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherAssignmentTaskView, TeacherClassPortalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherAssignmentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, tasks] = await Promise.all([
    apiGet<{ assignedClasses: TeacherClassPortalView[] }>("/api/v1/teacher-portal/dashboard"),
    apiGet<TeacherAssignmentTaskView[]>("/api/v1/teacher-portal/tasks")
  ]);
  const classOptions = [
    { label: "Select class", value: "" },
    ...portal.assignedClasses.map((item) => ({ label: `${formatNigeriaClassName(item.className)} / ${item.subject}`, value: item.classId ?? "" }))
  ];
  const subjectOptions = [
    { label: "Select subject", value: "" },
    ...portal.assignedClasses.map((item) => ({ label: `${item.subject} (${formatNigeriaClassName(item.className)})`, value: item.subjectId ?? "" }))
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Assignments</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            Create class-specific assignments and study tasks for the subjects assigned to you.
          </p>
        </section>
        <ResourceForm
          title="Create assignment"
          description="Publish a learning task with due date and optional material link."
          endpoint="/api/v1/teacher-portal/tasks"
          submitLabel="Create assignment"
          fields={[
            { name: "classId", label: "Class", type: "select", required: true, options: classOptions },
            { name: "subjectId", label: "Subject", type: "select", required: true, options: subjectOptions },
            { name: "title", label: "Title", required: true, placeholder: "Algebra revision worksheet" },
            { name: "dueAt", label: "Due date", type: "date", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              required: true,
              options: [
                { label: "Publish now", value: "PUBLISHED" },
                { label: "Save draft", value: "DRAFT" },
                { label: "Closed", value: "CLOSED" }
              ]
            },
            { name: "attachmentUrl", label: "Attachment URL", placeholder: "https://..." },
            { name: "description", label: "Instructions", type: "textarea", placeholder: "Task details and submission instructions" }
          ]}
        />
      </div>

      <TableCard
        title="Learning tasks"
        description="Assignments created by you with submission counts."
        items={tasks}
        columns={[
          {
            key: "title",
            header: "Task",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-ink/55">{formatNigeriaClassName(item.className)} / {item.subject}</p>
              </div>
            )
          },
          { key: "dueAt", header: "Due", render: (item) => formatDate(item.dueAt) },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "submissions", header: "Submissions", render: (item) => item.submissionsCount }
        ]}
      />
    </div>
  );
}
