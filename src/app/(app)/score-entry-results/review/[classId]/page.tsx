import type { Metadata } from "next";

import { ArmReviewView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Review", description: "One arm's sheets and children, ready to approve, decline or send back." };

export default async function ArmReviewPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <ArmReviewView classId={classId} />;
}
