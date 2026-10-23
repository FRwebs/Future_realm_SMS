import { inSchoolCurrency } from "../platform-policy/pricing-snapshot";
import { platformPolicy } from "../platform-policy/policy.service";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { fullName } from "../student-records/records.shared";
import {
  CAPABILITIES,
  KIND_LABEL,
  TIERS,
  gatewayMode,
  json,
  metaOf,
  naira,
  nextInvoiceNo,
  nextTerm,
  billingTarget,
  termLabelOf,
  num,
  rateOf,
  rollCount,
  round2,
  schoolOf,
  taxRate,
  tierOf,
  type InvoiceKind,
  type TierKey
} from "./billing.shared";
import { PaymentsService } from "./payments.service";

/**
 * The plan: what Future Realm costs at the school's current roll, and how to change it. Renewal
 * is arithmetic — students × rate — so the estimate is the form, and the payment follows it.
 */

const renewSchema = z.object({
  students: z.coerce.number().int().positive("Say how many students you expect."),
  estimateFrom: z.string().optional(),
  renewFor: z.string().default("Next term only"),
  /** The plan to be on, chosen when paying from a trial — it applies from today. */
  plan: z.string().optional(),
  payBy: z.string().default("Card · now"),
  autoRenew: z.coerce.boolean().default(false),
  remind: z.string().default("14 days before"),
  invoiceTo: z.string().optional(),
  email: z.string().optional()
});

const switchSchema = z.object({
  to: z.string().min(1, "Choose the plan to switch to."),
  effective: z.string().default("Start of next term"),
  reason: z.string().default("Other"),
  keepCredits: z.coerce.boolean().default(true)
});

/** A scheduled move to a cheaper tier is a pending downgrade; anything else is not. */
const statusFor = (from: TierKey, to: TierKey) =>
  TIERS[to].rate < TIERS[from].rate ? "PENDING_DOWNGRADE" : "ACTIVE";

const KIND = (meta: ReturnType<typeof metaOf>): InvoiceKind => (meta.kind as InvoiceKind) ?? "ONE_OFF";

@Injectable()
export class PlanService {
  constructor(private readonly payments: PaymentsService) {}

  private async audit(session: SessionPayload, entityId: string, metadata: Record<string, unknown>) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.BILLING_UPDATE, entityType: "PlatformInvoice", entityId, metadata: json(metadata) } });
  }

  /** What a payment is for, and the figures a school should estimate from. On a trial, that is the term the school is in; otherwise the next one. */
  async renewalFacts(schoolId: string) {
    const school = await schoolOf(schoolId);
    const onTrial = school.billingStatus === "TRIAL";
    const { term: target, startsNow, current, next } = await billingTarget(schoolId, onTrial);
    const [roll, accepted, top] = await Promise.all([
      rollCount(schoolId),
      prisma.admissionApplication.count({ where: { schoolId, status: { in: ["ACCEPTED", "FINANCIALLY_CLEARED"] } } }),
      prisma.classLevel.findFirst({ where: { schoolId, isActive: true }, orderBy: { order: "desc" }, select: { id: true, name: true } })
    ]);
    const leavers = top && !startsNow ? await prisma.student.count({ where: { schoolId, status: "ACTIVE", currentClass: { classLevelId: top.id } } }) : 0;
    const pendingDue = !startsNow && school.schoolSubscription?.pendingTier && school.schoolSubscription.pendingFrom && target && school.schoolSubscription.pendingFrom <= target.startDate;
    const tier = (pendingDue ? school.schoolSubscription?.pendingTier : tierOf(school)) as TierKey;
    const rate = pendingDue ? TIERS[tier].rate : rateOf(school);
    const terms = target ? await prisma.term.findMany({ where: { schoolId, academicSessionId: target.academicSessionId, startDate: { gte: target.startDate } }, orderBy: { startDate: "asc" } }) : [];
    // A payment made today for the term the school is in begins today, not on a date already past.
    const begins = target ? (startsNow ? new Date() : target.startDate) : null;
    return {
      current: current ? termLabelOf(current) : null,
      next: next ? { id: next.id, label: termLabelOf(next), start: next.startDate.toISOString(), end: next.endDate.toISOString() } : null,
      target: target && begins ? { id: target.id, label: termLabelOf(target), start: begins.toISOString(), end: target.endDate.toISOString() } : null,
      startsNow,
      tiers: (Object.keys(TIERS) as TierKey[]).map((key) => ({ key, name: TIERS[key].name, rate: TIERS[key].rate })),
      restOfSession: terms.length,
      roll,
      // On a trial the roll is what is being billed: nobody is "expected" for a term already running.
      accepted: startsNow ? 0 : accepted,
      leavers,
      leaversLevel: startsNow ? null : top?.name ?? null,
      suggest: Math.max(0, roll + (startsNow ? 0 : accepted) - leavers),
      rate,
      tier,
      tierName: TIERS[tier].name,
      switching: Boolean(pendingDue)
    };
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    const tier = tierOf(school);
    const rate = rateOf(school);
    const { current, next } = await nextTerm(schoolId);
    const sessionStart = current?.academicSession ? await prisma.term.findFirst({ where: { schoolId, academicSessionId: current.academicSessionId }, orderBy: { startDate: "asc" } }) : null;
    const since = sessionStart?.startDate ?? new Date(Date.now() - 365 * 86_400_000);

    const [invoices, wallet, roll, renewal, facts, migration] = await Promise.all([
      prisma.platformInvoice.findMany({ where: { schoolId }, include: { transactions: true }, orderBy: { issuedAt: "desc" } }),
      prisma.notificationWallet.findUnique({ where: { schoolId } }),
      rollCount(schoolId),
      this.renewalFacts(schoolId),
      this.valueFacts(schoolId, since),
      prisma.migrationJob.count({ where: { schoolId } })
    ]);

    const rows = invoices.map((invoice) => {
      const meta = metaOf(invoice.metadata);
      const total = round2(num(invoice.amount) + num(invoice.taxAmount));
      return { id: invoice.id, no: invoice.invoiceNo, kind: KIND(meta), kindLabel: KIND_LABEL[KIND(meta)], period: meta.description ?? (meta.plan ? `Plan · ${String(meta.billingCycle ?? "")}`.trim() : "Invoice"), amount: num(invoice.amount), tax: num(invoice.taxAmount), total, issued: invoice.issuedAt.toISOString(), due: invoice.dueAt.toISOString(), paidAt: invoice.paidAt?.toISOString() ?? null, state: invoice.status === "PAID" ? "Paid" : new Date(invoice.dueAt) < new Date() ? "Overdue" : "Outstanding", termLabel: meta.termLabel ?? null };
    });
    const outstanding = rows.filter((row) => row.state !== "Paid");
    const termly = rows.filter((row) => row.kind === "TERMLY");
    const lastPaid = rows.filter((row) => row.state === "Paid").sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0] ?? null;
    const thisTerm = current ? termly.find((row) => row.termLabel === `${current.name} ${current.academicSession?.name ?? ""}`.trim()) ?? null : null;

    const running = [
      { name: `${TIERS[tier].name} plan`, basis: "Per student, per term", units: roll, rate, thisTerm: roll * rate, renews: next?.startDate.toISOString() ?? null, state: school.billingStatus === "ACTIVE" ? "Active" : String(school.billingStatus), action: "Switch" },
      { name: "Guardian portal", basis: TIERS[tier].features.portal ? `Included in ${TIERS[tier].name}` : `Not in ${TIERS[tier].name}`, units: null, rate: null, thisTerm: null, renews: null, state: TIERS[tier].features.portal ? "Active" : "Not included", action: null },
      { name: "SMS credits", basis: `${(school.schoolSubscription?.baseSms ?? TIERS[tier].baseSms).toLocaleString("en-NG")} base, then pay as you go`, units: wallet?.smsBalance ?? null, rate: 3.8, thisTerm: null, renews: null, state: wallet ? (wallet.smsBalance <= wallet.lowBalanceThreshold ? "Low" : "Active") : "No wallet", action: "Top up SMS" },
      { name: "WhatsApp credits", basis: `${(school.schoolSubscription?.baseWhatsapp ?? TIERS[tier].baseWhatsapp).toLocaleString("en-NG")} base, then pay as you go`, units: wallet?.whatsappBalance ?? null, rate: 4.4, thisTerm: null, renews: null, state: wallet ? (wallet.whatsappBalance <= wallet.lowBalanceThreshold ? "Low" : "Active") : "No wallet", action: "Top up WhatsApp" },
      ...(migration || rows.some((row) => row.kind === "ONE_OFF" && /migrat/i.test(row.period)) ? [{ name: "Migration assistance", basis: "One-off", units: null, rate: null, thisTerm: 0, renews: null, state: "Completed", action: null }] : [])
    ];

    const sub = school.schoolSubscription;
    return {
      school: { name: school.name, currency: school.currency, billingStatus: String(school.billingStatus), status: String(school.status), trialEndsAt: school.trialEndsAt?.toISOString() ?? null },
      term: current ? { id: current.id, label: `${current.name} ${current.academicSession?.name ?? ""}`.trim() } : null,
      next: renewal.next,
      daysToRenew: next ? Math.ceil((next.startDate.getTime() - Date.now()) / 86_400_000) : null,
      tier,
      tierName: TIERS[tier].name,
      rate,
      roll,
      thisTerm: { amount: thisTerm?.total ?? roll * rate, students: roll, billed: Boolean(thisTerm), invoice: thisTerm?.no ?? null },
      account: { state: outstanding.some((row) => row.state === "Overdue") ? "Overdue" : outstanding.length ? "Awaiting payment" : "Paid and current", outstanding: outstanding.reduce((sum, row) => sum + row.total, 0), outstandingCount: outstanding.length, lastSettled: lastPaid?.paidAt ?? null },
      running,
      value: facts,
      invoices: rows,
      comparison: { roll, tiers: (Object.keys(TIERS) as TierKey[]).map((key) => ({ key, name: TIERS[key].name, rate: TIERS[key].rate, term: roll * TIERS[key].rate, session: roll * TIERS[key].rate * 3 })), capabilities: CAPABILITIES },
      pending: sub?.pendingTier ? { tier: TIERS[sub.pendingTier as TierKey]?.name ?? sub.pendingTier, from: sub.pendingFrom?.toISOString() ?? null, reason: sub.switchReason } : null,
      renewal,
      preferences: { autoRenew: sub?.autoRenew ?? false, remindDays: sub?.remindDays ?? 14, invoiceTo: sub?.invoiceTo ?? null, receiptEmail: sub?.receiptEmail ?? null },
      gateway: gatewayMode()
    };
  }

  /** What the school got for what it pays, read off the work actually done — presented without spin. */
  private async valueFacts(schoolId: string, since: Date) {
    const [cards, notices, delivered, attendance, scores, payments, activated, approvals, exportsTaken, tickets, drafts, syncedDrafts] = await Promise.all([
      prisma.reportCard.count({ where: { schoolId, createdAt: { gte: since } } }),
      prisma.notificationLog.count({ where: { schoolId, sentAt: { gte: since } } }),
      prisma.notificationLog.count({ where: { schoolId, sentAt: { gte: since }, NOT: { status: { in: ["FAILED", "BOUNCED"] } } } }),
      prisma.studentAttendance.count({ where: { schoolId, date: { gte: since } } }),
      prisma.scoreEntry.count({ where: { schoolId, recordedAt: { gte: since } } }),
      prisma.payment.aggregate({ where: { schoolId, status: "SUCCESS", isReversed: false, paidAt: { gte: since } }, _sum: { amount: true } }),
      prisma.guardian.count({ where: { schoolId, user: { lastLoginAt: { not: null } } } }),
      prisma.approvalRequest.findMany({ where: { schoolId, status: { not: "PENDING" }, decidedAt: { gte: since } }, select: { createdAt: true, decidedAt: true } }),
      prisma.auditLog.count({ where: { schoolId, action: "EXPORT", createdAt: { gte: since } } }),
      prisma.supportTicket.count({ where: { schoolId, createdAt: { gte: since } } }),
      prisma.syncDraft.count({ where: { schoolId, createdAt: { gte: since } } }),
      prisma.syncDraft.count({ where: { schoolId, createdAt: { gte: since }, syncedAt: { not: null } } })
    ]);
    const days = approvals.length ? approvals.reduce((sum, row) => sum + ((row.decidedAt as Date).getTime() - row.createdAt.getTime()) / 86_400_000, 0) / approvals.length : null;
    return [
      ["Report cards generated", cards.toLocaleString("en-NG"), ""],
      ["Notifications queued or sent", notices.toLocaleString("en-NG"), notices ? `${Math.round((delivered / notices) * 100)}% not failed` : ""],
      ["Attendance records", attendance.toLocaleString("en-NG"), ""],
      ["Fees tracked", naira(num(payments._sum.amount)), "Payments received and recorded"],
      ["Guardian families activated", activated.toLocaleString("en-NG"), "Have signed in to the portal"],
      ["Score entries", scores.toLocaleString("en-NG"), ""],
      ["Approvals decided", approvals.length.toLocaleString("en-NG"), days === null ? "" : `Average ${days.toFixed(1)} days`],
      ["Exports taken", exportsTaken.toLocaleString("en-NG"), "Every one logged"],
      ["Support tickets", tickets.toLocaleString("en-NG"), ""],
      ["Offline drafts", drafts.toLocaleString("en-NG"), drafts ? `${syncedDrafts} synced` : "None recorded"]
    ] as Array<[string, string, string]>;
  }

  /* ───────────────────────── renewing ───────────────────────── */

  async renew(session: SessionPayload, body: unknown) {
    const input = renewSchema.parse(body);
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    const facts = await this.renewalFacts(schoolId);
    const terms = input.renewFor.startsWith("A full") ? 3 : input.renewFor.startsWith("The rest") ? Math.max(1, facts.restOfSession) : 1;
    const discount = input.renewFor.startsWith("A full") ? 0.05 : 0;
    // From a trial the school chooses its plan as it pays, and it applies from today. Everyone else changes plan through a switch, which never lands mid-term.
    const chosen = facts.startsNow && input.plan ? (Object.keys(TIERS) as TierKey[]).find((key) => input.plan!.startsWith(TIERS[key].name)) : undefined;
    if (input.plan && facts.startsNow && !chosen) throw new BadRequestException("That is not a plan.");
    const tierKey = chosen ?? facts.tier;
    const rate = chosen ? TIERS[chosen].rate : facts.rate;
    const tierName = TIERS[tierKey].name;
    const label = facts.target?.label ?? "Next term";
    const gross = round2(input.students * rate * terms);
    const amount = round2(inSchoolCurrency(gross * (1 - discount), school.currency));
    const tax = round2(amount * (await taxRate(school.country)));
    const description = `${label}${terms > 1 ? ` + ${terms - 1} more` : ""} · ${input.students.toLocaleString("en-NG")} students`;
    const open = await prisma.platformInvoice.findFirst({ where: { schoolId, status: { not: "PAID" }, metadata: { path: ["termLabel"], equals: label } } });
    const paid = await prisma.platformInvoice.findFirst({ where: { schoolId, status: "PAID", metadata: { path: ["termLabel"], equals: label } } });
    if (paid) throw new BadRequestException(`${label} is already paid for (${paid.invoiceNo}).`);
    // Where what is bought runs out: the end of the last term it covers (as many as there are left in the session). The account is billed again from there.
    const targetTerm = facts.target ? await prisma.term.findUnique({ where: { id: facts.target.id }, select: { academicSessionId: true, startDate: true } }) : null;
    const coveredTerms = targetTerm ? await prisma.term.findMany({ where: { schoolId, academicSessionId: targetTerm.academicSessionId, startDate: { gte: targetTerm.startDate } }, orderBy: { startDate: "asc" }, select: { endDate: true } }) : [];
    const coversUntil = coveredTerms[Math.min(terms, coveredTerms.length) - 1]?.endDate ?? (facts.target ? new Date(facts.target.end) : null);
    const meta = { kind: "TERMLY", description, termLabel: label, units: input.students, rate, tier: tierName, tierKey, terms, discount, invoiceTo: input.invoiceTo ?? null, estimatedFrom: input.estimateFrom ?? null, starts: facts.target?.start ?? null, startsNow: facts.startsNow, coversUntil: coversUntil?.toISOString() ?? null };
    // Paying from a trial is for a term already running, so the invoice is due on receipt (three days' grace), not seven days before a term that has begun.
    const dueAt = facts.startsNow ? new Date(Date.now() + 3 * 86_400_000) : facts.target ? new Date(new Date(facts.target.start).getTime() - 7 * 86_400_000) : (await platformPolicy.invoiceTerms(0)).dueAt;
    const invoice = open
      ? await prisma.platformInvoice.update({ where: { id: open.id }, data: { amount, taxAmount: tax, dueAt, metadata: json(meta) } })
      : await prisma.platformInvoice.create({ data: { schoolId, invoiceNo: await nextInvoiceNo(), amount, taxAmount: tax, currency: school.currency, status: "PENDING", dueAt, metadata: json(meta) } });
    // A payment started for the old amount can no longer be honoured.
    if (open) await prisma.platformBillingTransaction.updateMany({ where: { invoiceId: invoice.id, status: "PENDING" }, data: { status: "FAILED", metadata: json({ superseded: "The invoice changed before it was paid" }) } });
    const remind = Number(input.remind.match(/\d+/)?.[0] ?? 0);
    await prisma.schoolSubscription.upsert({
      where: { schoolId },
      update: { autoRenew: input.autoRenew, remindDays: remind, invoiceTo: input.invoiceTo ?? undefined, receiptEmail: input.email || undefined },
      create: { schoolId, tier: tierOf(school), autoRenew: input.autoRenew, remindDays: remind, invoiceTo: input.invoiceTo, receiptEmail: input.email || null }
    });
    await this.audit(session, invoice.id, { summary: `Renewal invoiced · ${invoice.invoiceNo} · ${description}`, total: round2(amount + tax) });
    const total = round2(amount + tax);
    if (input.payBy.startsWith("Card")) {
      const started = await this.payments.start(session, invoice.id, { method: "Card", email: input.email || undefined });
      return { invoiceId: invoice.id, ...started };
    }
    return { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, total, mode: "transfer" as const, note: "The invoice is issued. Pay by bank transfer quoting its number; the term is applied once Future Realm confirms the payment." };
  }

  /* ───────────────────────── switching ───────────────────────── */

  async switchPlan(session: SessionPayload, body: unknown) {
    const input = switchSchema.parse(body);
    const schoolId = session.schoolId;
    const school = await schoolOf(schoolId);
    const to = (Object.keys(TIERS) as TierKey[]).find((key) => input.to.startsWith(TIERS[key].name));
    if (!to) throw new BadRequestException("That is not a plan.");
    if (to === tierOf(school)) throw new BadRequestException(`The school is already on ${TIERS[to].name}.`);
    const { next } = await nextTerm(schoolId);
    let from = next?.startDate ?? new Date(Date.now() + 30 * 86_400_000);
    if (input.effective.startsWith("Start of next session")) {
      const firstOfNext = await prisma.term.findFirst({ where: { schoolId, order: 1, startDate: { gt: new Date() } }, orderBy: { startDate: "asc" } });
      if (firstOfNext) from = firstOfNext.startDate;
    }
    await prisma.schoolSubscription.upsert({
      where: { schoolId },
      // `status` has to move with the schedule, or the subscription claims a
      // pending downgrade it no longer has — the midterm service and the
      // rollover worker both read it.
      update: { pendingTier: to, pendingFrom: from, switchReason: input.reason, keepCredits: input.keepCredits, status: statusFor(tierOf(school), to) },
      create: { schoolId, tier: tierOf(school), pendingTier: to, pendingFrom: from, switchReason: input.reason, keepCredits: input.keepCredits, status: statusFor(tierOf(school), to) }
    });
    await this.audit(session, schoolId, { summary: `Plan switch scheduled · ${TIERS[tierOf(school)].name} to ${TIERS[to].name}`, from: from.toISOString(), reason: input.reason });
    const roll = await rollCount(schoolId);
    return { to: TIERS[to].name, from: from.toISOString(), perTerm: roll * TIERS[to].rate, saving: roll * (rateOf(school) - TIERS[to].rate) };
  }

  async cancelSwitch(session: SessionPayload) {
    await prisma.schoolSubscription.updateMany({ where: { schoolId: session.schoolId }, data: { pendingTier: null, pendingFrom: null, switchReason: null, status: "ACTIVE" } });
    await this.audit(session, session.schoolId, { summary: "Plan switch withdrawn" });
    return {};
  }

  /* ───────────────────────── an invoice, as a document ───────────────────────── */

  async invoice(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const invoice = await prisma.platformInvoice.findFirst({ where: { id, schoolId }, include: { transactions: { orderBy: { processedAt: "asc" } } } });
    if (!invoice) throw new NotFoundException("That invoice does not exist.");
    const school = await schoolOf(schoolId);
    const meta = metaOf(invoice.metadata);
    const kind = KIND(meta);
    const subtotal = num(invoice.amount);
    const lines: Array<{ description: string; qty: string; rate: string; amount: number }> = [];
    if (kind === "TERMLY") {
      const gross = round2((meta.units ?? 0) * (meta.rate ?? 0) * (meta.terms ?? 1));
      lines.push({ description: `${meta.tier ?? "Plan"} plan · ${meta.termLabel ?? ""}${(meta.terms ?? 1) > 1 ? ` and ${(meta.terms ?? 1) - 1} further term(s)` : ""}`.trim(), qty: `${(meta.units ?? 0).toLocaleString("en-NG")} students × ${meta.terms ?? 1}`, rate: naira(meta.rate ?? 0), amount: gross });
      if (meta.discount) lines.push({ description: "Paid a session in advance", qty: "", rate: `${Math.round((meta.discount ?? 0) * 100)}% off`, amount: round2(subtotal - gross) });
    } else if (kind === "TOPUP") {
      lines.push({ description: `${meta.channel} credits`, qty: `${(meta.credits ?? 0).toLocaleString("en-NG")} credits`, rate: naira(meta.rate ?? 0), amount: round2((meta.credits ?? 0) * (meta.rate ?? 0)) });
      if (meta.discount) lines.push({ description: "Volume discount", qty: "", rate: `${Math.round((meta.discount ?? 0) * 100)}% off`, amount: round2(subtotal - (meta.credits ?? 0) * (meta.rate ?? 0)) });
    } else {
      lines.push({ description: meta.description ?? (meta.plan ? `${String(meta.plan)} plan · ${String(meta.billingCycle ?? "")}` : "Charges"), qty: "1", rate: naira(subtotal), amount: subtotal });
    }
    const total = round2(subtotal + num(invoice.taxAmount));
    const paid = invoice.transactions.filter((tx) => tx.status === "SUCCESS").reduce((sum, tx) => sum + num(tx.amount), 0);
    return {
      id: invoice.id,
      no: invoice.invoiceNo,
      kind: KIND_LABEL[kind],
      state: invoice.status === "PAID" ? "Paid" : invoice.dueAt < new Date() ? "Overdue" : "Outstanding",
      issued: invoice.issuedAt.toISOString(),
      due: invoice.dueAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
      currency: invoice.currency,
      lines,
      subtotal,
      tax: num(invoice.taxAmount),
      total,
      paid,
      billTo: { name: school.name, address: [school.address, school.city].filter(Boolean).join(", "), attention: meta.invoiceTo ?? school.schoolSubscription?.billingContact ?? school.ownerName ?? "", email: school.schoolSubscription?.billingEmail ?? school.ownerEmail ?? "" },
      payments: invoice.transactions.map((tx) => ({ reference: tx.reference, method: tx.method === "CARD" ? "Card" : tx.method === "BANK_TRANSFER" ? "Bank transfer" : tx.method, status: tx.status === "SUCCESS" ? "Cleared" : tx.status === "PENDING" ? "Awaiting the gateway" : "Failed", at: tx.processedAt.toISOString(), amount: num(tx.amount) })),
      issuedTo: fullName({ firstName: school.ownerName ?? "", lastName: "" })
    };
  }
}
