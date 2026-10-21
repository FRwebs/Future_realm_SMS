import { inSchoolCurrency } from "../platform-policy/pricing-snapshot";
import { platformPolicy } from "../platform-policy/policy.service";
import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CHANNEL_RATES, TIERS, discountFor, gatewayMode, json, nextInvoiceNo, num, quote, round2, schoolOf, taxRate, tierOf, currentTerm } from "./billing.shared";
import { PaymentsService } from "./payments.service";

/**
 * Credits: what is left on the two channels that cost money, and how to put more on. Email and
 * in-app are free on every tier, so there is nothing to top up for them.
 */

const topUpSchema = z.object({
  channel: z.string().default("SMS"),
  quantity: z.string().default("10,000"),
  custom: z.string().optional(),
  payBy: z.string().default("Card · now"),
  auto: z.coerce.boolean().default(false),
  warnAt: z.string().optional(),
  warnWho: z.string().optional(),
  email: z.string().optional()
});

const settingsSchema = z.object({ auto: z.coerce.boolean().default(false), channel: z.string().default("SMS"), quantity: z.string().default("10,000"), warnAt: z.string().default("2,000 credits"), warnWho: z.string().default("The Bursar") });

/** The first figure in a label such as "10,000 · ₦36,860 · 3% off" — never every digit in it. */
const number = (value: string | undefined) => Number(((value ?? "").match(/\d[\d,]*/)?.[0] ?? "").replace(/,/g, "")) || 0;

@Injectable()
export class CreditsService {
  constructor(private readonly payments: PaymentsService) {}

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    const tier = tierOf(school);
    const term = await currentTerm(schoolId);
    const since = term?.startDate ?? new Date(Date.now() - 120 * 86_400_000);
    const [wallet, ledger, used, guardians] = await Promise.all([
      prisma.notificationWallet.findUnique({ where: { schoolId } }),
      prisma.creditLedger.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 60 }),
      prisma.notificationLog.groupBy({ by: ["channel"], where: { schoolId, sentAt: { gte: since } }, _count: { _all: true } }),
      prisma.guardian.count({ where: { schoolId } })
    ]);
    const count = (channel: string) => used.find((row) => row.channel === channel)?._count._all ?? 0;
    const sub = school.schoolSubscription;
    const base = { SMS: sub?.baseSms ?? TIERS[tier].baseSms, WHATSAPP: sub?.baseWhatsapp ?? TIERS[tier].baseWhatsapp };
    const toppedThisTerm = (channel: string) => ledger.filter((row) => row.channel === channel && row.kind === "TOPUP" && row.createdAt >= since).reduce((sum, row) => sum + row.credits, 0);
    const invoices = await prisma.platformInvoice.findMany({ where: { id: { in: ledger.map((row) => row.invoiceId).filter((id): id is string => Boolean(id)) } }, select: { id: true, invoiceNo: true } });
    const invoiceNo = new Map(invoices.map((row) => [row.id, row.invoiceNo]));
    const balance = { SMS: wallet?.smsBalance ?? 0, WHATSAPP: wallet?.whatsappBalance ?? 0 };
    const auto = (sub?.autoTopup ?? null) as { on: boolean; channel: string; quantity: number } | null;
    return {
      configured: Boolean(wallet),
      term: term ? `${term.name} ${term.academicSession?.name ?? ""}`.trim() : null,
      guardians,
      threshold: wallet?.lowBalanceThreshold ?? 0,
      lastToppedUpAt: wallet?.lastToppedUpAt?.toISOString() ?? null,
      channels: [
        { key: "SMS", name: "SMS", paid: true, rate: CHANNEL_RATES.SMS, base: base.SMS, topped: toppedThisTerm("SMS"), used: count("SMS"), balance: balance.SMS, note: "160 characters a message", sendsCovered: guardians ? Math.floor(balance.SMS / guardians) : 0 },
        { key: "WHATSAPP", name: "WhatsApp", paid: true, rate: CHANNEL_RATES.WHATSAPP, base: base.WHATSAPP, topped: toppedThisTerm("WHATSAPP"), used: 0, balance: balance.WHATSAPP, note: "Billed by conversation, not message" },
        { key: "EMAIL", name: "Email", paid: false, rate: 0, base: 0, topped: 0, used: count("EMAIL"), balance: 0, note: "Unlimited on every tier" },
        { key: "IN_APP", name: "In-app", paid: false, rate: 0, base: 0, topped: 0, used: count("IN_APP"), balance: 0, note: "Unlimited · reaches activated families only" }
      ],
      topUps: ledger.filter((row) => row.kind === "TOPUP").map((row) => ({ id: row.id, at: row.createdAt.toISOString(), channel: row.channel === "SMS" ? "SMS" : "WhatsApp", credits: row.credits, amount: num(row.amount), method: row.method === "CARD" ? "Card" : row.method ?? "—", invoice: row.invoiceId ? invoiceNo.get(row.invoiceId) ?? null : null, invoiceId: row.invoiceId })),
      pricing: { sms: CHANNEL_RATES.SMS, smsInternational: CHANNEL_RATES.SMS_INTERNATIONAL, whatsapp: CHANNEL_RATES.WHATSAPP, tiers: { discount10k: 0.03, discount25k: 0.06 }, baseSms: base.SMS, baseWhatsapp: base.WHATSAPP },
      settings: { auto: Boolean(auto?.on), autoChannel: auto?.channel ?? "SMS", autoQuantity: auto?.quantity ?? 10_000, warnAt: sub?.warnAt ?? 2000, warnWho: sub?.warnWho ?? "The Bursar" },
      gateway: gatewayMode(),
      cards: await this.payments.cards(schoolId)
    };
  }

  /** The cost of a quantity, before anything is bought. */
  price(channel: string, credits: number) {
    const key = channel.toLowerCase().startsWith("what") ? "WHATSAPP" : "SMS";
    return { key, credits, ...quote(key, credits) };
  }

  async topUp(session: SessionPayload, body: unknown) {
    const input = topUpSchema.parse(body);
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    const credits = input.quantity.startsWith("A number") ? number(input.custom) : number(input.quantity);
    if (credits < 100) throw new BadRequestException("The smallest top-up is 100 credits.");
    if (credits > 500_000) throw new BadRequestException("The largest single top-up is 500,000 credits. Speak to your Account Manager about more.");
    const priced = this.price(input.channel, credits);
    const { key, rate, discount } = priced;
    const subtotal = inSchoolCurrency(Number(priced.subtotal), school.currency);
    const tax = round2(subtotal * (await taxRate(school.country)));
    const invoice = await prisma.platformInvoice.create({
      data: { schoolId, invoiceNo: await nextInvoiceNo(), amount: (await platformPolicy.invoiceTerms(Number(subtotal))).amount, taxAmount: tax, currency: school.currency, status: "PENDING", dueAt: (await platformPolicy.invoiceTerms(0)).dueAt, metadata: json({ kind: "TOPUP", description: `Credit top-up · ${credits.toLocaleString("en-NG")} ${key === "SMS" ? "SMS" : "WhatsApp"}`, channel: key, credits, rate, discount }) }
    });
    await this.saveSettings(session, { auto: input.auto, channel: input.channel, quantity: String(credits), warnAt: input.warnAt ?? "2,000 credits", warnWho: input.warnWho ?? "The Bursar" }, true);
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.BILLING_UPDATE, entityType: "PlatformInvoice", entityId: invoice.id, metadata: json({ summary: `Credit top-up invoiced · ${invoice.invoiceNo}`, credits, channel: key, total: round2(subtotal + tax) }) } });
    const total = round2(subtotal + tax);
    if (input.payBy.startsWith("Card")) return { invoiceId: invoice.id, credits, ...(await this.payments.start(session, invoice.id, { method: "Card", email: input.email || undefined })) };
    return { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, total, credits, mode: "transfer" as const, note: "The invoice is issued. The credits land on the wallet once Future Realm confirms the transfer." };
  }

  async saveSettings(session: SessionPayload, body: unknown, quiet = false) {
    const input = settingsSchema.parse(body);
    const school = await schoolOf(session.schoolId);
    const data = { autoTopup: json({ on: input.auto, channel: input.channel.toLowerCase().startsWith("what") ? "WHATSAPP" : "SMS", quantity: number(input.quantity) || 10_000 }), warnAt: number(input.warnAt) || 2000, warnWho: input.warnWho };
    await prisma.schoolSubscription.upsert({ where: { schoolId: session.schoolId }, update: data, create: { schoolId: session.schoolId, tier: tierOf(school), ...data } });
    if (!quiet) await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.BILLING_UPDATE, entityType: "SchoolSubscription", entityId: session.schoolId, metadata: json({ summary: "Credit settings saved", ...data }) } });
    return { saved: true, discountNote: discountFor(10_000) };
  }
}
