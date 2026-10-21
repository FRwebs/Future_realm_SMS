import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { platformPolicy } from "../platform-policy/policy.service";
import { renderTrigger, type TriggerKey } from "../platform-policy/triggers";
import { CHANNEL_RATES, TIERS, gatewayMode, json, nextInvoiceNo, quote, round2, schoolOf, taxRate, tierOf } from "../subscription-billing/billing.shared";

const DAY = 86_400_000;
const OWNER_ROLES = ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL"] as const;
const OPEN_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"];

/**
 * The trial's communication schedule. A step with `own` is sent by this engine; one with `lifecycle` is sent by the
 * lifecycle engine at the moment the trial changes state, and is only counted here. Days after day 14 count back from the
 * end of the trial, so a policy that shortens or lengthens the trial moves them with it.
 */
type Step = { key: string; day: (trial: number, readOnly: number) => number; message: string; channel: string; source: string; own?: { trigger: TriggerKey; subject: string; body: (s: Ctx) => string; skip?: (s: Ctx) => string | null }; lifecycle?: string };
type Ctx = { school: string; students: number; teachers: number; reportCards: number; setup: string; days: number };

export const TRIAL_STEPS: Step[] = [
  { key: "day0", day: () => 0, message: "Welcome — school web address, identifier, what to do first", channel: "Email + in-app", source: "Signup provisioning", lifecycle: "WELCOME" },
  { key: "day1", day: () => 1, message: "Download your first report card — guided prompt against sample data", channel: "Email + in-app", source: "Trial engine", own: { trigger: "trial.day1", subject: "Download your first report card", body: (c) => `${c.school} already has a sample class with scores entered. Open Report Cards and download one to see what parents will receive — it takes a minute.`, skip: (c) => (c.reportCards > 0 ? "The school has already produced a report card" : null) } },
  { key: "day3", day: () => 3, message: "Import your students — migration guide", channel: "Email + in-app", source: "Trial engine → Migration", own: { trigger: "trial.day3", subject: "Bring your students across", body: (c) => `The fastest way to make ${c.school} real is to import your students. Our migration guide walks through it — or ask your Account Manager to do it with you.`, skip: (c) => (c.students >= 50 ? `The school has already imported ${c.students} students` : null) } },
  { key: "day7", day: () => 7, message: "Invite your teachers", channel: "Email + in-app", source: "Trial engine", own: { trigger: "trial.day7", subject: "Invite your teachers", body: (c) => `A school runs on its teachers. Invite them to ${c.school} from Staff & Access so attendance and scores start flowing.`, skip: (c) => (c.teachers >= 3 ? `The school already has ${c.teachers} teachers` : null) } },
  { key: "day14", day: () => 14, message: "Progress summary — what the school has achieved so far", channel: "Email", source: "Trial engine", own: { trigger: "trial.day14", subject: "Your first two weeks on Future Realm", body: (c) => `${c.school} so far: ${c.students} students, ${c.teachers} teachers, setup ${c.setup}. Keep going — your trial has ${c.days} days left.` } },
  { key: "pricing", day: (t) => Math.max(15, t - 9), message: "Nine days left, plus pricing for their student count", channel: "Email + in-app", source: "Trial engine", own: { trigger: "trial.pricing", subject: "Your trial: pricing for your size", body: (c) => `Your trial has ${c.days} days left. For ${c.students.toLocaleString("en-NG")} students, open Subscription & Billing to see exactly what a plan costs and choose one.` } },
  { key: "payment", day: (t) => t - 3, message: "Three days left, plus payment instructions", channel: "Email + in-app", source: "Lifecycle engine", lifecycle: "TRIAL_ENDING" },
  { key: "ended", day: (t) => t, message: "Trial ended — read-only, seven days to reactivate", channel: "Email + in-app", source: "Lifecycle engine", lifecycle: "TRIAL_READ_ONLY" },
  { key: "locked", day: (t, r) => t + r, message: "Account locked, data safely retained", channel: "Email + in-app", source: "Lifecycle engine", lifecycle: "TRIAL_LOCK" }
];

const correctSchema = z.object({ amount: z.coerce.number().min(0), reason: z.string().trim().min(5, "Say what is being corrected and why.") });
const byHandSchema = z.object({
  schoolId: z.string().min(1, "Choose a school."),
  channel: z.enum(["SMS", "WHATSAPP"]),
  credits: z.coerce.number().int().min(1, "Add at least one credit.").max(500_000),
  reason: z.string().trim().min(5, "Say why the credit is being added by hand.")
});
const dismissSchema = z.object({ schoolId: z.string().min(1), plan: z.string().min(1), reason: z.string().trim().min(5, "Say why the recommendation is being dismissed.") });
const idsSchema = z.object({ invoiceIds: z.array(z.string()).min(1, "Choose at least one invoice.") });

@Injectable()
export class BillingExtrasService implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  private readonly log = new Logger("TrialJourney");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.TRIAL_JOURNEY === "off") return;
    this.timer = setInterval(() => void this.runJourney().catch((error) => this.log.error(error)), 3_600_000);
    this.timer.unref();
  }

  private topupTimer: NodeJS.Timeout | null = null;
  onApplicationBootstrap() {
    if (process.env.AUTO_TOPUP_SCANNER === "off") return;
    this.topupTimer = setInterval(() => void this.scanWallets().catch((error) => this.log.error(error)), 1_800_000);
    this.topupTimer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.topupTimer) clearInterval(this.topupTimer);
  }

  private async audit(session: SessionPayload | null, action: AuditAction, entityType: string, entityId: string, metadata: Prisma.InputJsonValue, schoolId?: string | null) {
    const actor = session ? await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } }) : null;
    await prisma.auditLog.create({ data: { schoolId: schoolId ?? null, actorId: actor?.id ?? null, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── payments: the reconciliation picture ───────────────────────── */

  async reconciliationStats() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [awaiting, reconciled, corrections, accruals] = await Promise.all([
      prisma.platformBillingTransaction.findMany({ where: { status: { in: ["SUCCESS", "PAID", "COMPLETED"] }, reconciledAt: null }, select: { processedAt: true } }),
      prisma.platformBillingTransaction.aggregate({ where: { reconciledAt: { gte: monthStart } }, _count: { _all: true }, _sum: { amount: true } }),
      prisma.platformBillingTransaction.count({ where: { status: "CORRECTION" } }),
      prisma.partnerAccrual.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { commission: true } })
    ]);
    return {
      awaiting: awaiting.length,
      overSevenDays: awaiting.filter((t) => Date.now() - t.processedAt.getTime() > 7 * DAY).length,
      reconciledThisMonth: reconciled._count._all,
      reconciledAmount: Number(reconciled._sum.amount ?? 0),
      corrections,
      commissionUnlocked: Number(accruals._sum.commission ?? 0)
    };
  }

  /** An amendment never edits the original: it adds a correcting entry, and both stay visible. */
  async correctPayment(session: SessionPayload, transactionId: string, body: unknown) {
    const input = correctSchema.parse(body);
    const original = await prisma.platformBillingTransaction.findUnique({ where: { id: transactionId }, include: { invoice: { include: { transactions: true } } } });
    if (!original) throw new NotFoundException("Transaction not found.");
    if (original.status === "CORRECTION") throw new BadRequestException("A correcting entry cannot itself be corrected — correct the original again.");
    const previousCorrections = await prisma.platformBillingTransaction.findMany({ where: { status: "CORRECTION", metadata: { path: ["corrects"], equals: original.id } } });
    const current = Number(original.amount) + previousCorrections.reduce((sum, row) => sum + Number(row.amount), 0);
    const delta = Math.round((input.amount - current) * 100) / 100;
    if (delta === 0) throw new BadRequestException("That is the amount already on record.");
    const entry = await prisma.platformBillingTransaction.create({
      data: { schoolId: original.schoolId, invoiceId: original.invoiceId, amount: delta, method: original.method, status: "CORRECTION", reference: `${original.reference}-C${previousCorrections.length + 1}`, recordedById: session.userId, metadata: { corrects: original.id, was: current, now: input.amount, reason: input.reason } as Prisma.InputJsonValue }
    });
    if (original.invoice) {
      const settled = [...original.invoice.transactions.filter((t) => t.status === "SUCCESS"), ...previousCorrections].reduce((sum, t) => sum + Number(t.amount), 0) + delta;
      const due = Number(original.invoice.amount) + Number(original.invoice.taxAmount);
      await prisma.platformInvoice.update({ where: { id: original.invoice.id }, data: { status: settled >= due ? "PAID" : settled > 0 ? "PARTIALLY_PAID" : "SENT", paidAt: settled >= due ? original.invoice.paidAt ?? new Date() : null } });
    }
    await this.audit(session, AuditAction.BILLING_UPDATE, "PlatformBillingTransaction", entry.id, { corrects: original.reference, from: current, to: input.amount, reason: input.reason }, original.schoolId);
    return { id: entry.id, reference: entry.reference, delta };
  }

  /* ───────────────────────── invoices in bulk ───────────────────────── */

  async remind(session: SessionPayload, body: unknown) {
    const { invoiceIds } = idsSchema.parse(body);
    const invoices = await prisma.platformInvoice.findMany({ where: { id: { in: invoiceIds }, status: { in: OPEN_STATUSES } }, include: { school: { select: { id: true, name: true, ownerEmail: true } } } });
    if (!invoices.length) throw new BadRequestException("None of the ticked invoices is waiting on payment.");
    for (const invoice of invoices) {
      const owing = Number(invoice.amount) + Number(invoice.taxAmount);
      if (invoice.school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: invoice.school.ownerEmail, title: `Reminder: invoice ${invoice.invoiceNo}`, body: `Invoice ${invoice.invoiceNo} for ${owing.toLocaleString("en-NG")} ${invoice.currency} was due ${invoice.dueAt.toDateString()}. Please arrange payment, or reply if something is in the way.` }).catch(() => undefined);
      const owners = await prisma.user.findMany({ where: { schoolId: invoice.schoolId, isActive: true, deletedAt: null, role: { in: [...OWNER_ROLES, "BURSAR"] as never } }, select: { id: true } });
      if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: invoice.schoolId, userId: owner.id, channel: "IN_APP" as const, title: `Reminder: invoice ${invoice.invoiceNo}`, body: `A payment is outstanding on ${invoice.invoiceNo}.`, status: "QUEUED", sentAt: new Date() })) });
      // The automatic sequence cannot say who decided to chase; this does.
      await this.audit(session, AuditAction.UPDATE, "PlatformInvoice", invoice.id, { reminder: "sent by hand", decidedBy: session.email }, invoice.schoolId);
    }
    return { reminded: invoices.length };
  }

  async sendDrafts(session: SessionPayload, body: unknown) {
    const { invoiceIds } = idsSchema.parse(body);
    const drafts = await prisma.platformInvoice.findMany({ where: { id: { in: invoiceIds }, status: "DRAFT" }, include: { school: { select: { ownerEmail: true } } } });
    if (!drafts.length) throw new BadRequestException("None of the ticked invoices is a draft — only drafts can be sent.");
    for (const invoice of drafts) {
      await prisma.platformInvoice.update({ where: { id: invoice.id }, data: { status: "SENT" } });
      if (invoice.school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: invoice.school.ownerEmail, title: `Invoice ${invoice.invoiceNo} from FutureRealm SMS`, body: `An invoice for ${Number(invoice.amount) + Number(invoice.taxAmount)} ${invoice.currency} is due ${invoice.dueAt.toDateString()}.` }).catch(() => undefined);
      await this.audit(session, AuditAction.UPDATE, "PlatformInvoice", invoice.id, { status: "SENT", bulk: true }, invoice.schoolId);
    }
    return { sent: drafts.length };
  }

  async exportInvoices(session: SessionPayload, ids: string[]) {
    const rows = await prisma.platformInvoice.findMany({ where: { id: { in: ids } }, include: { school: { select: { name: true } } }, orderBy: { issuedAt: "desc" } });
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    await this.audit(session, AuditAction.EXPORT, "PlatformInvoice", "selection", { rowCount: rows.length });
    return ["Invoice,School,Amount,Tax,Currency,Status,Due", ...rows.map((r) => [r.invoiceNo, r.school.name, Number(r.amount), Number(r.taxAmount), r.currency, r.status, r.dueAt.toISOString().slice(0, 10)].map(esc).join(","))].join("\n");
  }

  /* ───────────────────────── the trial communication schedule ───────────────────────── */

  private async context(school: { id: string; name: string; trialEndsAt: Date | null }, trialDays: number): Promise<Ctx> {
    const [students, teachers, cards, checklist] = await Promise.all([
      prisma.student.count({ where: { schoolId: school.id, NOT: { admissionNumber: { startsWith: "SMP-" } } } }),
      prisma.user.count({ where: { schoolId: school.id, isActive: true, deletedAt: null, role: { in: ["SUBJECT_TEACHER", "CLASS_TEACHER", "HEAD_OF_DEPARTMENT"] } } }),
      prisma.reportCard.count({ where: { schoolId: school.id, student: { NOT: { admissionNumber: { startsWith: "SMP-" } } } } }),
      prisma.onboardingChecklistItem.findMany({ where: { schoolId: school.id }, select: { completedAt: true } })
    ]);
    const left = school.trialEndsAt ? Math.max(0, Math.ceil((school.trialEndsAt.getTime() - Date.now()) / DAY)) : trialDays;
    return { school: school.name, students, teachers, reportCards: cards, setup: `${checklist.filter((c) => c.completedAt).length} of ${checklist.length || 6} steps done`, days: left };
  }

  /** Sends the next due message to every school on a trial, or records why it was held back. */
  async runJourney() {
    const policy = await platformPolicy.get();
    const schools = await prisma.school.findMany({ where: { deletedAt: null, status: "TRIAL", trialStartedAt: { not: null }, isPersonalWorkspace: false }, select: { id: true, name: true, ownerEmail: true, trialStartedAt: true, trialEndsAt: true } });
    let sent = 0;
    let suppressed = 0;
    for (const school of schools) {
      const day = Math.floor((Date.now() - (school.trialStartedAt as Date).getTime()) / DAY);
      const done = new Set((await prisma.trialMessage.findMany({ where: { schoolId: school.id }, select: { step: true } })).map((row) => row.step));
      const ctx = await this.context(school, policy.trial.days);
      for (const step of TRIAL_STEPS) {
        if (!step.own || done.has(step.key)) continue;
        const due = step.day(policy.trial.days, policy.trial.readOnlyDays);
        if (due > day) continue;
        // A step that came due long before the engine could run is not sent late — it would read as nonsense.
        const reason = due < day - 2 ? "Came due before this school was reached" : step.own.skip?.(ctx) ?? null;
        if (reason) {
          await prisma.trialMessage.create({ data: { schoolId: school.id, step: step.key, status: "SUPPRESSED", reason } });
          suppressed += 1;
          continue;
        }
        const vars = { school: school.name, students: ctx.students, teachers: ctx.teachers, setup: ctx.setup, days: ctx.days };
        const wording = await renderTrigger(step.own.trigger, vars, { subject: step.own.subject, body: step.own.body(ctx) });
        const owners = await prisma.user.findMany({ where: { schoolId: school.id, isActive: true, deletedAt: null, role: { in: [...OWNER_ROLES] } }, select: { id: true } });
        const log = school.ownerEmail
          ? await prisma.notificationLog.create({ data: { schoolId: school.id, userId: owners[0]?.id, channel: "EMAIL", title: wording.subject, body: wording.body, status: "QUEUED", sentAt: new Date(), metadata: { kind: "TRIAL_JOURNEY", step: step.key, email: school.ownerEmail, billing: "PLATFORM" } as Prisma.InputJsonValue } })
          : null;
        if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: school.id, userId: owner.id, channel: "IN_APP" as const, title: wording.subject, body: wording.body, status: "QUEUED", sentAt: new Date(), metadata: { kind: "TRIAL_JOURNEY", step: step.key } as Prisma.InputJsonValue })) });
        await prisma.trialMessage.create({ data: { schoolId: school.id, step: step.key, status: "SENT", logId: log?.id } });
        sent += 1;
      }
    }
    return { sent, suppressed, schools: schools.length };
  }

  /* ───────────────────────── wallets: the floor, the automatic top-up, the register ───────────────────────── */

  /**
   * One pass over every school's wallet. A school below its floor is told once a week. A school that has switched automatic
   * top-up on is given an invoice for the quantity it chose; the card cannot be charged from here (the gateway adapter has no
   * saved-card charge), so the "charge" is an invoice and a message, retried daily. Three unpaid in a row and it stops, tells
   * the school and the account manager, and waits for a person — it never keeps trying.
   */
  async scanWallets() {
    const subs = await prisma.schoolSubscription.findMany({ where: { autoTopup: { not: Prisma.DbNull } } });
    const wallets = await prisma.notificationWallet.findMany({ where: { school: { deletedAt: null, isPersonalWorkspace: false } }, include: { school: { select: { id: true, name: true, ownerEmail: true, currency: true, country: true, accountManagerId: true } } } });
    let alerted = 0, issued = 0, stopped = 0;
    for (const wallet of wallets) {
      const sub = subs.find((row) => row.schoolId === wallet.schoolId);
      const floor = sub?.warnAt ?? 2000;
      const auto = (sub?.autoTopup ?? null) as { on?: boolean; channel?: string; quantity?: number } | null;
      const channels = [["SMS", wallet.smsBalance], ["WHATSAPP", wallet.whatsappBalance]] as const;
      const below = channels.filter(([, balance]) => balance < floor);
      if (!below.length) continue;
      const weekAgo = new Date(Date.now() - 7 * DAY);
      const told = await prisma.auditLog.findFirst({ where: { schoolId: wallet.schoolId, entityType: "WalletLowAlert", createdAt: { gte: weekAgo } }, select: { id: true } });
      if (!told) {
        const names = below.map(([channel, balance]) => `${channel === "SMS" ? "SMS" : "WhatsApp"} (${balance.toLocaleString("en-NG")} left)`).join(" and ");
        const owners = await prisma.user.findMany({ where: { schoolId: wallet.schoolId, role: { in: [...OWNER_ROLES] }, isActive: true }, select: { id: true } });
        if (owners.length) await prisma.notificationLog.createMany({ data: owners.map((owner) => ({ schoolId: wallet.schoolId, userId: owner.id, channel: "IN_APP" as const, title: "Message credit is running low", body: `${wallet.school.name}'s ${names} balance is under its floor of ${floor.toLocaleString("en-NG")}. Top up in Subscription & Billing so messages keep going out.`, status: "SENT" as const, metadata: json({ kind: "WALLET_LOW" }) })) });
        if (wallet.school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: wallet.school.ownerEmail, title: "Your message credit is running low", body: `${names} is under your floor of ${floor.toLocaleString("en-NG")} credits. Top up in Subscription & Billing so messages keep going out.` }).catch(() => undefined);
        await this.audit(null, AuditAction.UPDATE, "WalletLowAlert", wallet.id, { channels: below.map(([channel]) => channel), floor }, wallet.schoolId);
        alerted += 1;
      }
      if (!auto?.on) continue;
      const channel = auto.channel === "WHATSAPP" ? "WHATSAPP" : "SMS";
      if (!below.some(([c]) => c === channel)) continue;
      const lastCredit = await prisma.creditLedger.findFirst({ where: { schoolId: wallet.schoolId, channel, kind: "TOPUP" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      const chain = await prisma.autoTopupAttempt.findMany({ where: { schoolId: wallet.schoolId, channel, ...(lastCredit ? { createdAt: { gt: lastCredit.createdAt } } : {}) }, orderBy: { createdAt: "desc" } });
      if (chain.some((row) => row.outcome === "STOPPED")) continue;
      if (chain[0] && Date.now() - chain[0].createdAt.getTime() < DAY) continue;
      if (chain.length >= 3) {
        await prisma.autoTopupAttempt.create({ data: { schoolId: wallet.schoolId, channel, credits: auto.quantity ?? 10_000, trigger: `Balance under ${floor.toLocaleString("en-NG")}`, outcome: "STOPPED", attempt: chain.length } });
        if (wallet.school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: wallet.school.ownerEmail, title: "Automatic top-up has stopped", body: `Three top-up invoices for ${wallet.school.name} went unpaid, so we have stopped issuing them. Pay the open invoice or add credit yourself, and messages will keep going out.` }).catch(() => undefined);
        await this.audit(null, AuditAction.UPDATE, "WalletAutoTopupStopped", wallet.id, { channel, attempts: chain.length, accountManagerId: wallet.school.accountManagerId }, wallet.schoolId);
        stopped += 1;
        continue;
      }
      const credits = Math.max(100, auto.quantity ?? 10_000);
      const school = await schoolOf(wallet.schoolId);
      const { rate, subtotal, discount } = quote(channel, credits);
      const tax = round2(subtotal * (await taxRate(school.country)));
      const terms = await platformPolicy.invoiceTerms(Number(subtotal));
      const invoice = await prisma.platformInvoice.create({
        data: { schoolId: wallet.schoolId, invoiceNo: await nextInvoiceNo(), amount: terms.amount, taxAmount: tax, currency: school.currency, status: "PENDING", dueAt: (await platformPolicy.invoiceTerms(0)).dueAt, metadata: json({ kind: "TOPUP", description: `Automatic credit top-up · ${credits.toLocaleString("en-NG")} ${channel === "SMS" ? "SMS" : "WhatsApp"}`, channel, credits, rate, discount, automatic: true }) }
      });
      await prisma.autoTopupAttempt.create({ data: { schoolId: wallet.schoolId, channel, credits, amount: round2(Number(terms.amount) + tax), trigger: `Balance under ${floor.toLocaleString("en-NG")}`, invoiceId: invoice.id, outcome: "ISSUED", attempt: chain.length + 1 } });
      if (school.ownerEmail) await sendNotification({ channel: "EMAIL", recipient: school.ownerEmail, title: `Automatic top-up: invoice ${invoice.invoiceNo}`, body: `${school.name}'s ${channel === "SMS" ? "SMS" : "WhatsApp"} balance fell under ${floor.toLocaleString("en-NG")}. We have invoiced ${credits.toLocaleString("en-NG")} credits (attempt ${chain.length + 1} of 3). Pay it in Subscription & Billing and the credits land at once.` }).catch(() => undefined);
      issued += 1;
    }
    return { schools: wallets.length, alerted, issued, stopped };
  }

  /** Recommendations someone has already declined, newest per school. A dismissal keeps the school where it is and says why. */
  async tierDismissals() {
    const rows = await prisma.auditLog.findMany({ where: { entityType: "TierRecommendation" }, include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
    const out: Record<string, { plan: string; reason: string; at: string; by: string }> = {};
    for (const row of rows) {
      const meta = (row.metadata ?? {}) as { plan?: string; reason?: string };
      if (!row.entityId || out[row.entityId] || !meta.plan) continue;
      out[row.entityId] = { plan: meta.plan, reason: meta.reason ?? "", at: row.createdAt.toISOString(), by: row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : "System" };
    }
    return out;
  }

  async dismissTier(session: SessionPayload, body: unknown) {
    const input = dismissSchema.parse(body);
    const school = await prisma.school.findFirst({ where: { id: input.schoolId, deletedAt: null }, select: { id: true } });
    if (!school) throw new NotFoundException("That school does not exist.");
    await this.audit(session, AuditAction.UPDATE, "TierRecommendation", school.id, { plan: input.plan, reason: input.reason, decision: "DISMISSED" }, school.id);
    return { schoolId: school.id, dismissed: true };
  }

  /** Credit added by a person, with the reason that goes in the register. A stopgap — it does not touch the school's payment method. */
  async addByHand(session: SessionPayload, body: unknown) {
    const input = byHandSchema.parse(body);
    const school = await prisma.school.findFirst({ where: { id: input.schoolId, deletedAt: null }, select: { id: true, name: true } });
    if (!school) throw new NotFoundException("That school does not exist.");
    const field = input.channel === "SMS" ? "smsBalance" : "whatsappBalance";
    const wallet = await prisma.notificationWallet.upsert({
      where: { schoolId: school.id },
      create: { schoolId: school.id, [field]: input.credits, lastToppedUpAt: new Date() },
      update: { [field]: { increment: input.credits }, lastToppedUpAt: new Date() }
    });
    const actor = await prisma.user.findFirst({ where: { OR: [{ id: session.userId }, { email: session.email }] }, select: { id: true } });
    await prisma.creditLedger.create({ data: { schoolId: school.id, channel: input.channel, kind: "TOPUP", credits: input.credits, amount: 0, method: "BY_HAND", note: `Added by hand · ${input.reason}`, createdById: actor?.id ?? null } });
    await this.audit(session, AuditAction.UPDATE, "NotificationWallet", wallet.id, { smsCredits: input.channel === "SMS" ? input.credits : 0, whatsappCredits: input.channel === "WHATSAPP" ? input.credits : 0, reason: input.reason }, school.id);
    return { schoolId: school.id, smsBalance: wallet.smsBalance, whatsappBalance: wallet.whatsappBalance };
  }

  /** Everything the Wallets tab shows: the five numbers, a row per school, the register, and the rate card with its margin. */
  async wallets() {
    const policy = await platformPolicy.get();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const termRow = await prisma.term.findFirst({ where: { startDate: { lte: new Date() }, endDate: { gte: new Date() } }, orderBy: { startDate: "asc" }, select: { startDate: true } }).catch(() => null);
    const termStart = termRow?.startDate ?? new Date(Date.now() - 120 * DAY);
    const [schools, attempts, ledger, legacy, alerts] = await Promise.all([
      prisma.school.findMany({ where: { deletedAt: null, isPersonalWorkspace: false }, include: { schoolSubscription: true, notificationWallet: true }, orderBy: { name: "asc" } }),
      prisma.autoTopupAttempt.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.creditLedger.findMany({ where: { kind: { in: ["TOPUP", "USED"] } }, orderBy: { createdAt: "desc" }, take: 2000 }),
      prisma.auditLog.findMany({ where: { entityType: "NotificationWallet", action: "UPDATE" }, include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.auditLog.findMany({ where: { entityType: "WalletLowAlert", createdAt: { gte: new Date(Date.now() - 7 * DAY) } }, select: { schoolId: true } })
    ]);
    const invoices = await prisma.platformInvoice.findMany({ where: { id: { in: attempts.map((a) => a.invoiceId).filter((id): id is string => Boolean(id)) } }, select: { id: true, invoiceNo: true, status: true } });
    const invoice = new Map(invoices.map((row) => [row.id, row]));
    const name = new Map(schools.map((school) => [school.id, school.name]));
    const label = (channel: string) => (channel === "SMS" ? "SMS" : "WhatsApp");
    const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
    const stoppedNow = new Set<string>();
    const rows = schools.map((school) => {
      const wallet = school.notificationWallet;
      const sub = school.schoolSubscription;
      const floor = sub?.warnAt ?? 2000;
      const auto = (sub?.autoTopup ?? null) as { on?: boolean; channel?: string; quantity?: number } | null;
      const mine = attempts.filter((a) => a.schoolId === school.id);
      const lastCredit = ledger.find((row) => row.schoolId === school.id && row.kind === "TOPUP");
      const stopped = mine.find((a) => a.outcome === "STOPPED" && (!lastCredit || a.createdAt > lastCredit.createdAt));
      if (stopped) stoppedNow.add(school.id);
      const sms = wallet?.smsBalance ?? 0;
      const wa = wallet?.whatsappBalance ?? 0;
      const lowest = Math.min(sms, wa);
      const burn30 = ledger.filter((row) => row.schoolId === school.id && row.kind === "USED" && row.createdAt >= new Date(Date.now() - 30 * DAY)).reduce((sum, row) => sum + Math.abs(row.credits), 0);
      const lastAuto = lastCredit?.invoiceId ? attempts.find((a) => a.invoiceId === lastCredit.invoiceId) : null;
      return {
        schoolId: school.id, school: school.name, tier: TIERS[tierOf(school)].name, sms, whatsapp: wa, floor,
        smsTone: sms < floor / 2 ? "bad" : sms < floor ? "warn" : "good", below: lowest < floor && Boolean(wallet),
        auto: stopped ? `Failed · ${stopped.attempt} unpaid` : auto?.on ? `On · ${(auto.quantity ?? 10_000).toLocaleString("en-NG")} ${label(auto.channel ?? "SMS")}` : "Off",
        autoTone: stopped ? "bad" : auto?.on ? "good" : "warn",
        lastTopUp: lastCredit?.createdAt.toISOString() ?? wallet?.lastToppedUpAt?.toISOString() ?? null,
        lastKind: lastCredit ? (lastCredit.method === "BY_HAND" ? "by hand" : lastAuto ? "automatic" : "paid") : null,
        burn30, accountManagerId: school.accountManagerId
      };
    });
    const heldValue = rows.reduce((sum, row) => sum + row.sms * CHANNEL_RATES.SMS + row.whatsapp * CHANNEL_RATES.WHATSAPP, 0);
    const monthAttempts = attempts.filter((a) => a.outcome === "ISSUED" && a.createdAt >= monthStart);
    const monthPaid = monthAttempts.filter((a) => a.invoiceId && invoice.get(a.invoiceId)?.status === "PAID");
    const monthStopped = attempts.filter((a) => a.outcome === "STOPPED" && a.createdAt >= monthStart);
    const byHand = ledger.filter((row) => row.kind === "TOPUP" && row.method === "BY_HAND" && row.createdAt >= termStart);
    const history = [
      ...attempts.map((a) => {
        const inv = a.invoiceId ? invoice.get(a.invoiceId) : null;
        const outcome = a.outcome === "STOPPED" ? "Stopped after 3 unpaid" : inv?.status === "PAID" ? "Paid · credits landed" : "Invoice issued · awaiting payment";
        return { id: a.id, at: a.createdAt.toISOString(), school: name.get(a.schoolId) ?? "Unknown school", channel: label(a.channel), amount: a.outcome === "STOPPED" ? "—" : naira(Number(a.amount)), trigger: a.trigger, gateway: a.outcome === "STOPPED" ? "None — stopped" : `Invoice · ${gatewayMode() === "live" ? "Paystack" : "test mode"}`, reference: inv?.invoiceNo ?? "—", outcome, tone: a.outcome === "STOPPED" ? "bad" : inv?.status === "PAID" ? "good" : "warn" };
      }),
      ...ledger.filter((row) => row.kind === "TOPUP" && row.method === "BY_HAND").map((row) => ({ id: row.id, at: row.createdAt.toISOString(), school: name.get(row.schoolId) ?? "Unknown school", channel: label(row.channel), amount: `${row.credits.toLocaleString("en-NG")} credits`, trigger: row.note ?? "Added by hand", gateway: "None — credited directly", reference: "—", outcome: "Added by hand", tone: "info" })),
      ...legacy.filter((row) => !((row.metadata ?? {}) as { reason?: unknown }).reason && !ledger.some((l) => l.method === "BY_HAND" && Math.abs(l.createdAt.getTime() - row.createdAt.getTime()) < 2000)).map((row) => {
        const meta = (row.metadata ?? {}) as { smsCredits?: number; whatsappCredits?: number };
        return { id: row.id, at: row.createdAt.toISOString(), school: row.schoolId ? name.get(row.schoolId) ?? "Unknown school" : "Unknown school", channel: (meta.smsCredits ?? 0) >= (meta.whatsappCredits ?? 0) ? "SMS" : "WhatsApp", amount: `${((meta.smsCredits ?? 0) + (meta.whatsappCredits ?? 0)).toLocaleString("en-NG")} credits`, trigger: `By hand · ${row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : "System"} · no reason recorded`, gateway: "None — credited directly", reference: "—", outcome: "Added by hand", tone: "info" };
      })
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
    const m = policy.messaging;
    const margin = (price: number, cost: number) => (cost > 0 && price > 0 ? { text: `${Math.round(((price - cost) / price) * 100)}%`, tone: price > cost ? "good" : "bad" } : { text: "Enter the cost", tone: "warn" });
    const money = (value: number) => `₦${value.toFixed(2)}`;
    const rate = [
      { channel: "SMS · Nigeria", cost: m.providerCostSms > 0 ? money(m.providerCostSms) : "Not entered", price: money(CHANNEL_RATES.SMS), margin: margin(CHANNEL_RATES.SMS, m.providerCostSms) },
      { channel: "SMS · international", cost: m.providerCostSmsInternational > 0 ? money(m.providerCostSmsInternational) : "Not entered", price: money(CHANNEL_RATES.SMS_INTERNATIONAL), margin: margin(CHANNEL_RATES.SMS_INTERNATIONAL, m.providerCostSmsInternational) },
      { channel: "WhatsApp · template", cost: m.providerCostWhatsapp > 0 ? money(m.providerCostWhatsapp) : "Not entered", price: money(CHANNEL_RATES.WHATSAPP), margin: margin(CHANNEL_RATES.WHATSAPP, m.providerCostWhatsapp) },
      { channel: "WhatsApp · session", cost: money(0), price: money(0), margin: { text: "Free window", tone: "mute" } },
      { channel: "Email", cost: m.providerCostEmail > 0 ? money(m.providerCostEmail) : "Not entered", price: money(0), margin: { text: "Included in tier", tone: "mute" } }
    ];
    return {
      kpis: {
        heldValue, belowFloor: rows.filter((r) => r.below).length, alerted: new Set(alerts.map((a) => a.schoolId)).size,
        autoCount: monthAttempts.length, autoValue: monthAttempts.reduce((sum, a) => sum + Number(a.amount), 0), autoPaid: monthPaid.length,
        failed: monthStopped.length, failedSchools: new Set(monthStopped.map((a) => a.schoolId)).size, failing: stoppedNow.size,
        byHand: byHand.length, byHandCredits: byHand.reduce((sum, row) => sum + row.credits, 0), withReason: byHand.filter((row) => row.note && row.note !== "Added by hand").length
      },
      rows, history, rate, providerCost: { sms: m.providerCostSms, smsInternational: m.providerCostSmsInternational, whatsapp: m.providerCostWhatsapp, email: m.providerCostEmail }
    };
  }

  /** The schedule as the Trials tab shows it, with how many were sent or held back at each step, and every trial against it. */
  async journey() {
    const policy = await platformPolicy.get();
    const schools = await prisma.school.findMany({ where: { deletedAt: null, status: "TRIAL", isPersonalWorkspace: false }, select: { id: true, name: true, trialStartedAt: true, trialEndsAt: true, createdAt: true } });
    const [messages, lifecycle, provisioned] = await Promise.all([
      prisma.trialMessage.findMany(),
      prisma.auditLog.findMany({ where: { entityType: "Lifecycle" }, select: { metadata: true } }),
      prisma.school.count({ where: { deletedAt: null, trialStartedAt: { not: null }, isPersonalWorkspace: false } })
    ]);
    const logs = await prisma.notificationLog.findMany({ where: { metadata: { path: ["kind"], equals: "TRIAL_JOURNEY" }, channel: "EMAIL" }, select: { schoolId: true, status: true, metadata: true } });
    const lifecycleCount = (kind: string) => lifecycle.filter((row) => ((row.metadata ?? {}) as { kind?: string }).kind === kind).length;
    const checklist = await prisma.onboardingChecklistItem.findMany({ where: { schoolId: { in: schools.map((s) => s.id) } }, select: { schoolId: true, completedAt: true } });
    const schedule = TRIAL_STEPS.map((step) => ({
      key: step.key, day: step.day(policy.trial.days, policy.trial.readOnlyDays), message: step.message, channel: step.channel, source: step.source,
      sent: step.own ? messages.filter((m) => m.step === step.key && m.status === "SENT").length : step.lifecycle === "WELCOME" ? provisioned : lifecycleCount(step.lifecycle as string),
      suppressed: step.own ? messages.filter((m) => m.step === step.key && m.status === "SUPPRESSED").length : 0
    })).sort((a, b) => a.day - b.day);
    const pipeline = schools.map((school) => {
      const day = school.trialStartedAt ? Math.floor((Date.now() - school.trialStartedAt.getTime()) / DAY) : null;
      const mine = messages.filter((m) => m.schoolId === school.id && m.status === "SENT");
      const lastKey = mine.map((m) => m.step).sort((a, b) => (schedule.find((s) => s.key === b)?.day ?? 0) - (schedule.find((s) => s.key === a)?.day ?? 0))[0];
      const next = day === null ? null : schedule.find((s) => s.day > day);
      const items = checklist.filter((c) => c.schoolId === school.id);
      const failed = logs.filter((l) => l.schoolId === school.id && l.status === "FAILED").length;
      return { schoolId: school.id, school: school.name, day, last: lastKey ? schedule.find((s) => s.key === lastKey)?.message ?? null : null, next: next ? `Day ${next.day} — ${next.message}` : null, failed, wizardDone: items.filter((c) => c.completedAt).length, wizardTotal: items.length || 6, started: Boolean(school.trialStartedAt) };
    }).sort((a, b) => (a.day ?? 999) - (b.day ?? 999));
    return { trialDays: policy.trial.days, running: schools.filter((s) => s.trialStartedAt).length, schedule, pipeline };
  }
}

export const billingExtras = new BillingExtrasService();
