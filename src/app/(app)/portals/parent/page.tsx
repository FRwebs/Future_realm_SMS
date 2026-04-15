import { AccessDenied } from "@/components/feedback/access-denied";
import { ParentPortalDashboard } from "@/components/portals/parent-portal-dashboard";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ParentPortalView } from "@/lib/domain/types";

export default async function ParentPortalPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const portal = await apiGet<ParentPortalView>("/api/v1/parent-portal/dashboard");

  return <ParentPortalDashboard portal={portal} />;
}
