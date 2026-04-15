"use client";

import { useState } from "react";

import { SessionUser } from "@/lib/domain/types";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <Sidebar
        session={session}
        collapsed={collapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <main className="min-w-0 grid gap-4">
        <Topbar
          session={session}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((prev) => !prev)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        {children}
      </main>
    </div>
  );
}
