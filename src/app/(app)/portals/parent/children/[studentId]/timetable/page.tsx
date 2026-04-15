import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PortalTimetableEntry, StudentPortalCalendarEvent, StudentPortalExamEntry } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ studentId: string }> };
type TimetablePayload = {
  weeklyTimetable: PortalTimetableEntry[];
  examTimetable: StudentPortalExamEntry[];
  calendar: StudentPortalCalendarEvent[];
};

export default async function ParentChildTimetablePage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const timetable = await apiGet<TimetablePayload>(`/api/v1/parent-portal/children/${studentId}/timetable`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href={`/portals/parent/children/${studentId}`} className="text-sm font-semibold text-brand-700">Back to child overview</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Child timetable</h1>
      </section>
      <TableCard
        title="Weekly timetable"
        description="Class timetable for this child."
        items={timetable.weeklyTimetable}
        columns={[
          { key: "day", header: "Day", render: (item) => item.day },
          { key: "time", header: "Time", render: (item) => item.time },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "teacher", header: "Teacher", render: (item) => item.teacherName ?? "Not assigned" },
          { key: "venue", header: "Venue", render: (item) => item.venue }
        ]}
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Exam timetable"
          description="Upcoming exams for this child."
          items={timetable.examTimetable}
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "date", header: "Date", render: (item) => formatDate(item.examDate) },
            { key: "time", header: "Time", render: (item) => item.time }
          ]}
        />
        <TableCard
          title="Calendar"
          description="Events relevant to this family or child's class."
          items={timetable.calendar}
          columns={[
            { key: "title", header: "Event", render: (item) => item.title },
            { key: "startsAt", header: "Starts", render: (item) => formatDate(item.startsAt) },
            { key: "audience", header: "Audience", render: (item) => item.audience }
          ]}
        />
      </section>
    </div>
  );
}
