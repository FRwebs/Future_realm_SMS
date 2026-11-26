import type { Metadata } from "next";

import { LeavePolicyView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Leave policy", description: "What the school offers, on what terms, and who decides a request." };

export default function LeavePolicyPage() {
  return <LeavePolicyView />;
}
