import type { Metadata } from "next";

import { ReviewNoteView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Review", description: "Read a note, then sign it or return it." };

export default async function ReviewNotePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <ReviewNoteView planId={planId} />;
}
