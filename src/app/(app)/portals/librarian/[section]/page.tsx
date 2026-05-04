import { AccessDenied } from "@/components/feedback/access-denied";
import { LibraryPortalSection } from "@/components/portals/support-portal-workspaces";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadLibraryPortalBundle } from "@/lib/support-services/portal";

type PageProps = { params: Promise<{ section: string }> };

export default async function LibrarianPortalSectionPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;

  const { section } = await params;

  if (!(await canAccessServerPath(session, `/portals/librarian/${section}`))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { dashboard, books, loans, members } = await loadLibraryPortalBundle();

  return <LibraryPortalSection section={section} dashboard={dashboard} books={books} loans={loans} members={members} />;
}
