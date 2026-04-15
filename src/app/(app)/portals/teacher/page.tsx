import { AccessDenied } from "@/components/feedback/access-denied";
import { TeacherPortalDashboard } from "@/components/portals/teacher-portal-dashboard";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherPortalView } from "@/lib/domain/types";

export default async function TeacherPortalPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const portal = await apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard");

  return <TeacherPortalDashboard portal={portal} />;
}
