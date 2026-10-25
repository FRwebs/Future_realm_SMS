import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiGet } from "@/lib/api/server";
import { ttlCached } from "@/lib/cache/ttl";
import { getPlatformSync } from "@/lib/api/platform-sync";
import { getStudentBadges, getStudentChrome } from "@/lib/api/student-workspace";
import { getTeacherBadges, getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { studentNavigation } from "@/lib/modules/student-workspace";
import { teacherNavigation } from "@/lib/modules/teacher-workspace";
import { getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchoolContextView } from "@/lib/domain/types";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export const metadata: Metadata = {
  title: "FutureRealm SMS",
};

const getCachedSchoolContext = cache(async (schoolId: string) => {
  try {
    const session = await getServerSession();
    const read = () => apiGet<SchoolContextView>("/api/v1/dashboard/context");
    // The school's name, session and term barely move, and the context stamp ends this the moment they do.
    return session ? await ttlCached(`ctx:${schoolId}:${session.userId}`, 600_000, read, { stamped: true }) : await read();
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

  const [permissions, schoolContext, platformSync, teacher, teacherBadges, studentBadges, studentChrome] = await Promise.all([
    getServerPermissions(session).catch(() => getDefaultPermissionsForRole(session.role)),
    getCachedSchoolContext(session.schoolId),
    getPlatformSync(session.schoolId),
    getTeacherWorkspace(session.role, session.schoolId),
    getTeacherBadges(session.role, session.schoolId),
    getStudentBadges(session.role),
    getStudentChrome(session.role),
  ]);

  // A teacher's rail: the teacher modules their permissions reach, in the teacher's order, then anything more the school has granted.
  const teacherRail = teacher ? teacherNavigation(teacher.persona, permissions) : session.role === "STUDENT" ? studentNavigation(platformSync?.switchedOff.map((module) => module.slug) ?? [], studentBadges.hidden) : null;
  const navBadges = session.role === "STUDENT" ? studentBadges.counts : teacherBadges;
  const navBadgeTones = session.role === "STUDENT" ? studentBadges.tones : undefined;

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
      navBadges={teacherRail ? navBadges : undefined}
      navBadgeTones={teacherRail ? navBadgeTones : undefined}
      studentChrome={studentChrome}
    >
      {children}
    </DashboardShell>
  );
}
