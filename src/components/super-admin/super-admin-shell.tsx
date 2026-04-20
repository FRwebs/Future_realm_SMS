"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SessionUser } from "@/lib/domain/types";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export function SuperAdminShell({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      session={session}
      permissions={getDefaultPermissionsForRole(session.role)}
      portalType="super_admin"
      schoolName="Super Admin Team"
    >
      {children}
    </DashboardShell>
  );
}
