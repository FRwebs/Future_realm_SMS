import { PageLoadBeacon } from "@/components/layout/page-load-beacon";
import { AccessDenied } from "@/components/feedback/access-denied";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";
import { apiGet, apiGetEnvelope, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { SuperAdminAnalyticsOverviewSchema, SuperAdminPartnerDealRowListSchema } from "@/lib/domain/types.zod";
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

/** Back Office module id → the sidebar entries that belong to it. */
const MODULE_NAV: Record<string, string[]> = {
  schools: ["sa_schools", "sa_crm"], migration: ["sa_migration"], billing: ["sa_billing"], partners: ["sa_partners"], users: ["sa_users"],
  communications: ["sa_communications"], support: ["sa_support"], curriculum: ["sa_config_library"], plans: ["sa_feature_flags"],
  infrastructure: ["sa_system_health"], security: ["sa_security", "sa_audit_logs"], team: ["sa_internal_team"], analytics: ["sa_analytics"], settings: ["sa_settings"]
};

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
    myAccess,
  ] = await Promise.all([
    apiGet("/api/super-admin/analytics/overview", observe<SuperAdminAnalyticsOverview>(SuperAdminAnalyticsOverviewSchema)).catch(() => null),
    apiGet("/api/super-admin/my-work", observe<MyWorkOverview>(localContracts["src/app/super-admin/layout.tsx#5e3dbcac"])).catch(() => null),
    apiGet("/api/super-admin/migration/jobs", observe<MigrationJobRow[]>(localContracts["src/app/super-admin/layout.tsx#ba4ffc0f"])).catch(() => null),
    apiGet("/api/super-admin/partners/deals?status=REGISTERED", observe<SuperAdminPartnerDealRow[]>(SuperAdminPartnerDealRowListSchema)).catch(() => null),
    apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?status=OPEN&limit=1").catch(() => null),
    apiGet("/api/super-admin/security", observe<SecurityOverview>(localContracts["src/app/super-admin/layout.tsx#bd587995"])).catch(() => null),
    apiGetEnvelope<SuperAdminSuspiciousActivityRow[]>("/api/super-admin/users/suspicious-activity").catch(() => null),
    apiGetEnvelope<SuperAdminDuplicateFlagRow[]>("/api/super-admin/users/duplicates").catch(() => null),
    apiGetEnvelope<SuperAdminAccountRecoveryRow[]>("/api/super-admin/users/recovery").catch(() => null),
    apiGet("/api/super-admin/internal-team/me/access", observe<{ levels: Record<string, string> }>(localContracts["src/app/super-admin/layout.tsx#b191a7a1"])).catch(() => null),
  ]);
  // A module the person's access grid sets to None is not shown to them at all.
  const hiddenNavIds = Object.entries(myAccess?.levels ?? {}).filter(([, level]) => level === "NONE").flatMap(([id]) => MODULE_NAV[id] ?? []);

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
      hiddenNavIds={hiddenNavIds}
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
      <PageLoadBeacon />
      {children}
    </SuperAdminShell>
  );
}
