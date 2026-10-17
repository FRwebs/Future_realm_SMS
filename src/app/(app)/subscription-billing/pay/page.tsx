import type { Metadata } from "next";

import { PaymentReturnView } from "@/components/modules/subscription-billing-views";

export const metadata: Metadata = { title: "Subscription & Billing · Payment", description: "Where a payment to Future Realm lands." };

export default async function PayPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const query = await searchParams;
  return <PaymentReturnView reference={query.reference ?? query.trxref} />;
}
