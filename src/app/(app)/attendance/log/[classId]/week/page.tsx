import type { Metadata } from "next";

import { WeekView } from "@/components/modules/attendance-views";

export const metadata: Metadata = { title: "Attendance · Week", description: "One arm's week, day by day." };

export default async function ArmWeekPage({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<{ start?: string }> }) {
  const { classId } = await params;
  const { start } = await searchParams;
  return <WeekView classId={classId} start={start} />;
}
