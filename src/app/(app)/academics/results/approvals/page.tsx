import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ResultApprovalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function ResultApprovalsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results") || session.role === "TEACHER") {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const approvals = await apiGet<ResultApprovalView[]>("/api/v1/academics/approval-queue");

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Approval queue</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            Review submitted score sheets, approve clean results, or return sheets for correction.
          </p>
        </section>
        <ResourceForm
          title="Approve score sheet"
          description="Use the Result Sheet ID from the queue to approve and optionally add a principal comment."
          endpoint="/api/v1/academics/score-sheets/approve"
          submitLabel="Approve"
          fields={[
            { name: "resultSheetId", label: "Result Sheet ID", required: true },
            { name: "principalComment", label: "Principal comment", type: "textarea", placeholder: "Optional principal remark" },
            { name: "note", label: "Approval note", type: "textarea", placeholder: "Internal approval note" }
          ]}
        />
        <ResourceForm
          title="Return for correction"
          description="Return a submitted sheet to the teacher or score officer with a clear note."
          endpoint="/api/v1/academics/score-sheets/reject"
          submitLabel="Return sheet"
          fields={[
            { name: "resultSheetId", label: "Result Sheet ID", required: true },
            { name: "note", label: "Correction note", type: "textarea", required: true }
          ]}
        />
      </div>

      <TableCard
        title="Pending workflow items"
        description="Submitted, under-review, approved, and returned result sheets."
        items={approvals}
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.studentName}</p>
                <p className="text-xs text-ink/55">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "id", header: "Sheet ID", render: (item) => item.resultSheetId },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "actor", header: "Last actor", render: (item) => item.actorName },
          { key: "date", header: "Updated", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
