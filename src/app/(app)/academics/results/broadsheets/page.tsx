import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { BroadsheetView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function BroadsheetsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results") || ["TEACHER", "SUBJECT_TEACHER"].includes(session.role)) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const broadsheets = await apiGet<BroadsheetView[]>("/api/v1/academics/broadsheets");
  const canManage = canManagePath(session.role, "/academics/results") && !["TEACHER", "SUBJECT_TEACHER"].includes(session.role);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Exam office workspace</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">Broadsheet compilation</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Compile Nigerian-style class broadsheets, surface missing-score warnings, track moderation stages, and generate report-card records.
            </p>
          </div>
          {canManage ? (
            <ResourceActionDialog
              triggerLabel="Compile broadsheet"
              title="Compile broadsheet"
              description="Use a class ID from class management to compile a term broadsheet and generate report-card records."
              endpoint="/api/v1/academics/broadsheets/compile"
              submitLabel="Compile"
              confirmLabel="Confirm compilation"
              confirmMessage="Compilation will fail with visible warnings if required subject scores are missing."
              fields={[
                { name: "classId", label: "Class ID", required: true, placeholder: "class_jss2_gold" },
                { name: "termId", label: "Term ID", placeholder: "Optional current term ID" },
                { name: "rankingEnabled", label: "Ranking enabled", type: "select", options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] }
              ]}
            />
          ) : null}
        </div>
      </section>

      <TableCard
        title="Class broadsheets"
        description="Approval stage follows Subject Teacher, HOD, Class Teacher, Exam Officer, VP Academics, and Principal final approval."
        items={broadsheets}
        columns={[
          {
            key: "class",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.className}</p>
                <p className="text-xs text-ink/55">{item.term}{item.session ? ` · ${item.session}` : ""}</p>
              </div>
            )
          },
          { key: "stage", header: "Stage", render: (item) => <StatusBadge status={item.approvalStage} tone="brand" /> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "students", header: "Students", render: (item) => item.rows.length },
          { key: "warnings", header: "Warnings", render: (item) => item.missingScoreWarnings.length },
          { key: "published", header: "Published", render: (item) => item.publishedAt ? formatDate(item.publishedAt) : "Not published" },
          {
            key: "open",
            header: "Workspace",
            render: (item) => (
              <Link className="font-semibold text-brand-700" href={`/academics/results/broadsheets/${item.id}` as Route}>
                Open
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
