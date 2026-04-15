import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalAssignmentView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function StudentAssignmentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const assignments = await apiGet<StudentPortalAssignmentView[]>("/api/v1/student-portal/assignments");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My assignments</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Teacher-published assignments and graded submission feedback for your current class.
        </p>
      </section>

      <TableCard
        title="Learning tasks"
        description="Assignments and study tasks currently available to you."
        items={assignments}
        columns={[
          { key: "title", header: "Task", render: (item) => item.title },
          { key: "className", header: "Class", render: (item) => item.className ? formatNigeriaClassName(item.className) : "-" },
          { key: "subject", header: "Subject", render: (item) => item.subject ?? "-" },
          { key: "dueAt", header: "Due", render: (item) => (item.dueAt ? formatDate(item.dueAt) : "-") },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "feedback", header: "Feedback", render: (item) => item.feedback ?? "-" }
        ]}
      />
      {assignments.length === 0 ? (
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 text-sm text-ink/65 shadow-panel">
          No teacher-published assignments are available for your current class yet.
        </section>
      ) : null}
    </div>
  );
}
