import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { REAL_STUDENTS } from "../super-admin/sample";

/**
 * Commission, as the platform actually pays it.
 *
 *  - It accrues on reconciled money only — an invoice is a statement of what is owed, a recorded payment is somebody
 *    saying money arrived; reconciliation against the bank is the event that counts.
 *  - Only once the invoice is fully settled, and only for an attributed school.
 *  - The rate belongs to a stream: subscriptions (B) decline by relationship year and then end; agency projects (A) are flat.
 *  - A refund claws back what it earned; a dispute that is upheld moves commission from the point of attribution.
 */

const DAY = 86_400_000;
const num = (value: unknown) => Number(value ?? 0);
const money = (value: number) => Math.round(value * 100) / 100;

const ISSUERS = new Set(["PLATFORM_OWNER", "PLATFORM_ADMIN", "FINANCE_MANAGER", "SUPER_ADMIN"]);
const SETTLERS = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);
const DECIDERS = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);

/** The percentage paid in each year of a relationship: the partner's own schedule, or the deal rate stepped down 100% / 60% / 30%. */
export function ratesFor(partner: { yearRates: unknown; commissionRatePercent: unknown }, dealRate: number): number[] {
  const own = Array.isArray(partner.yearRates) ? (partner.yearRates as unknown[]).map(Number).filter((rate) => Number.isFinite(rate) && rate >= 0) : [];
  return own.length ? own : [dealRate, money(dealRate * 0.6), money(dealRate * 0.3)];
}

/** Which relationship year a moment falls in, counted from the first reconciled invoice. */
export const relationshipYear = (firstReconciledAt: Date, at: Date) => Math.floor((at.getTime() - firstReconciledAt.getTime()) / (365 * DAY)) + 1;

const statementSchema = z.object({
  period: z.string().trim().min(3, "Name the period, for example Term 1 · 2026/27."),
  from: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Choose when the period starts."),
  to: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Choose when the period ends."),
  partnerId: z.string().optional(),
  dueDays: z.coerce.number().int().min(0).max(120).default(14),
});
const settleSchema = z.object({ paymentRef: z.string().trim().min(3, "Enter the bank reference the payment was released under.") });
const clawbackSchema = z.object({ transactionId: z.string().min(1, "Choose the payment that was reversed."), amount: z.coerce.number().positive("Enter the amount refunded."), reason: z.string().trim().min(5, "Say why it was reversed.") });
const disputeSchema = z.object({ schoolId: z.string().min(1), raisedBy: z.string().min(1, "Who raised it?"), counterparty: z.string().min(1, "Who is it against?"), grounds: z.string().trim().min(10, "State the grounds."), evidence: z.string().trim().optional() });
const decideSchema = z.object({ outcome: z.enum(["UPHELD", "REJECTED"]), notes: z.string().trim().min(10, "Give the reasons — they are kept against the school and the partner."), reattributeToPartnerId: z.string().optional(), toDirect: z.boolean().optional() });

@Injectable()
export class PartnerEngineService {
  private assert(session: SessionPayload, allowed: Set<string>, message: string) {
    if (!allowed.has(String(session.role))) throw new ForbiddenException(message);
  }

  private async audit(session: SessionPayload | null, entityType: string, entityId: string, summary: string, extra: Record<string, unknown> = {}, schoolId: string | null = null) {
    await prisma.auditLog.create({ data: { schoolId, actorId: session?.userId ?? null, action: AuditAction.BILLING_UPDATE, entityType, entityId, metadata: { summary, ...extra } as Prisma.InputJsonValue } });
  }

  /**
   * A school arriving with a partner's reference code maps to that partner without anyone typing a name — provided the
   * partner is active and countersigned, and nobody else holds a valid registration for the same school. It never
   * attributes a school retrospectively: this only runs at signup.
   */
  async attributeAtSignup(schoolId: string, schoolName: string, partnerCode: string | undefined | null): Promise<{ attributed: boolean; why: string }> {
    const code = (partnerCode ?? "").trim().toUpperCase();
    if (!code) return { attributed: false, why: "No partner code." };
    const partner = await prisma.partner.findUnique({ where: { code } });
    if (!partner || partner.status !== "ACTIVE" || !partner.countersignedAt) return { attributed: false, why: "That code does not belong to an active, countersigned partner." };
    const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const now = new Date();
    const open = await prisma.partnerDeal.findMany({ where: { status: "REGISTERED", validUntil: { gt: now } } });
    const matching = open.filter((deal) => norm(deal.prospectSchoolName) === norm(schoolName));
    const mine = matching.find((deal) => deal.partnerId === partner.id);
    if (matching.length && !mine) return { attributed: false, why: "Another partner holds a valid registration for this school." };
    if (mine) {
      await prisma.partnerDeal.update({ where: { id: mine.id }, data: { status: "CONVERTED", schoolId, convertedAt: now } });
    } else {
      await prisma.partnerDeal.create({ data: { partnerId: partner.id, schoolId, prospectSchoolName: schoolName, stream: "B", introductionEvidence: `Signed up with the partner's reference code ${code}`, registeredAt: now, validUntil: now, status: "CONVERTED", convertedAt: now, commissionRatePercent: partner.commissionRatePercent } });
    }
    await this.audit(null, "PartnerDeal", schoolId, `School attributed to ${partner.name} at signup`, { code }, schoolId);
    return { attributed: true, why: partner.name };
  }

  /* ───────────────────────── accrual ───────────────────────── */

  /**
   * Called when a payment is reconciled. Accrues commission for the invoice it belongs to when — and only when — every
   * rule is met; says why not otherwise, so a missing accrual is never a mystery. Safe to call twice.
   */
  async accrueForTransaction(transactionId: string): Promise<{ accrued: boolean; why: string; commission?: number }> {
    const transaction = await prisma.platformBillingTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction?.invoiceId || !transaction.reconciledAt) return { accrued: false, why: "The payment is not reconciled against an invoice." };
    const invoice = await prisma.platformInvoice.findUnique({ where: { id: transaction.invoiceId }, include: { transactions: true } });
    if (!invoice) return { accrued: false, why: "The invoice no longer exists." };
    if (await prisma.partnerAccrual.findFirst({ where: { invoiceId: invoice.id, kind: "ACCRUAL", voidedAt: null } })) return { accrued: false, why: "Commission was already accrued on this invoice." };

    const owed = num(invoice.amount) + num(invoice.taxAmount);
    const reconciled = invoice.transactions.filter((entry) => entry.reconciledAt && num(entry.amount) > 0).reduce((sum, entry) => sum + num(entry.amount), 0);
    if (reconciled + 0.5 < owed) return { accrued: false, why: "The invoice is not fully settled yet — a partial payment accrues nothing." };

    const deal = await prisma.partnerDeal.findFirst({ where: { schoolId: invoice.schoolId, status: { in: ["CONVERTED", "COMMISSION_PAID"] } }, include: { partner: true }, orderBy: { convertedAt: "asc" } });
    if (!deal) return { accrued: false, why: "The school is not attributed to a partner." };
    if (deal.partner.status === "SUSPENDED") return { accrued: false, why: "The partner is suspended." };

    const stream = (invoice.metadata as { stream?: string } | null)?.stream === "A" ? "A" : "B";
    const first = await prisma.partnerAccrual.findFirst({ where: { partnerId: deal.partnerId, schoolId: invoice.schoolId, kind: "ACCRUAL", voidedAt: null }, orderBy: { reconciledAt: "asc" }, select: { reconciledAt: true } });
    const year = stream === "B" ? relationshipYear(first?.reconciledAt ?? transaction.reconciledAt, transaction.reconciledAt) : null;
    let rate: number;
    if (stream === "A") {
      rate = num(deal.partner.streamARatePercent ?? deal.commissionRatePercent);
    } else {
      const schedule = ratesFor(deal.partner, num(deal.commissionRatePercent));
      if ((year as number) > schedule.length) return { accrued: false, why: `The relationship is past year ${schedule.length}, where commission ends.` };
      rate = schedule[(year as number) - 1];
    }
    const collected = num(invoice.amount);
    const commission = money(collected * (rate / 100));
    await prisma.partnerAccrual.create({ data: { partnerId: deal.partnerId, dealId: deal.id, schoolId: invoice.schoolId, invoiceId: invoice.id, transactionId: transaction.id, stream, kind: "ACCRUAL", collected, ratePercent: rate, relationshipYear: year, commission, reconciledAt: transaction.reconciledAt } });
    return { accrued: true, why: "Accrued.", commission };
  }

  /** A payment that was reversed or refunded: it takes back what it earned, at the rate it earned it. */
  async recordClawback(session: SessionPayload, body: unknown) {
    this.assert(session, ISSUERS, "Clawbacks are recorded by platform finance roles.");
    const input = clawbackSchema.parse(body);
    const transaction = await prisma.platformBillingTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new NotFoundException("That payment does not exist.");
    const original = await prisma.partnerAccrual.findFirst({ where: { OR: [{ transactionId: transaction.id }, { invoiceId: transaction.invoiceId ?? "-" }], kind: "ACCRUAL", voidedAt: null } });
    if (!original) throw new BadRequestException("No commission was accrued on that payment, so there is nothing to claw back.");
    const taken = await prisma.partnerAccrual.aggregate({ where: { invoiceId: original.invoiceId, kind: "CLAWBACK", voidedAt: null }, _sum: { collected: true } });
    if (Math.abs(num(taken._sum.collected)) + input.amount > num(original.collected) + 0.01) throw new BadRequestException("That is more than was collected on the invoice.");
    const commission = -money(input.amount * (num(original.ratePercent) / 100));
    const row = await prisma.partnerAccrual.create({ data: { partnerId: original.partnerId, dealId: original.dealId, schoolId: original.schoolId, invoiceId: original.invoiceId, transactionId: transaction.id, stream: original.stream, kind: "CLAWBACK", collected: -input.amount, ratePercent: original.ratePercent, relationshipYear: original.relationshipYear, commission, reconciledAt: new Date(), note: input.reason } });
    await this.audit(session, "PartnerAccrual", row.id, `Commission clawed back · ${commission}`, { reason: input.reason, original: original.id }, original.schoolId);
    return { id: row.id, commission };
  }

  /* ───────────────────────── statements ───────────────────────── */

  async listStatements() {
    const rows = await prisma.partnerStatement.findMany({ orderBy: { issuedAt: "desc" }, include: { partner: { select: { name: true, code: true } } }, take: 200 });
    return rows.map((row) => this.statementView(row));
  }

  private statementView(row: { id: string; ref: string; period: string; gross: Prisma.Decimal; clawbacks: Prisma.Decimal; net: Prisma.Decimal; invoices: number; status: string; issuedAt: Date; dueAt: Date; settledAt: Date | null; paymentRef: string | null; partnerId: string; partner: { name: string; code: string | null } }) {
    return { id: row.id, ref: row.ref, partnerId: row.partnerId, partner: row.partner.name, code: row.partner.code, period: row.period, gross: num(row.gross), clawbacks: num(row.clawbacks), net: num(row.net), invoices: row.invoices, status: row.status, issuedAt: row.issuedAt.toISOString(), dueAt: row.dueAt.toISOString(), settledAt: row.settledAt?.toISOString() ?? null, paymentRef: row.paymentRef };
  }

  async statement(id: string) {
    const row = await prisma.partnerStatement.findUnique({ where: { id }, include: { partner: true } });
    if (!row) throw new NotFoundException("That statement does not exist.");
    return { ...this.statementView(row), lines: row.lines as unknown[], agreement: row.partner.agreementReference, rate: num(row.partner.commissionRatePercent), bank: row.partner.bankName ? `${row.partner.bankName} · ${row.partner.bankAccountNumber ? `****${row.partner.bankAccountNumber.slice(-4)}` : ""} · ${row.partner.bankAccountName ?? ""}` : null, contact: row.partner.primaryContactName ?? row.partner.email };
  }

  /**
   * One statement per partner for the period, issued whether or not the amount is positive — a zero period is a statement,
   * not a silence. Every unstatemented, unvoided accrual inside the period goes on it and is stamped so it cannot go on another.
   */
  async generateStatements(session: SessionPayload, body: unknown) {
    this.assert(session, ISSUERS, "Statements are issued by platform finance roles.");
    const input = statementSchema.parse(body);
    const from = new Date(input.from);
    const to = new Date(new Date(input.to).getTime() + DAY - 1);
    if (to < from) throw new BadRequestException("The period ends before it starts.");
    const partners = await prisma.partner.findMany({ where: { ...(input.partnerId ? { id: input.partnerId } : {}), status: { not: "SUSPENDED" } } });
    const made: Array<{ partner: string; ref: string; net: number }> = [];
    for (const partner of partners) {
      const already = await prisma.partnerStatement.findFirst({ where: { partnerId: partner.id, period: input.period, status: { not: "VOID" } } });
      if (already) continue;
      const accruals = await prisma.partnerAccrual.findMany({ where: { partnerId: partner.id, statementId: null, voidedAt: null, reconciledAt: { gte: from, lte: to } }, orderBy: { reconciledAt: "asc" } });
      const schools = new Map((await prisma.school.findMany({ where: { id: { in: accruals.map((row) => row.schoolId) } }, select: { id: true, name: true } })).map((school) => [school.id, school.name]));
      const invoices = new Map((await prisma.platformInvoice.findMany({ where: { id: { in: accruals.map((row) => row.invoiceId).filter((id): id is string => Boolean(id)) } }, select: { id: true, invoiceNo: true } })).map((invoice) => [invoice.id, invoice.invoiceNo]));
      const gross = money(accruals.filter((row) => row.kind === "ACCRUAL").reduce((sum, row) => sum + num(row.commission), 0));
      const clawbacks = money(accruals.filter((row) => row.kind === "CLAWBACK").reduce((sum, row) => sum + num(row.commission), 0));
      const sequence = (await prisma.partnerStatement.count({ where: { partnerId: partner.id } })) + 1;
      const ref = `STM-${(partner.code ?? partner.id.slice(-5)).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}-${String(sequence).padStart(3, "0")}`;
      const lines = accruals.map((row) => ({ school: schools.get(row.schoolId) ?? "A school", invoice: row.invoiceId ? invoices.get(row.invoiceId) ?? null : null, kind: row.kind, stream: row.stream, collected: num(row.collected), rate: num(row.ratePercent), year: row.relationshipYear, commission: num(row.commission), reconciledAt: row.reconciledAt.toISOString(), note: row.note }));
      const statement = await prisma.$transaction(async (tx) => {
        const created = await tx.partnerStatement.create({ data: { partnerId: partner.id, ref, period: input.period, periodStart: from, periodEnd: to, gross, clawbacks, net: money(gross + clawbacks), invoices: new Set(accruals.map((row) => row.invoiceId)).size, status: "ISSUED", lines: lines as unknown as Prisma.InputJsonValue, issuedById: session.userId, dueAt: new Date(Date.now() + input.dueDays * DAY) } });
        if (accruals.length) await tx.partnerAccrual.updateMany({ where: { id: { in: accruals.map((row) => row.id) } }, data: { statementId: created.id } });
        return created;
      });
      made.push({ partner: partner.name, ref: statement.ref, net: num(statement.net) });
      await this.audit(session, "PartnerStatement", statement.id, `Statement issued · ${partner.name} · ${input.period}`, { net: num(statement.net) });
    }
    return { issued: made.length, statements: made };
  }

  /** The person who issues a statement cannot be the person who pays it. */
  async settle(session: SessionPayload, id: string, body: unknown) {
    this.assert(session, SETTLERS, "Statements are settled by a Super Admin.");
    const input = settleSchema.parse(body);
    const row = await prisma.partnerStatement.findUnique({ where: { id }, include: { partner: true } });
    if (!row) throw new NotFoundException("That statement does not exist.");
    if (row.status !== "ISSUED") throw new BadRequestException(row.status === "SETTLED" ? "That statement is already settled." : "A void statement cannot be settled.");
    if (row.issuedById === session.userId) throw new BadRequestException("The person who issued a statement cannot also settle it.");
    await prisma.partnerStatement.update({ where: { id }, data: { status: "SETTLED", settledAt: new Date(), settledById: session.userId, paymentRef: input.paymentRef } });
    // Deals whose commission this statement paid move to COMMISSION_PAID.
    const dealIds = (await prisma.partnerAccrual.findMany({ where: { statementId: id, kind: "ACCRUAL" }, select: { dealId: true } })).map((entry) => entry.dealId).filter((value): value is string => Boolean(value));
    if (dealIds.length) await prisma.partnerDeal.updateMany({ where: { id: { in: dealIds }, status: "CONVERTED" }, data: { status: "COMMISSION_PAID" } });
    await this.audit(session, "PartnerStatement", id, `Statement settled · ${row.partner.name} · ${row.ref}`, { paymentRef: input.paymentRef, net: num(row.net) });
    return { settled: true };
  }

  /** The payment run: settle every ticked statement under one reference. A statement the caller issued themselves is left for someone else, and the rest still go through. */
  async settleMany(session: SessionPayload, body: unknown) {
    this.assert(session, SETTLERS, "Statements are settled by a Super Admin.");
    const input = z.object({ statementIds: z.array(z.string()).min(1, "Choose at least one statement."), paymentRef: z.string().trim().optional() }).parse(body);
    const reference = input.paymentRef || `Payment run ${new Date().toISOString().slice(0, 10)}`;
    const settled: string[] = [];
    const skipped: Array<{ ref: string; why: string }> = [];
    for (const id of input.statementIds) {
      const row = await prisma.partnerStatement.findUnique({ where: { id }, select: { ref: true } });
      try {
        await this.settle(session, id, { paymentRef: reference });
        settled.push(row?.ref ?? id);
      } catch (error) {
        skipped.push({ ref: row?.ref ?? id, why: error instanceof Error ? error.message : "Could not be settled." });
      }
    }
    return { settled: settled.length, skipped, reference };
  }

  /** Send the statement again to the partner's notices address, exactly as it stands. */
  async resend(session: SessionPayload, body: unknown) {
    const input = z.object({ statementIds: z.array(z.string()).min(1, "Choose at least one statement.") }).parse(body);
    const rows = await prisma.partnerStatement.findMany({ where: { id: { in: input.statementIds } }, include: { partner: true } });
    let sent = 0;
    const withoutEmail: string[] = [];
    for (const row of rows) {
      if (!row.partner.email) { withoutEmail.push(row.partner.name); continue; }
      await sendNotification({ channel: "EMAIL", recipient: row.partner.email, title: `Statement of account ${row.ref} — ${row.period}`, body: `Gross commission ${num(row.gross).toLocaleString("en-NG")}, clawbacks ${Math.abs(num(row.clawbacks)).toLocaleString("en-NG")}, net payable ${num(row.net).toLocaleString("en-NG")} NGN. Status: ${row.status === "SETTLED" ? "settled" : "awaiting settlement"}. Reply to this email if anything looks wrong.` }).catch(() => undefined);
      await this.audit(session, "PartnerStatement", row.id, `Statement re-sent · ${row.partner.name} · ${row.ref}`, { to: row.partner.email });
      sent += 1;
    }
    return { sent, withoutEmail };
  }

  async statementsCsv(ids?: string[]) {
    const rows = await prisma.partnerStatement.findMany({ where: { status: "ISSUED", ...(ids?.length ? { id: { in: ids } } : {}) }, include: { partner: true } });
    const lines = [["Statement", "Partner", "Period", "Net payable (NGN)", "Bank", "Account number", "Account name", "Due"].join(",")];
    for (const row of rows) lines.push([row.ref, row.partner.name, row.period, num(row.net), row.partner.bankName ?? "", row.partner.bankAccountNumber ?? "", row.partner.bankAccountName ?? "", row.dueAt.toISOString().slice(0, 10)].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
    return lines.join("\n");
  }

  /* ───────────────────────── the commission page ───────────────────────── */

  async commission() {
    const [accruals, unstated, settledStatements, clawbacks] = await Promise.all([
      prisma.partnerAccrual.findMany({ where: { voidedAt: null }, orderBy: { reconciledAt: "desc" }, take: 200, include: { partner: { select: { name: true } } } }),
      prisma.partnerAccrual.aggregate({ where: { voidedAt: null, statementId: null }, _sum: { commission: true } }),
      prisma.partnerStatement.aggregate({ where: { status: "SETTLED" }, _sum: { net: true }, _count: true }),
      prisma.partnerAccrual.aggregate({ where: { voidedAt: null, kind: "CLAWBACK", reconciledAt: { gte: new Date(Date.now() - 120 * DAY) } }, _sum: { commission: true }, _count: true }),
    ]);
    const schools = new Map((await prisma.school.findMany({ where: { id: { in: accruals.map((row) => row.schoolId) } }, select: { id: true, name: true } })).map((school) => [school.id, school.name]));
    return {
      kpis: { liability: money(num(unstated._sum.commission)), settled: money(num(settledStatements._sum.net)), settledStatements: settledStatements._count, clawbacks: money(num(clawbacks._sum.commission)), clawbackCount: clawbacks._count },
      lines: accruals.map((row) => ({ id: row.id, school: schools.get(row.schoolId) ?? "A school", partner: row.partner.name, stream: row.stream, kind: row.kind, collected: num(row.collected), year: row.relationshipYear, rate: num(row.ratePercent), commission: num(row.commission), reconciledAt: row.reconciledAt.toISOString(), statemented: Boolean(row.statementId), note: row.note })),
    };
  }

  /* ───────────────────────── disputes ───────────────────────── */

  async disputes() {
    const rows = await prisma.partnerDispute.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const schools = new Map((await prisma.school.findMany({ where: { id: { in: rows.map((row) => row.schoolId) } }, select: { id: true, name: true } })).map((school) => [school.id, school.name]));
    return rows.map((row) => ({ id: row.id, schoolId: row.schoolId, school: schools.get(row.schoolId) ?? "A school", raisedBy: row.raisedByPartnerId ?? "", counterparty: row.counterpartyLabel, grounds: row.grounds, evidence: row.evidence, status: row.status, outcome: row.outcome, decidedAt: row.decidedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
  }

  async raiseDispute(session: SessionPayload, body: unknown) {
    this.assert(session, new Set([...ISSUERS, "SALES_MANAGER"]), "Disputes are logged by sales and finance roles.");
    const input = disputeSchema.parse(body);
    const school = await prisma.school.findFirst({ where: { id: input.schoolId, deletedAt: null }, select: { id: true, name: true } });
    if (!school) throw new NotFoundException("That school does not exist.");
    if (await prisma.partnerDispute.findFirst({ where: { schoolId: school.id, status: "OPEN" } })) throw new BadRequestException("There is already an open dispute over this school.");
    const row = await prisma.partnerDispute.create({ data: { schoolId: school.id, raisedByPartnerId: input.raisedBy, counterpartyLabel: input.counterparty, grounds: input.grounds, evidence: input.evidence ?? null, createdById: session.userId } });
    await this.audit(session, "PartnerDispute", row.id, `Attribution dispute opened · ${school.name}`, { grounds: input.grounds }, school.id);
    return { id: row.id };
  }

  /**
   * Decided against the registration record. Upheld with a new owner: the school's deal moves to them and the commission is
   * recalculated from the point of attribution — what was accrued to the old partner is voided (or clawed back if it was
   * already on a settled statement), and the same reconciled invoices accrue again to the new one.
   */
  async decide(session: SessionPayload, id: string, body: unknown) {
    this.assert(session, DECIDERS, "Only a Super Admin decides a dispute.");
    const input = decideSchema.parse(body);
    const dispute = await prisma.partnerDispute.findUnique({ where: { id } });
    if (!dispute || dispute.status !== "OPEN") throw new NotFoundException("That dispute is not open.");
    let recalculation: Record<string, unknown> | null = null;
    if (input.outcome === "UPHELD") {
      recalculation = await this.reattribute(session, dispute.schoolId, input.reattributeToPartnerId ?? null, Boolean(input.toDirect));
    }
    await prisma.partnerDispute.update({ where: { id }, data: { status: input.outcome, outcome: input.notes, decidedById: session.userId, decidedAt: new Date(), reattributedTo: input.reattributeToPartnerId ?? (input.toDirect ? "DIRECT" : null), recalculation: recalculation as Prisma.InputJsonValue | undefined } });
    await this.audit(session, "PartnerDispute", id, `Dispute ${input.outcome.toLowerCase()}`, { notes: input.notes, recalculation }, dispute.schoolId);
    return { outcome: input.outcome, recalculation };
  }

  private async reattribute(session: SessionPayload, schoolId: string, toPartnerId: string | null, toDirect: boolean) {
    const deal = await prisma.partnerDeal.findFirst({ where: { schoolId, status: { in: ["CONVERTED", "COMMISSION_PAID"] } } });
    if (!toPartnerId && !toDirect) throw new BadRequestException("Say who the school belongs to: another partner, or FutureRealm direct.");
    const voided = await prisma.partnerAccrual.updateMany({ where: { schoolId, statementId: null, voidedAt: null }, data: { voidedAt: new Date(), voidReason: "Attribution disputed and upheld" } });
    const settled = await prisma.partnerAccrual.findMany({ where: { schoolId, voidedAt: null, kind: "ACCRUAL", statement: { status: "SETTLED" } } });
    let adjusted = 0;
    for (const accrual of settled) {
      await prisma.partnerAccrual.create({ data: { partnerId: accrual.partnerId, dealId: accrual.dealId, schoolId, invoiceId: accrual.invoiceId, transactionId: accrual.transactionId, stream: accrual.stream, kind: "CLAWBACK", collected: -num(accrual.collected), ratePercent: accrual.ratePercent, relationshipYear: accrual.relationshipYear, commission: -num(accrual.commission), reconciledAt: new Date(), note: "Adjustment: attribution disputed and upheld" } });
      // The statement it paid on is kept exactly as issued; the row itself is retired so the invoice can accrue to its rightful partner.
      await prisma.partnerAccrual.update({ where: { id: accrual.id }, data: { voidedAt: new Date(), voidReason: "Superseded by an attribution decision" } });
      adjusted += 1;
    }
    const newOwner = toPartnerId ? await prisma.partner.findUnique({ where: { id: toPartnerId } }) : null;
    if (toPartnerId && !newOwner) throw new NotFoundException("That partner does not exist.");
    if (deal) await prisma.partnerDeal.update({ where: { id: deal.id }, data: toDirect ? { status: "EXPIRED", schoolId: null } : { partnerId: toPartnerId as string, status: "CONVERTED", commissionRatePercent: newOwner?.commissionRatePercent } });
    let accrued = 0;
    if (toPartnerId) {
      const transactions = await prisma.platformBillingTransaction.findMany({ where: { schoolId, reconciledAt: { not: null }, invoiceId: { not: null } }, orderBy: { reconciledAt: "asc" } });
      for (const transaction of transactions) {
        const result = await this.accrueForTransaction(transaction.id);
        if (result.accrued) accrued += 1;
      }
    }
    return { voided: voided.count, adjusted, reaccrued: accrued, to: toDirect ? "FutureRealm direct" : toPartnerId };
  }

  /* ───────────────────────── performance ───────────────────────── */

  async performance() {
    const partners = await prisma.partner.findMany({ include: { deals: true } });
    const since = new Date(Date.now() - 240 * DAY);
    const partnerSchoolIds = new Set(partners.flatMap((partner) => partner.deals.filter((deal) => deal.schoolId && (deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID")).map((deal) => deal.schoolId as string)));
    const schoolStats = async (ids: string[], direct = false) => {
      const where: Prisma.SchoolWhereInput = direct ? { deletedAt: null, isPersonalWorkspace: false, id: { notIn: Array.from(partnerSchoolIds) } } : { id: { in: ids } };
      const [schools, tickets] = await Promise.all([
        prisma.school.findMany({ where, select: { id: true, status: true, createdAt: true } }),
        prisma.supportTicket.count({ where: { school: where, createdAt: { gte: new Date(Date.now() - 90 * DAY) } } }),
      ]);
      const old = schools.filter((school) => school.createdAt < since);
      const kept = old.filter((school) => school.status === "ACTIVE" || school.status === "TRIAL" || school.status === "GRACE_PERIOD");
      return { schools: schools.length, retention: old.length ? Math.round((kept.length / old.length) * 100) : null, ticketsPer100: schools.length ? Math.round((tickets / schools.length) * 100) : null };
    };
    const rows = [];
    for (const partner of partners) {
      const registered = partner.deals.filter((deal) => deal.status !== "REJECTED");
      const converted = partner.deals.filter((deal) => deal.status === "CONVERTED" || deal.status === "COMMISSION_PAID");
      const stats = await schoolStats(converted.map((deal) => deal.schoolId).filter((id): id is string => Boolean(id)));
      const recentRegistrations = registered.filter((deal) => deal.registeredAt >= since).length;
      const minPerTerm = partner.minRegistrationsPerTerm ?? 0;
      const retentionBreached = partner.minRetentionPercent !== null && stats.retention !== null && stats.retention < partner.minRetentionPercent;
      const registrationBreached = minPerTerm > 0 && recentRegistrations < minPerTerm * 2;
      rows.push({ id: partner.id, name: partner.name, code: partner.code, registered: registered.length, converted: converted.length, conversion: registered.length ? Math.round((converted.length / registered.length) * 100) : null, retention: stats.retention, ticketsPer100: stats.ticketsPer100, schools: stats.schools, recentRegistrations, condition: minPerTerm || partner.minRetentionPercent !== null ? (registrationBreached || retentionBreached ? "BREACHED" : "MET") : "NONE", conditionNote: registrationBreached ? `Fewer than ${minPerTerm * 2} registrations across the last two terms` : retentionBreached ? `Retention ${stats.retention}% is below the ${partner.minRetentionPercent}% the agreement asks for` : null });
    }
    const direct = await schoolStats([], true);
    const overall = await schoolStats(Array.from(partnerSchoolIds));
    const activeBase = await prisma.school.count({ where: { deletedAt: null, isPersonalWorkspace: false, status: { in: ["ACTIVE", "TRIAL", "GRACE_PERIOD"] } } });
    const allConverted = rows.reduce((sum, row) => sum + row.converted, 0);
    const allRegistered = rows.reduce((sum, row) => sum + row.registered, 0);
    return { rows, direct, overall, totals: { activeBase, breachedNames: rows.filter((row) => row.condition === "BREACHED").map((row) => row.name), partnerSchools: partnerSchoolIds.size, conversion: allRegistered ? Math.round((allConverted / allRegistered) * 100) : null, breached: rows.filter((row) => row.condition === "BREACHED").length } };
  }

  /** How many real students a school has — what the partner sheet shows beside each school it brought. */
  async schoolsOf(partnerId: string) {
    const deals = await prisma.partnerDeal.findMany({ where: { partnerId, schoolId: { not: null }, status: { in: ["CONVERTED", "COMMISSION_PAID"] } }, include: { school: { select: { id: true, name: true, city: true, state: true, plan: true, status: true, createdAt: true, _count: { select: { students: { where: REAL_STUDENTS } } } } } } });
    const accruals = await prisma.partnerAccrual.groupBy({ by: ["schoolId"], where: { partnerId, voidedAt: null }, _sum: { commission: true } });
    const earned = new Map(accruals.map((row) => [row.schoolId, num(row._sum.commission)]));
    return deals.filter((deal) => deal.school).map((deal) => ({ id: deal.school!.id, name: deal.school!.name, location: [deal.school!.city, deal.school!.state].filter(Boolean).join(", "), plan: deal.school!.plan, status: deal.school!.status, students: deal.school!._count.students, since: deal.school!.createdAt.toISOString(), stream: deal.stream ?? "B", commission: earned.get(deal.school!.id) ?? 0 }));
  }
}

/** For code outside Nest's injection (the billing service that reconciles a payment). */
export const partnerEngine = new PartnerEngineService();
