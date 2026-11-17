import type { Metadata } from "next";

import { LeaveBalancesView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Leave balances", description: "Days approved this session against what each type allows." };

export default function LeaveBalancesPage() {
  return <LeaveBalancesView />;
}
