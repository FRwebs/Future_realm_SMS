import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AcademicAssessmentView, AssessmentCandidateView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function AssessmentWorkspacePage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { assessmentId } = await params;
  const assessment = await apiGet<AcademicAssessmentView>(`/api/v1/academics/academic-assessments/${assessmentId}`);
  const canManageScores = canManagePath(session.role, "/academics/results");
  const scoreTemplate = JSON.stringify(
    (assessment.candidates ?? []).map((candidate) => ({
      studentId: candidate.studentId,
      score: candidate.score ?? 0,
      attendanceState: candidate.attendanceState,
      scoreFlag: candidate.scoreFlag,
      comment: candidate.comment ?? ""
    })),
    null,
    2
  );

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(250,245,235,0.96))] p-6 md:p-8">
          <Link href={"/academics/results/assessments" as Route} className="text-sm font-semibold text-brand-700">Back to assessments</Link>
          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
                {assessment.term}{assessment.session ? ` · ${assessment.session}` : ""}
              </p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{assessment.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
                {assessment.className} · {assessment.subject} · {assessment.assessmentType.replaceAll("_", " ")} · {formatDate(assessment.assessmentDate)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={assessment.status} />
              {canManageScores ? (
                <ResourceActionDialog
                  triggerLabel="Enter bulk scores"
                  title="Bulk score entry"
                  description="Paste or edit the generated candidate score JSON. Each score is still validated server-side against the assessment max score and class membership."
                  endpoint="/api/v1/academics/academic-assessments/scores"
                  submitLabel="Save scores"
                  confirmLabel="Confirm score entry"
                  confirmMessage="Scores will be audited with your user account and may move the assessment to marked when complete."
                  fields={[
                    { name: "assessmentId", label: "Assessment ID", required: true, defaultValue: assessment.id },
                    { name: "scores", label: "Candidate scores JSON", type: "textarea", required: true, defaultValue: scoreTemplate, parse: "json" }
                  ]}
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-4 border-t border-ink/6 p-6 md:grid-cols-4 md:p-8">
          {[
            ["Candidates", assessment.candidateCount],
            ["Scores entered", assessment.enteredCount],
            ["Max score", assessment.maxScore],
            ["Weight", `${assessment.weight}%`]
          ].map(([label, value]) => (
            <article key={label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{value}</p>
            </article>
          ))}
        </div>
      </section>

      <TableCard<AssessmentCandidateView>
        title="Candidate score sheet"
        description="Bulk score entry is optimized for teacher/exam officer workflows, with attendance state and score flags retained per learner."
        items={assessment.candidates ?? []}
        emptyState="No candidates have been generated yet. Use the assessment setup action to generate the class candidate list."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <Link className="font-semibold text-brand-700" href={`/students/${item.studentId}` as Route}>{item.studentName}</Link>
                <p className="text-xs text-ink/55">{item.admissionNumber ?? "No admission number"}</p>
              </div>
            )
          },
          { key: "attendance", header: "Attendance", render: (item) => <StatusBadge status={item.attendanceState} /> },
          { key: "score", header: "Score", render: (item) => item.score ?? "Not entered" },
          { key: "flag", header: "Flag", render: (item) => <StatusBadge status={item.scoreFlag} /> },
          { key: "entered", header: "Entered by", render: (item) => item.enteredBy ?? "Pending" },
          { key: "comment", header: "Comment", render: (item) => item.comment ?? "No comment" }
        ]}
      />
    </div>
  );
}
