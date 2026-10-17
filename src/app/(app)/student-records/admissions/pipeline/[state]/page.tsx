import type { Metadata } from "next";

import { PipelineView } from "@/components/modules/student-records-views";

export const metadata: Metadata = { title: "Student Records · Pipeline", description: "Every applicant in one stage of the admissions pipeline." };

export default async function PipelinePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  return <PipelineView state={state} />;
}
