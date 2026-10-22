import type { Metadata } from "next";

import { CourseView } from "@/components/modules/training-views";

export const metadata: Metadata = { title: "Training · Course", description: "A course, lesson by lesson." };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseView courseId={courseId} />;
}
