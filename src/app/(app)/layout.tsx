import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiGet } from "@/lib/api/server";
import { getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchoolContextView } from "@/lib/domain/types";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export const metadata: Metadata = {
  title: "FutureRealm SMS",
};

const getCachedSchoolContext = cache(async (schoolId: string) => {
  void schoolId;
  try {
    return await apiGet<SchoolContextView>("/api/v1/dashboard/context");
  } catch {
    return null;
  }
});

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
    getServerPermissions(session).catch(() => getDefaultPermissionsForRole(session.role)),
    getCachedSchoolContext(session.schoolId),
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
