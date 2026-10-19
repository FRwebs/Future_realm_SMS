import type { Metadata } from "next";

import { RouteView } from "@/components/modules/approvals-views";

export const metadata: Metadata = { title: "Approvals & Workflow · Route", description: "One approval route, end to end: who decides, how long it may sit, and how it is performing." };

export default async function RoutePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return <RouteView type={decodeURIComponent(type)} />;
}
