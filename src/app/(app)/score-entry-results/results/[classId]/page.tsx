import type { Metadata } from "next";

import { ArmResultView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Results", description: "One arm's broadsheet." };

export default async function ArmResultPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <ArmResultView classId={classId} />;
}
