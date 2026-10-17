import type { Metadata } from "next";

import { OffboardChooserView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Offboard someone", description: "Choose who is leaving." };

export default async function OffboardChooserPage() {
  return <OffboardChooserView />;
}
