import type { Metadata } from "next";

import { SensitiveGroupsView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Sensitive groups", description: "Records closed to everyone except a named few." };

export default function SensitiveGroupsPage() {
  return <SensitiveGroupsView />;
}
