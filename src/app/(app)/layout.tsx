import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiGet } from "@/lib/api/server";
import { getPlatformSync } from "@/lib/api/platform-sync";
import { getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { teacherNavigation } from "@/lib/modules/teacher-workspace";
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

  const [permissions, schoolContext, platformSync, teacher] = await Promise.all([
    getServerPermissions(session).catch(() => getDefaultPermissionsForRole(session.role)),
    getCachedSchoolContext(session.schoolId),
    getPlatformSync(session.schoolId),
    getTeacherWorkspace(session.role, session.schoolId),
  ]);

  // A teacher's rail: the teacher modules their permissions reach, in the teacher's order, then anything more the school has granted.
  const teacherRail = teacher ? teacherNavigation(teacher.persona, permissions) : null;

  return (
    <DashboardShell
      session={session}
      permissions={permissions}
      schoolName={schoolContext?.schoolName}
      schoolSlug={schoolContext?.schoolSlug}
      currentSessionName={schoolContext?.currentSession}
      currentTermName={schoolContext?.currentTerm}
      platformSync={platformSync}
      teacherRail={teacherRail}
    >
      {children}
    </DashboardShell>
  );
}
