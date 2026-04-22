import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { BroadsheetView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const approvalStages = [
  "CLASS_TEACHER",
  "EXAM_OFFICER",
  "VICE_PRINCIPAL_ACADEMICS",
  "PRINCIPAL",
  "PUBLISHED"
] as const;

function SummaryCard({ label, value, tone = "ink" }: { label: string; value: string | number; tone?: "ink" | "brand" | "emerald" | "amber" }) {
  const toneClasses = {
    ink: "text-ink",
    brand: "text-brand-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700"
  };

  return (
    <article className="rounded-[1.5rem] border border-white/60 bg-white/90 p-5 shadow-sm">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-ink/45">{label}</p>
      <p className={`mt-3 font-[var(--font-heading)] text-3xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </article>
  );
}

function subjectCellSummary(subject: BroadsheetView["rows"][number]["subjects"][number]) {
  const componentLabel = (subject.components ?? [])
    .map((component) => `${component.code}: ${component.score ?? "-"}`)
    .join(" · ");

  return (
    <div className="min-w-[130px]">
      <p className="font-semibold text-ink">
        {subject.total} <span className="text-xs text-ink/55">({subject.grade})</span>
      </p>
      <p className="mt-1 text-xs text-ink/55">
        CA {subject.caTotal} · Exam {subject.examTotal}
      </p>
      {componentLabel ? <p className="mt-1 text-[0.68rem] text-ink/45">{componentLabel}</p> : null}
      {subject.position ? <p className="mt-1 text-[0.68rem] font-semibold text-brand-700">Subject pos. {subject.position}</p> : null}
      {subject.isComplete === false ? (
        <p className="mt-1 text-[0.68rem] font-semibold text-amber-700">
          Missing: {subject.missingComponents?.join(", ") || "components"}
        </p>
      ) : null}
    </div>
  );
}

export default async function BroadsheetDetailPage({ params }: { params: Promise<{ broadsheetId: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/broadsheets"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { broadsheetId } = await params;
  const [broadsheet, permissions] = await Promise.all([
    apiGet<BroadsheetView>(`/api/v1/academics/broadsheets/${broadsheetId}`),
    getServerPermissions(session),
  ]);

  const subjectColumns = Array.from(
    new Map(
      broadsheet.rows.flatMap((row) =>
        row.subjects.map((subject) => [
          subject.subjectId ?? subject.subject,
          { id: subject.subjectId ?? subject.subject, name: subject.subject, code: subject.subjectCode }
        ])
      )
    ).values()
  );

  const isAssignedClassTeacher = broadsheet.classTeacherId === session.userId;
  const canExport = permissions.includes("results.export");
  const canApprove = permissions.includes("results.approve") || isAssignedClassTeacher;
  const canPublish = permissions.includes("results.publish");
  const reviewOptions =
    broadsheet.status === "PUBLISHED"
      ? canPublish
        ? [{ label: "Unlock for correction", value: "UNLOCK" }]
        : []
      : [
          ...(canApprove ? [{ label: "Approve current stage", value: "APPROVE" }] : []),
          ...(canApprove ? [{ label: "Return for correction", value: "REQUEST_CORRECTION" }] : []),
          ...(canApprove && broadsheet.status !== "APPROVED" ? [{ label: "Reject review", value: "REJECT" }] : []),
          ...(canPublish && broadsheet.status === "APPROVED" ? [{ label: "Publish results", value: "PUBLISH" }] : [])
        ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={"/academics/results/broadsheets" as Route} className="text-sm font-semibold text-brand-700">Back to broadsheets</Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
              {broadsheet.term}
              {broadsheet.session ? ` · ${broadsheet.session}` : ""}
            </p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{broadsheet.className} broadsheet</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Canonical class result sheet for academic review, approval, publishing, export, and report-card readiness.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={broadsheet.status} />
              <StatusBadge status={broadsheet.approvalStage} tone="brand" />
              <span className="rounded-full border border-ink/10 bg-sand/70 px-3 py-1 text-xs font-semibold text-ink/70">
                Ranking {broadsheet.rankingEnabled ? "enabled" : "disabled"}
              </span>
              {broadsheet.classTeacherName ? (
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/70">
                  Class teacher: {broadsheet.classTeacherName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canExport ? (
              <>
                <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/pdf`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                  Export PDF
                </a>
                <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/excel`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                  Export Excel
                </a>
                <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/csv`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                  Export CSV
                </a>
              </>
            ) : null}
            {reviewOptions.length > 0 ? (
              <ResourceActionDialog
                triggerLabel="Workflow action"
                title="Broadsheet workflow"
                description="Advance, return, publish, or unlock the canonical class broadsheet with a fully audited workflow note."
                endpoint="/api/v1/academics/broadsheets/review"
                submitLabel="Save action"
                confirmLabel="Confirm action"
                fields={[
                  { name: "broadsheetId", label: "Broadsheet ID", required: true, defaultValue: broadsheet.id },
                  {
                    name: "action",
                    label: "Action",
                    type: "select",
                    required: true,
                    options: reviewOptions
                  },
                  { name: "note", label: "Workflow note", type: "textarea", placeholder: "Reason, review note, or correction instruction." }
                ]}
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Students" value={broadsheet.metrics?.studentCount ?? broadsheet.rows.length} />
        <SummaryCard label="Complete" value={broadsheet.metrics?.completeStudents ?? 0} tone="emerald" />
        <SummaryCard label="Incomplete" value={broadsheet.metrics?.incompleteStudents ?? 0} tone="amber" />
        <SummaryCard label="Class Mean" value={`${broadsheet.metrics?.classAverage ?? 0}%`} tone="brand" />
      </div>

      {broadsheet.missingScoreWarnings.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold">Data integrity flags</p>
          <p className="mt-2 text-amber-800/80">
            This broadsheet cannot move to approval or publication until the flagged missing scores or incomplete assessment components are resolved.
          </p>
          <div className="mt-4 grid gap-2">
            {broadsheet.missingScoreWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Approval timeline</p>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {approvalStages.map((stage) => {
            const latestApproval = broadsheet.approvals.find((approval) => approval.stage === stage);
            const active = broadsheet.approvalStage === stage;
            const complete = Boolean(latestApproval) || (stage === "PUBLISHED" && broadsheet.status === "PUBLISHED");

            return (
              <article key={stage} className={`rounded-[1.5rem] border p-4 ${active ? "border-brand-200 bg-brand-50" : complete ? "border-emerald-200 bg-emerald-50" : "border-ink/8 bg-sand/45"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">{stage.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{latestApproval?.actorName ?? (complete ? "Completed" : "Pending")}</p>
                <p className="mt-1 text-xs text-ink/55">
                  {latestApproval?.createdAt ? formatDate(latestApproval.createdAt) : latestApproval?.note ?? "Awaiting action"}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-panel">
        <div className="border-b border-ink/6 px-6 py-5">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Class broadsheet matrix</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Practical class review grid showing subject totals, grades, positions, completion flags, averages, and promotion decisions in one place.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
              <tr className="text-xs uppercase tracking-[0.22em] text-ink/40">
                <th className="whitespace-nowrap border-b border-ink/6 px-4 py-3 text-left font-semibold">Student</th>
                <th className="whitespace-nowrap border-b border-ink/6 px-4 py-3 text-left font-semibold">Admission No.</th>
                {subjectColumns.map((subject) => (
                  <th key={subject.id} className="whitespace-nowrap border-b border-ink/6 px-4 py-3 text-left font-semibold">
                    {subject.code ? `${subject.code} · ` : ""}{subject.name}
                  </th>
                ))}
                <th className="whitespace-nowrap border-b border-ink/6 px-4 py-3 text-left font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody>
              {broadsheet.rows.map((row) => (
                <tr key={row.studentId} className="align-top text-ink/80 odd:bg-sand/35">
                  <td className="border-b border-ink/6 px-4 py-4">
                    <p className="font-semibold text-ink">{row.studentName}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {row.totalSubjectsOffered ?? row.subjects.length} subjects · {row.completedSubjects ?? 0} complete
                    </p>
                    {row.isComplete === false ? (
                      <p className="mt-1 text-xs font-semibold text-amber-700">Incomplete record</p>
                    ) : null}
                  </td>
                  <td className="border-b border-ink/6 px-4 py-4 text-xs text-ink/60">{row.admissionNumber ?? "No admission number"}</td>
                  {subjectColumns.map((subject) => {
                    const subjectCell = row.subjects.find((item) => (item.subjectId ?? item.subject) === subject.id);
                    return (
                      <td key={`${row.studentId}-${subject.id}`} className="border-b border-ink/6 px-4 py-4">
                        {subjectCell ? subjectCellSummary(subjectCell) : <span className="text-xs text-ink/35">Not offered</span>}
                      </td>
                    );
                  })}
                  <td className="border-b border-ink/6 px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-ink">Total {row.total}</p>
                      <p className="mt-1 text-xs text-ink/55">Average {row.average}%</p>
                      <p className="mt-1 text-xs text-ink/55">Overall grade {row.overallGrade ?? "-"}</p>
                      <p className="mt-1 text-xs text-ink/55">Position {row.position ?? "-"}</p>
                      <p className="mt-1 text-xs text-ink/55">Attendance {row.attendance ?? "N/A"}</p>
                      <p className="mt-1 text-xs font-semibold text-brand-700">{row.promotionStatus ?? "Pending"}</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TableCard
        title="Approval history"
        description="Every compile, review, correction, approval, publish, and unlock action stays on record for accountability."
        items={broadsheet.approvals}
        columns={[
          { key: "actor", header: "Actor", render: (item) => item.actorName },
          { key: "stage", header: "Stage", render: (item) => item.stage.replaceAll("_", " ") },
          { key: "action", header: "Action", render: (item) => item.action.replaceAll("_", " ") },
          { key: "note", header: "Note", render: (item) => item.note ?? "No note" },
          { key: "date", header: "Date", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
