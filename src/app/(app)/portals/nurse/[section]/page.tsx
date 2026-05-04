import { AccessDenied } from "@/components/feedback/access-denied";
import { NursePortalSection } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadNursePortalBundle } from "@/lib/support-services/portal";

type PageProps = { params: Promise<{ section: string }> };

export default async function NursePortalSectionPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;

  const { section } = await params;

  if (!(await canAccessServerPath(session, `/portals/nurse/${section}`))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard, visits } = await loadNursePortalBundle();

  return <NursePortalSection section={section} dashboard={dashboard} visits={visits} />;
}
