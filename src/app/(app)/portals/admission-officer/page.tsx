import { AccessDenied } from "@/components/feedback/access-denied";
import { AdmissionOfficerPortalDashboard } from "@/components/portals/admission-officer-portal-dashboard";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type {
  AdmissionApplicationView,
  AdmissionMetricsView,
} from "@/lib/domain/types";

export default async function AdmissionOfficerPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [applications, metrics] = await Promise.all([
    apiGet<AdmissionApplicationView[]>("/api/v1/admissions"),
    apiGet<AdmissionMetricsView>("/api/v1/admissions/metrics"),
  ]);

  return (
    <AdmissionOfficerPortalDashboard
      applications={applications}
      metrics={metrics}
    />
  );
}
