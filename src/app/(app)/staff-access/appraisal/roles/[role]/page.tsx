import type { Metadata } from "next";

import { RoleKpiView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Role KPIs", description: "The KPIs a role is appraised on, and their weights." };

export default async function RoleKpiPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  return <RoleKpiView role={decodeURIComponent(role)} />;
}
