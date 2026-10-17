import type { Metadata } from "next";

import { AppraisalOneView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Appraisal", description: "One appraisal: their words, the product’s figures and the review." };

export default async function AppraisalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppraisalOneView id={id} />;
}
