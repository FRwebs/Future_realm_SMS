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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/student" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My assignments</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
        <section className="surface-card p-6 text-[13px] text-[var(--color-text-secondary)]">
          No teacher-published assignments are available for your current class yet.
        </section>
      ) : null}
    </div>
  );
}
