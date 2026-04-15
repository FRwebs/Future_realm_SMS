import { AccessDenied } from "@/components/feedback/access-denied";
import { StudentPortalDashboard } from "@/components/portals/student-portal-dashboard";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalView } from "@/lib/domain/types";

export default async function StudentPortalPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const portal = await apiGet<StudentPortalView>("/api/v1/student-portal/dashboard");

  return <StudentPortalDashboard portal={portal} />;
}
