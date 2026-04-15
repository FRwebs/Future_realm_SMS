import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { CurriculumTopicView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherCurriculumPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const topics = await apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum");
  const firstTopic = topics[0];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My Scheme of Work</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Weekly Nigerian curriculum topics assigned to your classes and subjects.
        </p>
      </section>

      {firstTopic ? (
        <ResourceForm
          title="Update topic progress"
          description={`Quick update for ${firstTopic.subject}, ${formatNigeriaClassName(firstTopic.className)}, week ${firstTopic.weekNumber}.`}
          endpoint={`/api/v1/nigeria-operations/curriculum/${firstTopic.id}/progress`}
          submitLabel="Update progress"
          fields={[
            {
              name: "progressStatus",
              label: "Progress",
              type: "select",
              options: [
                { label: "Not started", value: "NOT_STARTED" },
                { label: "In progress", value: "IN_PROGRESS" },
                { label: "Taught", value: "TAUGHT" },
                { label: "Completed", value: "COMPLETED" }
              ]
            },
            { name: "actualDateTaught", label: "Actual date taught", type: "date" },
            { name: "teacherNotes", label: "Teacher note", type: "textarea" }
          ]}
        />
      ) : null}

      <TableCard
        title="Assigned weekly topics"
        description="Read and update coverage for your assigned class-subject scheme of work."
        items={topics}
        columns={[
          { key: "week", header: "Week", render: (item) => `Week ${item.weekNumber}` },
          { key: "topic", header: "Topic", render: (item) => <span className="font-semibold text-ink">{item.topic}</span> },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "progress", header: "Progress", render: (item) => item.progressStatus.replaceAll("_", " ") },
          { key: "taught", header: "Taught", render: (item) => (item.actualDateTaught ? formatDate(item.actualDateTaught) : "-") }
        ]}
        emptyState="No scheme-of-work topics are assigned to your classes yet."
      />
    </div>
  );
}
