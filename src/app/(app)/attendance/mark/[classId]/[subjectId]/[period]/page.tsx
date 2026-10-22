import type { Metadata } from "next";

import { PeriodMarkView } from "@/components/modules/attendance-views";

export const metadata: Metadata = { title: "Attendance · Period register", description: "Take one period's register." };

export default async function PeriodMarkPage({ params, searchParams }: { params: Promise<{ classId: string; subjectId: string; period: string }>; searchParams: Promise<{ date?: string }> }) {
  const { classId, subjectId, period } = await params;
  const { date } = await searchParams;
  return <PeriodMarkView classId={classId} subjectId={subjectId} period={period} date={date} />;
}
