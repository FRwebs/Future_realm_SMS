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
  theme?: "default" | "finance-dark" | "finance-light";
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
  theme = "default",
  isMobile = false,
}: {
  session: SessionUser;
  permissions?: string[];
  collapsed: boolean;
  pathname: string;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  portalType?: PortalType;
  theme?: "default" | "finance-dark" | "finance-light";
  isMobile?: boolean;
}) {
  const isFinanceLight = theme === "finance-light";
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
    <div
      className={cn(
        "flex h-full flex-col rounded-[2rem] backdrop-blur-xl",
        collapsed && !isMobile ? "overflow-visible" : "overflow-hidden",
        isFinanceLight
          ? "finance-sidebar-card border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,248,0.98),rgba(240,245,241,0.96))] text-[var(--finance-text-primary)] shadow-[0_18px_38px_rgba(15,23,42,0.10)]"
          : "finance-sidebar-card border-[var(--finance-border)] bg-[linear-gradient(180deg,rgba(18,33,23,0.98),rgba(26,46,32,0.98),rgba(15,28,19,0.98))] text-[var(--finance-text-primary)] shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
      )}
    >
      <div
        className={cn(
          isFinanceLight
            ? "border-b border-[var(--finance-border)] bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),rgba(255,255,255,0.94),rgba(240,245,241,0.98))]"
            : "border-b border-[var(--finance-border)] bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),rgba(18,33,23,0.98),rgba(15,28,19,0.98))]",
          collapsed ? "px-3 py-4" : "px-5 py-5",
        )}
      >
        {collapsed && !isMobile ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold text-white",
                isFinanceLight
                  ? "bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#122117] shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                  : "bg-gradient-to-br from-[#2dd4bf] via-[#0f766e] to-[#122117] shadow-[0_16px_34px_rgba(0,0,0,0.28)]",
              )}
            >
              {portalType === "super_admin" ? "SA" : "FR"}
            </div>

            <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                  isFinanceLight
                    ? "border-[var(--finance-border)] bg-white/85 text-[var(--finance-text-secondary)] hover:bg-white hover:text-[var(--finance-text-primary)]"
                    : "border-[var(--finance-border)] bg-[var(--finance-surface-soft)] text-[var(--finance-text-secondary)] hover:bg-[var(--finance-surface-soft-hover)] hover:text-[var(--finance-text-primary)]",
                )}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-white",
                isFinanceLight
                  ? "bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#122117] shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                  : "bg-gradient-to-br from-[#2dd4bf] via-[#0f766e] to-[#122117] shadow-[0_18px_34px_rgba(45,212,191,0.18)]",
              )}
            >
              {portalType === "super_admin" ? "SA" : "FR"}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-[var(--font-heading)] text-lg font-bold">
                FutureRealm SMS
              </p>
              <p className="text-sm text-[var(--finance-text-secondary)]">
                {portalType === "super_admin"
                  ? "Platform control"
                  : "Smart school operations"}
              </p>
              {portalType === "super_admin" && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--finance-text-muted)]">
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
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                    isFinanceLight
                      ? "border-[var(--finance-border)] bg-white/85 text-[var(--finance-text-secondary)] hover:bg-white hover:text-[var(--finance-text-primary)]"
                      : "border-[var(--finance-border)] bg-[var(--finance-surface-soft)] text-[var(--finance-text-secondary)] hover:bg-[var(--finance-surface-soft-hover)] hover:text-[var(--finance-text-primary)]",
                  )}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}

              {isMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close mobile sidebar"
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                    isFinanceLight
                      ? "border-[var(--finance-border)] bg-white/85 text-[var(--finance-text-secondary)] hover:bg-white hover:text-[var(--finance-text-primary)]"
                      : "border-[var(--finance-border)] bg-[var(--finance-surface-soft)] text-[var(--finance-text-secondary)] hover:bg-[var(--finance-surface-soft-hover)] hover:text-[var(--finance-text-primary)]",
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-[var(--finance-border)] px-5 py-4">
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              isFinanceLight
                ? "bg-white/85 ring-1 ring-[var(--finance-border)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                : "bg-[var(--finance-surface-soft)] ring-1 ring-[var(--finance-border)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
            )}
          >
            <p className="mt-1 truncate text-sm font-semibold text-[var(--finance-text-primary)]">
              {session.name}
            </p>
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.16em] text-[var(--finance-text-muted)]">
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
          collapsed ? "px-1.5" : "px-3",
        )}
      >
        <div className={cn("pointer-events-none absolute inset-x-3 top-4 z-10 h-6", isFinanceLight ? "bg-gradient-to-b from-[rgba(255,255,255,0.96)] to-transparent" : "bg-gradient-to-b from-[#122117] to-transparent")} />
        <div className={cn("pointer-events-none absolute inset-x-3 bottom-4 z-10 h-6", isFinanceLight ? "bg-gradient-to-t from-[rgba(255,255,255,0.96)] to-transparent" : "bg-gradient-to-t from-[#122117] to-transparent")} />

        <nav
          className={cn(
            "sidebar-scroll h-full",
            collapsed && !isMobile
              ? "overflow-x-visible overflow-y-auto pr-0"
              : "overflow-y-auto pr-1",
          )}
        >
          <div className="grid gap-5 pb-4">
            {visibleGroups.map((group) => (
              <section key={group.title} className="grid gap-2">
                {!collapsed && (
                  <div className="px-3">
                    <p className="text-[0.67rem] font-semibold uppercase tracking-[0.24em] text-[var(--finance-text-muted)]">
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
                              ? isFinanceLight
                                ? "border border-[#a7ece1] bg-[linear-gradient(135deg,rgba(45,212,191,0.18),rgba(255,255,255,0.98))] text-[var(--finance-text-primary)] shadow-[0_12px_28px_rgba(15,23,42,0.10)]"
                                : "border border-[var(--finance-border)] bg-[linear-gradient(135deg,rgba(45,212,191,0.18),rgba(18,33,23,0.98))] text-[var(--finance-text-primary)] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                              : isFinanceLight
                                ? "text-[var(--finance-text-secondary)] hover:bg-black/[0.03] hover:text-[var(--finance-text-primary)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                                : "text-[var(--finance-text-secondary)] hover:bg-[var(--finance-surface-soft)] hover:text-[var(--finance-text-primary)] hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute rounded-full transition-all duration-200",
                              collapsed
                                ? "bottom-1.5 left-1/2 h-1.5 w-6 -translate-x-1/2"
                                : "left-1 top-1/2 h-8 w-1 -translate-y-1/2",
                              active ? "bg-[var(--finance-accent-primary)]" : "bg-transparent",
                            )}
                          />

                          <span
                            className={cn(
                              "absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-200",
                              active && "bg-[var(--finance-accent-primary)]/20 opacity-100",
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
                            <div
                              className={cn(
                                "relative whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium shadow-[0_12px_30px_rgba(37,89,63,0.14)]",
                                isFinanceLight
                                  ? "border-[var(--finance-border)] bg-white text-[var(--finance-text-primary)] shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                                  : "border-[var(--finance-border)] bg-[var(--color-bg-overlay)] text-[var(--finance-text-primary)] shadow-[0_18px_34px_rgba(0,0,0,0.38)]",
                              )}
                            >
                              {item.label}
                              <span
                                className={cn(
                                  "absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l",
                                  isFinanceLight ? "border-[var(--finance-border)] bg-white" : "border-[var(--finance-border)] bg-[var(--color-bg-overlay)]",
                                )}
                              />
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
  theme = "default",
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen shrink-0 p-0 transition-all duration-200 md:block",
          collapsed ? "overflow-visible" : "overflow-hidden",
          "bg-transparent",
          collapsed
            ? "w-[var(--layout-sidebar-collapsed)] min-w-[var(--layout-sidebar-collapsed)]"
            : "w-[var(--layout-sidebar-width)] min-w-[var(--layout-sidebar-width)]",
        )}
      >
        <div className={cn("h-full", collapsed ? "px-2 py-3" : "p-3")}>
          <SidebarContent
            session={session}
            permissions={permissions}
            collapsed={collapsed}
            pathname={pathname}
            onToggleCollapse={onToggleCollapse}
            onCloseMobile={onCloseMobile}
            portalType={portalType}
            theme={theme}
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
            theme={theme}
            isMobile
          />
        </aside>
      )}
    </>
  );
}
