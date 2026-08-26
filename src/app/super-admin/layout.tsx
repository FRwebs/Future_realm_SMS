import { AccessDenied } from "@/components/feedback/access-denied";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type {
  SuperAdminAnalyticsOverview,
  SuperAdminAccountRecoveryRow,
  SuperAdminDuplicateFlagRow,
  SuperAdminPartnerDealRow,
  SuperAdminSuspiciousActivityRow,
  SuperAdminTicketRow,
} from "@/lib/domain/types";
import { platformRoles } from "@/lib/navigation/registry";

type SecurityOverview = { incidents?: { status: string }[] };
type MyWorkOverview = { total?: number };
type MigrationJobRow = { status: string };

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

  const [
    overview,
    myWork,
    migrationJobs,
    registeredDeals,
    openTicketsEnvelope,
    security,
    suspiciousEnvelope,
    duplicatesEnvelope,
    recoveryEnvelope,
  ] = await Promise.all([
    apiGet<SuperAdminAnalyticsOverview>("/api/super-admin/analytics/overview").catch(() => null),
    apiGet<MyWorkOverview>("/api/super-admin/my-work").catch(() => null),
    apiGet<MigrationJobRow[]>("/api/super-admin/migration/jobs").catch(() => null),
    apiGet<SuperAdminPartnerDealRow[]>("/api/super-admin/partners/deals?status=REGISTERED").catch(() => null),
    apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?status=OPEN&limit=1").catch(() => null),
    apiGet<SecurityOverview>("/api/super-admin/security").catch(() => null),
    apiGetEnvelope<SuperAdminSuspiciousActivityRow[]>("/api/super-admin/users/suspicious-activity").catch(() => null),
    apiGetEnvelope<SuperAdminDuplicateFlagRow[]>("/api/super-admin/users/duplicates").catch(() => null),
    apiGetEnvelope<SuperAdminAccountRecoveryRow[]>("/api/super-admin/users/recovery").catch(() => null),
  ]);

  const migrationOpenCount = migrationJobs?.filter((job) => job.status !== "COMPLETED" && job.status !== "ROLLED_BACK").length;
  const openIncidentCount = security?.incidents?.filter((incident) => incident.status !== "RESOLVED").length;
  const openTicketCount = openTicketsEnvelope?.pagination?.total ?? openTicketsEnvelope?.data?.length;
  const openRecoveryCount = recoveryEnvelope?.data?.filter((record) => !record.completedAt).length ?? 0;
  const userCaseCount =
    suspiciousEnvelope?.data && duplicatesEnvelope?.data
      ? suspiciousEnvelope.data.length + duplicatesEnvelope.data.length + openRecoveryCount
      : undefined;

  return (
    <SuperAdminShell
      session={session}
      platformStats={{
        totalSchools: overview?.schools.total,
        reviewQueueCount: overview?.commandCenter?.onboardingPipeline.pendingVerification,
      }}
      navBadges={{
        sa_my_work: myWork?.total,
        sa_schools: overview?.commandCenter?.onboardingPipeline.pendingVerification,
        sa_migration: migrationOpenCount,
        sa_partners: registeredDeals?.length,
        sa_users: userCaseCount,
        sa_support: openTicketCount,
        sa_security: openIncidentCount,
      }}
    >
      {children}
    </SuperAdminShell>
  );
}
