import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { GradeRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function PublishResultsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results/publish") || session.role === "TEACHER") {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const grades = await apiGet<GradeRecordView[]>("/api/v1/academics/grades");

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Compile and publish results</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            Compile averages/positions, publish approved sheets, or unpublish through a controlled audit path.
          </p>
        </section>
        <ResourceForm
          title="Compile results"
          description="Recalculate totals, averages, grade bands, and positions for the active term or selected class."
          endpoint="/api/v1/academics/compile"
          submitLabel="Compile"
          fields={[
            { name: "classId", label: "Class ID", placeholder: "Optional class ID" },
            { name: "termId", label: "Term ID", placeholder: "Optional term ID" }
          ]}
        />
        <ResourceForm
          title="Publish approved results"
          description="Only approved result sheets are published. Published results become visible in student and parent portals."
          endpoint="/api/v1/academics/publish"
          submitLabel="Publish"
          fields={[
            { name: "classId", label: "Class ID", placeholder: "Optional class ID" },
            { name: "termId", label: "Term ID", placeholder: "Optional term ID" },
            { name: "note", label: "Publication note", type: "textarea", placeholder: "Optional audit note" }
          ]}
        />
        <ResourceForm
          title="Unpublish results"
          description="Restricted correction path for already-published results."
          endpoint="/api/v1/academics/unpublish"
          submitLabel="Unpublish"
          fields={[
            { name: "classId", label: "Class ID", placeholder: "Optional class ID" },
            { name: "termId", label: "Term ID", placeholder: "Optional term ID" },
            { name: "note", label: "Reason", type: "textarea", required: true }
          ]}
        />
      </div>

      <TableCard
        title="Publication status"
        description="Current result publication state by score sheet."
        items={grades}
        columns={[
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "status", header: "Status", render: (item) => item.status ?? "DRAFT" },
          { key: "published", header: "Published", render: (item) => (item.published ? "Yes" : "No") }
        ]}
      />
    </div>
  );
}
