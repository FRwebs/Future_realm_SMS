import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { GradeRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function ResultHistoryPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const grades = await apiGet<GradeRecordView[]>("/api/v1/academics/grades");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Academic history</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Historical score sheets and transcript-ready rows by student, class, subject, status, and publication state.
        </p>
      </section>

      <TableCard
        title="Result history"
        description="Current and historical score rows available to your role."
        items={grades}
        columns={[
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "total", header: "Total", render: (item) => item.total },
          { key: "grade", header: "Grade", render: (item) => item.grade },
          { key: "remark", header: "Remark", render: (item) => item.remark ?? "-" },
          { key: "position", header: "Position", render: (item) => item.position ?? "-" },
          { key: "status", header: "Status", render: (item) => item.status ?? "DRAFT" }
        ]}
      />
    </div>
  );
}
