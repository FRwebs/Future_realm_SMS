import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getInvoiceStatus, toMoney } from "../../../../src/lib/domain/finance";
import { FinanceService } from "../finance/finance.service";
import { PAYMENT_MODE, armName, currentTerm, dayStart, daysSince, fullName, isoDay, num, utcDay } from "./fees.shared";

/**
 * Review: supervising the finance function without running it. Everything on this tab is read off
 * the payments and invoices themselves — a cash-up is recorded against counted money, and an
 * integrity flag is a fact the books show, not a mood.
 */

const PHYSICAL = new Set(["CASH", "CHEQUE"]);
const OWNERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN", "PRINCIPAL"]);

@Injectable()
export class ReviewService {
  constructor(private readonly finance: FinanceService) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    const since = new Date(Date.now() - 45 * 86_400_000);
    const [payments, days, waivers, allocations, reversed, noInvoice] = await Promise.all([
      prisma.payment.findMany({ where: { schoolId, status: "SUCCESS", isReversed: false }, include: { student: { include: { currentClass: true } }, recordedBy: { select: { id: true, firstName: true, lastName: true, role: true } }, invoice: { select: { invoiceNumber: true, termId: true } } }, orderBy: { paidAt: "desc" } }),
      prisma.cashUpDay.findMany({ where: { schoolId }, orderBy: { day: "desc" } }),
      prisma.feeWaiver.findMany({ where: { schoolId, status: "PENDING" }, include: { student: { include: { currentClass: true, guardians: { include: { guardian: true } } } }, invoice: { select: { invoiceNumber: true, balance: true, total: true } }, requestedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.paymentAllocation.findMany({ where: { schoolId }, select: { paymentId: true } }),
      prisma.payment.findMany({ where: { schoolId, isReversed: true }, include: { student: { select: { firstName: true, lastName: true } }, reversedBy: { select: { firstName: true, lastName: true } } }, orderBy: { reversedAt: "desc" }, take: 30 }),
      prisma.payment.findMany({ where: { schoolId, status: "SUCCESS", isReversed: false, invoiceId: null }, include: { student: { select: { firstName: true, lastName: true } } } })
    ]);

    // Cash-up: only money that can be counted by hand — cash and cheques.
    const physical = payments.filter((payment) => PHYSICAL.has(String(payment.method)) && payment.paidAt);
    const byDay = new Map<string, { recorded: number; by: Map<string, { name: string; role: string; n: number }> }>();
    for (const payment of physical) {
      const key = utcDay(payment.paidAt as Date);
      const entry = byDay.get(key) ?? { recorded: 0, by: new Map() };
      entry.recorded += num(payment.amount);
      const who = payment.recordedBy;
      if (who) entry.by.set(who.id, { name: fullName(who), role: String(who.role), n: (entry.by.get(who.id)?.n ?? 0) + 1 });
      byDay.set(key, entry);
    }
    const recorded = new Map(days.map((day) => [utcDay(day.day), day]));
    const keys = Array.from(new Set([...byDay.keys(), ...recorded.keys()])).filter((key) => new Date(key) >= since).sort().reverse();
    const today = utcDay(new Date());
    const cashup = keys.map((key) => {
      const entry = byDay.get(key);
      const row = recorded.get(key);
      const total = entry?.recorded ?? 0;
      const counted = row?.countedAmount === null || row?.countedAmount === undefined ? null : num(row.countedAmount);
      const state = row?.closedAt ? "Closed" : key === today ? "In progress" : "Unreconciled";
      const lead = entry ? Array.from(entry.by.values()).sort((a, b) => b.n - a.n)[0] : undefined;
      return { day: key, recorded: total, counted, variance: counted === null ? null : toMoney(counted - total), by: lead?.name ?? "—", byRole: lead?.role ?? "", state, note: row?.note ?? null };
    });
    const unreconciled = cashup.filter((day) => day.state === "Unreconciled");
    const openVariance = cashup.filter((day) => day.state !== "Closed" && day.variance !== null).reduce((sum, day) => sum + (day.variance ?? 0), 0);

    // By recorder.
    const recorders = new Map<string, { name: string; role: string; n: number; value: number; reversals: number; duplicates: number }>();
    const refs = new Map<string, number>();
    for (const payment of payments) if (payment.schoolBankReference) refs.set(payment.schoolBankReference, (refs.get(payment.schoolBankReference) ?? 0) + 1);
    for (const payment of payments) {
      const who = payment.recordedBy;
      const key = who?.id ?? "system";
      const entry = recorders.get(key) ?? { name: who ? fullName(who) : "The system", role: who ? String(who.role) : "", n: 0, value: 0, reversals: 0, duplicates: 0 };
      entry.n += 1;
      entry.value += num(payment.amount);
      if (payment.schoolBankReference && (refs.get(payment.schoolBankReference) ?? 0) > 1) entry.duplicates += 1;
      recorders.set(key, entry);
    }
    for (const payment of reversed) {
      const key = payment.recordedById ?? "system";
      const entry = recorders.get(key);
      if (entry) entry.reversals += 1;
    }

    // Integrity flags: facts the books show.
    const dupes = Array.from(refs.entries()).filter(([, count]) => count > 1);
    const applied = new Set(allocations.map((allocation) => allocation.paymentId));
    const unapplied = payments.filter((payment) => payment.invoiceId && !applied.has(payment.id));
    const early = term ? payments.filter((payment) => payment.invoice?.termId === term.id && payment.paidAt && payment.paidAt < new Date(term.startDate.getTime() - 30 * 86_400_000)) : [];
    const flags = [
      { key: "duplicate", label: "Duplicate bank reference", count: dupes.length, found: dupes.length ? `${dupes.slice(0, 2).map(([ref]) => ref).join(", ")} was recorded more than once.` : "Every bank reference is unique.", action: "Review", items: dupes.flatMap(([ref]) => payments.filter((payment) => payment.schoolBankReference === ref).map((payment) => ({ id: payment.id, label: `${fullName(payment.student)} · ₦${Math.round(num(payment.amount)).toLocaleString("en-NG")}`, sub: `${ref} · ${payment.paidAt ? isoDay(payment.paidAt) : "undated"}` }))) },
      { key: "no-invoice", label: "Payment with no matching invoice", count: noInvoice.length, found: noInvoice.length ? `₦${Math.round(noInvoice.reduce((sum, payment) => sum + num(payment.amount), 0)).toLocaleString("en-NG")} received for students with nothing billed.` : "Every payment is on an invoice.", action: "Review", items: noInvoice.map((payment) => ({ id: payment.id, label: `${fullName(payment.student)} · ₦${Math.round(num(payment.amount)).toLocaleString("en-NG")}`, sub: payment.paidAt ? isoDay(payment.paidAt) : "undated" })) },
      { key: "outside-term", label: "Payment dated before the term", count: early.length, found: early.length ? "Dated well before the term it is applied to — likely an earlier term's payment." : "Every payment falls inside its term.", action: "Review", items: early.map((payment) => ({ id: payment.id, label: `${fullName(payment.student)} · ₦${Math.round(num(payment.amount)).toLocaleString("en-NG")}`, sub: payment.paidAt ? isoDay(payment.paidAt) : "undated" })) },
      { key: "unapplied", label: "Unapplied payments", count: unapplied.length, found: unapplied.length ? `₦${Math.round(unapplied.reduce((sum, payment) => sum + num(payment.amount), 0)).toLocaleString("en-NG")} received but not allocated to an invoice — the commonest source of a disputed balance.` : "Every payment is allocated.", action: "Apply", items: unapplied.map((payment) => ({ id: payment.id, label: `${fullName(payment.student)} · ₦${Math.round(num(payment.amount)).toLocaleString("en-NG")}`, sub: payment.invoice?.invoiceNumber ?? "" })) },
      { key: "reversed", label: "Reversed payments", count: reversed.length, found: reversed.length ? `${reversed.length} reversed, each with a named reason.` : "Nothing has been reversed.", action: "View", items: reversed.map((payment) => ({ id: payment.id, label: `${fullName(payment.student)} · ₦${Math.round(num(payment.amount)).toLocaleString("en-NG")}`, sub: `${payment.reversalReason ?? "No reason"} · ${payment.reversedBy ? fullName(payment.reversedBy) : "—"}` })) }
    ];

    const pending = waivers.map((waiver) => {
      const guardian = waiver.student.guardians.find((link) => link.isPrimary)?.guardian ?? waiver.student.guardians[0]?.guardian;
      const value = waiver.waiverType === "PERCENTAGE" && waiver.percentage ? (num(waiver.invoice.balance) * num(waiver.percentage)) / 100 : num(waiver.amount);
      return {
        id: waiver.id,
        family: guardian ? `${guardian.lastName} family` : `${waiver.student.lastName} family`,
        child: fullName(waiver.student),
        arm: armName(waiver.student.currentClass),
        type: waiver.waiverType === "FULL" ? "Full waiver" : waiver.waiverType === "PERCENTAGE" ? `${num(waiver.percentage)}% waiver` : "Partial waiver",
        value,
        reason: waiver.reason,
        days: daysSince(waiver.createdAt),
        by: waiver.requestedBy ? fullName(waiver.requestedBy) : "—",
        invoice: waiver.invoice.invoiceNumber
      };
    });

    return {
      term: term ? `${term.name} ${term.academicSession?.name ?? ""}`.trim() : "",
      cashup,
      unreconciled: unreconciled.length,
      oldestUnreconciled: unreconciled.length ? unreconciled[unreconciled.length - 1].day : null,
      openVariance,
      recorders: Array.from(recorders.values()).sort((a, b) => b.value - a.value),
      flags,
      flagCount: flags.filter((flag) => flag.key !== "reversed").reduce((sum, flag) => sum + flag.count, 0),
      waivers: pending,
      waiverValue: pending.reduce((sum, row) => sum + row.value, 0),
      oldestWaiver: pending.length ? Math.max(...pending.map((row) => row.days)) : 0,
      mode: Object.fromEntries(Object.entries(PAYMENT_MODE))
    };
  }

  /* ───────────────────────── the cash-up ───────────────────────── */

  async count(session: SessionPayload, day: string, body: unknown) {
    const input = z.object({ counted: z.coerce.number().min(0, "A count cannot be negative."), note: z.string().optional() }).parse(body);
    const date = dayStart(day);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("That is not a day.");
    const existing = await prisma.cashUpDay.findUnique({ where: { schoolId_day: { schoolId: session.schoolId, day: date } } });
    if (existing?.closedAt) throw new BadRequestException("That day is already closed. A closed day is a record, not a draft.");
    await prisma.cashUpDay.upsert({
      where: { schoolId_day: { schoolId: session.schoolId, day: date } },
      update: { countedAmount: input.counted, note: input.note ?? null, countedById: session.userId, countedAt: new Date() },
      create: { schoolId: session.schoolId, day: date, countedAmount: input.counted, note: input.note ?? null, countedById: session.userId, countedAt: new Date() }
    });
    await this.audit(session, AuditAction.UPDATE, "CashUpDay", day, { summary: `Cash counted · ${day} · ₦${Math.round(input.counted).toLocaleString("en-NG")}` });
    return { day };
  }

  async close(session: SessionPayload, day: string, body: unknown) {
    const input = z.object({ note: z.string().optional() }).parse(body);
    const date = dayStart(day);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("That is not a day.");
    const row = await prisma.cashUpDay.findUnique({ where: { schoolId_day: { schoolId: session.schoolId, day: date } } });
    if (!row || row.countedAmount === null) throw new BadRequestException("Count the day before closing it.");
    if (row.closedAt) throw new BadRequestException("That day is already closed.");
    if (row.countedById === session.userId && !OWNERS.has(session.role)) throw new ForbiddenException("Whoever counted a day cannot also close it.");
    const recorded = (await prisma.payment.findMany({ where: { schoolId: session.schoolId, status: "SUCCESS", isReversed: false, method: { in: ["CASH", "CHEQUE"] }, paidAt: { gte: date, lt: new Date(date.getTime() + 86_400_000) } }, select: { amount: true } })).reduce((sum, payment) => sum + num(payment.amount), 0);
    const variance = toMoney(num(row.countedAmount) - recorded);
    if (variance !== 0 && !(input.note ?? row.note)?.trim()) throw new BadRequestException(`The count is ₦${Math.abs(Math.round(variance)).toLocaleString("en-NG")} ${variance < 0 ? "short" : "over"}. Say what explains it before closing the day.`);
    await prisma.cashUpDay.update({ where: { id: row.id }, data: { closedAt: new Date(), closedById: session.userId, note: input.note ?? row.note } });
    await this.audit(session, AuditAction.APPROVE, "CashUpDay", day, { summary: `Cash-up closed · ${day}`, variance });
    return { day, variance };
  }

  async applyUnapplied(session: SessionPayload) {
    const schoolId = session.schoolId;
    const allocated = new Set((await prisma.paymentAllocation.findMany({ where: { schoolId }, select: { paymentId: true } })).map((row) => row.paymentId));
    const targets = (await prisma.payment.findMany({ where: { schoolId, status: "SUCCESS", isReversed: false, invoiceId: { not: null } }, select: { id: true } })).filter((payment) => !allocated.has(payment.id));
    let done = 0;
    for (const payment of targets) {
      await this.finance.allocatePayment(schoolId, payment.id).then(() => (done += 1)).catch(() => undefined);
    }
    await this.audit(session, AuditAction.UPDATE, "Payment", schoolId, { summary: `Unapplied payments allocated · ${done}` });
    return { applied: done, of: targets.length };
  }

  /* ───────────────────────── waivers and discounts ───────────────────────── */

  async decideWaiver(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ decision: z.enum(["approve", "decline"]), note: z.string().trim().optional() }).parse(body);
    if (!OWNERS.has(session.role)) throw new ForbiddenException("Waivers are decided by the Proprietor or the Principal.");
    const waiver = await prisma.feeWaiver.findFirst({ where: { id, schoolId: session.schoolId }, include: { invoice: true, student: true } });
    if (!waiver) throw new NotFoundException("That request does not exist.");
    if (waiver.status !== "PENDING") throw new BadRequestException("That request has already been decided.");
    if (waiver.requestedById === session.userId) throw new ForbiddenException("Nobody decides their own request.");
    if (input.decision === "decline") {
      if (!input.note) throw new BadRequestException("A refusal carries a reason the bursary can read.");
      await prisma.feeWaiver.update({ where: { id }, data: { status: "REJECTED", approvedById: session.userId, approvedAt: new Date() } });
    } else {
      const balance = num(waiver.invoice.balance);
      const raw = waiver.waiverType === "PERCENTAGE" && waiver.percentage ? (balance * num(waiver.percentage)) / 100 : waiver.waiverType === "FULL" ? balance : num(waiver.amount);
      const amount = toMoney(Math.min(raw, balance));
      const nextBalance = toMoney(balance - amount);
      await prisma.$transaction([
        prisma.feeWaiver.update({ where: { id }, data: { status: "APPROVED", approvedById: session.userId, approvedAt: new Date(), amount } }),
        prisma.invoiceAdjustment.create({ data: { schoolId: session.schoolId, invoiceId: waiver.invoiceId, appliedById: waiver.requestedById, approvedById: session.userId, type: "WAIVER", valueType: "FIXED", value: amount, amount, reason: `${waiver.reason}${input.note ? ` · ${input.note}` : ""}` } }),
        prisma.invoice.update({ where: { id: waiver.invoiceId }, data: { discount: toMoney(num(waiver.invoice.discount) + amount), total: toMoney(num(waiver.invoice.total) - amount), balance: nextBalance, status: getInvoiceStatus(num(waiver.invoice.total) - amount, nextBalance, waiver.invoice.dueOn) } })
      ]);
    }
    await this.audit(session, input.decision === "approve" ? AuditAction.APPROVE : AuditAction.UPDATE, "FeeWaiver", id, { summary: `Waiver ${input.decision === "approve" ? "approved" : "declined"}`, note: input.note });
    return { id, decision: input.decision };
  }
}
