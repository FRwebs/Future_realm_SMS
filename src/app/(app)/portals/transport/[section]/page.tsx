import { AccessDenied } from "@/components/feedback/access-denied";
import { TransportPortalSection } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadTransportPortalBundle } from "@/lib/support-services/portal";

type PageProps = { params: Promise<{ section: string }> };

export default async function TransportPortalSectionPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;

  const { section } = await params;

  if (!(await canAccessServerPath(session, `/portals/transport/${section}`))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { vehicles, routes, students, complianceAlerts } = await loadTransportPortalBundle();

  return (
    <TransportPortalSection
      section={section}
      vehicles={vehicles}
      routes={routes}
      students={students}
      complianceAlerts={complianceAlerts}
    />
  );
}
