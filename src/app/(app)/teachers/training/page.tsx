import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { TrainingParticipantView, TrainingProgramView } from "@/lib/domain/types";
import { trainingCategoryOptions } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherTrainingPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/teachers/training"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [programs, participants] = await Promise.all([
    apiGet<TrainingProgramView[]>("/api/v1/nigeria-operations/training"),
    apiGet<TrainingParticipantView[]>("/api/v1/nigeria-operations/training/participants")
  ]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">People & Staffing</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Teacher Training & CPD</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Plan seminars, pedagogy refreshers, curriculum orientation, safeguarding, and ICT/digital literacy training.
        </p>
      </section>

      <section className="surface-card p-5">
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

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Training programmes"
          description="Upcoming and historical teacher development activities."
          items={programs}
          columns={[
            { key: "title", header: "Training", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
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
