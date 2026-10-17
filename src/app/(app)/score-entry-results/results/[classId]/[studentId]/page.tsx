import type { Metadata } from "next";

import { StudentView } from "@/components/modules/score-results-views";

export const metadata: Metadata = { title: "Score Entry & Results · Result", description: "One child's result, and how every number was reached." };

export default async function StudentResultPage({ params }: { params: Promise<{ classId: string; studentId: string }> }) {
  const { classId, studentId } = await params;
  return <StudentView classId={classId} studentId={studentId} from="results" />;
}
