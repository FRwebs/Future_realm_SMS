import { AccessDenied } from "@/components/feedback/access-denied";
import { FrontDeskPortalDashboard } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadFrontDeskPortalBundle } from "@/lib/support-services/portal";

export default async function FrontDeskPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/front-desk"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard } = await loadFrontDeskPortalBundle();

  return <FrontDeskPortalDashboard dashboard={dashboard} />;
}
