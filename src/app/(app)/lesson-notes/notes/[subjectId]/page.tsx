import type { Metadata } from "next";

import { SubjectNotesView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Subject notes", description: "Every week's note for one subject." };

export default async function SubjectNotesPage({ params, searchParams }: { params: Promise<{ subjectId: string }>; searchParams: Promise<{ term?: string }> }) {
  const { subjectId } = await params;
  const { term } = await searchParams;
  return <SubjectNotesView subjectId={subjectId} term={term} />;
}
