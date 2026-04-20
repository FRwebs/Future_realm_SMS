import Link from "next/link";

import { TimetableGrid } from "@/components/academics/timetable-grid";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { CurriculumTopicView, PortalSubjectOffering, PortalTimetableEntry, StudentPortalCalendarEvent, StudentPortalExamEntry } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type TimetablePayload = {
  weeklyTimetable: PortalTimetableEntry[];
  examTimetable: StudentPortalExamEntry[];
  calendar: StudentPortalCalendarEvent[];
  subjects?: PortalSubjectOffering[];
  curriculumTopics?: CurriculumTopicView[];
  departmentTrack?: string;
};

export default async function StudentTimetablePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const timetable = await apiGet<TimetablePayload>("/api/v1/student-portal/timetable");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My timetable</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">Class timetable, exam timetable, and school calendar events.</p>
        {timetable.departmentTrack ? (
          <p className="mt-3 text-sm font-semibold text-brand-700">Senior secondary track: {timetable.departmentTrack}</p>
        ) : null}
      </section>

      <TableCard
        title="Subjects I offer"
        description="Subjects assigned to your current class."
        items={timetable.subjects ?? []}
        emptyState="No subject assignment is visible for your class yet."
        columns={[
          { key: "name", header: "Subject", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
          { key: "teacher", header: "Teacher", render: (item) => item.teacherName ?? "Not assigned" },
          { key: "track", header: "Track", render: (item) => item.track ?? item.departmentName ?? "General" }
        ]}
      />

      <TimetableGrid
        title="Weekly class timetable"
        description="Your class schedule for the current term."
        entries={timetable.weeklyTimetable}
        emptyState="No weekly class timetable has been published for your class yet."
        compact
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Exam timetable"
          description="Upcoming exam schedule for your class."
          items={timetable.examTimetable}
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "examDate", header: "Date", render: (item) => formatDate(item.examDate) },
            { key: "time", header: "Time", render: (item) => item.time },
            { key: "venue", header: "Venue", render: (item) => item.venue ?? "-" }
          ]}
        />
        <TableCard
          title="Calendar"
          description="School events and reminders visible to students."
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
