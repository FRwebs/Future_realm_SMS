import { AccessDenied } from "@/components/feedback/access-denied";
import { ExamOfficerPortalDashboard } from "@/components/portals/exam-officer-portal-dashboard";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerDashboardView } from "@/lib/domain/types";

export default async function ExamOfficerPortalPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const dashboard = await apiGet<ExamOfficerDashboardView>(
    "/api/v1/exam-officer/dashboard",
  );

  return <ExamOfficerPortalDashboard dashboard={dashboard} />;
}
