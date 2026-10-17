import type { Metadata } from "next";

import { ModuleAccessView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Module access", description: "One module of one person’s access, tab by tab." };

export default async function ModuleAccessPage({ params }: { params: Promise<{ userId: string; module: string }> }) {
  const { userId, module } = await params;
  return <ModuleAccessView userId={userId} slug={module} />;
}
