import type { Metadata } from "next";

import { FamilyView } from "@/components/modules/fee-management-views";

export const metadata: Metadata = { title: "Fee Management · Family", description: "One family’s money: what was billed, what came in, and every conversation about it." };

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FamilyView id={decodeURIComponent(id)} />;
}
