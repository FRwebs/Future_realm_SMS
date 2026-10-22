import type { Metadata } from "next";

import { FormBroadsheetView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Scores · Class broadsheet", description: "Your form class against every subject it takes." };

export default async function FormBroadsheetPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <FormBroadsheetView classId={classId} />;
}
