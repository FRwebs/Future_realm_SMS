import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "FutureRealm SMS",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-dashboard-grid px-4 py-4 md:px-6 md:py-6">
      <DashboardShell session={session}>{children}</DashboardShell>
    </div>
  );
}