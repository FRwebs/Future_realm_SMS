import { AccessDenied } from "@/components/feedback/access-denied";
import { HostelPortalSection } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadHostelPortalBundle } from "@/lib/support-services/portal";

type PageProps = { params: Promise<{ section: string }> };

export default async function HostelPortalSectionPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;

  const { section } = await params;

  if (!(await canAccessServerPath(session, `/portals/hostel/${section}`))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard, rooms } = await loadHostelPortalBundle();

  return <HostelPortalSection section={section} dashboard={dashboard} rooms={rooms} />;
}
