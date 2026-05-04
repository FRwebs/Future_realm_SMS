import { AccessDenied } from "@/components/feedback/access-denied";
import { TransportPortalDashboard } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadTransportPortalBundle } from "@/lib/support-services/portal";

export default async function TransportPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/transport"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard, complianceAlerts } = await loadTransportPortalBundle();

  return <TransportPortalDashboard dashboard={dashboard} complianceAlerts={complianceAlerts} />;
}
