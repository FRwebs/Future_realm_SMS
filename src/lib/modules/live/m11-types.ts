/** The shapes `/api/v1/subscription-billing` answers with, as the Plan, Credits and Account tabs read them. */

export type TierKey = "STANDARD" | "PREMIUM" | "ELITE";
export type InvoiceState = "Paid" | "Outstanding" | "Overdue";

export type InvoiceRow = { id: string; no: string; kind: "TERMLY" | "TOPUP" | "ONE_OFF"; kindLabel: string; period: string; amount: number; tax: number; total: number; issued: string; due: string; paidAt: string | null; state: InvoiceState; termLabel: string | null };

export type RenewalFacts = {
  current: string | null;
  next: { id: string; label: string; start: string; end: string } | null;
  restOfSession: number;
  roll: number;
  accepted: number;
  leavers: number;
  leaversLevel: string | null;
  suggest: number;
  rate: number;
  tier: TierKey;
  tierName: string;
  switching: boolean;
};

export type Plan = {
  school: { name: string; currency: string; billingStatus: string; status: string; trialEndsAt: string | null };
  term: { id: string; label: string } | null;
  next: RenewalFacts["next"];
  daysToRenew: number | null;
  tier: TierKey;
  tierName: string;
  rate: number;
  roll: number;
  thisTerm: { amount: number; students: number; billed: boolean; invoice: string | null };
  account: { state: string; outstanding: number; outstandingCount: number; lastSettled: string | null };
  running: Array<{ name: string; basis: string; units: number | null; rate: number | null; thisTerm: number | null; renews: string | null; state: string; action: string | null }>;
  value: Array<[string, string, string]>;
  invoices: InvoiceRow[];
  comparison: { roll: number; tiers: Array<{ key: TierKey; name: string; rate: number; term: number; session: number }>; capabilities: Array<{ label: string; standard: boolean; premium: boolean; elite: boolean }> };
  pending: { tier: string; from: string | null; reason: string | null } | null;
  renewal: RenewalFacts;
  preferences: { autoRenew: boolean; remindDays: number; invoiceTo: string | null; receiptEmail: string | null };
  gateway: "test" | "live";
};

export type ChannelRow = { key: string; name: string; paid: boolean; rate: number; base: number; topped: number; used: number; balance: number; note: string; sendsCovered?: number; entitled?: boolean; why?: string };

export type Credits = {
  configured: boolean;
  term: string | null;
  guardians: number;
  threshold: number;
  lastToppedUpAt: string | null;
  channels: ChannelRow[];
  topUps: Array<{ id: string; at: string; channel: string; credits: number; amount: number; method: string; invoice: string | null; invoiceId: string | null }>;
  pricing: { sms: number; smsInternational: number; whatsapp: number; baseSms: number; baseWhatsapp: number };
  settings: { auto: boolean; autoChannel: string; autoQuantity: number; warnAt: number; warnWho: string };
  gateway: "test" | "live";
  cards?: Array<{ id: string; brand: string | null; last4: string; bank: string | null; expires: string | null; since: string; lastUsedAt: string | null }>;
};

export type Account = {
  school: { name: string; ownerName: string | null; ownerEmail: string | null; country: string | null };
  agreement: { status: string; version: string | null; current?: string | null; acceptedAt: string | null; by: string | null; hosting: string | null; retentionDays: number; retentionDefault: boolean; dpo: { name: string; email: string | null } | null };
  contacts: { billing: string | null; billingEmail: string | null; school: string | null; manager: string | null; managerEmail: string | null; productOnly: boolean };
  address: { subdomain: string | null; issued: string };
  tier: TierKey;
  transfer: { id: string; status: string; createdAt: string; holdExpiresAt: string | null } | null;
  transfers: Array<{ id: string; status: string; createdAt: string }>;
  exports: Array<{ id: string; token: string; datasets: string[]; rows: number; expiresAt: string; downloadedAt: string | null; expired: boolean; createdAt: string }>;
  exportDelivered: boolean;
  closure: { status: string; createdAt: string; retentionDays: number } | null;
  counts: Record<string, number>;
  datasets: string[];
  canOwn: boolean;
  userMfa: boolean;
};

export type InvoiceDoc = {
  id: string;
  no: string;
  kind: string;
  state: InvoiceState;
  issued: string;
  due: string;
  paidAt: string | null;
  currency: string;
  lines: Array<{ description: string; qty: string; rate: string; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  billTo: { name: string; address: string; attention: string; email: string };
  payments: Array<{ reference: string; method: string; status: string; at: string; amount: number }>;
};
