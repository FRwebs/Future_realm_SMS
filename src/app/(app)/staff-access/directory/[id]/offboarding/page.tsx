import type { Metadata } from "next";

import { OffboardingView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Offboarding", description: "Everything a person holds finds an owner before their account closes." };

export default async function OffboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OffboardingView id={id} />;
}
