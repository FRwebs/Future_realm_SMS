import type { Metadata } from "next";

import { RulesView } from "@/components/modules/fee-management-views";

export const metadata: Metadata = { title: "Fee Management · Adjustment rules", description: "The discounts and concessions that appear as a line on every invoice." };

export default async function RulesPage() {
  return <RulesView />;
}
