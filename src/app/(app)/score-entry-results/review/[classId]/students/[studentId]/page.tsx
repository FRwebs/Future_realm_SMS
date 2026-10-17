import type { Metadata } from "next";

import { StudentView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Child", description: "One child's whole result, every subject and every component." };

export default async function ReviewStudentPage({ params }: { params: Promise<{ classId: string; studentId: string }> }) {
  const { classId, studentId } = await params;
  return <StudentView classId={classId} studentId={studentId} from="review" />;
}
