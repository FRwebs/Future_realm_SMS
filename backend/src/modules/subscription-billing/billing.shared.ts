import { REAL_STUDENTS } from "../super-admin/sample";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { env } from "../../../../src/lib/utils/env";
import { currentTerm, num } from "../student-records/records.shared";

export { currentTerm, num };

/**
 * What Future Realm charges, and how a school's bill is worked out. Priced per student per term,
 * so renewal is an arithmetic question a school can answer on screen: students × rate.
 */

export const OWNERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN"]);

export type TierKey = "STANDARD" | "PREMIUM" | "ELITE";

export const TIERS: Record<TierKey, { name: string; rate: number; baseSms: number; baseWhatsapp: number; features: Record<string, boolean> }> = {
  STANDARD: { name: "Standard", rate: 600, baseSms: 2000, baseWhatsapp: 500, features: { portal: false, reports: false, rich: false, manager: false } },
  PREMIUM: { name: "Premium", rate: 900, baseSms: 3000, baseWhatsapp: 1000, features: { portal: true, reports: true, rich: false, manager: false } },
  ELITE: { name: "Elite", rate: 1200, baseSms: 4000, baseWhatsapp: 1500, features: { portal: true, reports: true, rich: true, manager: true } }
};

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

export function rateOf(school: { plan: string; schoolSubscription: { tier: string; ratePerStudent: unknown } | null }): number {
  const own = school.schoolSubscription?.ratePerStudent;
  return own === null || own === undefined ? TIERS[tierOf(school)].rate : num(own);
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
