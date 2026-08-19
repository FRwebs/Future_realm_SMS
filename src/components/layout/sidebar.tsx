"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Search, User, X } from "lucide-react";

import { roleLabels } from "@/lib/auth/roles";
import { dropdownItemsFor } from "@/components/layout/topbar";
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const profilePath = dropdownItemsFor(session)[0]?.path ?? "/dashboard";

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

  const query = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!query) return visibleGroups;
    return visibleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, visibleGroups.length]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (!accountMenuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [accountMenuOpen]);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-[#0d2315] text-white",
        collapsed && !isMobile ? "overflow-visible" : "overflow-hidden",
      )}
    >
      <div
        className={cn(
          "border-b border-[rgba(255,255,255,0.13)]",
          collapsed ? "px-3 py-4" : "px-5 py-5",
        )}
      >
        {collapsed && !isMobile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4fa895] via-[#12796a] to-[#0d2315] font-bold text-white shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
              {portalType === "super_admin" ? "SA" : "FR"}
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.7)] transition hover:bg-[rgba(255,255,255,0.14)] hover:text-white"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4fa895] via-[#12796a] to-[#0d2315] font-bold text-white shadow-[0_18px_34px_rgba(18,121,106,0.18)]">
              {portalType === "super_admin" ? "SA" : "FR"}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-[var(--font-heading)] text-lg font-bold text-white">
                FutureRealm SMS
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.12)] px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-gold)" }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                  {portalType === "super_admin" ? "Super Admin" : "School Portal"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isMobile && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Collapse sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.7)] transition hover:bg-[rgba(255,255,255,0.14)] hover:text-white"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}

              {isMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close mobile sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.7)] transition hover:bg-[rgba(255,255,255,0.14)] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 pt-4">
          <label className="flex items-center gap-[9px] rounded-[11px] border border-[rgba(255,255,255,0.13)] bg-[rgba(255,255,255,0.09)] px-[11px] py-[9px]">
            <Search className="h-[15px] w-[15px] shrink-0 text-[rgba(255,255,255,0.6)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={portalType === "super_admin" ? "Search modules…" : "Search students, staff…"}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-white placeholder:text-[rgba(255,255,255,0.55)] outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="shrink-0 text-[rgba(255,255,255,0.55)] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="shrink-0 rounded-[5px] border border-[rgba(255,255,255,0.2)] px-[5px] py-px text-[10.5px] font-semibold text-[rgba(255,255,255,0.45)]">
                ⌘K
              </span>
            )}
          </label>
        </div>
      )}

      <div
        className={cn(
          "relative min-h-0 flex-1 py-2",
          collapsed ? "px-1.5" : "px-3",
        )}
      >
        <div className="pointer-events-none absolute inset-x-3 top-2 z-10 h-6 bg-gradient-to-b from-[#0d2315] to-transparent" />
        <div className="pointer-events-none absolute inset-x-3 bottom-2 z-10 h-6 bg-gradient-to-t from-[#0d2315] to-transparent" />

        <nav
          className={cn(
            "sidebar-scroll h-full",
            collapsed && !isMobile
              ? "overflow-x-visible overflow-y-auto pr-0"
              : "overflow-y-auto pr-1",
          )}
        >
          <div className="grid gap-5 py-2 pb-4">
            {filteredGroups.map((group) => (
              <section key={group.title} className="grid gap-2">
                {!collapsed && (
                  <div className="px-3">
                    <p className="text-[0.67rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,255,255,0.42)]">
                      {group.title}
                    </p>
                  </div>
                )}

                <div className="grid gap-1">
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
                            "group relative flex items-center rounded-[11px] text-[13.2px] transition-all duration-200",
                            collapsed
                              ? "mx-auto h-12 w-12 justify-center p-0"
                              : "gap-3 px-3 py-2.5",
                            active
                              ? "bg-[#ffffff] font-semibold text-[#0d2315] shadow-[0_8px_18px_-10px_rgba(0,0,0,0.7)]"
                              : "font-medium text-[rgba(255,255,255,0.78)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute rounded-r-[4px] bg-[#ffffff] transition-all duration-200",
                              collapsed
                                ? "bottom-1.5 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full"
                                : "-left-3 top-1/2 h-[22px] w-1 -translate-y-1/2",
                              active ? "opacity-100" : "opacity-0",
                            )}
                          />

                          <Icon
                            className={cn(
                              "relative z-[1] shrink-0 transition-transform duration-200",
                              collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                              !active && "group-hover:scale-105",
                            )}
                          />

                          {!collapsed && (
                            <span className="relative z-[1] flex-1 truncate">
                              {item.label}
                            </span>
                          )}
                        </Link>

                        {collapsed && !isMobile && (
                          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 opacity-0 transition-all duration-200 group-hover/item:translate-x-0 group-hover/item:opacity-100">
                            <div className="relative whitespace-nowrap rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                              {item.label}
                              <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-[var(--color-border-default)] bg-[var(--color-bg-surface)]" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {query && filteredGroups.length === 0 ? (
              <p className="px-3 text-[12.5px] text-[rgba(255,255,255,0.5)]">No pages match &ldquo;{search}&rdquo;.</p>
            ) : null}
          </div>
        </nav>
      </div>

      <div ref={accountMenuRef} className="relative border-t border-[rgba(255,255,255,0.13)] px-4 py-3.5">
        {accountMenuOpen && (
          <div
            className={cn(
              "absolute bottom-[calc(100%+8px)] z-50 w-[calc(100%-2rem)] overflow-hidden rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)] shadow-[var(--shadow-lg)]",
              collapsed && !isMobile ? "left-[calc(100%+8px)] bottom-0 w-56" : "left-4",
            )}
          >
            <div className="border-b border-[var(--color-border-default)] px-4 py-3.5">
              <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{session.name}</p>
              <p className="truncate text-[11px] text-[var(--color-text-secondary)]">{roleLabels[session.role]}</p>
            </div>
            <div className="py-1.5">
              <Link
                href={profilePath as never}
                onClick={() => {
                  setAccountMenuOpen(false);
                  if (isMobile) onCloseMobile();
                }}
                className="mx-2 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]"
              >
                <User className="h-4 w-4 text-[var(--color-text-muted)]" />
                My Profile
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] transition disabled:opacity-60"
                style={{ color: "var(--color-danger)" }}
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          className={cn(
            "flex w-full items-center gap-[10px] rounded-[11px] transition",
            collapsed && !isMobile ? "justify-center p-1.5" : "px-1 py-1 hover:bg-[rgba(255,255,255,0.06)]",
          )}
        >
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-white text-[12.5px] font-bold font-[var(--font-heading)] text-[#0d2315]">
            {initials(session.name)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-semibold text-white">{session.name}</span>
                <span className="block truncate text-[11px] text-[rgba(255,255,255,0.62)]">{roleLabels[session.role]}</span>
              </span>
              <ChevronDown className={cn("h-[15px] w-[15px] shrink-0 text-[rgba(255,255,255,0.55)] transition-transform", accountMenuOpen ? "rotate-0" : "-rotate-90")} />
            </>
          )}
        </button>
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
          "sticky top-0 z-40 hidden h-screen shrink-0 p-0 transition-all duration-200 md:block",
          "bg-[#0d2315]",
          collapsed
            ? "w-[var(--layout-sidebar-collapsed)] min-w-[var(--layout-sidebar-collapsed)]"
            : "w-[var(--layout-sidebar-width)] min-w-[var(--layout-sidebar-width)]",
        )}
      >
        <SidebarContent
          session={session}
          permissions={permissions}
          collapsed={collapsed}
          pathname={pathname}
          onToggleCollapse={onToggleCollapse}
          onCloseMobile={onCloseMobile}
          portalType={portalType}
        />
      </aside>

      {mobileOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 w-[var(--layout-sidebar-width)] max-w-[calc(100vw-1rem)] bg-[#0d2315] md:hidden">
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
