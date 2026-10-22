import type { Metadata } from "next";

import { SchemeView } from "@/components/modules/lesson-notes-views";

export const metadata: Metadata = { title: "Lesson Notes · Scheme of work", description: "A subject's term, week by week." };

export default async function SchemePage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  return <SchemeView subjectId={subjectId} />;
}
