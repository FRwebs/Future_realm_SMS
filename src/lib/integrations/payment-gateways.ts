import { createHmac, timingSafeEqual } from "crypto";

import { env } from "@/lib/utils/env";

export type GatewayProvider = "PAYSTACK" | "FLUTTERWAVE";
export type GatewayVerificationStatus = "SUCCESS" | "FAILED" | "PENDING" | "ABANDONED" | "REVERSED";

export interface PaymentGatewayInitializeInput {
  amount: number;
  currency?: string;
  email: string;
  reference: string;
  callbackUrl: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
  customFields?: Array<{ display_name: string; variable_name: string; value: string }>;
}

export interface PaymentGatewayInitializeResult {
  checkoutUrl: string;
  accessCode?: string;
  reference: string;
  provider: GatewayProvider;
  raw?: unknown;
}

export interface PaymentGatewayVerificationResult {
  status: GatewayVerificationStatus;
  amount?: number;
  currency?: string;
  channel?: string;
  gatewayTransactionId?: string;
  paidAt?: string;
  customerEmail?: string;
  raw: unknown;
}

export interface PaymentGatewayAdapter {
  initializePayment(input: PaymentGatewayInitializeInput): Promise<PaymentGatewayInitializeResult>;
  verifyPayment(reference: string): Promise<PaymentGatewayVerificationResult>;
}

function toKobo(amount: number) {
  return Math.round(amount * 100);
}

function fromKobo(amount?: number) {
  return typeof amount === "number" ? amount / 100 : undefined;
}

function normalizePaystackStatus(status?: string): GatewayVerificationStatus {
  if (status === "success") return "SUCCESS";
  if (status === "failed") return "FAILED";
  if (status === "abandoned") return "ABANDONED";
  if (status === "reversed") return "REVERSED";
  return "PENDING";
}

function normalizeFlutterwaveStatus(status?: string): GatewayVerificationStatus {
  if (status === "successful") return "SUCCESS";
  if (status === "failed") return "FAILED";
  if (status === "cancelled") return "ABANDONED";
  return "PENDING";
}

async function parseGatewayResponse<T>(response: Response, provider: string): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !body) {
    throw new Error(`${provider} request failed with status ${response.status}`);
  }
  return body;
}

class MockGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly provider: GatewayProvider) {}

  async initializePayment(input: PaymentGatewayInitializeInput): Promise<PaymentGatewayInitializeResult> {
    return {
      checkoutUrl: `${input.callbackUrl}?reference=${input.reference}&provider=${this.provider.toLowerCase()}`,
      reference: input.reference,
      provider: this.provider,
      raw: { mode: "mock", metadata: input.metadata }
    };
  }

  async verifyPayment(reference: string): Promise<PaymentGatewayVerificationResult> {
    return {
      status: "SUCCESS",
      amount: undefined,
      currency: "NGN",
      gatewayTransactionId: reference,
      raw: {
        reference,
        provider: this.provider,
        mode: "mock"
      }
    };
  }
}

class PaystackGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly secretKey: string) {}

  async initializePayment(input: PaymentGatewayInitializeInput): Promise<PaymentGatewayInitializeResult> {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: String(toKobo(input.amount)),
        email: input.email,
        currency: input.currency ?? "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: input.channels ?? ["card", "bank", "ussd", "qr", "bank_transfer", "mobile_money"],
        metadata: {
          ...(input.metadata ?? {}),
          custom_fields: input.customFields ?? []
        }
      })
    });
    const body = await parseGatewayResponse<{
      status: boolean;
      message: string;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    }>(response, "Paystack");

    if (!body.status || !body.data?.authorization_url) {
      throw new Error(body.message || "Paystack did not return a checkout URL.");
    }

    return {
      checkoutUrl: body.data.authorization_url,
      accessCode: body.data.access_code,
      reference: body.data.reference ?? input.reference,
      provider: "PAYSTACK",
      raw: body
    };
  }

  async verifyPayment(reference: string): Promise<PaymentGatewayVerificationResult> {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` }
    });
    const body = await parseGatewayResponse<{
      status: boolean;
      message: string;
      data?: {
        id?: number | string;
        status?: string;
        amount?: number;
        currency?: string;
        channel?: string;
        paid_at?: string;
        customer?: { email?: string };
      };
    }>(response, "Paystack");
    const data = body.data ?? {};

    return {
      status: normalizePaystackStatus(data.status),
      amount: fromKobo(data.amount),
      currency: data.currency,
      channel: data.channel,
      gatewayTransactionId: data.id ? String(data.id) : undefined,
      paidAt: data.paid_at,
      customerEmail: data.customer?.email,
      raw: body
    };
  }
}

class FlutterwaveGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly secretKey: string) {}

  async initializePayment(input: PaymentGatewayInitializeInput): Promise<PaymentGatewayInitializeResult> {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency ?? "NGN",
        redirect_url: input.callbackUrl,
        payment_options: (input.channels ?? ["card", "banktransfer", "ussd"]).join(", "),
        customer: {
          email: input.email,
          name: input.customerName,
          phonenumber: input.customerPhone
        },
        meta: input.metadata,
        customizations: {
          title: "School Fees Payment",
          description: "Secure school fee collection"
        }
      })
    });
    const body = await parseGatewayResponse<{
      status: string;
      message: string;
      data?: { link?: string };
    }>(response, "Flutterwave");

    if (body.status !== "success" || !body.data?.link) {
      throw new Error(body.message || "Flutterwave did not return a checkout URL.");
    }

    return {
      checkoutUrl: body.data.link,
      reference: input.reference,
      provider: "FLUTTERWAVE",
      raw: body
    };
  }

  async verifyPayment(reference: string): Promise<PaymentGatewayVerificationResult> {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` }
    });
    const body = await parseGatewayResponse<{
      status: string;
      message: string;
      data?: {
        id?: number | string;
        status?: string;
        amount?: number;
        currency?: string;
        payment_type?: string;
        created_at?: string;
        customer?: { email?: string };
      };
    }>(response, "Flutterwave");
    const data = body.data ?? {};

    return {
      status: normalizeFlutterwaveStatus(data.status),
      amount: data.amount,
      currency: data.currency,
      channel: data.payment_type,
      gatewayTransactionId: data.id ? String(data.id) : undefined,
      paidAt: data.created_at,
      customerEmail: data.customer?.email,
      raw: body
    };
  }
}

export function getPaymentGateway(provider: GatewayProvider) {
  if (provider === "PAYSTACK" && env.PAYSTACK_SECRET_KEY) {
    return new PaystackGatewayAdapter(env.PAYSTACK_SECRET_KEY);
  }

  if (provider === "FLUTTERWAVE" && env.FLUTTERWAVE_SECRET_KEY) {
    return new FlutterwaveGatewayAdapter(env.FLUTTERWAVE_SECRET_KEY);
  }

  return new MockGatewayAdapter(provider);
}

export function verifyPaystackSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyFlutterwaveSignature(signature: string | undefined, secret: string | undefined) {
  if (!signature || !secret) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(secret));
}
