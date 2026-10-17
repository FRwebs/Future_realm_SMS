import type { Metadata } from "next";

import { SheetView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Sheet", description: "One subject in one arm, every child and every component, and the decision about it." };

export default async function SheetPage({ params }: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { classId, subjectId } = await params;
  return <SheetView classId={classId} subjectId={subjectId} />;
}
