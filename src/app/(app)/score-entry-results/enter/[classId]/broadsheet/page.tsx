import type { Metadata } from "next";

import { BroadsheetView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Broadsheet", description: "Every child in an arm against every subject, including the marks nobody has entered." };

export default async function BroadsheetPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <BroadsheetView classId={classId} />;
}
