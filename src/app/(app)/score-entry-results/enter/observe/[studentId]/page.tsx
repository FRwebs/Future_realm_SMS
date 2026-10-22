import type { Metadata } from "next";

import { ObserveView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Observations · Child", description: "What a teacher saw, in words." };

export default async function ObservePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <ObserveView studentId={studentId} />;
}
