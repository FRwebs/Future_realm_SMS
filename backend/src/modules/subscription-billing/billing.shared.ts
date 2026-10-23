import { REAL_STUDENTS } from "../super-admin/sample";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { env } from "../../../../src/lib/utils/env";
import { tierNairaRate } from "../platform-policy/pricing-snapshot";
import { currentTerm, num } from "../student-records/records.shared";

export { currentTerm, num };

/**
 * What Future Realm charges, and how a school's bill is worked out. Priced per student per term,
 * so renewal is an arithmetic question a school can answer on screen: students × rate.
 */

export const OWNERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN"]);

export type TierKey = "STANDARD" | "PREMIUM" | "ELITE";

type TierSpec = { name: string; rate: number; baseSms: number; baseWhatsapp: number; features: Record<string, boolean> };
const TIER_BASE: Record<TierKey, Omit<TierSpec, "rate"> & { builtInRate: number }> = {
  STANDARD: { name: "Standard", builtInRate: 600, baseSms: 2000, baseWhatsapp: 500, features: { portal: false, reports: false, rich: false, manager: false } },
  PREMIUM: { name: "Premium", builtInRate: 900, baseSms: 3000, baseWhatsapp: 1000, features: { portal: true, reports: true, rich: false, manager: false } },
  ELITE: { name: "Elite", builtInRate: 1200, baseSms: 4000, baseWhatsapp: 1500, features: { portal: true, reports: true, rich: true, manager: true } }
};

/** Each tier's termly price per student. `rate` is read live: it follows the dollar price at the term's rate when a tier is authored in dollars. */
export const TIERS = Object.fromEntries(
  (Object.keys(TIER_BASE) as TierKey[]).map((key) => {
    const { builtInRate, ...rest } = TIER_BASE[key];
    return [key, Object.defineProperty({ ...rest }, "rate", { enumerable: true, get: () => tierNairaRate(key, builtInRate) })];
  })
) as Record<TierKey, TierSpec>;


export const CAPABILITIES: Array<{ label: string; standard: boolean; premium: boolean; elite: boolean }> = [
  { label: "Attendance, scores, report cards", standard: true, premium: true, elite: true },
  { label: "Offline entry and sync", standard: true, premium: true, elite: true },
  { label: "Full data export, every tier", standard: true, premium: true, elite: true },
  { label: "Guardian portal", standard: false, premium: true, elite: true },
  { label: "Custom report builder", standard: false, premium: true, elite: true },
  { label: "Rich messaging channel", standard: false, premium: false, elite: true },
  { label: "Named Account Manager", standard: false, premium: false, elite: true }
];

export const CHANNEL_RATES = { SMS: 3.8, WHATSAPP: 4.4, SMS_INTERNATIONAL: 11.2 } as const;

/** Volume discount on a top-up, applied automatically. */
export function discountFor(credits: number): number {
  return credits >= 25_000 ? 0.06 : credits >= 10_000 ? 0.03 : 0;
}

export const round2 = (value: number) => Math.round(value * 100) / 100;

export function quote(channel: "SMS" | "WHATSAPP", credits: number) {
  const rate = CHANNEL_RATES[channel];
  const gross = round2(credits * rate);
  const discount = discountFor(credits);
  const subtotal = round2(gross * (1 - discount));
  return { rate, gross, discount, subtotal };
}

export const PLAN_TO_TIER: Record<string, TierKey> = { BASIC: "STANDARD", STANDARD: "STANDARD", PROFESSIONAL: "PREMIUM", ENTERPRISE: "ELITE", CUSTOM: "ELITE" };

export type InvoiceKind = "TERMLY" | "TOPUP" | "ONE_OFF";
export const KIND_LABEL: Record<InvoiceKind, string> = { TERMLY: "Termly plan", TOPUP: "Credit top-up", ONE_OFF: "One-off" };

/** The gateway is in test mode until the school's platform account has live keys — and the page says which. */
export const gatewayMode = (): "live" | "test" => (env.PAYSTACK_SECRET_KEY ? "live" : "test");

export async function schoolOf(schoolId: string) {
  return prisma.school.findUniqueOrThrow({ where: { id: schoolId }, include: { schoolSubscription: true } });
}

/** The tier this school is on today: its own row if it has one, else read from the plan it was sold. */
export function tierOf(school: { plan: string; schoolSubscription: { tier: string } | null }): TierKey {
  const own = school.schoolSubscription?.tier as TierKey | undefined;
  return own && own in TIERS ? own : PLAN_TO_TIER[school.plan] ?? "STANDARD";
}

/** A rate a school keeps until a date, whatever the tier's rate does meanwhile. */
export type PriceLock = { rate: number; until: Date; reason: string | null };

type LockableSubscription = {
  lockedMonthlyPrice?: unknown;
  priceLockedUntil?: Date | null;
  priceLockReason?: string | null;
};

/**
 * The agreed price a school is still holding, if any.
 *
 * A lock is what makes "the price you agreed is the price you pay until you
 * renew" true rather than aspirational: when the tier rate moves, schools
 * already on it are pinned at what they agreed, and only pick the new rate up
 * at their next renewal. An expired lock is simply ignored — it is left on the
 * row so the history of what a school was holding, and why, survives.
 */
export function priceLockOf(
  school: { schoolSubscription: LockableSubscription | null },
  at: Date = new Date(),
): PriceLock | null {
  const sub = school.schoolSubscription;
  if (!sub || sub.lockedMonthlyPrice === null || sub.lockedMonthlyPrice === undefined) return null;
  if (!sub.priceLockedUntil || sub.priceLockedUntil <= at) return null;
  return { rate: num(sub.lockedMonthlyPrice), until: sub.priceLockedUntil, reason: sub.priceLockReason ?? null };
}

/**
 * What this school pays per student per term.
 *
 * In order: a rate negotiated for them outright, then a price they are still
 * holding from before a change, then their tier's rate.
 */
export function rateOf(
  school: { plan: string; schoolSubscription: ({ tier: string; ratePerStudent: unknown } & LockableSubscription) | null },
): number {
  const own = school.schoolSubscription?.ratePerStudent;
  if (own !== null && own !== undefined) return num(own);
  const lock = priceLockOf(school);
  if (lock) return lock.rate;
  return TIERS[tierOf(school)].rate;
}

export async function rollCount(schoolId: string): Promise<number> {
  return prisma.student.count({ where: { schoolId, status: "ACTIVE", ...REAL_STUDENTS } });
}

/** The term after the one running now — what a renewal is for. */
export async function nextTerm(schoolId: string) {
  const current = await currentTerm(schoolId);
  const after = await prisma.term.findFirst({ where: { schoolId, startDate: { gt: current?.startDate ?? new Date(0) } }, include: { academicSession: true }, orderBy: { startDate: "asc" } });
  return { current, next: after };
}

export const termLabelOf = (term: { name: string; academicSession?: { name: string } | null }) => `${term.name} ${term.academicSession?.name ?? ""}`.trim();

/**
 * The term a payment made today is for.
 *
 * A school that is on its free trial is, today, in a term it has not paid for — so paying and upgrading now buys the term it is in, starting
 * today, not the next one (which would leave this term free and book the school a term ahead of itself). Every other school renews the term
 * after the one running now, as it always has. If the trial school's current term is already paid, the next term is the one that is left.
 */
export async function billingTarget(schoolId: string, onTrial: boolean) {
  const { current, next } = await nextTerm(schoolId);
  if (onTrial && current) {
    const paid = await prisma.platformInvoice.findFirst({ where: { schoolId, status: "PAID", metadata: { path: ["termLabel"], equals: termLabelOf(current) } } });
    if (!paid) return { term: current, startsNow: true, current, next };
  }
  return { term: next, startsNow: false, current, next };
}

export async function taxRate(country: string | null | undefined): Promise<number> {
  const row = await prisma.taxRate.findFirst({ where: { country: country ?? "Nigeria", isActive: true }, orderBy: { createdAt: "desc" } });
  return row ? row.rate / 100 : 0.075;
}

/** FR-INV-<year>-<next in sequence>: the platform's own numbering, never reused. */
export async function nextInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.platformInvoice.findMany({ where: { invoiceNo: { startsWith: `FR-INV-${year}-` } }, select: { invoiceNo: true } });
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.invoiceNo.split("-").pop()) || 0), 0);
  return `FR-INV-${year}-${String(highest + 1).padStart(4, "0")}`;
}

export type InvoiceMeta = {
  kind?: InvoiceKind;
  description?: string;
  termLabel?: string;
  units?: number;
  rate?: number;
  tier?: string;
  channel?: string;
  credits?: number;
  invoiceTo?: string;
  estimatedFrom?: string;
  terms?: number;
  discount?: number;
  [key: string]: unknown;
};

export const metaOf = (value: unknown): InvoiceMeta => ((value ?? {}) as InvoiceMeta);

export const ok = async <T>(dataPromise: Promise<T>, message?: string) => ({ ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise });

export const json = (value: unknown) => value as Prisma.InputJsonValue;

export const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
