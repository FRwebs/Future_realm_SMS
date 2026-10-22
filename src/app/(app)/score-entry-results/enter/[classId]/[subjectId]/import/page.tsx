import type { Metadata } from "next";

import { ScoreImportView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry · Import", description: "Bring a sheet's scores in from Excel." };

export default async function ScoreImportPage({ params }: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { classId, subjectId } = await params;
  return <ScoreImportView classId={classId} subjectId={subjectId} />;
}
