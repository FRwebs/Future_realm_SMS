import { AccessDenied } from "@/components/feedback/access-denied";
import { ParentPortalDashboard } from "@/components/portals/parent-portal-dashboard";
import { apiGet, observe } from "@/lib/api/server";
import { ParentPortalViewSchema } from "@/lib/domain/types.zod";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ParentPortalView } from "@/lib/domain/types";

export default async function ParentPortalPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const portal = await apiGet("/api/v1/parent-portal/dashboard", observe<ParentPortalView>(ParentPortalViewSchema));

  return <ParentPortalDashboard portal={portal} />;
}
