import { SchoolCommandCenter } from "@/app/(app)/dashboard/_school-command-center";
import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadCommandCenterSnapshot } from "@/lib/dashboard/command-center-snapshot";
import { getRoleDashboardProfile } from "@/lib/domain/dashboard";
import { loadPrincipalDashboardBundle } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

function displayDateOrText(value: string) {
  return Number.isNaN(new Date(value).getTime()) ? value : formatDate(value);
}

export default async function PrincipalPortalPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { overview } = await loadPrincipalDashboardBundle();

  const profile = getRoleDashboardProfile(session.role);
  const roleSignals = overview.roleWidgets?.slice(0, 6) ?? [];
  const topAlerts = overview.alerts.slice(0, 3);
  const timeline = [
    ...(overview.recentActivity ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      meta: displayDateOrText(item.time),
      category: item.category
    })),
    ...(overview.recentAnnouncements ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      meta: formatDate(item.publishedAt),
      category: "communication"
    }))
  ].slice(0, 6);

  const snapshot = await loadCommandCenterSnapshot(overview);

  return (
    <SchoolCommandCenter
      session={session}
      overview={overview}
      profile={profile}
      roleSignals={roleSignals}
      topAlerts={topAlerts}
      timeline={timeline}
      pulse={snapshot.pulse}
      termProgress={snapshot.termProgress}
      academicSnapshot={snapshot.academicSnapshot}
      financialSnapshot={snapshot.financialSnapshot}
      staffActivity={snapshot.staffActivity}
      commsSnapshot={snapshot.commsSnapshot}
    />
  );
}
