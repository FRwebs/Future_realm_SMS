import type { Metadata } from "next";

import { CheckoutView } from "@/components/modules/training-views";

export const metadata: Metadata = { title: "Training · Checkout", description: "Settle your basket — ask the school to pay, or record a payment you made." };

export default function CheckoutPage() {
  return <CheckoutView />;
}
