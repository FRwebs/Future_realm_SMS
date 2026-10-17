import type { Metadata } from "next";

import { GridView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Enter", description: "Type a score sheet — every child, every component." };

export default async function EnterPage({ params }: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { classId, subjectId } = await params;
  return <GridView classId={classId} subjectId={subjectId} />;
}
