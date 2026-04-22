import { ClassTimetableClient } from "@/components/timetable/class-timetable-client";
import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function ClassTimetablePage({ params }: { params: Promise<{ classId: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/timetable"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }
  const { classId } = await params;

  return <ClassTimetableClient classId={classId} />;
}
