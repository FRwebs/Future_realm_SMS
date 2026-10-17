import type { Metadata } from "next";

import { PersonAccessView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Access map", description: "One person’s access: every module, every tab, every action." };

export default async function PersonAccessPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <PersonAccessView userId={userId} />;
}
