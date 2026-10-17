import type { Metadata } from "next";

import { StructureView } from "@/components/modules/fee-management-views";

export const metadata: Metadata = { title: "Fee Management · Structure", description: "One fee structure: its items, the classes mapped to it, and what it bills." };

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StructureView id={id} />;
}
