"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PermissionProvider } from "@/components/auth/permission-provider";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { SessionUser } from "@/lib/domain/types";
import type { PortalType } from "@/lib/navigation/registry";
import { canAccessPathWithPermissions } from "@/lib/navigation/registry";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({
  session,
  permissions = [],
  portalType = "school",
  schoolName,
  children,
}: {
  session: SessionUser;
  permissions?: string[];
  portalType?: PortalType;
  schoolName?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const canOpenRoute = canAccessPathWithPermissions(session.role, pathname, permissions);

  useEffect(() => {
    if (!canOpenRoute && portalType === "school") {
      router.replace(getDefaultPathForRole(session.role));
    }
  }, [canOpenRoute, portalType, router, session.role]);

  if (!canOpenRoute && portalType === "super_admin") {
    return (
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-8 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Permission check</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">Super Admin permission required</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/68">
          Your internal platform role can sign in, but it cannot open this Super Admin section.
        </p>
      </section>
    );
  }

  if (!canOpenRoute) return null;

  return (
    <PermissionProvider permissions={permissions}>
      <div className="flex h-screen overflow-hidden bg-dashboard-grid">
        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
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
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            session={session}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            permissions={permissions}
            portalType={portalType}
            schoolName={schoolName}
          />
          <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </PermissionProvider>
  );
}
