import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalPortalDashboard } from "@/components/portals/principal-portal-dashboard";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalDashboardBundle } from "@/lib/principal/portal";

export default async function PrincipalPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { overview, finance, admissions, announcements, approvalQueue, teachers, teacherActivities } =
    await loadPrincipalDashboardBundle();

  return (
    <PrincipalPortalDashboard
      overview={overview}
      finance={finance}
      admissions={admissions}
      announcements={announcements}
      approvalQueue={approvalQueue}
      teachers={teachers}
      teacherActivities={teacherActivities}
      principalName={session.name}
    />
  );
}
