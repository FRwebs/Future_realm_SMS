import type { Metadata } from "next";

import { TrendView } from "@/components/modules/attendance-views";

export const metadata: Metadata = { title: "Attendance · Log", description: "One arm's attendance across the term, week by week." };

export default async function ArmTrendPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <TrendView classId={classId} />;
}
