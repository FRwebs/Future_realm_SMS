import { AccessDenied } from "@/components/feedback/access-denied";
import { FrontDeskPortalSection } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadFrontDeskPortalBundle } from "@/lib/support-services/portal";

type PageProps = { params: Promise<{ section: string }> };

export default async function FrontDeskPortalSectionPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;

  const { section } = await params;

  if (!(await canAccessServerPath(session, `/portals/front-desk/${section}`))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard, visitors, meetings } = await loadFrontDeskPortalBundle();

  return <FrontDeskPortalSection section={section} dashboard={dashboard} visitors={visitors} meetings={meetings} />;
}
