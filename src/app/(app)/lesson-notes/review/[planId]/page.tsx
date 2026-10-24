import type { Metadata } from "next";

import { ReviewNoteView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Review", description: "Read a note, then sign it or return it." };

export default async function ReviewNotePage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams?: Promise<{ from?: string }> }) {
  const { planId } = await params;
  const from = (await searchParams)?.from;
  return <ReviewNoteView planId={planId} from={from} />;
}
