import { env } from "@/lib/utils/env";

export interface PaymentGatewayAdapter {
  initializePayment(input: {
    amount: number;
    email: string;
    reference: string;
    callbackUrl: string;
  }): Promise<{ checkoutUrl: string; reference: string; provider: string }>;
  verifyPayment(reference: string): Promise<{ status: "SUCCESS" | "FAILED" | "PENDING"; raw: unknown }>;
}

class MockGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly provider: string) {}

  async initializePayment(input: { amount: number; email: string; reference: string; callbackUrl: string }) {
    return {
      checkoutUrl: `${input.callbackUrl}?reference=${input.reference}&provider=${this.provider.toLowerCase()}`,
      reference: input.reference,
      provider: this.provider
    };
  }

  async verifyPayment(reference: string) {
    return {
      status: "SUCCESS" as const,
      raw: {
        reference,
        provider: this.provider,
        mode: "mock"
      }
    };
  }
}

export function getPaymentGateway(provider: "PAYSTACK" | "FLUTTERWAVE") {
  if (provider === "PAYSTACK" && env.PAYSTACK_SECRET_KEY) {
    return new MockGatewayAdapter("PAYSTACK");
  }

  if (provider === "FLUTTERWAVE" && env.FLUTTERWAVE_SECRET_KEY) {
    return new MockGatewayAdapter("FLUTTERWAVE");
  }

  return new MockGatewayAdapter(provider);
}
