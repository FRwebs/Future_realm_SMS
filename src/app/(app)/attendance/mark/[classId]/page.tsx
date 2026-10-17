import type { Metadata } from "next";

import { MarkView } from "@/components/modules/attendance-views";

export const metadata: Metadata = { title: "Attendance · Mark", description: "Take one arm's register." };

export default async function MarkArmPage({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { classId } = await params;
  const { date } = await searchParams;
  return <MarkView classId={classId} date={date} />;
}
