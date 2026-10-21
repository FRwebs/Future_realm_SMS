import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getPaymentGateway } from "../../../../src/lib/integrations/payment-gateways";
import { gatewayMode, json, metaOf, num, round2 } from "./billing.shared";

/**
 * Paying Future Realm. A payment is started against one invoice, finished when the gateway says it
 * cleared, and only then does anything change: the invoice is paid and whatever it bought —
 * credits on the wallet, a term on the plan — is applied, exactly once.
 */

const startSchema = z.object({ method: z.string().default("Card"), email: z.string().email("Give an email address for the receipt.").optional(), saveCard: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false) });

@Injectable()
export class PaymentsService {
  async start(session: SessionPayload, invoiceId: string, body: unknown) {
    const input = startSchema.parse(body ?? {});
    const schoolId = session.schoolId;
    const invoice = await prisma.platformInvoice.findFirst({ where: { id: invoiceId, schoolId }, include: { transactions: true } });
    if (!invoice) throw new NotFoundException("That invoice does not exist.");
    if (invoice.status === "PAID") throw new BadRequestException(`${invoice.invoiceNo} is already paid.`);
    const total = round2(num(invoice.amount) + num(invoice.taxAmount));
    if (input.method.startsWith("Bank")) {
      await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.BILLING_UPDATE, entityType: "PlatformInvoice", entityId: invoice.id, metadata: json({ summary: `Bank transfer chosen · ${invoice.invoiceNo}`, total }) } });
      return { mode: "transfer" as const, invoiceNo: invoice.invoiceNo, total, note: "Pay by bank transfer quoting the invoice number. Whatever the invoice buys is applied when Future Realm's finance team confirms the payment." };
    }
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, ownerEmail: true, ownerPhone: true, schoolSubscription: { select: { receiptEmail: true } } } });
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, firstName: true, lastName: true } });
    const email = input.email ?? school.schoolSubscription?.receiptEmail ?? user?.email ?? school.ownerEmail ?? "";
    if (!email) throw new BadRequestException("Give an email address for the receipt.");
    const reference = `FR-PAY-${Date.now().toString(36).toUpperCase()}`;
    const checkout = await getPaymentGateway("PAYSTACK").initializePayment({
      amount: total,
      email,
      customerName: user ? `${user.firstName} ${user.lastName}` : school.name,
      customerPhone: school.ownerPhone ?? undefined,
      reference,
      callbackUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/subscription-billing/pay`,
      channels: ["card"],
      metadata: { school_id: schoolId, invoice_id: invoice.id, invoice_no: invoice.invoiceNo }
    });
    await prisma.platformBillingTransaction.create({ data: { schoolId, invoiceId: invoice.id, amount: total, method: "CARD", status: "PENDING", reference, recordedById: session.userId, metadata: json({ saveCard: input.saveCard, email, provider: checkout.provider, mode: gatewayMode() }) } });
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.PAYMENT, entityType: "PlatformInvoice", entityId: invoice.id, metadata: json({ summary: `Card payment started · ${invoice.invoiceNo}`, reference, total }) } });
    return { mode: "card" as const, checkoutUrl: checkout.checkoutUrl, reference, invoiceNo: invoice.invoiceNo, total, gateway: gatewayMode() };
  }

  /** Ask the gateway what happened, and apply what the invoice bought — once. */
  async settle(session: SessionPayload, reference: string) {
    const schoolId = session.schoolId;
    const tx = await prisma.platformBillingTransaction.findFirst({ where: { reference, schoolId }, include: { invoice: true } });
    if (!tx || !tx.invoice) throw new NotFoundException("That payment does not exist.");
    if (tx.status === "SUCCESS") return { status: "SUCCESS", invoiceNo: tx.invoice.invoiceNo, already: true, total: num(tx.amount), applied: null as string | null, mode: String(metaOf(tx.metadata).mode ?? "test") };
    if (tx.status === "FAILED") return { status: "FAILED", invoiceNo: tx.invoice.invoiceNo, already: false, total: num(tx.amount), applied: null, mode: String(metaOf(tx.metadata).mode ?? "test") };
    if (round2(num(tx.invoice.amount) + num(tx.invoice.taxAmount)) !== round2(num(tx.amount))) throw new BadRequestException("The invoice changed after this payment was started. Start the payment again.");
    const verification = await getPaymentGateway("PAYSTACK").verifyPayment(reference);
    if (verification.status !== "SUCCESS") {
      await prisma.platformBillingTransaction.update({ where: { id: tx.id }, data: { status: verification.status === "PENDING" ? "PENDING" : "FAILED", metadata: json({ ...metaOf(tx.metadata), verification: verification.status }) } });
      return { status: verification.status, invoiceNo: tx.invoice.invoiceNo, already: false, total: num(tx.amount), applied: null, mode: String(metaOf(tx.metadata).mode ?? "test") };
    }
    const applied = await prisma.$transaction(async (db) => {
      await db.platformBillingTransaction.update({ where: { id: tx.id }, data: { status: "SUCCESS", processedAt: new Date() } });
      await db.platformInvoice.update({ where: { id: tx.invoice!.id }, data: { status: "PAID", paidAt: new Date() } });
      return this.apply(db, schoolId, tx.invoice!, tx.id, session.userId);
    });
    await this.keepCard(schoolId, verification.authorization, metaOf(tx.metadata), session.userId);
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.PAYMENT, entityType: "PlatformInvoice", entityId: tx.invoice.id, metadata: json({ summary: `Invoice paid · ${tx.invoice.invoiceNo}`, reference, applied }) } });
    return { status: "SUCCESS", invoiceNo: tx.invoice.invoiceNo, already: false, total: num(tx.amount), applied, mode: String(metaOf(tx.metadata).mode ?? "test") };
  }

  /** Keep the card the school just paid with, when it agreed to (it ticked the box, or has automatic top-up on). Only the gateway's authorization is stored. */
  private async keepCard(schoolId: string, auth: { code: string; signature: string; last4: string; brand?: string; bank?: string; expMonth?: string; expYear?: string; reusable: boolean } | undefined, txMeta: Record<string, unknown>, userId: string | null) {
    if (!auth || !auth.reusable) return;
    const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId }, select: { autoTopup: true } });
    const autoOn = Boolean((sub?.autoTopup as { on?: boolean } | null)?.on);
    if (!txMeta.saveCard && !autoOn) return;
    const email = String(txMeta.email ?? "");
    await prisma.savedCard.upsert({
      where: { schoolId_signature: { schoolId, signature: auth.signature } },
      create: { schoolId, provider: "PAYSTACK", authorization: auth.code, signature: auth.signature, last4: auth.last4, brand: auth.brand ?? null, bank: auth.bank ?? null, expMonth: auth.expMonth ?? null, expYear: auth.expYear ?? null, email, createdById: userId },
      update: { authorization: auth.code, last4: auth.last4, brand: auth.brand ?? null, expMonth: auth.expMonth ?? null, expYear: auth.expYear ?? null, removedAt: null }
    });
  }

  /** The card on file, if any, newest first. */
  async cards(schoolId: string) {
    const rows = await prisma.savedCard.findMany({ where: { schoolId, removedAt: null }, orderBy: { createdAt: "desc" } });
    return rows.map((card) => ({ id: card.id, brand: card.brand, last4: card.last4, bank: card.bank, expires: card.expMonth && card.expYear ? `${card.expMonth}/${card.expYear}` : null, since: card.createdAt.toISOString(), lastUsedAt: card.lastUsedAt?.toISOString() ?? null }));
  }

  async removeCard(session: SessionPayload, cardId: string) {
    const card = await prisma.savedCard.findFirst({ where: { id: cardId, schoolId: session.schoolId, removedAt: null } });
    if (!card) throw new NotFoundException("That card is not on file.");
    await prisma.savedCard.update({ where: { id: card.id }, data: { removedAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.BILLING_UPDATE, entityType: "SavedCard", entityId: card.id, metadata: json({ summary: `Card ending ${card.last4} removed` }) } });
    return { removed: true };
  }

  /**
   * Charge the school's saved card for an invoice without a checkout page, and apply what the invoice bought if it clears.
   * Returns what happened rather than throwing, so a caller deciding whether to retry can read the reason.
   */
  async chargeSavedCard(schoolId: string, invoiceId: string, actorId: string | null): Promise<{ charged: boolean; reference: string | null; failure: string | null }> {
    const gateway = getPaymentGateway("PAYSTACK");
    if (!gateway.chargeAuthorization) return { charged: false, reference: null, failure: "The payment gateway cannot charge a saved card." };
    const card = await prisma.savedCard.findFirst({ where: { schoolId, removedAt: null }, orderBy: { createdAt: "desc" } });
    if (!card) return { charged: false, reference: null, failure: "No card is on file." };
    const invoice = await prisma.platformInvoice.findFirst({ where: { id: invoiceId, schoolId } });
    if (!invoice) return { charged: false, reference: null, failure: "The invoice does not exist." };
    if (invoice.status === "PAID") return { charged: false, reference: null, failure: "The invoice is already paid." };
    const total = round2(num(invoice.amount) + num(invoice.taxAmount));
    const reference = `FR-AUTO-${Date.now().toString(36).toUpperCase()}`;
    const tx = await prisma.platformBillingTransaction.create({ data: { schoolId, invoiceId: invoice.id, amount: total, method: "CARD", status: "PENDING", reference, recordedById: actorId, metadata: json({ automatic: true, card: card.last4 }) } });
    let result;
    try {
      result = await gateway.chargeAuthorization({ authorizationCode: card.authorization, email: card.email, amount: total, currency: invoice.currency, reference, metadata: { school_id: schoolId, invoice_id: invoice.id, invoice_no: invoice.invoiceNo, automatic: true } });
    } catch (error) {
      const failure = error instanceof Error ? error.message : "The gateway did not answer.";
      await prisma.platformBillingTransaction.update({ where: { id: tx.id }, data: { status: "FAILED", metadata: json({ automatic: true, failure }) } });
      return { charged: false, reference, failure };
    }
    if (result.status !== "SUCCESS") {
      const failure = String((result.raw as { message?: string } | null)?.message ?? `The card was not charged (${result.status.toLowerCase()}).`);
      await prisma.platformBillingTransaction.update({ where: { id: tx.id }, data: { status: result.status === "PENDING" ? "PENDING" : "FAILED", metadata: json({ automatic: true, failure }) } });
      return { charged: false, reference, failure };
    }
    await prisma.$transaction(async (db) => {
      await db.platformBillingTransaction.update({ where: { id: tx.id }, data: { status: "SUCCESS", processedAt: new Date() } });
      await db.platformInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });
      await this.apply(db, schoolId, invoice, tx.id, actorId ?? "");
    });
    await prisma.savedCard.update({ where: { id: card.id }, data: { lastUsedAt: new Date() } });
    await prisma.auditLog.create({ data: { schoolId, actorId, action: AuditAction.PAYMENT, entityType: "PlatformInvoice", entityId: invoice.id, metadata: json({ summary: `Invoice paid automatically · ${invoice.invoiceNo} · card ending ${card.last4}`, reference }) } });
    return { charged: true, reference, failure: null };
  }

  /** What a paid invoice bought, put where it belongs. */
  private async apply(db: Prisma.TransactionClient, schoolId: string, invoice: { id: string; metadata: unknown; invoiceNo: string; amount: unknown }, txId: string, userId: string): Promise<string | null> {
    const meta = metaOf(invoice.metadata);
    if (meta.kind === "TOPUP" && meta.channel && meta.credits) {
      const field = meta.channel === "SMS" ? "smsBalance" : "whatsappBalance";
      const wallet = await db.notificationWallet.findUnique({ where: { schoolId } });
      if (wallet) await db.notificationWallet.update({ where: { schoolId }, data: { [field]: { increment: meta.credits }, lastToppedUpAt: new Date() } });
      else await db.notificationWallet.create({ data: { schoolId, [field]: meta.credits, lastToppedUpAt: new Date() } });
      await db.creditLedger.create({ data: { schoolId, channel: meta.channel, kind: "TOPUP", credits: meta.credits, amount: round2(num(invoice.amount)), invoiceId: invoice.id, method: "CARD", note: txId, createdById: userId } });
      return `${meta.credits.toLocaleString("en-NG")} ${meta.channel} credits are on the wallet`;
    }
    if (meta.kind === "TERMLY") {
      await db.school.update({ where: { id: schoolId }, data: { billingStatus: "ACTIVE" } });
      // A school made read-only when its trial ended is switched back on by paying.
      await db.school.updateMany({ where: { id: schoolId, status: "GRACE_PERIOD", statusReason: { startsWith: "Trial ended" } }, data: { status: "ACTIVE", statusReason: null, lifecycleNote: "Paid — editing restored" } });
      return `${meta.termLabel ?? "The term"} is paid for`;
    }
    return null;
  }
}
