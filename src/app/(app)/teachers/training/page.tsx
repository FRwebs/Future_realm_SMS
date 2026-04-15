import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { TrainingParticipantView, TrainingProgramView } from "@/lib/domain/types";
import { trainingCategoryOptions } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherTrainingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/teachers/training")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [programs, participants] = await Promise.all([
    apiGet<TrainingProgramView[]>("/api/v1/nigeria-operations/training"),
    apiGet<TrainingParticipantView[]>("/api/v1/nigeria-operations/training/participants")
  ]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">People & Staffing</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Teacher Training & CPD</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
          Plan seminars, pedagogy refreshers, curriculum orientation, safeguarding, and ICT/digital literacy training.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-5 shadow-panel">
        <ResourceActionDialog
          triggerLabel="Create training"
          title="Create training programme"
          description="Use Nigerian-school categories such as curriculum orientation, assessment/grading, and child protection."
          endpoint="/api/v1/nigeria-operations/training"
          submitLabel="Create training"
          confirmLabel="Confirm Training"
          confirmMessage="Confirm this training programme before inviting teachers."
          fields={[
            { name: "title", label: "Title", required: true, placeholder: "Second Term Scheme of Work Orientation" },
            { name: "description", label: "Description", type: "textarea" },
            { name: "category", label: "Category", type: "select", options: trainingCategoryOptions },
            {
              name: "trainingType",
              label: "Training type",
              type: "select",
              options: [
                { label: "Internal", value: "INTERNAL" },
                { label: "External", value: "EXTERNAL" },
                { label: "Online", value: "ONLINE" },
                { label: "Physical", value: "PHYSICAL" },
                { label: "Blended", value: "BLENDED" }
              ]
            },
            { name: "startsAt", label: "Start date/time", required: true, placeholder: "2026-04-20T09:00:00.000Z" },
            { name: "durationHours", label: "Duration hours", type: "number", min: 0.5, step: 0.5 },
            { name: "facilitator", label: "Facilitator" },
            { name: "provider", label: "Provider" },
            { name: "location", label: "Location / meeting room" },
            { name: "meetingLink", label: "Meeting link" }
          ]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Training programmes"
          description="Upcoming and historical teacher development activities."
          items={programs}
          columns={[
            { key: "title", header: "Training", render: (item) => <span className="font-semibold text-ink">{item.title}</span> },
            { key: "category", header: "Category", render: (item) => item.category.replaceAll("_", " ") },
            { key: "startsAt", header: "Date", render: (item) => formatDate(item.startsAt) },
            { key: "completion", header: "Completion", render: (item) => `${item.completedCount}/${item.invitedCount}` }
          ]}
          emptyState="No teacher training programmes have been created yet."
        />
        <TableCard
          title="Participation records"
          description="Teacher training attendance, completion, certificates, and CPD points."
          items={participants}
          columns={[
            { key: "teacher", header: "Teacher", render: (item) => item.teacherName },
            { key: "title", header: "Training", render: (item) => item.title },
            { key: "status", header: "Status", render: (item) => item.status },
            { key: "cpd", header: "CPD", render: (item) => item.cpdPoints }
          ]}
          emptyState="No teacher training participants have been assigned yet."
        />
      </section>
    </div>
  );
}
