import type { Metadata } from "next";

import { StudentWorkingView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Scores · A child’s result", description: "How a total was reached, and the comment that prints beside it." };

export default async function StudentWorkingPage({ params }: { params: Promise<{ classId: string; subjectId: string; studentId: string }> }) {
  const { classId, subjectId, studentId } = await params;
  return <StudentWorkingView classId={classId} subjectId={subjectId} studentId={studentId} />;
}
