import { TimetableGrid } from "@/components/academics/timetable-grid";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PortalTimetableEntry } from "@/lib/domain/types";

export default async function TeacherTimetablePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const timetable = await apiGet<PortalTimetableEntry[]>("/api/v1/teacher-portal/timetable");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My timetable</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Personal teaching periods for classes and subjects currently assigned to you.
        </p>
      </section>

      <TimetableGrid
        title="Weekly timetable"
        description="Teaching periods grouped by day, time, subject, and class."
        entries={timetable}
        emptyState="No timetable periods are currently linked to your account."
      />
    </div>
  );
}
