"use client";

import { PortalProvider } from "@/components/layout/portal-context";
import { cn } from "@/lib/utils/cn";
import { OutboxSync } from "@/components/layout/outbox-sync";
import { PageLoadBeacon } from "@/components/layout/page-load-beacon";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PermissionProvider } from "@/components/auth/permission-provider";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { PlatformNotices } from "@/components/layout/platform-notices";
import { NavigationNoticeListener } from "@/components/layout/navigation-notice-listener";
import { useTheme } from "@/components/theme/theme-provider";
import type { PlatformSyncView, SessionUser } from "@/lib/domain/types";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import type { PortalType } from "@/lib/navigation/registry";
import type { TeacherRail } from "@/lib/navigation/workflows";
import { canAccessPathWithPermissions } from "@/lib/navigation/registry";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({
  session,
  permissions = [],
  portalType = "school",
  schoolName,
  schoolSlug,
  currentSessionName,
  currentTermName,
  platformStats,
  navBadges,
  hiddenNavIds,
  platformSync,
  teacherRail,
  children,
}: {
  session: SessionUser;
  permissions?: string[];
  portalType?: PortalType;
  schoolName?: string;
  schoolSlug?: string;
  currentSessionName?: string;
  currentTermName?: string;
  platformStats?: {
    totalSchools?: number;
    reviewQueueCount?: number;
  };
  navBadges?: Record<string, number | undefined>;
  hiddenNavIds?: string[];
  /** What the Back Office has decided for this school: read-only state, modules switched off, announcements, maintenance. */
  platformSync?: PlatformSyncView | null;
  /** The teaching workspace's rail, when the signed-in person is a teacher. */
  teacherRail?: TeacherRail | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme: activeTheme, toggleTheme } = useTheme();
  const canOpenRoute = canAccessPathWithPermissions(session.role, pathname, permissions);
  const theme = activeTheme === "light" ? "finance-light" : "finance-dark";

  // A module the Back Office has switched off is gone for everyone, so say that, rather than "not authorised".
  const switchedOff = platformSync?.switchedOff.find((module) => pathname === `/${module.slug}` || pathname.startsWith(`/${module.slug}/`));

  useEffect(() => {
    if (!canOpenRoute && portalType === "school") {
      const notice = switchedOff ? `module-off&module=${encodeURIComponent(switchedOff.name)}&scope=${switchedOff.scope}` : "not-authorized";
      router.replace(`${getDefaultPathForRole(session.role)}?notice=${notice}&from=${encodeURIComponent(pathname)}`);
    }
  }, [canOpenRoute, pathname, portalType, router, session.role, switchedOff]);

  if (!canOpenRoute && portalType === "super_admin") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center">
        <section className="w-full">
          <div className="surface-hero p-8 md:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">
              Permission Check
            </p>
            <h1 className="mt-3 text-[28px] font-extrabold tracking-tight text-[var(--color-text-primary)] md:text-[32px]">
              Super Admin permission required
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[var(--color-text-secondary)]">
              Your internal platform role can sign in, but it cannot open this Super Admin section.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (!canOpenRoute) return null;

  return (
    <PortalProvider value={portalType}>
    <PermissionProvider permissions={permissions}>
      <NavigationNoticeListener />
      <div
        data-shell-theme={theme}
        className="finance-shell flex h-screen overflow-hidden"
      >
        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md md:hidden"
          />
        )}

        <Sidebar
          session={session}
          permissions={permissions}
          collapsed={collapsed}
          mobileOpen={mobileSidebarOpen}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          portalType={portalType}
          theme={theme}
          navBadges={navBadges}
          hiddenNavIds={hiddenNavIds}
          teacherRail={teacherRail}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            session={session}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            permissions={permissions}
            portalType={portalType}
            schoolName={schoolName}
            schoolSlug={schoolSlug}
            currentSessionName={currentSessionName}
            currentTermName={currentTermName}
            platformStats={platformStats}
            theme={theme}
            onToggleTheme={toggleTheme}
            currentThemeMode={activeTheme}
          />
          <ImpersonationBanner session={session} />
          {portalType === "school" && platformSync ? <PlatformNotices sync={platformSync} /> : null}
          <OutboxSync />
          <PageLoadBeacon />
          <main
            data-portal={portalType}
            className={cn(
              "finance-scroll min-w-0 flex-1 overflow-y-auto px-4 pb-5 pt-4",
              // The Back Office page frame: 24px above, 28px at the sides, 64px below.
              portalType === "super_admin" ? "md:px-7 md:pb-16 md:pt-6" : "md:px-6 md:pb-8 md:pt-5"
            )}
          >
            {/* No `key={pathname}` here on purpose: keying this on the route forces React to
                tear the whole subtree down and rebuild it on every navigation, which discards
                the Suspense boundary Next.js already wraps `children` in — so instead of
                showing the previous page until the next one (or its loading.tsx fallback) is
                ready, the screen goes blank for a beat first. That read as a flicker/refresh.
                Leaving the wrapper's identity stable lets Suspense do its normal swap; the
                incoming content is still a freshly-inserted child each time, so it still gets
                its own page-shell-enter entrance below. */}
            <div className="page-shell-enter mx-auto w-full max-w-[1480px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PermissionProvider>
    </PortalProvider>
  );
}
