import { ClassTimetableClient } from "@/components/timetable/class-timetable-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function ClassTimetablePage({ params }: { params: Promise<{ classId: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/timetable")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }
  const { classId } = await params;

  return <ClassTimetableClient classId={classId} />;
}
