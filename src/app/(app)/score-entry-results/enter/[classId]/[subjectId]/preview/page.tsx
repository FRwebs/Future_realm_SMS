import type { Metadata } from "next";

import { GridView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Preview", description: "The whole sheet, exactly as it will be submitted." };

export default async function PreviewPage({ params }: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { classId, subjectId } = await params;
  return <GridView classId={classId} subjectId={subjectId} preview />;
}
