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

const startSchema = z.object({ method: z.string().default("Card"), email: z.string().email("Give an email address for the receipt.").optional() });

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
    await prisma.platformBillingTransaction.create({ data: { schoolId, invoiceId: invoice.id, amount: total, method: "CARD", status: "PENDING", reference, recordedById: session.userId, metadata: json({ provider: checkout.provider, mode: gatewayMode(), email }) } });
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
    await prisma.auditLog.create({ data: { schoolId, actorId: session.userId, action: AuditAction.PAYMENT, entityType: "PlatformInvoice", entityId: tx.invoice.id, metadata: json({ summary: `Invoice paid · ${tx.invoice.invoiceNo}`, reference, applied }) } });
    return { status: "SUCCESS", invoiceNo: tx.invoice.invoiceNo, already: false, total: num(tx.amount), applied, mode: String(metaOf(tx.metadata).mode ?? "test") };
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
