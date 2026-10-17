import type { Metadata } from "next";

import { ApplicantView } from "@/components/modules/student-records-views";

export const metadata: Metadata = { title: "Student Records · Applicant", description: "An applicant: their progress, their family and their screening." };

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicantView id={id} />;
}
