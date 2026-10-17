import type { Metadata } from "next";

import { ExportView } from "@/components/modules/subscription-billing-views";

export const metadata: Metadata = { title: "Subscription & Billing · Full export", description: "Download each dataset of a full-school export." };

export default async function ExportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ExportView token={token} />;
}
