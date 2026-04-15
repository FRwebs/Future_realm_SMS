"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { roleLabels } from "@/lib/auth/roles";
import { SessionUser } from "@/lib/domain/types";
import { getWorkflowNavItemForPath } from "@/lib/navigation/workflows";

type TopbarProps = {
  session: SessionUser;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
};

export function Topbar({
  session,
  collapsed,
  onToggleSidebar,
  onOpenMobileSidebar,
}: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentItem = getWorkflowNavItemForPath(pathname);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="rounded-[2rem] border border-white/50 bg-white/85 p-5 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              aria-label="Open sidebar"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/5 bg-white text-ink shadow-sm transition hover:border-brand-200 hover:bg-brand-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-black/5 bg-white text-ink shadow-sm transition hover:border-brand-200 hover:bg-brand-50 lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
              {currentItem?.label ?? "School operations"}
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h2 className="truncate font-[var(--font-heading)] text-2xl font-bold text-ink md:text-3xl">
              Welcome back, {session.name}
            </h2>

            <span className="inline-flex w-fit items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
              {roleLabels[session.role]}
            </span>
          </div>

          <p className="mt-2 text-sm text-ink/60">
            Manage workflows, school records, and daily operations from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-800 hover:shadow-md active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}