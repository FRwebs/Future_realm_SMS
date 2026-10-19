import type { Metadata } from "next";

import { CompletionArmView } from "@/components/modules/report-cards-views";

export const metadata: Metadata = { title: "Report Cards · Arm", description: "Where each child in one arm stands, and what can be sent." };

export default async function CompletionArmPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <CompletionArmView classId={classId} />;
}
