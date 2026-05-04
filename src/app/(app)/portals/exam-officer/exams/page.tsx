import Link from "next/link";
import { CalendarDays, FileCheck, Send } from "lucide-react";

import { StatusBadge } from "@/components/data-display/status-badge";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerExamView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ClassOption = { id: string; fullName?: string; name: string; arm?: string | null };
type SubjectOption = { id: string; name: string; code?: string };
type ClassOptionsPayload = { data: ClassOption[] };

export default async function ExamOfficerExamsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer/exams"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [exams, classes, subjects] = await Promise.all([
    apiGet<ExamOfficerExamView[]>("/api/v1/exam-officer/exams"),
    apiGet<ClassOptionsPayload>("/api/v1/classes"),
    apiGet<SubjectOption[]>("/api/v1/academics/subjects"),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-eyebrow">All exams</p>
            <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
              Exam register and release pipeline
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
              Create exam papers, track score completion, and jump directly into
              marking and publication workflows from one controlled surface.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Create Exam"
            title="Create examination paper"
            description="Open a new exam record and auto-generate candidates for the selected class and subject."
            endpoint="/api/v1/academics/academic-assessments"
            submitLabel="Create exam"
            presentation="drawer"
            fields={[
              { name: "title", label: "Exam title", required: true },
              {
                name: "classId",
                label: "Class",
                type: "select",
                required: true,
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
                label: "Type",
                type: "select",
                required: true,
                defaultValue: "EXAMINATION",
                options: [{ label: "Examination", value: "EXAMINATION" }],
              },
              { name: "maxScore", label: "Max score", type: "number", required: true, defaultValue: 100, min: 1, max: 100 },
              { name: "weight", label: "Weight", type: "number", required: true, defaultValue: 100, min: 0, max: 100 },
              { name: "assessmentDate", label: "Exam date", type: "date", required: true },
              {
                name: "submissionMode",
                label: "Submission mode",
                type: "select",
                required: true,
                defaultValue: "PAPER",
                options: [
                  { label: "Paper", value: "PAPER" },
                  { label: "CBT", value: "CBT" },
                  { label: "Practical", value: "PRACTICAL" },
                  { label: "Oral", value: "ORAL" },
                ],
              },
              {
                name: "status",
                label: "Initial status",
                type: "select",
                required: true,
                defaultValue: "DRAFT",
                options: [
                  { label: "Draft", value: "DRAFT" },
                  { label: "Active", value: "ACTIVE" },
                ],
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {exams.map((exam) => (
          <article key={exam.id} className="surface-card flex flex-col gap-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                  {exam.term} · {exam.session}
                </p>
                <h2 className="mt-2 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-text-primary)]">
                  {exam.title}
                </h2>
                <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
                  {exam.subject} · {exam.className}
                </p>
              </div>
              <StatusBadge status={exam.status} />
            </div>

            <div className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Score completion
                  </p>
                  <p className="mt-1 font-[var(--font-mono)] text-[18px] font-semibold text-[var(--color-text-primary)]">
                    {exam.enteredCount}/{exam.candidateCount}
                  </p>
                </div>
                <p className="font-[var(--font-display)] text-[24px] font-black text-[var(--color-text-accent)]">
                  {exam.completionRate}%
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent-primary)]"
                  style={{ width: `${exam.completionRate}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 text-[13px] text-[var(--color-text-secondary)] sm:grid-cols-2">
              <div className="rounded-[1rem] bg-[var(--color-bg-subtle)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Date</p>
                <p className="mt-1 font-medium text-[var(--color-text-primary)]">{formatDate(exam.assessmentDate)}</p>
              </div>
              <div className="rounded-[1rem] bg-[var(--color-bg-subtle)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Mode</p>
                <p className="mt-1 font-medium text-[var(--color-text-primary)]">{exam.submissionMode}</p>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={`/academics/results/assessment-format/${exam.id}`} className="btn-primary px-4">
                <Send className="h-4 w-4" />
                Open score sheet
              </Link>
              <Link href="/portals/exam-officer/timetable" className="btn-secondary px-4">
                <CalendarDays className="h-4 w-4" />
                Timetable
              </Link>
              <Link href="/portals/exam-officer/score-entry-status" className="btn-secondary px-4">
                <FileCheck className="h-4 w-4" />
                Status
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
