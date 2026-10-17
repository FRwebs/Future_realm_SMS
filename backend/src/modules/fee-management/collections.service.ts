import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getInvoiceStatus, toMoney } from "../../../../src/lib/domain/finance";
import { FinanceService } from "../finance/finance.service";
import {
  PAYMENT_MODE,
  armName,
  currentTerm,
  daysSince,
  fullName,
  jsonValue,
  loadFamilies,
  num,
  type LedgerFamily
} from "./fees.shared";

/**
 * Collections: money in today, and exactly which families still owe. A balance is always the
 * family's, never a child's — one conversation, one reminder, one plan — so everything here is
 * grouped by the guardian who answers for the account.
 */

const OWNERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN"]);
const MODE_FOR: Record<string, "CASH" | "TRANSFER" | "POS" | "CHEQUE" | "USSD" | "BANK_TRANSFER"> = {
  "Bank transfer": "BANK_TRANSFER",
  "Cash at the bursary": "CASH",
  Cash: "CASH",
  "POS card": "POS",
  "POS card payment": "POS",
  "Online card": "TRANSFER",
  "Online card payment": "TRANSFER",
  "USSD transfer": "USSD",
  "Mobile money": "TRANSFER",
  Cheque: "CHEQUE",
  "Bank draft": "CHEQUE",
  "Direct debit": "TRANSFER"
};

const paymentSchema = z.object({
  student: z.union([z.string().min(1), z.array(z.string()).min(1)], { message: "Choose who is paying." }).transform((value) => (Array.isArray(value) ? value[0] : value)),
  applyTo: z.string().default("This child only"),
  item: z.string().optional(),
  paying: z.string().default("Part payment"),
  amount: z.coerce.number().positive("Give the amount received."),
  date: z.string().min(1, "Give the date it was received."),
  mode: z.string().min(1, "Choose how it was paid."),
  channel: z.string().optional(),
  reference: z.string().trim().min(3, "A bank or teller reference is how a family disputes a payment — give it."),
  payer: z.string().optional(),
  note: z.string().optional(),
  issueReceipt: z.coerce.boolean().default(true),
  sendBy: z.array(z.string()).default([])
});

const reminderSchema = z.object({
  scope: z.string().default("Everyone who owes"),
  pastNinety: z.string().default("Request a meeting instead"),
  channels: z.array(z.string()).default([]),
  include: z.array(z.string()).default([]),
  message: z.string().trim().min(10, "Say what the family should read."),
  followUp: z.string().optional(),
  printed: z.coerce.boolean().default(true),
  families: z.array(z.string()).optional()
});

const planSchema = z.object({
  total: z.coerce.number().positive("Give the total to spread."),
  count: z.coerce.number().int().min(2).max(6).default(3),
  first: z.string().default("In 7 days"),
  firstDate: z.string().optional(),
  every: z.string().default("Monthly"),
  while: z.string().optional(),
  missed: z.string().optional(),
  approvedBy: z.string().optional(),
  reason: z.string().trim().min(5, "Say why, and on what conditions."),
  send: z.coerce.boolean().default(true)
});

const meetingSchema = z.object({
  with: z.string().default("The Bursar"),
  date: z.string().min(1, "Propose a date."),
  time: z.string().default("10:00"),
  where: z.string().default("At the school · bursary"),
  purpose: z.string().default("Agree a payment plan"),
  message: z.string().optional(),
  pause: z.coerce.boolean().default(true),
  sendBy: z.array(z.string()).default([]),
  families: z.array(z.string()).optional()
});

const adjustSchema = z.object({
  adjustment: z.string().default("Discount"),
  appliesTo: z.string().default("The whole invoice"),
  item: z.string().optional(),
  valueIs: z.string().default("A percentage"),
  value: z.coerce.number().positive("Give the value."),
  duration: z.string().default("This term only"),
  reason: z.string().trim().min(5, "The reason is kept on the family's record and on every fee report."),
  approvedBy: z.string().optional(),
  send: z.coerce.boolean().default(true)
});

const writeOffSchema = z.object({
  amount: z.coerce.number().positive("Give the amount."),
  whole: z.string().default("The whole balance"),
  reason: z.string().min(1),
  evidence: z.string().trim().min(10, "Evidence and reasoning are shown at every audit — give them."),
  tell: z.coerce.boolean().default(false)
});

@Injectable()
export class CollectionsService {
  constructor(private readonly finance: FinanceService) {}

  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  private async audit(session: SessionPayload, action: AuditAction, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType, entityId, metadata } });
  }

  /* ───────────────────────── the term's position ───────────────────────── */

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const term = await currentTerm(schoolId);
    const [open, termFamilies, payments, previous, settings, school] = await Promise.all([
      loadFamilies(schoolId),
      loadFamilies(schoolId, { includeSettled: true }),
      prisma.payment.findMany({
        where: { schoolId, status: "SUCCESS", isReversed: false },
        include: { student: { include: { currentClass: true } }, recordedBy: { select: { firstName: true, lastName: true } }, invoice: { select: { invoiceNumber: true, total: true, balance: true, status: true } }, receipts: { select: { receiptNumber: true } } },
        orderBy: [{ paidAt: "desc" }, { id: "desc" }]
      }),
      term ? this.previousTermRate(schoolId, term.id) : Promise.resolve(null),
      this.finance.getFinanceSettings(schoolId).catch(() => null),
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
    ]);

    const billed = termFamilies.reduce((sum, family) => sum + family.billed, 0);
    const collected = termFamilies.reduce((sum, family) => sum + family.paid, 0);
    const outstanding = open.reduce((sum, family) => sum + family.owing, 0);
    const over90 = open.filter((family) => family.days > 90);
    const discounts = await prisma.invoice.aggregate({ where: { schoolId, status: { not: "VOID" } }, _sum: { discount: true } });

    const rows = payments.slice(0, 30).map((payment) => this.mapPayment(payment));
    const since = new Date(Date.now() - 2 * 86_400_000);
    const lastTwoDays = payments.filter((payment) => (payment.paidAt ?? new Date(0)) >= since).reduce((sum, payment) => sum + num(payment.amount), 0);

    // Where the money comes from: by the section a child sits in, and by how it was paid.
    const sectionOf = (section: string) => (/NURSERY|PRIMARY|CRECHE|EARLY/i.test(section) ? "Nursery and Primary" : /JUNIOR|JSS/i.test(section) ? "Junior Secondary" : /SENIOR|SSS|SECONDARY/i.test(section) ? "Senior Secondary" : "Other");
    const bySection = new Map<string, { billed: number; paid: number }>();
    for (const family of termFamilies) {
      for (const child of family.children) {
        const key = sectionOf(child.section);
        const entry = bySection.get(key) ?? { billed: 0, paid: 0 };
        entry.billed += child.billed;
        entry.paid += child.paid;
        bySection.set(key, entry);
      }
    }
    const byMethod = new Map<string, number>();
    for (const payment of payments) byMethod.set(PAYMENT_MODE[String(payment.method)] ?? String(payment.method), (byMethod.get(PAYMENT_MODE[String(payment.method)] ?? String(payment.method)) ?? 0) + num(payment.amount));

    const items = new Map<string, { expected: number; collected: number }>();
    for (const family of termFamilies) {
      for (const child of family.children) {
        for (const invoice of child.invoices) {
          const share = invoice.total > 0 ? invoice.received / invoice.total : 0;
          for (const item of invoice.items) {
            const entry = items.get(item.description) ?? { expected: 0, collected: 0 };
            entry.expected += item.amount;
            entry.collected += item.amount * share;
            items.set(item.description, entry);
          }
        }
      }
    }

    const levels = await prisma.classLevel.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" }, select: { name: true } });
    const arms = await prisma.classRoom.findMany({ where: { schoolId, deletedAt: null }, select: { name: true, arm: true }, orderBy: { name: "asc" } });

    return {
      term: term ? { id: term.id, name: term.name, session: term.academicSession?.name ?? "", label: `${term.name} ${term.academicSession?.name ?? ""}`.trim() } : null,
      school: school?.name ?? "",
      totals: {
        expected: billed,
        collected,
        outstanding,
        families: open.length,
        over90: over90.reduce((sum, family) => sum + family.owing, 0),
        over90Families: over90.length,
        discount: num(discounts._sum.discount),
        lastTermRate: previous,
        receipts: payments.length
      },
      payments: rows,
      recent: { amount: lastTwoDays },
      debtors: open
        .sort((a, b) => b.days - a.days)
        .map((family) => this.mapFamily(family)),
      bars: {
        sections: Array.from(bySection.entries()).map(([name, value]) => ({ name, billed: value.billed, paid: value.paid })),
        methods: Array.from(byMethod.entries()).map(([name, value]) => ({ name, amount: value })),
        items: Array.from(items.entries()).map(([name, value]) => ({ name, expected: value.expected, collected: Math.round(value.collected) }))
      },
      payers: open
        .flatMap((family) => family.children.filter((child) => child.owing > 0).map((child) => ({ id: child.studentId, name: child.name, adm: child.adm, arm: child.arm, owing: child.owing, billed: child.billed, paid: child.paid, family: family.name, guardian: family.id })))
        .slice(0, 400),
      options: { levels: levels.map((level) => level.name), arms: Array.from(new Set(arms.map(armName))), methods: Array.from(new Set(payments.map((payment) => PAYMENT_MODE[String(payment.method)] ?? String(payment.method)))) },
      receiptPrefix: settings?.receiptPrefix ?? "RCP"
    };
  }

  private async previousTermRate(schoolId: string, currentId: string): Promise<number | null> {
    const terms = await prisma.term.findMany({ where: { schoolId }, orderBy: { startDate: "asc" }, select: { id: true } });
    const index = terms.findIndex((term) => term.id === currentId);
    const previous = terms[index - 1];
    if (!previous) return null;
    const families = await loadFamilies(schoolId, { termId: previous.id, includeSettled: true });
    const billed = families.reduce((sum, family) => sum + family.billed, 0);
    const paid = families.reduce((sum, family) => sum + family.paid, 0);
    return billed ? Math.round((paid / billed) * 1000) / 10 : null;
  }

  private mapPayment(payment: {
    id: string;
    amount: Prisma.Decimal;
    method: string;
    reference: string;
    schoolBankReference: string | null;
    receiptNumber: string | null;
    paidAt: Date | null;
    paymentNumber: string | null;
    student: { firstName: string; lastName: string; admissionNumber: string; currentClass: { name: string; arm: string | null } | null };
    recordedBy: { firstName: string; lastName: string } | null;
    invoice: { invoiceNumber: string; total: Prisma.Decimal; balance: Prisma.Decimal; status: string } | null;
    receipts: Array<{ receiptNumber: string }>;
  }) {
    const settled = payment.invoice ? num(payment.invoice.balance) <= 0 : false;
    return {
      id: payment.id,
      ref: payment.receipts[0]?.receiptNumber ?? payment.receiptNumber ?? payment.paymentNumber ?? payment.reference,
      student: fullName(payment.student),
      adm: payment.student.admissionNumber,
      arm: armName(payment.student.currentClass),
      amount: num(payment.amount),
      kind: settled ? "Full payment" : "Part payment",
      mode: PAYMENT_MODE[String(payment.method)] ?? String(payment.method),
      bankRef: payment.schoolBankReference ?? null,
      by: payment.recordedBy ? fullName(payment.recordedBy) : "The system",
      at: payment.paidAt?.toISOString() ?? null,
      invoice: payment.invoice?.invoiceNumber ?? null
    };
  }

  mapFamily(family: LedgerFamily) {
    return {
      id: family.id,
      name: family.name,
      relation: family.relation,
      phone: family.phone,
      portal: family.portal,
      owing: family.owing,
      billed: family.billed,
      paid: family.paid,
      days: family.days,
      bucket: family.bucket,
      stage: family.stage,
      children: family.children.map((child) => ({ id: child.studentId, name: child.name, arm: child.arm, level: child.level, owing: child.owing })),
      canSms: family.canSms
    };
  }

  /* ───────────────────────── a form master's view ───────────────────────── */

  /** Status only, for the form class they answer for — never an amount. */
  async formClass(session: SessionPayload) {
    const rooms = await prisma.classRoom.findMany({ where: { schoolId: session.schoolId, classTeacherId: session.userId, deletedAt: null }, include: { students: { where: { status: "ACTIVE" }, include: { guardians: { include: { guardian: true } }, invoices: { where: { status: { not: "VOID" } }, select: { total: true, balance: true } } } } } });
    const students = rooms.flatMap((room) => room.students);
    const rows = students.map((student) => {
      const total = student.invoices.reduce((sum, invoice) => sum + num(invoice.total), 0);
      const balance = student.invoices.reduce((sum, invoice) => sum + num(invoice.balance), 0);
      const guardian = student.guardians.find((link) => link.isPrimary)?.guardian ?? student.guardians[0]?.guardian;
      return {
        id: student.id,
        name: fullName(student),
        adm: student.admissionNumber,
        status: !student.invoices.length ? "Not billed" : balance <= 0 ? "Paid" : balance < total ? "Part paid" : "Outstanding",
        guardian: guardian ? `${guardian.firstName} ${guardian.lastName}` : "Nobody on record"
      };
    });
    return { className: rooms.map(armName).join(", ") || "No form class", rows, outstanding: rows.filter((row) => row.status === "Outstanding" || row.status === "Part paid").length };
  }

  /* ───────────────────────── one family ───────────────────────── */

  private async familyOrThrow(schoolId: string, id: string) {
    const family = (await loadFamilies(schoolId, { includeSettled: true })).find((item) => item.id === id);
    if (!family) throw new NotFoundException("That family has nothing on the books.");
    return family;
  }

  async family(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const family = await this.familyOrThrow(schoolId, id);
    const studentIds = family.children.map((child) => child.studentId);
    const [payments, plans, settings, adjustments] = await Promise.all([
      prisma.payment.findMany({
        where: { schoolId, studentId: { in: studentIds }, status: "SUCCESS", isReversed: false },
        include: { student: { include: { currentClass: true } }, recordedBy: { select: { firstName: true, lastName: true } }, invoice: { select: { invoiceNumber: true, total: true, balance: true, status: true } }, receipts: { select: { receiptNumber: true } } },
        orderBy: [{ paidAt: "desc" }]
      }),
      prisma.installmentPlan.findMany({ where: { schoolId, studentId: { in: studentIds } }, include: { items: { orderBy: { dueOn: "asc" } } }, orderBy: { createdAt: "desc" } }),
      this.finance.getFinanceSettings(schoolId).catch(() => null),
      prisma.invoiceAdjustment.findMany({ where: { schoolId, invoice: { studentId: { in: studentIds } } }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    const children = family.children.map((child) => ({
      id: child.studentId,
      name: child.name,
      adm: child.adm,
      arm: child.arm,
      boarding: child.boarding,
      structures: child.invoices.map((invoice) => invoice.structure),
      billed: child.billed,
      paid: child.paid,
      owing: child.owing,
      state: child.owing <= 0 ? "Paid" : child.paid > 0 ? "Part paid" : "Outstanding",
      invoices: child.invoices.map((invoice) => ({ id: invoice.id, number: invoice.number, structure: invoice.structure, total: invoice.total, received: invoice.received, balance: invoice.balance, issuedOn: invoice.issuedOn.toISOString(), items: invoice.items }))
    }));
    return {
      family: { ...this.mapFamily(family), email: family.email, guardianId: family.guardianId },
      children,
      receipts: payments.map((payment) => this.mapPayment(payment)),
      contacts: family.contacts.map((contact) => ({ id: contact.id, kind: contact.kind, channel: contact.channel, summary: contact.summary, at: contact.at.toISOString(), meetingAt: contact.meetingAt?.toISOString() ?? null })),
      plans: plans.map((plan) => ({ id: plan.id, number: plan.planNumber, status: String(plan.status), total: num(plan.totalAmount), balance: num(plan.balance), notes: plan.notes, items: plan.items.map((item) => ({ id: item.id, dueOn: item.dueOn.toISOString(), amount: num(item.amount), paid: num(item.paidAmount), status: String(item.status) })) })),
      adjustments: adjustments.map((item) => ({ id: item.id, type: String(item.type), amount: num(item.amount), reason: item.reason, at: item.createdAt.toISOString() })),
      policy: { receiptPrefix: settings?.receiptPrefix ?? "RCP", writeOffBy: "The Proprietor only", approvalLimit: 50_000 }
    };
  }

  /* ───────────────────────── recording money ───────────────────────── */

  async recordPayment(session: SessionPayload, body: unknown) {
    const input = paymentSchema.parse(body);
    const schoolId = session.schoolId;
    const method = MODE_FOR[input.mode];
    if (!method) throw new BadRequestException("That payment mode is not one the bursary records.");
    const student = await prisma.student.findFirst({ where: { id: input.student, schoolId }, include: { guardians: { where: { isPrimary: true } } } });
    if (!student) throw new NotFoundException("That student is not on the roll.");

    const reference = input.reference;
    const clash = await prisma.payment.findFirst({ where: { schoolId, OR: [{ schoolBankReference: reference }, { reference }] }, include: { student: { select: { firstName: true, lastName: true } } } });
    if (clash) throw new BadRequestException(`That reference was already used for ${fullName(clash.student)}. A reference is how a payment is told apart from another — give this one its own.`);

    let studentIds = [student.id];
    if (input.applyTo === "Every child in this family" && student.guardians[0]) {
      const siblings = await prisma.studentGuardian.findMany({ where: { guardianId: student.guardians[0].guardianId }, select: { studentId: true } });
      studentIds = siblings.map((link) => link.studentId);
    }
    const invoices = await prisma.invoice.findMany({
      where: { schoolId, studentId: { in: studentIds }, status: { notIn: ["VOID", "PAID"] }, balance: { gt: 0 } },
      include: { items: true },
      orderBy: { issuedOn: "asc" }
    });
    const ordered =
      input.applyTo === "A specific fee item" && input.item
        ? [...invoices.filter((invoice) => invoice.items.some((item) => item.description.toLowerCase().includes((input.item ?? "").toLowerCase()))), ...invoices.filter((invoice) => !invoice.items.some((item) => item.description.toLowerCase().includes((input.item ?? "").toLowerCase())))]
        : invoices;
    const owing = ordered.reduce((sum, invoice) => sum + num(invoice.balance), 0);
    if (!ordered.length) throw new BadRequestException("Nothing is outstanding for them, so there is nothing to apply this to.");
    if (input.amount > owing) throw new BadRequestException(`That is ₦${Math.round(input.amount - owing).toLocaleString("en-NG")} more than is owed (₦${Math.round(owing).toLocaleString("en-NG")}). Record only what the account can take.`);
    const full = input.paying === "In full";
    if (full && Math.abs(input.amount - owing) > 1 && studentIds.length === 1) {
      throw new BadRequestException(`Paying in full means ₦${Math.round(owing).toLocaleString("en-NG")}. Record a part payment, or correct the amount.`);
    }

    const created: Array<{ id: string; receipt: string | null }> = [];
    let remaining = toMoney(input.amount);
    let part = 0;
    for (const invoice of ordered) {
      if (remaining <= 0) break;
      const portion = toMoney(Math.min(remaining, num(invoice.balance)));
      part += 1;
      const ref = ordered.length > 1 ? `${reference}-${part}` : reference;
      await this.finance.recordManualPayment(schoolId, session.userId, {
        invoiceId: invoice.id,
        amount: portion,
        method,
        reference: ref,
        schoolBankReference: reference,
        paidAt: input.date,
        paymentChannel: input.channel || undefined,
        note: [input.note, input.payer ? `Paid by ${input.payer}` : ""].filter(Boolean).join(" · ") || undefined
      });
      const payment = await prisma.payment.findFirst({ where: { schoolId, reference: ref } });
      if (payment) {
        let receipt: string | null = null;
        if (input.issueReceipt) {
          const issued = await this.finance.generateReceipt(schoolId, session.userId, payment.id).catch(() => null);
          receipt = issued?.receiptNumber ?? null;
        }
        created.push({ id: payment.id, receipt });
      }
      remaining = toMoney(remaining - portion);
    }
    await this.audit(session, AuditAction.CREATE, "Payment", created[0]?.id ?? student.id, { summary: `Payment recorded · ${fullName(student)} · ₦${Math.round(input.amount).toLocaleString("en-NG")}`, reference, mode: input.mode });
    return { payments: created, receipts: created.map((item) => item.receipt).filter(Boolean), applied: toMoney(input.amount), balanceAfter: toMoney(owing - input.amount) };
  }

  /* ───────────────────────── chasing a balance ───────────────────────── */

  private async notifyGuardian(schoolId: string, guardianId: string, title: string, body: string, channels: string[]) {
    const guardian = await prisma.guardian.findFirst({ where: { id: guardianId, schoolId } });
    if (!guardian) return { sent: [] as string[], skipped: ["No guardian on record"] };
    const sent: string[] = [];
    const rows: Prisma.NotificationLogCreateManyInput[] = [];
    if (channels.some((channel) => /In-app/i.test(channel)) && guardian.userId) {
      rows.push({ schoolId, userId: guardian.userId, channel: "IN_APP", title, body, status: "QUEUED", sentAt: new Date() });
      sent.push("In-app");
    }
    if (channels.some((channel) => /SMS/i.test(channel)) && guardian.canReceiveSms && guardian.phone) {
      rows.push({ schoolId, userId: guardian.userId ?? undefined, channel: "SMS", title, body, status: "QUEUED", metadata: { phone: guardian.phone } as Prisma.InputJsonValue, sentAt: new Date() });
      sent.push("SMS");
    }
    if (channels.some((channel) => /Email/i.test(channel)) && guardian.canReceiveEmail && guardian.email) {
      rows.push({ schoolId, userId: guardian.userId ?? undefined, channel: "EMAIL", title, body, status: "QUEUED", metadata: { email: guardian.email } as Prisma.InputJsonValue, sentAt: new Date() });
      sent.push("Email");
    }
    if (rows.length) await prisma.notificationLog.createMany({ data: rows });
    return { sent, skipped: sent.length ? [] : ["No channel reaches them"] };
  }

  async remind(session: SessionPayload, body: unknown) {
    const input = reminderSchema.parse(body);
    const schoolId = session.schoolId;
    const families = (await loadFamilies(schoolId)).filter((family) => !input.families?.length || input.families.includes(family.id));
    const minimum = /30/.test(input.scope) ? 30 : /60/.test(input.scope) ? 60 : /90/.test(input.scope) ? 90 : 0;
    let reminded = 0;
    let meetings = 0;
    const skipped: string[] = [];
    let credits = 0;
    for (const family of families) {
      if (family.days < minimum) continue;
      if (!family.guardianId) {
        skipped.push(`${family.name} has no guardian on record`);
        continue;
      }
      if (family.stage === "On a payment plan") {
        skipped.push(`${family.name} is on a payment plan`);
        continue;
      }
      if (family.days > 90 && /Skip/.test(input.pastNinety)) {
        skipped.push(`${family.name} is past 90 days — left for a meeting in person`);
        continue;
      }
      if (family.days > 90 && /meeting/i.test(input.pastNinety)) {
        const when = new Date(Date.now() + 7 * 86_400_000);
        await prisma.feeContact.create({
          data: { schoolId, guardianId: family.guardianId, kind: "MEETING", channel: input.channels.join(", "), summary: "Meeting requested instead of a third reminder", detail: jsonValue({ purpose: "Agree a payment plan", outstanding: family.owing }), meetingAt: when, createdById: session.userId }
        });
        await this.notifyGuardian(schoolId, family.guardianId, "The bursary would like to meet you", `We would like to meet about your account balance of ₦${Math.round(family.owing).toLocaleString("en-NG")}. Please come to the bursary or call us.`, input.channels);
        meetings += 1;
        continue;
      }
      const text = `${input.message}${input.include.includes("The amount outstanding") ? ` Outstanding: ₦${Math.round(family.owing).toLocaleString("en-NG")}.` : ""}`;
      const result = await this.notifyGuardian(schoolId, family.guardianId, "Fee reminder", text, input.channels);
      if (!result.sent.length) {
        skipped.push(`${family.name}: ${result.skipped[0]}`);
        if (input.printed) skipped[skipped.length - 1] += " — a printed letter is needed";
      }
      await prisma.feeContact.create({
        data: { schoolId, guardianId: family.guardianId, kind: "REMINDER", channel: result.sent.join(", ") || "None reached", summary: result.sent.length ? `Reminder sent by ${result.sent.join(" and ")}` : "Reminder could not be delivered", detail: jsonValue({ outstanding: family.owing, followUp: input.followUp }), createdById: session.userId }
      });
      if (result.sent.includes("SMS")) credits += 1;
      reminded += 1;
    }
    await this.audit(session, AuditAction.CREATE, "FeeReminder", schoolId, { summary: `Fee reminders sent · ${reminded} families, ${meetings} meetings requested` });
    return { reminded, meetings, skipped, smsCredits: credits };
  }

  async meeting(session: SessionPayload, id: string, body: unknown) {
    const input = meetingSchema.parse(body);
    const family = await this.familyOrThrow(session.schoolId, id);
    if (!family.guardianId) throw new BadRequestException("This child has no guardian on record to invite.");
    const when = new Date(`${input.date}T${/^\d{2}:\d{2}$/.test(input.time) ? input.time : "10:00"}:00`);
    await prisma.feeContact.create({
      data: { schoolId: session.schoolId, guardianId: family.guardianId, kind: "MEETING", channel: input.sendBy.join(", "), summary: `Meeting requested with ${input.with.toLowerCase()} · ${input.purpose}`, detail: jsonValue({ ...input, outstanding: family.owing }), meetingAt: when, createdById: session.userId }
    });
    const sent = await this.notifyGuardian(session.schoolId, family.guardianId, "A meeting about your account", `${input.message || `The school would like to meet you about your account.`} Proposed: ${input.date} at ${input.time}, ${input.where}.`, input.sendBy);
    await this.audit(session, AuditAction.CREATE, "FeeMeeting", family.guardianId, { summary: `Fee meeting requested · ${family.name}` });
    return { invited: sent.sent };
  }

  /** A meeting asked for by many families at once — each is invited about their own balance only. */
  async meetingMany(session: SessionPayload, body: unknown) {
    const input = meetingSchema.parse(body);
    const families = (await loadFamilies(session.schoolId)).filter((family) => !input.families?.length || input.families.includes(family.id));
    let invited = 0;
    const skipped: string[] = [];
    for (const family of families) {
      if (!family.guardianId) {
        skipped.push(`${family.name} has no guardian on record`);
        continue;
      }
      await this.meeting(session, family.id, { ...input, families: undefined });
      invited += 1;
    }
    return { invited, skipped };
  }

  async plan(session: SessionPayload, id: string, body: unknown) {
    const input = planSchema.parse(body);
    const schoolId = session.schoolId;
    const family = await this.familyOrThrow(schoolId, id);
    if (input.total > family.owing + 0.5) throw new BadRequestException(`The family owes ₦${Math.round(family.owing).toLocaleString("en-NG")}; a plan cannot spread more than that.`);
    const owed = family.children.flatMap((child) => child.invoices.filter((invoice) => invoice.balance > 0)).sort((a, b) => a.issuedOn.getTime() - b.issuedOn.getTime());
    const start = input.first === "Immediately" ? new Date() : input.first === "In 7 days" ? new Date(Date.now() + 7 * 86_400_000) : input.first === "In 14 days" ? new Date(Date.now() + 14 * 86_400_000) : new Date(input.firstDate ?? "");
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Give the date the first instalment falls due.");
    const gap = input.every === "2 weeks" ? 14 : input.every === "At each half-term" ? 45 : 30;
    const dates = Array.from({ length: input.count }, (_, index) => new Date(start.getTime() + index * gap * 86_400_000));
    let remainingTotal = toMoney(input.total);
    const made: string[] = [];
    for (const invoice of owed) {
      if (remainingTotal <= 0) break;
      const cover = toMoney(Math.min(remainingTotal, invoice.balance));
      const each = toMoney(cover / input.count);
      const installments = dates.map((date, index) => ({ dueOn: date.toISOString(), amount: index === input.count - 1 ? toMoney(cover - each * (input.count - 1)) : each }));
      const plan = await this.finance.createInstallmentPlan(schoolId, session.userId, { invoiceId: invoice.id, notes: input.reason, installments });
      made.push(plan.planNumber);
      remainingTotal = toMoney(remainingTotal - cover);
    }
    if (family.guardianId) {
      await prisma.feeContact.create({ data: { schoolId, guardianId: family.guardianId, kind: "PLAN", summary: `Payment plan agreed · ${input.count} instalments of about ₦${Math.round(input.total / input.count).toLocaleString("en-NG")}`, detail: jsonValue({ ...input, plans: made }), createdById: session.userId } });
      if (input.send) await this.notifyGuardian(schoolId, family.guardianId, "Your payment plan", `Your plan: ${input.count} instalments from ${start.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, ${input.every.toLowerCase()}.`, ["In-app", "SMS"]);
    }
    await this.audit(session, AuditAction.CREATE, "InstallmentPlan", made[0] ?? id, { summary: `Payment plan agreed · ${family.name}`, plans: made });
    return { plans: made };
  }

  /* ───────────────────────── changing what is owed ───────────────────────── */

  async adjust(session: SessionPayload, id: string, body: unknown) {
    const input = adjustSchema.parse(body);
    const schoolId = session.schoolId;
    const family = await this.familyOrThrow(schoolId, id);
    const owed = family.children.flatMap((child) => child.invoices.filter((invoice) => invoice.balance > 0));
    if (!owed.length) throw new BadRequestException("Nothing is outstanding for this family.");
    const type = input.adjustment === "Surcharge" ? "FINE" : input.adjustment === "Waiver" ? "WAIVER" : input.adjustment === "Scholarship" ? "SCHOLARSHIP" : "DISCOUNT";
    const percentage = /percentage/i.test(input.valueIs);
    const total = owed.reduce((sum, invoice) => sum + invoice.balance, 0);
    const amount = toMoney(percentage ? (total * input.value) / 100 : input.value);
    if (type !== "FINE" && amount > total) throw new BadRequestException(`That is more than the family owes (₦${Math.round(total).toLocaleString("en-NG")}).`);

    // The bursary may adjust up to a limit; above it the Proprietor or Principal decides, so it waits as a request.
    const limit = 50_000;
    const mayDecide = OWNERS.has(session.role) || session.role === "PRINCIPAL";
    if (type !== "FINE" && amount > limit && !mayDecide) {
      const invoice = owed[0];
      const student = family.children.find((child) => child.invoices.some((row) => row.id === invoice.id));
      await prisma.feeWaiver.create({
        data: { schoolId, studentId: student!.studentId, invoiceId: invoice.id, waiverType: percentage ? "PERCENTAGE" : "PARTIAL", amount, percentage: percentage ? input.value : null, reason: `${input.adjustment}: ${input.reason}`, requestedById: session.userId }
      });
      await this.audit(session, AuditAction.CREATE, "FeeWaiver", invoice.id, { summary: `${input.adjustment} requested · ${family.name} · above the bursary's limit`, amount });
      return { applied: false, pending: true, amount, because: `Above ₦${limit.toLocaleString("en-NG")}, an adjustment needs the Proprietor or Principal. It is waiting in Review.` };
    }

    let left = amount;
    for (const invoice of owed.sort((a, b) => b.balance - a.balance)) {
      if (left <= 0) break;
      const portion = toMoney(type === "FINE" ? (owed.indexOf(invoice) === 0 ? left : 0) : Math.min(left, invoice.balance));
      if (portion <= 0) continue;
      const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      const nextBalance = toMoney(type === "FINE" ? num(fresh.balance) + portion : num(fresh.balance) - portion);
      await prisma.$transaction([
        prisma.invoiceAdjustment.create({ data: { schoolId, invoiceId: invoice.id, appliedById: session.userId, approvedById: mayDecide ? session.userId : null, type, valueType: percentage ? "PERCENTAGE" : "FIXED", value: input.value, amount: portion, reason: input.reason, metadata: jsonValue({ appliesTo: input.appliesTo, item: input.item, duration: input.duration }) } }),
        prisma.invoice.update({
          where: { id: invoice.id },
          data:
            type === "FINE"
              ? { fine: toMoney(num(fresh.fine) + portion), total: toMoney(num(fresh.total) + portion), balance: nextBalance, status: getInvoiceStatus(num(fresh.total) + portion, nextBalance, fresh.dueOn) }
              : { discount: toMoney(num(fresh.discount) + portion), total: toMoney(num(fresh.total) - portion), balance: nextBalance, status: getInvoiceStatus(num(fresh.total) - portion, nextBalance, fresh.dueOn) }
        })
      ]);
      left = toMoney(left - portion);
    }
    if (family.guardianId) {
      await prisma.feeContact.create({ data: { schoolId, guardianId: family.guardianId, kind: "ADJUSTMENT", summary: `${input.adjustment} of ₦${Math.round(amount).toLocaleString("en-NG")} · ${input.reason}`, detail: jsonValue(input), createdById: session.userId } });
      if (input.send) await this.notifyGuardian(schoolId, family.guardianId, "Your invoice has been restated", `A ${input.adjustment.toLowerCase()} of ₦${Math.round(amount).toLocaleString("en-NG")} has been applied to your account.`, ["In-app", "SMS"]);
    }
    await this.audit(session, AuditAction.UPDATE, "Invoice", owed[0].id, { summary: `${input.adjustment} applied · ${family.name} · ₦${Math.round(amount).toLocaleString("en-NG")}`, reason: input.reason });
    return { applied: true, amount };
  }

  async writeOff(session: SessionPayload, id: string, body: unknown) {
    const input = writeOffSchema.parse(body);
    if (!OWNERS.has(session.role)) throw new ForbiddenException("A write-off is the Proprietor’s decision alone, and cannot be approved by the person requesting it.");
    const schoolId = session.schoolId;
    const family = await this.familyOrThrow(schoolId, id);
    const owed = family.children.flatMap((child) => child.invoices.filter((invoice) => invoice.balance > 0)).sort((a, b) => a.issuedOn.getTime() - b.issuedOn.getTime());
    const total = owed.reduce((sum, invoice) => sum + invoice.balance, 0);
    const amount = /whole/i.test(input.whole) ? total : toMoney(input.amount);
    if (amount > total + 0.5) throw new BadRequestException(`The family owes ₦${Math.round(total).toLocaleString("en-NG")}, so that is more than can be written off.`);
    let left = amount;
    for (const invoice of owed) {
      if (left <= 0) break;
      const portion = toMoney(Math.min(left, invoice.balance));
      const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      const nextBalance = toMoney(num(fresh.balance) - portion);
      await prisma.$transaction([
        prisma.invoiceAdjustment.create({ data: { schoolId, invoiceId: invoice.id, appliedById: session.userId, approvedById: session.userId, type: "WRITE_OFF", valueType: "FIXED", value: portion, amount: portion, reason: `${input.reason} · ${input.evidence}` } }),
        prisma.invoice.update({ where: { id: invoice.id }, data: { balance: nextBalance, status: nextBalance <= 0 ? "PAID" : getInvoiceStatus(num(fresh.total), nextBalance, fresh.dueOn) } })
      ]);
      left = toMoney(left - portion);
    }
    if (family.guardianId) {
      await prisma.feeContact.create({ data: { schoolId, guardianId: family.guardianId, kind: "WRITE_OFF", summary: `₦${Math.round(amount).toLocaleString("en-NG")} written off · ${input.reason}`, detail: jsonValue(input), createdById: session.userId } });
      if (input.tell) await this.notifyGuardian(schoolId, family.guardianId, "Your balance has been cleared", "The school has cleared the balance on your account.", ["In-app", "SMS"]);
    }
    await this.audit(session, AuditAction.UPDATE, "Invoice", owed[0]?.id ?? id, { summary: `Balance written off · ${family.name} · ₦${Math.round(amount).toLocaleString("en-NG")}`, reason: input.reason });
    return { amount };
  }

  /* ───────────────────────── a receipt, as a document ───────────────────────── */

  async receipt(session: SessionPayload, paymentId: string) {
    const schoolId = session.schoolId;
    const payment = await prisma.payment.findFirst({
      where: { schoolId, id: paymentId },
      include: {
        student: { include: { currentClass: true, guardians: { include: { guardian: true } } } },
        invoice: { include: { items: true, term: { include: { academicSession: true } } } },
        recordedBy: { select: { firstName: true, lastName: true } },
        receipts: true
      }
    });
    if (!payment) throw new NotFoundException("That payment does not exist.");
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const priorReceipts = payment.receipts.length;
    const invoice = payment.invoice;
    const billed = invoice ? num(invoice.total) : num(payment.amount);
    const balance = invoice ? num(invoice.balance) : 0;
    const paidTotal = billed - balance;
    // What this payment went to: the invoice's lines, oldest line first, until the money runs out.
    let rest = num(payment.amount);
    let before = Math.max(0, paidTotal - num(payment.amount));
    const items = (invoice?.items ?? []).map((item) => {
      const line = num(item.amount) * item.quantity;
      const previously = Math.min(line, before);
      before = Math.max(0, before - previously);
      const room = line - previously;
      const applied = Math.min(room, rest);
      rest -= applied;
      return { label: item.description, billed: line, previously, applied, balance: line - previously - applied };
    });
    const guardian = payment.student.guardians.find((link) => link.isPrimary)?.guardian ?? payment.student.guardians[0]?.guardian;
    return {
      id: payment.id,
      ref: payment.receipts[0]?.receiptNumber ?? payment.receiptNumber ?? payment.paymentNumber ?? payment.reference,
      issued: payment.receipts[0]?.issuedAt?.toISOString() ?? null,
      payer: guardian ? `${guardian.firstName} ${guardian.lastName}` : `Guardian of ${fullName(payment.student)}`,
      student: fullName(payment.student),
      adm: payment.student.admissionNumber,
      arm: armName(payment.student.currentClass),
      mode: PAYMENT_MODE[String(payment.method)] ?? String(payment.method),
      bankRef: payment.schoolBankReference ?? payment.reference,
      date: payment.paidAt?.toISOString() ?? null,
      by: payment.recordedBy ? fullName(payment.recordedBy) : "The system",
      paid: num(payment.amount),
      billed,
      paidToDate: paidTotal,
      balance,
      receipts: priorReceipts,
      term: invoice?.term ? `${invoice.term.name} ${invoice.term.academicSession?.name ?? ""}`.trim() : "",
      invoice: invoice?.invoiceNumber ?? null,
      items,
      school: { name: school?.name ?? "", address: [school?.address, school?.city].filter(Boolean).join(", "), phone: school?.mainPhone ?? "", email: school?.ownerEmail ?? "" },
      ageing: balance > 0 ? "Part payment — a balance remains" : "Settled",
      daysOld: daysSince(payment.paidAt)
    };
  }
}
