import type { Metadata } from "next";

import { CourseEditorView } from "@/components/modules/training-views";

export const metadata: Metadata = { title: "Staff & Access · Course", description: "Write a course, lesson by lesson." };

export default async function CourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseEditorView courseId={courseId} />;
}
