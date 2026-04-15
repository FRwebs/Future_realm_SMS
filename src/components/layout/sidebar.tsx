"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { SessionUser } from "@/lib/domain/types";
import { getVisibleWorkflowNavGroups } from "@/lib/navigation/workflows";
import { cn } from "@/lib/utils/cn";

type SidebarProps = {
  session: SessionUser;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

function SidebarContent({
  session,
  collapsed,
  pathname,
  onToggleCollapse,
  onCloseMobile,
  isMobile = false,
}: {
  session: SessionUser;
  collapsed: boolean;
  pathname: string;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  isMobile?: boolean;
}) {
  const visibleGroups = getVisibleWorkflowNavGroups(session.role);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-ink text-white shadow-panel">
      <div
        className={cn(
          "relative flex items-center border-b border-white/10 px-4 py-5",
          collapsed ? "justify-center" : "gap-3 px-5"
        )}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 font-bold text-white shadow-md shadow-brand-950/20">
          FR
        </div>

        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-[var(--font-heading)] text-lg font-bold">
                FutureRealm SMS
              </p>
              <p className="text-sm text-white/50">Smart school operations</p>
            </div>

            <div className="flex items-center gap-2">
              {!isMobile && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Collapse sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}

              {isMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close mobile sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}

        {collapsed && !isMobile && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="absolute right-3 top-5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-white/10 px-5 py-4">
          <div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/40">
              Signed in as
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {session.name}
            </p>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 px-3 py-4">
        <div className="pointer-events-none absolute inset-x-3 top-4 z-10 h-6 bg-gradient-to-b from-ink to-transparent" />
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-10 h-6 bg-gradient-to-t from-ink to-transparent" />

        <nav className="sidebar-scroll h-full overflow-y-auto pr-1">
          <div className="grid gap-5 pb-4">
            {visibleGroups.map((group) => (
              <section key={group.title} className="grid gap-2">
                {!collapsed && (
                  <div className="px-3">
                    <p className="text-[0.67rem] font-semibold uppercase tracking-[0.24em] text-white/35">
                      {group.title}
                    </p>
                  </div>
                )}

                <div className="grid gap-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                    return (
                      <div key={item.href} className="group/item relative">
                        <Link
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          onClick={isMobile ? onCloseMobile : undefined}
                          className={cn(
                            "group relative flex items-center rounded-2xl text-sm font-medium transition-all duration-200",
                            collapsed
                              ? "justify-center px-3 py-3.5"
                              : "gap-3 px-4 py-3",
                            active
                              ? "bg-brand-500 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/10"
                              : "text-white/70 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200",
                              collapsed
                                ? "left-1/2 h-1.5 w-6 -translate-x-1/2 translate-y-7"
                                : "left-1 h-8 w-1",
                              active ? "bg-white/90" : "bg-transparent"
                            )}
                          />

                          <span
                            className={cn(
                              "absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-200",
                              active && "bg-brand-400/20 opacity-100"
                            )}
                          />

                          <Icon
                            className={cn(
                              "relative z-[1] shrink-0 transition-transform duration-200",
                              collapsed ? "h-5 w-5" : "h-4 w-4",
                              !active && "group-hover:scale-105"
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
                            <div className="relative whitespace-nowrap rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-xs font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                              {item.label}
                              <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-[#111827]" />
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
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={cn(
          "relative hidden self-stretch lg:block",
          collapsed ? "w-[92px]" : "w-[300px]"
        )}
      >
        <div className="sticky top-4 h-[calc(100dvh-2rem)]">
          <SidebarContent
            session={session}
            collapsed={collapsed}
            pathname={pathname}
            onToggleCollapse={onToggleCollapse}
            onCloseMobile={onCloseMobile}
          />
        </div>
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          />
          <aside className="fixed inset-y-4 left-4 z-50 w-[300px] max-w-[calc(100vw-2rem)] lg:hidden">
            <SidebarContent
              session={session}
              collapsed={false}
              pathname={pathname}
              onToggleCollapse={onToggleCollapse}
              onCloseMobile={onCloseMobile}
              isMobile
            />
          </aside>
        </>
      )}
    </>
  );
}
