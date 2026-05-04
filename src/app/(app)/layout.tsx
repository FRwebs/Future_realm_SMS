import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, SchoolContextView } from "@/lib/domain/types";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export const metadata: Metadata = {
  title: "FutureRealm SMS",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const [permissions, schoolContext] = await Promise.all([
    apiGet<MyPermissionsView>(
      `/api/v1/school/${session.schoolId}/roles-management/permissions/my`
    )
      .then((payload) => payload.permissions)
      .catch(() => getDefaultPermissionsForRole(session.role)),
    apiGet<SchoolContextView>("/api/v1/dashboard/context").catch(() => null),
  ]);

  return (
    <DashboardShell
      session={session}
      permissions={permissions}
      schoolName={schoolContext?.schoolName}
      currentSessionName={schoolContext?.currentSession}
      currentTermName={schoolContext?.currentTerm}
    >
      {children}
    </DashboardShell>
  );
}
