import type { Metadata } from "next";

import { RoleTemplatesView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Role templates", description: "What a new account starts from, and what everyone on it holds." };

export default function RoleTemplatesPage() {
  return <RoleTemplatesView />;
}
