import type { Metadata } from "next";

import { StaffRecordView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Staff record", description: "One person: who they are, what they hold, what they are paid and what they can reach." };

export default async function StaffRecord_assignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffRecordView id={id} section="assignments" />;
}
