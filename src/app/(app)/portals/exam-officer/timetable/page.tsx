import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerTimetableEntryView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ClassOption = { id: string; fullName?: string; name: string; arm?: string | null };
type SubjectOption = { id: string; name: string; code?: string };
type ClassOptionsPayload = { data: ClassOption[] };

export default async function ExamOfficerTimetablePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer/timetable"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [entries, classes, subjects] = await Promise.all([
    apiGet<ExamOfficerTimetableEntryView[]>("/api/v1/exam-officer/timetable"),
    apiGet<ClassOptionsPayload>("/api/v1/classes"),
    apiGet<SubjectOption[]>("/api/v1/academics/subjects"),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-eyebrow">Exam timetable</p>
            <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
              Schedule papers with conflict-aware control
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
              Build the exam calendar, monitor candidate volume, and keep halls
              and timing organized without leaving the portal.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Add Timetable Entry"
            title="Schedule exam paper"
            description="Create one exam timetable entry. The backend will reject class and invigilator conflicts automatically."
            endpoint="/api/v1/exam-officer/timetable"
            submitLabel="Save timetable entry"
            presentation="drawer"
            fields={[
              {
                name: "classId",
                label: "Class",
                type: "select",
                required: true,
                options: classes.data.map((item) => ({
                  label: item.fullName ?? [item.name, item.arm].filter(Boolean).join(" "),
                  value: item.id,
                })),
              },
              {
                name: "subjectId",
                label: "Subject",
                type: "select",
                required: true,
                options: subjects.map((item) => ({
                  label: item.code ? `${item.name} (${item.code})` : item.name,
                  value: item.id,
                })),
              },
              { name: "examDate", label: "Exam date", type: "date", required: true },
              { name: "startsAt", label: "Start time", required: true, placeholder: "08:30" },
              { name: "endsAt", label: "End time", required: true, placeholder: "10:30" },
              { name: "venue", label: "Venue", placeholder: "Main Hall" },
            ]}
          />
        </div>
      </section>

      <TableCard
        title="Scheduled papers"
        description="Every saved paper, grouped in one list for daily exam-office operations."
        items={entries}
        getRowKey={(item) => item.id}
        primaryColumnKey="subject"
        featuredColumnKeys={["candidateCount"]}
        columns={[
          {
            key: "subject",
            header: "Paper",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.subject}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.className}</p>
              </div>
            ),
          },
          { key: "date", header: "Date", render: (item) => formatDate(item.examDate) },
          {
            key: "time",
            header: "Time",
            render: (item) => (
              <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
                {item.startsAt} - {item.endsAt}
              </span>
            ),
          },
          { key: "venue", header: "Venue", render: (item) => item.venue ?? "Pending venue" },
          { key: "candidateCount", header: "Candidates", render: (item) => item.candidateCount.toLocaleString() },
          {
            key: "invigilators",
            header: "Invigilators",
            render: (item) =>
              item.invigilators.length
                ? item.invigilators.map((invigilator) => invigilator.staffName).join(", ")
                : "Not assigned",
          },
        ]}
      />
    </div>
  );
}
