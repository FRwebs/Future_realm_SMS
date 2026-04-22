"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PermissionProvider } from "@/components/auth/permission-provider";
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
      router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }, [canOpenRoute, pathname, portalType, router]);

  if (!canOpenRoute && portalType === "super_admin") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center">
        <section className="w-full">
          <div className="surface-hero p-8 md:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-700">
              Permission Check
            </p>
            <h1 className="mt-3 text-[28px] font-extrabold tracking-tight text-slate-900 md:text-[32px]">
              Super Admin permission required
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-600">
              Your internal platform role can sign in, but it cannot open this Super Admin section.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (!canOpenRoute) return null;

  return (
    <PermissionProvider permissions={permissions}>
      <div className="flex h-screen overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.96))]">
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
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
            {children}
          </main>
        </div>
      </div>
    </PermissionProvider>
  );
}
