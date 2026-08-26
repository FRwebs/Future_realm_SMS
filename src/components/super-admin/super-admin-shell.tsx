"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SessionUser } from "@/lib/domain/types";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export function SuperAdminShell({
  session,
  platformStats,
  navBadges,
  children,
}: {
  session: SessionUser;
  platformStats?: {
    totalSchools?: number;
    reviewQueueCount?: number;
  };
  navBadges?: Record<string, number | undefined>;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      session={session}
      permissions={getDefaultPermissionsForRole(session.role)}
      portalType="super_admin"
      platformStats={platformStats}
      navBadges={navBadges}
    >
      {children}
    </DashboardShell>
  );
}
