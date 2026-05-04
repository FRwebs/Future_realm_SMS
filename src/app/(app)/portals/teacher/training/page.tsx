import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { TrainingParticipantView, TrainingProgramView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherTrainingPortalPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/training")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [programs, participants] = await Promise.all([
    apiGet<TrainingProgramView[]>("/api/v1/nigeria-operations/training"),
    apiGet<TrainingParticipantView[]>("/api/v1/nigeria-operations/training/participants")
  ]);
  const firstPending = participants.find((item) => item.status !== "COMPLETED");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My Training & CPD</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          View required professional development, curriculum orientation, and certificates attached to your teacher profile.
        </p>
      </section>

      {firstPending ? (
        <ResourceForm
          title="Update training completion"
          description={`Quick update for ${firstPending.title}.`}
          endpoint={`/api/v1/nigeria-operations/training/participants/${firstPending.id}/complete`}
          submitLabel="Update training"
          fields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { label: "Attended", value: "ATTENDED" },
                { label: "Completed", value: "COMPLETED" },
                { label: "Absent", value: "ABSENT" },
                { label: "Overdue", value: "OVERDUE" }
              ]
            },
            { name: "certificateUrl", label: "Certificate URL" },
            { name: "cpdPoints", label: "CPD points", type: "number", min: 0, defaultValue: firstPending.cpdPoints },
            { name: "feedback", label: "Feedback", type: "textarea" }
          ]}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Assigned training"
          description="Training programmes assigned to your teacher account."
          items={programs}
          columns={[
            { key: "title", header: "Training", render: (item) => <span className="font-semibold text-ink">{item.title}</span> },
            { key: "category", header: "Category", render: (item) => item.category.replaceAll("_", " ") },
            { key: "date", header: "Date", render: (item) => formatDate(item.startsAt) },
            { key: "type", header: "Type", render: (item) => item.trainingType }
          ]}
          emptyState="No training has been assigned yet."
        />
        <TableCard
          title="My training history"
          description="Completion status, CPD points, and certificate evidence."
          items={participants}
          columns={[
            { key: "title", header: "Training", render: (item) => item.title },
            { key: "status", header: "Status", render: (item) => item.status },
            { key: "cpd", header: "CPD", render: (item) => item.cpdPoints },
            { key: "completed", header: "Completed", render: (item) => (item.completedAt ? formatDate(item.completedAt) : "-") }
          ]}
          emptyState="No training history is available yet."
        />
      </section>
    </div>
  );
}
