import type { Metadata } from "next";

import { PayrollBandView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Pay band", description: "One band: its ladder, its allowances and who is on it." };

export default async function PayrollBandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayrollBandView id={id} />;
}
