import { schoolContextContract } from "@/lib/api/contracts";
import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { apiGet } from "@/lib/api/server";
import { ttlCached } from "@/lib/cache/ttl";
import { getPlatformSync } from "@/lib/api/platform-sync";
import { getStudentBadges, getStudentChrome } from "@/lib/api/student-workspace";
import { getTeacherBadges, getTeacherWorkspace } from "@/lib/api/teacher-workspace";
import { getParentChrome, getParentRail } from "@/lib/api/parent-workspace";
import { PARENT_PHONE_TABS, parentHref, parentNavigation, parentPages, parentPhoneTabLabel, visibleParentPages } from "@/lib/modules/parent-workspace";
import { STUDENT_PHONE_TABS, studentHref, studentNavigation, studentPages, studentPhoneTabLabel } from "@/lib/modules/student-workspace";
import { teacherNavigation, teacherPhoneTabLabelFor, teacherPhoneTabOrder } from "@/lib/modules/teacher-workspace";
import { getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { getDefaultPermissionsForRole } from "@/lib/navigation/registry";

export const metadata: Metadata = {
  title: "FutureRealm SMS",
};

const getCachedSchoolContext = cache(async (schoolId: string) => {
  try {
    const session = await getServerSession();
    const read = () => apiGet("/api/v1/dashboard/context", schoolContextContract);
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

  const [permissions, schoolContext, platformSync, teacher, teacherBadges, studentBadges, studentChrome, parentRail, parentChrome] = await Promise.all([
    getServerPermissions(session).catch(() => getDefaultPermissionsForRole(session.role)),
    getCachedSchoolContext(session.schoolId),
    getPlatformSync(session.schoolId),
    getTeacherWorkspace(session.role, session.schoolId),
    getTeacherBadges(session.role, session.schoolId),
    getStudentBadges(session.role),
    getStudentChrome(session.role),
    getParentRail(session.role),
    getParentChrome(session.role),
  ]);

  // A teacher's rail: the teacher modules their permissions reach, in the teacher's order, then anything more the school has granted.
  const teacherRail = teacher
    ? teacherNavigation(teacher.persona, permissions)
    : session.role === "STUDENT"
      ? studentNavigation(platformSync?.switchedOff.map((module) => module.slug) ?? [], studentBadges.hidden)
      : session.role === "PARENT" && parentRail
        ? parentNavigation(parentRail.sees)
        : null;
  // The bottom bar on a phone. Only the portals whose mockups draw one get it;
  // which four tabs is each portal's own rule.
  const phoneTabs = (() => {
    if (session.role === "STUDENT" && studentChrome) {
      // Everything in the rail, plus the phone's own Sync page, which the desktop has no use for.
      const left = new Set(studentBadges.hidden);
      // The rail has already worked out what this school shows its students and what the Back Office has switched off.
      const rail = studentNavigation(platformSync?.switchedOff.map((module) => module.slug) ?? [], studentBadges.hidden);
      const reachable = new Set((rail.groups ?? []).flatMap((group) => group.items.map((item) => item.id)));
      const items = studentPages
        .filter((page) => page.slug === "sync" || (reachable.has(`s_${page.slug}`) && !left.has(page.slug)))
        .map((page) => ({ id: `s_${page.slug}`, label: page.label, short: studentPhoneTabLabel[page.slug] ?? page.label, icon: page.icon, href: studentHref(page.slug) }));
      return { items, primaryIds: STUDENT_PHONE_TABS.map((slug) => `s_${slug}`).filter((id) => items.some((item) => item.id === id)), label: "Student portal" };
    }
    if (session.role === "PARENT" && parentRail) {
      const visible = visibleParentPages(parentRail.sees);
      const items = parentPages
        .filter((page) => visible.includes(page.slug))
        .map((page) => ({ id: `p_${page.slug}`, label: page.label, short: parentPhoneTabLabel[page.slug] ?? page.label, icon: page.icon, href: parentHref(page.slug) }));
      return { items, primaryIds: PARENT_PHONE_TABS.map((slug) => `p_${slug}`).filter((id) => items.some((item) => item.id === id)), label: "Parent portal" };
    }
    if (teacher && teacherRail && "items" in teacherRail) {
      const items = teacherRail.items.map((item) => ({
        id: item.id,
        label: item.label,
        short: teacherPhoneTabLabelFor(item.id.replace(/^t_/, ""), teacher.persona) || item.label,
        icon: item.iconPath ?? "",
        href: item.href,
      }));
      const primaryIds = teacherPhoneTabOrder.map((code) => `t_${code}`).filter((id) => items.some((item) => item.id === id)).slice(0, 4);
      return { items, primaryIds, label: "Teaching workspace" };
    }
    return null;
  })();

  const navBadges = session.role === "STUDENT" ? studentBadges.counts : session.role === "PARENT" ? (parentRail?.counts ?? {}) : teacherBadges;
  const navBadgeTones = session.role === "STUDENT" ? studentBadges.tones : session.role === "PARENT" ? parentRail?.tones : undefined;

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
      parentChrome={parentChrome}
      phoneTabs={phoneTabs}
    >
      {children}
    </DashboardShell>
  );
}
