import type { Policy } from "./policy.shared";

/**
 * The pricing part of the platform policy, as a plain snapshot the billing code can read without awaiting anything.
 * The policy refreshes it whenever it is read or saved.
 */
let current: Policy["pricing"] | null = null;

export const setPricingSnapshot = (pricing: Policy["pricing"]) => {
  current = pricing;
};

const ROUND_TO = 0.5; // to the nearest 50 kobo

/** The naira price of a tier per student per term: its dollar price at the term's rate when authored in dollars, else the built-in naira price. */
export function tierNairaRate(tier: "STANDARD" | "PREMIUM" | "ELITE", builtIn: number): number {
  const p = current;
  if (!p || p.anchor !== "USD") return builtIn;
  const usd = p.usd[tier];
  if (!usd || !p.ngnPerUsd) return builtIn;
  return Math.round((usd * p.ngnPerUsd) / ROUND_TO) * ROUND_TO;
}

const RATE_FIELD = { USD: "ngnPerUsd", GHS: "ngnPerGhs", KES: "ngnPerKes", GBP: "ngnPerGbp" } as const;

/**
 * A naira amount in the school's own currency, at the rate fixed for the term. A school is always invoiced in its own
 * currency; if its currency has no rate yet, the invoice is refused rather than issued in the wrong money.
 */
export function inSchoolCurrency(naira: number, currency: string | null | undefined): number {
  const code = (currency ?? "NGN").toUpperCase();
  if (code === "NGN") return naira;
  const field = RATE_FIELD[code as keyof typeof RATE_FIELD];
  const rate = field && current ? current[field] : 0;
  if (!rate) throw new Error(`No rate is fixed for ${code} yet, so an invoice in ${code} cannot be issued. Set the term's rates on Plans & Features.`);
  return Math.round((naira / rate) * 100) / 100;
}
