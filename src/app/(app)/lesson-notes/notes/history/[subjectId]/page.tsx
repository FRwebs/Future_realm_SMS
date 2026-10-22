import type { Metadata } from "next";

import { HistoryView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Note history", description: "Signed notes from earlier terms." };

export default async function HistoryPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  return <HistoryView subjectId={subjectId} />;
}
