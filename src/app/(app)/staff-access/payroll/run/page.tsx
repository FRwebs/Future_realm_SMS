import type { Metadata } from "next";

import { PayrollRunView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Payroll run", description: "Everything this month’s run pays, and everything that changed." };

export default async function PayrollRunPage() {
  return <PayrollRunView />;
}
