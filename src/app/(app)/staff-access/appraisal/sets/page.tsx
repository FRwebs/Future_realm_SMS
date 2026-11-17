import type { Metadata } from "next";

import { AppraisalSetsView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · KPI sets and the cycle", description: "What each role is measured on, and the order the cycle runs in." };

export default function AppraisalSetsPage() {
  return <AppraisalSetsView />;
}
