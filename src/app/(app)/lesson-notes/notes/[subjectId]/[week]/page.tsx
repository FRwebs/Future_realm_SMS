import type { Metadata } from "next";

import { NoteView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Note", description: "One week's lesson note." };

export default async function NotePage({ params }: { params: Promise<{ subjectId: string; week: string }> }) {
  const { subjectId, week } = await params;
  return <NoteView subjectId={subjectId} week={week} />;
}
