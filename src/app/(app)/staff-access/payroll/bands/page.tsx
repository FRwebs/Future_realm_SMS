import type { Metadata } from "next";

import { PayrollBandsView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Pay bands", description: "What the school pays, rung by rung, and who sits on each." };

export default function PayrollBandsPage() {
  return <PayrollBandsView />;
}
