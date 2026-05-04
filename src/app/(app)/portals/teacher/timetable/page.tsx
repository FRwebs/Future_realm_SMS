import { TeacherTimetableWorkspace } from "@/components/portals/teacher-timetable-workspace";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { TeacherPortalView } from "@/lib/domain/types";
import { canAccessPathWithPermissions } from "@/lib/navigation/registry";

export default async function TeacherTimetablePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/timetable")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, permissions] = await Promise.all([
    apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard"),
    getServerPermissions(session),
  ]);

  return (
    <TeacherTimetableWorkspace
      portal={portal}
      canOpenScores={canAccessPathWithPermissions(session.role, "/portals/teacher/gradebook", permissions)}
    />
  );
}
