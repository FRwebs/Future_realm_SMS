import type { Metadata } from "next";

import { LessonView } from "@/components/modules/training-views";

export const metadata: Metadata = { title: "Training · Lesson", description: "One lesson, and the question that ends it." };

export default async function LessonPage({ params }: { params: Promise<{ courseId: string; position: string }> }) {
  const { courseId, position } = await params;
  return <LessonView courseId={courseId} position={position} />;
}
