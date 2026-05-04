import { AccessDenied } from "@/components/feedback/access-denied";
import { HostelPortalDashboard } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadHostelPortalBundle } from "@/lib/support-services/portal";

export default async function HostelPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/hostel"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard } = await loadHostelPortalBundle();

  return <HostelPortalDashboard dashboard={dashboard} />;
}
