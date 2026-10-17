import type { Metadata } from "next";

import { FamilyView } from "@/components/modules/guardians-views";

export const metadata: Metadata = { title: "Parents & Guardians · Family", description: "One family: their children, their balance and what has been sent." };

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FamilyView id={id} />;
}
