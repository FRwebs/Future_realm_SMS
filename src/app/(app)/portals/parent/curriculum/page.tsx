import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { CurriculumTopicView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function ParentCurriculumPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const topics = await apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/parent" className="text-sm font-semibold text-brand-700">Back to parent portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Children's Scheme of Work</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Read-only weekly curriculum outline for the classes linked to your children.
        </p>
      </section>
      <TableCard
        title="Visible term topics"
        description="Active scheme-of-work topics for your linked children."
        items={topics}
        columns={[
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "week", header: "Week", render: (item) => `Week ${item.weekNumber}` },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "topic", header: "Topic", render: (item) => <span className="font-semibold text-ink">{item.topic}</span> },
          { key: "assignment", header: "Homework", render: (item) => item.assignmentNote ?? "-" }
        ]}
        emptyState="No scheme-of-work topics are visible for your children yet."
      />
    </div>
  );
}
