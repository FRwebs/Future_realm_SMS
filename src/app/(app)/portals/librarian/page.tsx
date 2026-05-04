import { AccessDenied } from "@/components/feedback/access-denied";
import { LibraryPortalDashboard } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadLibraryPortalBundle } from "@/lib/support-services/portal";

export default async function LibrarianPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/librarian"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard } = await loadLibraryPortalBundle();

  return <LibraryPortalDashboard dashboard={dashboard} />;
}
