import { z } from "zod";

/**
 * The platform's own defaults — what a school gets before anyone has decided anything. Each group is enforced by the
 * code named beside it; a key missing from the stored policy falls back to the value here.
 */

export const policySchema = z.object({
  /** LifecycleService: what happens when a trial ends. */
  trial: z.object({
    days: z.number().int().min(1).max(120),
    /** The school can still read and export, but not change anything, for this many days after the trial ends. */
    readOnlyDays: z.number().int().min(0).max(60),
    /** The owner is reminded this many days before the lock. */
    lockReminderDays: z.number().int().min(0).max(30),
  }),
  /** LifecycleService: what happens to a school nobody signs in to. */
  dormancy: z.object({
    watchDays: z.number().int().min(7).max(720),
    dormantDays: z.number().int().min(14).max(1080),
    /** After the owner is told, the web address is released this many days later if nobody has signed in. */
    noticeDays: z.number().int().min(7).max(365),
  }),
  /** Every platform invoice. */
  invoice: z.object({
    netDays: z.number().int().min(0).max(90),
    rounding: z.enum(["NONE", "NEAREST_NAIRA", "NEAREST_FIVE", "NEAREST_TEN"]),
  }),
  /** DeliveryService: when and how often a message may leave. */
  messaging: z.object({
    quietFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    quietTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    quietHoursOn: z.boolean(),
    dailyCapPerRecipient: z.number().int().min(0).max(100),
    maxAttempts: z.number().int().min(1).max(10),
    /** What the provider charges FutureRealm per message, in naira. 0 means it has not been entered yet — no margin is shown. */
    providerCostSms: z.number().min(0).max(1000),
    providerCostSmsInternational: z.number().min(0).max(1000),
    providerCostWhatsapp: z.number().min(0).max(1000),
    providerCostEmail: z.number().min(0).max(1000),
    /** Platform notices switched off by hand, by trigger key. The state change still happens; only the message is not sent. */
    disabledTriggers: z.array(z.string()),
  }),
  /** What the platform calls itself and how a school reaches it. Used on every email the platform sends. */
  identity: z.object({
    platformName: z.string().trim().min(2).max(60),
    supportEmail: z.union([z.literal(""), z.string().trim().email()]),
    supportPhone: z.string().trim().max(40),
    timeZone: z.string().trim().min(3).max(60),
  }),
  /**
   * Pricing. Naira is the currency a school is invoiced in. A tier can be authored once in US dollars (anchor "USD"): its
   * naira price is then the dollar price at the rate fixed for the term. With anchor "NGN" (or no dollar price set) the
   * built-in naira price stands and the other currencies are only a reading aid.
   */
  pricing: z.object({
    anchor: z.enum(["NGN", "USD"]),
    usd: z.object({ STANDARD: z.number().min(0).max(10000), PREMIUM: z.number().min(0).max(10000), ELITE: z.number().min(0).max(10000) }),
    ratesFor: z.string().max(60),
    ngnPerUsd: z.number().min(0).max(100000),
    ngnPerGhs: z.number().min(0).max(100000),
    ngnPerKes: z.number().min(0).max(100000),
    ngnPerGbp: z.number().min(0).max(100000),
    /** A rate that moves by more than this share is held for Finance to decide instead of being applied. */
    shockPercent: z.number().min(1).max(100),
    /** Where the rates came from: entered by hand, or fetched from FX_RATES_URL. */
    source: z.string().max(40),
    /** Rates waiting for Finance because they moved too far. */
    pending: z.object({ ratesFor: z.string(), ngnPerUsd: z.number(), ngnPerGhs: z.number(), ngnPerKes: z.number(), ngnPerGbp: z.number(), moved: z.string(), source: z.string(), proposedBy: z.string(), at: z.string() }).nullable(),
  }),
});

export type Policy = z.infer<typeof policySchema>;

export const DEFAULT_POLICY: Policy = {
  trial: { days: 30, readOnlyDays: 7, lockReminderDays: 3 },
  dormancy: { watchDays: 60, dormantDays: 120, noticeDays: 30 },
  invoice: { netDays: 14, rounding: "NONE" },
  messaging: { quietFrom: "21:00", quietTo: "06:00", quietHoursOn: false, dailyCapPerRecipient: 0, maxAttempts: 3, providerCostSms: 0, providerCostSmsInternational: 0, providerCostWhatsapp: 0, providerCostEmail: 0, disabledTriggers: [] },
  identity: { platformName: "FutureRealm SMS", supportEmail: "", supportPhone: "", timeZone: "Africa/Lagos" },
  pricing: { anchor: "NGN", usd: { STANDARD: 0, PREMIUM: 0, ELITE: 0 }, ratesFor: "", ngnPerUsd: 0, ngnPerGhs: 0, ngnPerKes: 0, ngnPerGbp: 0, shockPercent: 15, source: "", pending: null },
};

export const policyPatchSchema = z.object({
  trial: policySchema.shape.trial.partial().optional(),
  dormancy: policySchema.shape.dormancy.partial().optional(),
  invoice: policySchema.shape.invoice.partial().optional(),
  messaging: policySchema.shape.messaging.partial().optional(),
  pricing: policySchema.shape.pricing.partial().optional(),
  identity: policySchema.shape.identity.partial().optional(),
});

export function mergePolicy(stored: unknown, patch: z.infer<typeof policyPatchSchema> = {}): Policy {
  const base = (stored ?? {}) as Partial<Record<keyof Policy, Record<string, unknown>>>;
  const merged = {
    trial: { ...DEFAULT_POLICY.trial, ...(base.trial ?? {}), ...(patch.trial ?? {}) },
    dormancy: { ...DEFAULT_POLICY.dormancy, ...(base.dormancy ?? {}), ...(patch.dormancy ?? {}) },
    invoice: { ...DEFAULT_POLICY.invoice, ...(base.invoice ?? {}), ...(patch.invoice ?? {}) },
    messaging: { ...DEFAULT_POLICY.messaging, ...(base.messaging ?? {}), ...(patch.messaging ?? {}) },
    pricing: { ...DEFAULT_POLICY.pricing, ...(base.pricing ?? {}), ...(patch.pricing ?? {}) },
    identity: { ...DEFAULT_POLICY.identity, ...(base.identity ?? {}), ...(patch.identity ?? {}) },
  };
  const parsed = policySchema.parse(merged);
  if (parsed.dormancy.dormantDays <= parsed.dormancy.watchDays) throw new Error("A school is dormant later than it is put on watch: raise the dormant days above the watch days.");
  return parsed;
}

/** "21:00" → minutes since midnight. */
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Is this moment inside the quiet hours, in the school's day (Africa/Lagos)? Handles a window that crosses midnight. */
export function inQuietHours(policy: Policy["messaging"], now = new Date()): boolean {
  if (!policy.quietHoursOn) return false;
  const local = new Date(now.getTime() + 3_600_000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const from = minutesOf(policy.quietFrom);
  const to = minutesOf(policy.quietTo);
  return from === to ? false : from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

export function roundAmount(amount: number, rounding: Policy["invoice"]["rounding"]): number {
  const step = rounding === "NEAREST_NAIRA" ? 1 : rounding === "NEAREST_FIVE" ? 5 : rounding === "NEAREST_TEN" ? 10 : 0;
  return step ? Math.round(amount / step) * step : Math.round(amount * 100) / 100;
}
