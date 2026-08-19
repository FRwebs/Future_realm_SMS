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
    ink: "text-[var(--color-text-primary)]",
    brand: "text-[var(--color-text-accent)]",
    emerald: "text-[var(--color-success)]",
    amber: "text-[var(--color-warning)]"
  };

  return (
    <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-2 text-[22px] font-bold ${toneClasses[tone]}`}>{value}</p>
    </article>
  );
}

function subjectCellSummary(subject: BroadsheetView["rows"][number]["subjects"][number]) {
  const componentLabel = (subject.components ?? [])
    .map((component) => `${component.code}: ${component.score ?? "-"}`)
    .join(" · ");

  return (
    <div className="min-w-[130px]">
      <p className="font-semibold text-[var(--color-text-primary)]">
        {subject.total} <span className="text-xs text-[var(--color-text-muted)]">({subject.grade})</span>
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        CA {subject.caTotal} · Exam {subject.examTotal}
      </p>
      {componentLabel ? <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{componentLabel}</p> : null}
      {subject.position ? <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-accent)]">Subject pos. {subject.position}</p> : null}
      {subject.isComplete === false ? (
        <p className="mt-1 text-[11px] font-semibold text-[var(--color-warning)]">
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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/academics/results/broadsheets" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to broadsheets</Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="section-eyebrow">
              {broadsheet.term}
              {broadsheet.session ? ` · ${broadsheet.session}` : ""}
            </p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{broadsheet.className} broadsheet</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Canonical class result sheet for academic review, approval, publishing, export, and report-card readiness.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={broadsheet.status} />
              <StatusBadge status={broadsheet.approvalStage} tone="brand" />
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Ranking {broadsheet.rankingEnabled ? "enabled" : "disabled"}
              </span>
              {broadsheet.classTeacherName ? (
                <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                  Class teacher: {broadsheet.classTeacherName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canExport ? (
              <>
                <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/pdf`} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]">
                  Export PDF
                </a>
                <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/excel`} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]">
                  Export Excel
                </a>
                <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/csv`} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]">
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
        <section className="surface-card p-6 text-sm" style={{ borderColor: "var(--color-warning)", background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>
          <p className="font-semibold">Data integrity flags</p>
          <p className="mt-2 opacity-80">
            This broadsheet cannot move to approval or publication until the flagged missing scores or incomplete assessment components are resolved.
          </p>
          <div className="mt-4 grid gap-2">
            {broadsheet.missingScoreWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface-card p-6">
        <p className="section-eyebrow">Approval timeline</p>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {approvalStages.map((stage) => {
            const latestApproval = broadsheet.approvals.find((approval) => approval.stage === stage);
            const active = broadsheet.approvalStage === stage;
            const complete = Boolean(latestApproval) || (stage === "PUBLISHED" && broadsheet.status === "PUBLISHED");
            const stageStyle = active
              ? { borderColor: "var(--color-accent-primary)", background: "var(--color-accent-primary-dim)" }
              : complete
                ? { borderColor: "var(--color-success)", background: "var(--color-success-dim)" }
                : { borderColor: "var(--color-border-default)", background: "var(--color-bg-subtle)" };

            return (
              <article key={stage} className="rounded-[10px] border p-4" style={stageStyle}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{stage.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{latestApproval?.actorName ?? (complete ? "Completed" : "Pending")}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {latestApproval?.createdAt ? formatDate(latestApproval.createdAt) : latestApproval?.note ?? "Awaiting action"}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-[var(--color-border-default)] px-6 py-5">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Class broadsheet matrix</h2>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Practical class review grid showing subject totals, grades, positions, completion flags, averages, and promotion decisions in one place.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
              <tr className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <th className="whitespace-nowrap border-b border-[var(--color-border-default)] px-4 py-3 text-left font-bold">Student</th>
                <th className="whitespace-nowrap border-b border-[var(--color-border-default)] px-4 py-3 text-left font-bold">Admission No.</th>
                {subjectColumns.map((subject) => (
                  <th key={subject.id} className="whitespace-nowrap border-b border-[var(--color-border-default)] px-4 py-3 text-left font-bold">
                    {subject.code ? `${subject.code} · ` : ""}{subject.name}
                  </th>
                ))}
                <th className="whitespace-nowrap border-b border-[var(--color-border-default)] px-4 py-3 text-left font-bold">Summary</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--color-bg-surface)]">
              {broadsheet.rows.map((row) => (
                <tr key={row.studentId} className="align-top text-[var(--color-text-secondary)] odd:bg-[var(--color-bg-subtle)]">
                  <td className="border-b border-[var(--color-border-default)] px-4 py-4">
                    <p className="font-semibold text-[var(--color-text-primary)]">{row.studentName}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {row.totalSubjectsOffered ?? row.subjects.length} subjects · {row.completedSubjects ?? 0} complete
                    </p>
                    {row.isComplete === false ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--color-warning)]">Incomplete record</p>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--color-border-default)] px-4 py-4 text-xs text-[var(--color-text-muted)]">{row.admissionNumber ?? "No admission number"}</td>
                  {subjectColumns.map((subject) => {
                    const subjectCell = row.subjects.find((item) => (item.subjectId ?? item.subject) === subject.id);
                    return (
                      <td key={`${row.studentId}-${subject.id}`} className="border-b border-[var(--color-border-default)] px-4 py-4">
                        {subjectCell ? subjectCellSummary(subjectCell) : <span className="text-xs text-[var(--color-text-muted)]">Not offered</span>}
                      </td>
                    );
                  })}
                  <td className="border-b border-[var(--color-border-default)] px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-[var(--color-text-primary)]">Total {row.total}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Average {row.average}%</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Overall grade {row.overallGrade ?? "-"}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Position {row.position ?? "-"}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Attendance {row.attendance ?? "N/A"}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--color-text-accent)]">{row.promotionStatus ?? "Pending"}</p>
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
