import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { BroadsheetRowView, BroadsheetView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const approvalStages = [
  "SUBJECT_TEACHER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER",
  "EXAM_OFFICER",
  "VICE_PRINCIPAL_ACADEMICS",
  "PRINCIPAL",
  "PUBLISHED"
];

export default async function BroadsheetDetailPage({ params }: { params: Promise<{ broadsheetId: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results") || ["TEACHER", "SUBJECT_TEACHER"].includes(session.role)) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { broadsheetId } = await params;
  const broadsheet = await apiGet<BroadsheetView>(`/api/v1/academics/broadsheets/${broadsheetId}`);
  const canManage = canManagePath(session.role, "/academics/results") && !["TEACHER", "SUBJECT_TEACHER"].includes(session.role);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={"/academics/results/broadsheets" as Route} className="text-sm font-semibold text-brand-700">Back to broadsheets</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">{broadsheet.term}{broadsheet.session ? ` · ${broadsheet.session}` : ""}</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{broadsheet.className} broadsheet</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={broadsheet.status} />
              <StatusBadge status={broadsheet.approvalStage} tone="brand" />
              <span className="rounded-full border border-ink/10 bg-sand/70 px-3 py-1 text-xs font-semibold text-ink/70">
                Ranking {broadsheet.rankingEnabled ? "enabled" : "disabled"}
              </span>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-3">
              <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/pdf`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                Export PDF
              </a>
              <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/excel`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                Export Excel
              </a>
              <a href={`/api/v1/reports/broadsheet/${broadsheet.id}/csv`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                Export CSV
              </a>
              <a href={`/academics/results/broadsheets/${broadsheet.id}?print=1`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm">
                Print view
              </a>
              <ResourceActionDialog
                triggerLabel="Review action"
                title="Review broadsheet"
                description="Approve, request correction, reject, publish, or unlock this broadsheet with an audit note."
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
                    options: [
                      { label: "Approve", value: "APPROVE" },
                      { label: "Request correction", value: "REQUEST_CORRECTION" },
                      { label: "Reject", value: "REJECT" },
                      { label: "Publish", value: "PUBLISH" },
                      { label: "Unlock", value: "UNLOCK" }
                    ]
                  },
                  { name: "note", label: "Audit note", type: "textarea", placeholder: "Reason or review note" }
                ]}
              />
            </div>
          ) : null}
        </div>
      </section>

      {broadsheet.missingScoreWarnings.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold">Missing-score warnings</p>
          <div className="mt-3 grid gap-2">
            {broadsheet.missingScoreWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Approval timeline</p>
        <div className="mt-5 grid gap-3 md:grid-cols-7">
          {approvalStages.map((stage) => {
            const latestApproval = broadsheet.approvals.find((approval) => approval.stage === stage);
            const active = broadsheet.approvalStage === stage;
            const complete = Boolean(latestApproval) || stage === "PUBLISHED" && broadsheet.status === "PUBLISHED";
            return (
              <article key={stage} className={`rounded-[1.5rem] border p-4 ${active ? "border-brand-200 bg-brand-50" : complete ? "border-emerald-200 bg-emerald-50" : "border-ink/8 bg-sand/45"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">{stage.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{latestApproval?.actorName ?? (complete ? "Completed" : "Pending")}</p>
                <p className="mt-1 text-xs text-ink/55">{latestApproval?.createdAt ? formatDate(latestApproval.createdAt) : latestApproval?.note ?? "Awaiting action"}</p>
              </article>
            );
          })}
        </div>
      </section>

      <TableCard<BroadsheetRowView>
        title="Class broadsheet"
        description="Nigerian-style class summary with CA, exam, total, average, grade, position, remarks, and promotion status."
        items={broadsheet.rows}
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.studentName}</p>
                <p className="text-xs text-ink/55">{item.admissionNumber ?? "No admission number"}</p>
                <Link className="mt-2 inline-flex text-xs font-semibold text-brand-700" href={`/students/${item.studentId}` as Route}>Open result profile</Link>
              </div>
            )
          },
          { key: "subjects", header: "Subjects", render: (item) => item.subjects.map((subject) => `${subject.subject}: CA ${subject.caTotal}, Exam ${subject.examTotal}, Total ${subject.total} (${subject.grade})`).join(" · ") },
          { key: "total", header: "Total", render: (item) => <span className="font-bold text-ink">{item.total}</span> },
          { key: "average", header: "Average", render: (item) => <span className="font-bold text-brand-800">{item.average}%</span> },
          { key: "position", header: "Position", render: (item) => item.position ?? "Off" },
          { key: "promotion", header: "Promotion", render: (item) => item.promotionStatus ?? "Pending" }
        ]}
      />

      <TableCard
        title="Approval history"
        description="Every moderation decision is retained for accountability."
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
