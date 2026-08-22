import { AccessDenied } from "@/components/feedback/access-denied";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { SuperAdminAnalyticsOverview } from "@/lib/domain/types";
import { platformRoles } from "@/lib/navigation/registry";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!platformRoles.includes(session.role)) {
    return (
      <div className="min-h-screen bg-dashboard-grid p-6">
        <AccessDenied backHref={getDefaultPathForRole(session.role)} />
      </div>
    );
  }

  const overview = await apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview").catch(() => null);

  return (
    <SuperAdminShell
      session={session}
      platformStats={{
        totalSchools: overview?.schools.total,
        reviewQueueCount: overview?.commandCenter?.onboardingPipeline.pendingVerification,
      }}
    >
      {children}
    </SuperAdminShell>
  );
}
