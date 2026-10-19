import type { Metadata } from "next";

import { ItemView } from "@/components/modules/approvals-views";

export const metadata: Metadata = { title: "Approvals & Workflow · Decision", description: "One decision: the request, the context to judge it, and the conversation about it." };

export default async function ItemPage({ params }: { params: Promise<{ key: string; section?: string[] }> }) {
  const { key, section } = await params;
  return <ItemView keyValue={decodeURIComponent(key)} section={section?.[0]} />;
}
