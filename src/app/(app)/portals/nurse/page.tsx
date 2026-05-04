import { AccessDenied } from "@/components/feedback/access-denied";
import { NursePortalDashboard } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadNursePortalBundle } from "@/lib/support-services/portal";

export default async function NursePortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/nurse"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard } = await loadNursePortalBundle();

  return <NursePortalDashboard dashboard={dashboard} nurseName={session.name} />;
}
