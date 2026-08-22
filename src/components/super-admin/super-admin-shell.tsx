"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SessionUser } from "@/lib/domain/types";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export function SuperAdminShell({
  session,
  platformStats,
  children,
}: {
  session: SessionUser;
  platformStats?: {
    totalSchools?: number;
    reviewQueueCount?: number;
  };
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      session={session}
      permissions={getDefaultPermissionsForRole(session.role)}
      portalType="super_admin"
      platformStats={platformStats}
    >
      {children}
    </DashboardShell>
  );
}
