import type { Metadata } from "next";

import { RoleTemplateView } from "@/components/modules/staff-access-views";

export const metadata: Metadata = { title: "Staff & Access · Role template", description: "What a role grants in every module." };

export default async function RoleTemplatePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <RoleTemplateView name={decodeURIComponent(name)} />;
}
