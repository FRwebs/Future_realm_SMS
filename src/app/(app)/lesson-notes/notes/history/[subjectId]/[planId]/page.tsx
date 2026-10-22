import type { Metadata } from "next";

import { HistoryNoteView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Signed note", description: "A signed note from an earlier term." };

export default async function HistoryNotePage({ params }: { params: Promise<{ subjectId: string; planId: string }> }) {
  const { subjectId, planId } = await params;
  return <HistoryNoteView subjectId={subjectId} planId={planId} />;
}
