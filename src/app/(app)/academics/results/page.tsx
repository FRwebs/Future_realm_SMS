import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { GradeRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName, nigerianClassFieldOptions } from "@/lib/school-options";

const resultWorkspaceLinks = [
  ["Assessments", "/academics/results/assessments"],
  ["Subjects", "/academics/subjects"],
  ["Settings", "/academics/results/settings"],
  ["Approvals", "/academics/results/approvals"],
  ["Broadsheets", "/academics/results/broadsheets"],
  ["Publish", "/academics/results/publish"],
  ["Analytics", "/academics/results/analytics"],
  ["History", "/academics/results/history"],
  ["Report cards", "/academics/results/report-cards"]
] as const;

export default async function ResultsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const grades = await apiGet<GradeRecordView[]>("/api/v1/academics/grades");
  const canManageGrades = canManagePath(session.role, "/academics/results");

  return (
    <div className="grid gap-6">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Result workflow</h3>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Manage grading schemes, component setup, approval, publication, analytics, report cards, and history from the same module.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {canManageGrades ? (
              <>
                <ResourceActionDialog
                  triggerLabel="Save score draft"
                  title="Draft score entry"
                  description="Capture CA and exam scores as drafts with offline support. Teachers are server-scoped to assigned subjects."
                  endpoint="/api/v1/academics/grades"
                  submitLabel="Save draft"
                  offlineKey="grade-drafts"
                  fields={[
                    { name: "studentName", label: "Student name", required: true, placeholder: "Daniel Yusuf" },
                    { name: "className", label: "Class", type: "select", required: true, options: nigerianClassFieldOptions },
                    { name: "subject", label: "Subject", required: true, placeholder: "Mathematics" },
                    { name: "continuousAssessment", label: "Continuous assessment", type: "number", required: true, min: 0, max: 40 },
                    { name: "exam", label: "Exam score", type: "number", required: true, min: 0, max: 60 },
                    { name: "teacherComment", label: "Teacher comment", type: "textarea", placeholder: "Optional class teacher or subject remark" }
                  ]}
                />
                <ResourceActionDialog
                  triggerLabel="Submit score sheet"
                  title="Submit score sheet"
                  description="Submit a completed score sheet into the approval workflow immediately."
                  endpoint="/api/v1/academics/grades/submit"
                  submitLabel="Save and submit"
                  confirmLabel="Submit scores"
                  confirmMessage="Submitted scores move into the result approval workflow."
                  fields={[
                    { name: "studentName", label: "Student name", required: true, placeholder: "Daniel Yusuf" },
                    { name: "className", label: "Class", type: "select", required: true, options: nigerianClassFieldOptions },
                    { name: "subject", label: "Subject", required: true, placeholder: "Mathematics" },
                    { name: "continuousAssessment", label: "Continuous assessment", type: "number", required: true, min: 0, max: 40 },
                    { name: "exam", label: "Exam score", type: "number", required: true, min: 0, max: 60 },
                    { name: "teacherComment", label: "Teacher comment", type: "textarea", placeholder: "Optional remark before review" }
                  ]}
                  variant="secondary"
                />
              </>
            ) : null}
            {resultWorkspaceLinks.filter(([, href]) => canAccessPath(session.role, href)).map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                {label}
              </a>
            ))}
          </div>
        </section>
      </div>
      <TableCard
        title="Assessment board"
        description="Recent subject entries with computed grades and class performance view."
        items={grades}
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
          { key: "ca", header: "CA", render: (item) => item.continuousAssessment },
          { key: "exam", header: "Exam", render: (item) => item.exam },
          {
            key: "total",
            header: "Total / Grade",
            render: (item) => (
              <div>
                <p>{item.total}</p>
                <p className="text-xs text-ink/55">{item.grade} {item.remark ? `- ${item.remark}` : ""}</p>
              </div>
            )
          },
          { key: "status", header: "Status", render: (item) => item.status ?? "DRAFT" },
          { key: "published", header: "Published", render: (item) => (item.published ? "Yes" : "No") }
        ]}
      />
    </div>
  );
}
