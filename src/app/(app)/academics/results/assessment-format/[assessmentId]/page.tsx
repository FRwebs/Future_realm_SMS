import Link from "next/link";
import type { Route } from "next";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AcademicAssessmentView, AssessmentCandidateView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-panel">
      <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
      <div className="p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ink/45">{label}</p>
        <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-ink">{value}</p>
        <p className="mt-2 text-sm leading-6 text-ink/60">{note}</p>
      </div>
    </article>
  );
}

export default async function AssessmentFormatWorkspacePage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/assessment-format"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { assessmentId } = await params;
  const [assessment, permissions] = await Promise.all([
    apiGet<AcademicAssessmentView>(`/api/v1/academics/academic-assessments/${assessmentId}`),
    getServerPermissions(session),
  ]);
  const canManageScores =
    canManagePath(session.role, "/academics/results") ||
    permissions.some((permission) => ["results.create", "results.edit"].includes(permission));
  const scoreTemplate = JSON.stringify(
    (assessment.candidates ?? []).map((candidate) => ({
      studentId: candidate.studentId,
      score: candidate.score ?? 0,
      attendanceState: candidate.attendanceState,
      scoreFlag: candidate.scoreFlag,
      comment: candidate.comment ?? "",
    })),
    null,
    2,
  );

  const completionRate =
    assessment.candidateCount === 0 ? 0 : Math.round((assessment.enteredCount / assessment.candidateCount) * 100);
  const pendingCandidates = (assessment.candidates ?? []).filter((candidate) => candidate.score == null).length;
  const flaggedCandidates = (assessment.candidates ?? []).filter((candidate) => candidate.scoreFlag !== "NONE").length;
  const attendanceExceptions = (assessment.candidates ?? []).filter((candidate) => candidate.attendanceState !== "PRESENT").length;
  const highlightCandidates = (assessment.candidates ?? [])
    .filter((candidate) => candidate.score == null || candidate.scoreFlag !== "NONE" || candidate.attendanceState !== "PRESENT")
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="h-2 bg-gradient-to-r from-brand-800 via-emerald-500 to-ink" />
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(238,247,241,0.96),rgba(250,245,235,0.95))] p-6 md:p-8">
          <Link href={"/academics/results/assessment-format" as Route} className="text-sm font-semibold text-brand-700">
            Back to assessment format
          </Link>
          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
                {assessment.term}
                {assessment.session ? ` · ${assessment.session}` : ""}
              </p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">{assessment.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
                {assessment.className} · {assessment.subject} · {assessment.assessmentType.replaceAll("_", " ")} ·{" "}
                {formatDate(assessment.assessmentDate)}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                  {completionRate}% completion
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  {assessment.enteredCount}/{assessment.candidateCount} scores entered
                </span>
                {flaggedCandidates > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    {flaggedCandidates} flagged cases
                  </span>
                ) : null}
              </div>
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
                    { name: "scores", label: "Candidate scores JSON", type: "textarea", required: true, defaultValue: scoreTemplate, parse: "json" },
                  ]}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <DetailTabs
        tabs={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Candidates", href: "#candidates" },
          { label: "Risk review", href: "#risk-review" },
        ]}
      />

      <section id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Candidates" value={assessment.candidateCount} note="Automatically generated from the class candidate list." />
        <SummaryCard label="Scores entered" value={assessment.enteredCount} note="Learners with marks already captured for this assessment." />
        <SummaryCard label="Pending entry" value={pendingCandidates} note="Candidates still waiting for score capture or review." />
        <SummaryCard label="Weight / max score" value={`${assessment.weight}% / ${assessment.maxScore}`} note="Contribution of this assessment to final broadsheet totals." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Score-entry pulse</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">Premium snapshot before you edit</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              See completion, pending learners, and attendance exceptions before opening bulk score entry.
            </p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-sand">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand-700 via-emerald-500 to-emerald-400"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ink/45">Pending</p>
                <p className="mt-3 text-2xl font-black text-ink">{pendingCandidates}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ink/45">Flags</p>
                <p className="mt-3 text-2xl font-black text-ink">{flaggedCandidates}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ink/45">Attendance exceptions</p>
                <p className="mt-3 text-2xl font-black text-ink">{attendanceExceptions}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="risk-review" className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-amber via-brand-700 to-emerald-500" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Risk review</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">Learners who still need attention</h2>
            <div className="mt-5 grid gap-3">
              {highlightCandidates.length === 0 ? (
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  This assessment workspace is clean right now. No missing scores, flags, or attendance exceptions were found.
                </div>
              ) : (
                highlightCandidates.map((candidate) => (
                  <article key={candidate.id} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                    <p className="font-semibold text-ink">{candidate.studentName}</p>
                    <p className="mt-1 text-xs text-ink/55">{candidate.admissionNumber ?? "No admission number"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.score == null ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          Score pending
                        </span>
                      ) : null}
                      {candidate.scoreFlag !== "NONE" ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          {candidate.scoreFlag.replaceAll("_", " ")}
                        </span>
                      ) : null}
                      {candidate.attendanceState !== "PRESENT" ? (
                        <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                          {candidate.attendanceState.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      <div id="candidates">
        <TableCard<AssessmentCandidateView>
          title="Candidate score sheet"
          description="This score-entry workspace stays inside Assessment Format so teachers and exam officers can inspect every learner, bulk update marks, and resolve exceptions from one place."
          items={assessment.candidates ?? []}
          emptyState="No candidates have been generated yet. Use the assessment setup action to generate the class candidate list."
          columns={[
            {
              key: "student",
              header: "Student",
              render: (item) => (
                <div>
                  <Link className="font-semibold text-brand-700" href={`/students/${item.studentId}` as Route}>
                    {item.studentName}
                  </Link>
                  <p className="text-xs text-ink/55">{item.admissionNumber ?? "No admission number"}</p>
                </div>
              ),
            },
            { key: "attendance", header: "Attendance", render: (item) => <StatusBadge status={item.attendanceState} /> },
            { key: "score", header: "Score", render: (item) => item.score ?? "Not entered" },
            { key: "flag", header: "Flag", render: (item) => <StatusBadge status={item.scoreFlag} /> },
            { key: "entered", header: "Entered by", render: (item) => item.enteredBy ?? "Pending" },
            { key: "comment", header: "Comment", render: (item) => item.comment ?? "No comment" },
          ]}
        />
      </div>
    </div>
  );
}
