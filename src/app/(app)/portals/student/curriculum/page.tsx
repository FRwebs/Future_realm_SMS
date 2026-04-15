import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { CurriculumTopicView } from "@/lib/domain/types";

export default async function StudentCurriculumPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const topics = await apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My Scheme of Work</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Read-only weekly curriculum outline for your class subjects.
        </p>
      </section>
      <TableCard
        title="Term topics"
        description="Active topics published for your class this term."
        items={topics}
        columns={[
          { key: "week", header: "Week", render: (item) => `Week ${item.weekNumber}` },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "topic", header: "Topic", render: (item) => <span className="font-semibold text-ink">{item.topic}</span> },
          { key: "subTopic", header: "Sub-topic", render: (item) => item.subTopic ?? "-" },
          { key: "assignment", header: "Homework", render: (item) => item.assignmentNote ?? "-" }
        ]}
        emptyState="No scheme-of-work topics are visible for your class yet."
      />
    </div>
  );
}
