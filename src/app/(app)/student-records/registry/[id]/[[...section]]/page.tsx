import type { Metadata } from "next";

import { StudentRecordView } from "@/components/modules/student-records-views";

export const metadata: Metadata = { title: "Student Records · Student", description: "One child: who they are, how they are scoring, what has reached their family and what they owe." };

type PageProps = { params: Promise<{ id: string; section?: string[] }>; searchParams: Promise<{ term?: string; from?: string; arm?: string }> };

export default async function StudentRecordPage({ params, searchParams }: PageProps) {
  const { id, section } = await params;
  const query = await searchParams;
  return <StudentRecordView id={id} section={section?.[0]} termId={query.term} from={query.from} arm={query.arm} />;
}
