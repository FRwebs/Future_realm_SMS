import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerQuestionBankView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ClassOption = { id: string; fullName?: string; name: string; arm?: string | null };
type SubjectOption = { id: string; name: string; code?: string };
type ClassOptionsPayload = { data: ClassOption[] };

export default async function ExamOfficerQuestionBankPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer/question-bank"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [questions, classes, subjects] = await Promise.all([
    apiGet<ExamOfficerQuestionBankView[]>("/api/v1/exam-officer/question-bank"),
    apiGet<ClassOptionsPayload>("/api/v1/classes"),
    apiGet<SubjectOption[]>("/api/v1/academics/subjects"),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-eyebrow">Question bank</p>
            <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
              Build the moderated question pool
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
              Maintain exam-ready question drafts, keep difficulty balanced, and move approved items into the school’s assessment pipeline.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Add Question"
            title="Create question bank item"
            description="Add a new moderated question for the selected subject and class."
            endpoint="/api/v1/operations/question-bank"
            submitLabel="Save question"
            presentation="drawer"
            fields={[
              {
                name: "classId",
                label: "Class",
                type: "select",
                options: classes.data.map((item) => ({
                  label: item.fullName ?? [item.name, item.arm].filter(Boolean).join(" "),
                  value: item.id,
                })),
              },
              {
                name: "subjectId",
                label: "Subject",
                type: "select",
                required: true,
                options: subjects.map((item) => ({
                  label: item.code ? `${item.name} (${item.code})` : item.name,
                  value: item.id,
                })),
              },
              {
                name: "assessmentType",
                label: "Assessment type",
                type: "select",
                required: true,
                options: [
                  { label: "Examination", value: "EXAMINATION" },
                  { label: "Test", value: "TEST" },
                  { label: "Mock", value: "MOCK" },
                  { label: "Practical", value: "PRACTICAL" },
                ],
              },
              { name: "question", label: "Question", type: "textarea", required: true },
              { name: "answerGuide", label: "Answer guide", type: "textarea" },
              {
                name: "difficulty",
                label: "Difficulty",
                type: "select",
                required: true,
                defaultValue: "MEDIUM",
                options: [
                  { label: "Easy", value: "EASY" },
                  { label: "Medium", value: "MEDIUM" },
                  { label: "Hard", value: "HARD" },
                ],
              },
              {
                name: "status",
                label: "Status",
                type: "select",
                required: true,
                defaultValue: "DRAFT",
                options: [
                  { label: "Draft", value: "DRAFT" },
                  { label: "Submitted", value: "SUBMITTED" },
                ],
              },
            ]}
          />
        </div>
      </section>

      <TableCard
        title="Question bank inventory"
        description="The latest moderated question items available to exam and CBT workflows."
        items={questions}
        getRowKey={(item) => item.id}
        primaryColumnKey="questionPreview"
        featuredColumnKeys={["status"]}
        columns={[
          {
            key: "questionPreview",
            header: "Question",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.questionPreview}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.subject}{item.className ? ` · ${item.className}` : ""}</p>
              </div>
            ),
          },
          { key: "assessmentType", header: "Type", render: (item) => item.assessmentType },
          { key: "difficulty", header: "Difficulty", render: (item) => item.difficulty },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "teacherName", header: "Owner", render: (item) => item.teacherName ?? "Exam office" },
          { key: "createdAt", header: "Created", render: (item) => formatDate(item.createdAt) },
        ]}
      />
    </div>
  );
}
