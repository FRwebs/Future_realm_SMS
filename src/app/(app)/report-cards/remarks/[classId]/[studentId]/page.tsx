import type { Metadata } from "next";

import { RemarkView } from "@/components/modules/report-cards-views";

export const metadata: Metadata = { title: "Report Cards · Remark", description: "One child's remarks, read and reviewed." };

export default async function RemarkPage({ params }: { params: Promise<{ classId: string; studentId: string }> }) {
  const { classId, studentId } = await params;
  return <RemarkView classId={classId} studentId={studentId} />;
}
