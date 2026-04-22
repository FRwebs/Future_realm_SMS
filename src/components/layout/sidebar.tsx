"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { SessionUser } from "@/lib/domain/types";
import type { PortalType } from "@/lib/navigation/registry";
import { getVisibleWorkflowNavGroups } from "@/lib/navigation/workflows";
import { cn } from "@/lib/utils/cn";

type SidebarProps = {
  session: SessionUser;
  permissions?: string[];
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  portalType?: PortalType;
};

function normalizePath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function SidebarContent({
  session,
  permissions,
  collapsed,
  pathname,
  onToggleCollapse,
  onCloseMobile,
  portalType = "school",
  isMobile = false,
}: {
  session: SessionUser;
  permissions?: string[];
  collapsed: boolean;
  pathname: string;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  portalType?: PortalType;
  isMobile?: boolean;
}) {
  const visibleGroups = getVisibleWorkflowNavGroups(
    session.role,
    permissions,
    portalType,
  );

  const normalizedPath = normalizePath(pathname);

  const allNavHrefs = visibleGroups
    .flatMap((group) => group.items)
    .map((item) => normalizePath(item.href));

  const bestMatch =
    allNavHrefs
      .filter(
        (href) =>
          normalizedPath === href || normalizedPath.startsWith(`${href}/`),
      )
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-brand-100/80 bg-[linear-gradient(180deg,rgba(246,250,247,0.98),rgba(235,244,238,0.96),rgba(255,255,255,0.94))] text-ink shadow-[0_20px_48px_rgba(37,89,63,0.12)] backdrop-blur-xl">
      <div
        className={cn(
          "border-b border-brand-100/80 bg-[radial-gradient(circle_at_top_left,rgba(116,176,141,0.18),rgba(255,255,255,0.72),rgba(235,244,238,0.85))]",
          collapsed ? "px-3 py-4" : "px-5 py-5",
        )}
      >
        {collapsed && !isMobile ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 via-brand-500 to-emerald-400 font-bold text-white shadow-[0_16px_34px_rgba(37,89,63,0.26)]",
              )}
            >
              {portalType === "super_admin" ? "SA" : "FR"}
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-100 bg-white/92 text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 via-brand-500 to-emerald-400 font-bold text-white shadow-[0_16px_34px_rgba(37,89,63,0.26)]",
              )}
            >
              {portalType === "super_admin" ? "SA" : "FR"}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-[var(--font-heading)] text-lg font-bold">
                FutureRealm SMS
              </p>
              <p className="text-sm text-ink/55">
                {portalType === "super_admin"
                  ? "Platform control"
                  : "Smart school operations"}
              </p>
              {portalType === "super_admin" && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                  Super Admin
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isMobile && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Collapse sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-100 bg-white/92 text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}

              {isMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close mobile sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-100 bg-white/92 text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-brand-100/70 px-5 py-4">
          <div className="rounded-2xl bg-white/88 px-4 py-3 ring-1 ring-brand-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            <p className="mt-1 truncate text-sm font-semibold text-ink">
              {session.name}
            </p>
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
              {portalType === "super_admin"
                ? "Super Admin Team"
                : "School Portal"}
            </p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative min-h-0 flex-1 py-4",
          collapsed ? "px-2" : "px-3",
        )}
      >
        <div className="pointer-events-none absolute inset-x-3 top-4 z-10 h-6 bg-gradient-to-b from-brand-50/95 to-transparent" />
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-10 h-6 bg-gradient-to-t from-brand-50/95 to-transparent" />

        <nav className="sidebar-scroll h-full overflow-y-auto pr-1">
          <div className="grid gap-5 pb-4">
            {visibleGroups.map((group) => (
              <section key={group.title} className="grid gap-2">
                {!collapsed && (
                  <div className="px-3">
                    <p className="text-[0.67rem] font-semibold uppercase tracking-[0.24em] text-brand-700/70">
                      {group.title}
                    </p>
                  </div>
                )}

                <div className="grid gap-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const normalizedHref = normalizePath(item.href);
                    const active = bestMatch === normalizedHref;

                    return (
                      <div key={item.href} className="group/item relative">
                        <Link
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          onClick={isMobile ? onCloseMobile : undefined}
                          className={cn(
                            "group relative flex items-center rounded-2xl text-sm font-medium transition-all duration-200",
                            collapsed
                              ? "mx-auto h-12 w-12 justify-center p-0"
                              : "gap-3 px-4 py-3",
                            active
                              ? "border border-brand-100 bg-gradient-to-r from-brand-50 via-emerald-50 to-white text-brand-900 ring-1 ring-white/70 shadow-[0_14px_30px_rgba(37,89,63,0.14)]"
                              : "text-ink/65 hover:bg-brand-50/75 hover:text-brand-900 hover:shadow-[0_8px_20px_rgba(37,89,63,0.08)]",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute rounded-full transition-all duration-200",
                              collapsed
                                ? "bottom-1.5 left-1/2 h-1.5 w-6 -translate-x-1/2"
                                : "left-1 top-1/2 h-8 w-1 -translate-y-1/2",
                              active ? "bg-brand-600" : "bg-transparent",
                            )}
                          />

                          <span
                            className={cn(
                              "absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-200",
                              active && "bg-brand-200/35 opacity-100",
                            )}
                          />

                          <Icon
                            className={cn(
                              "relative z-[1] shrink-0 transition-transform duration-200",
                              collapsed ? "h-5 w-5" : "h-4 w-4",
                              !active && "group-hover:scale-105",
                            )}
                          />

                          {!collapsed && (
                            <span className="relative z-[1] truncate">
                              {item.label}
                            </span>
                          )}
                        </Link>

                        {collapsed && !isMobile && (
                          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 opacity-0 transition-all duration-200 group-hover/item:translate-x-0 group-hover/item:opacity-100">
                            <div className="relative whitespace-nowrap rounded-xl border border-brand-100 bg-white px-3 py-2 text-xs font-medium text-ink shadow-[0_12px_30px_rgba(37,89,63,0.14)]">
                              {item.label}
                              <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-brand-100 bg-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function Sidebar({
  session,
  permissions = [],
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  portalType = "school",
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen shrink-0 overflow-hidden bg-white p-0 transition-all duration-200 md:block",
          collapsed
            ? "w-[var(--layout-sidebar-collapsed)] min-w-[var(--layout-sidebar-collapsed)]"
            : "w-[var(--layout-sidebar-width)] min-w-[var(--layout-sidebar-width)]",
        )}
      >
        <div className="h-full border-l-[3px] border-primary-500 p-3">
          <SidebarContent
            session={session}
            permissions={permissions}
            collapsed={collapsed}
            pathname={pathname}
            onToggleCollapse={onToggleCollapse}
            onCloseMobile={onCloseMobile}
            portalType={portalType}
          />
        </div>
      </aside>

      {mobileOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 w-[var(--layout-sidebar-width)] max-w-[calc(100vw-1rem)] bg-transparent md:hidden">
          <SidebarContent
            session={session}
            permissions={permissions}
            collapsed={false}
            pathname={pathname}
            onToggleCollapse={onToggleCollapse}
            onCloseMobile={onCloseMobile}
            portalType={portalType}
            isMobile
          />
        </aside>
      )}
    </>
  );
}
