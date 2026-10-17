import type { Metadata } from "next";

import { DayView } from "@/components/modules/attendance-views";

export const metadata: Metadata = { title: "Attendance · Register", description: "One arm's register on one day, every child and the mark they were given." };

export default async function ArmDayPage({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { classId } = await params;
  const { date } = await searchParams;
  return <DayView classId={classId} date={date} />;
}
