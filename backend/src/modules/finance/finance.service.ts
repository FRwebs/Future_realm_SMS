import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { getDemoStore } from "../../../../src/lib/demo/data";
import {
  allocatePaymentAcrossInvoices,
  calculateInvoiceTotals,
  formatMoneyForAudit,
  getInvoiceStatus,
  toMoney
} from "../../../../src/lib/domain/finance";
import {
  FeeStructureView,
  FinanceDashboardView,
  InstallmentPlanView,
  InvoiceView,
  PaymentView,
  ReceiptView
} from "../../../../src/lib/domain/types";
import { getPaymentGateway } from "../../../../src/lib/integrations/payment-gateways";
import { formatNigeriaClassName, normalizeNigeriaClassValue } from "../../../../src/lib/school-options";
import { env } from "../../../../src/lib/utils/env";

const moneySchema = z.coerce.number().min(0);
const dateStringSchema = z.string().min(4).refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");
const nigeriaClassInputSchema = z
  .string()
  .min(2)
  .refine((value) => Boolean(normalizeNigeriaClassValue(value)), "Select a valid Nigerian class.");

const feeStructureItemSchema = z.object({
  label: z.string().min(2),
  componentType: z
    .enum(["TUITION", "DEVELOPMENT_LEVY", "EXAM_FEE", "ICT_FEE", "PTA_FEE", "TRANSPORT", "HOSTEL", "BOOKS", "UNIFORM", "OTHER"])
    .default("OTHER"),
  amount: moneySchema,
  isOptional: z.coerce.boolean().default(false)
});

export const feeStructureSchema = z.object({
  name: z.string().min(3),
  academicSessionId: z.string().optional().or(z.literal("")),
  termId: z.string().optional().or(z.literal("")),
  classId: z.string().optional().or(z.literal("")),
  studentCategory: z.string().optional().or(z.literal("")),
  recurrence: z.enum(["TERM", "SESSION", "ONE_TIME"]).default("TERM"),
  isOneTime: z.coerce.boolean().default(false),
  dueDate: dateStringSchema.optional().or(z.literal("")),
  items: z.array(feeStructureItemSchema).min(1)
});

export const createInvoiceSchema = z.object({
  studentId: z.string().optional(),
  studentName: z.string().min(2),
  className: nigeriaClassInputSchema,
  feeStructureId: z.string().optional().or(z.literal("")),
  tuition: moneySchema.default(0),
  transport: moneySchema.default(0),
  developmentLevy: moneySchema.default(0),
  discount: moneySchema.default(0),
  fine: moneySchema.default(0),
  dueOn: dateStringSchema,
  issueAsDraft: z.coerce.boolean().default(false)
});

export const generateInvoicesSchema = z.object({
  feeStructureId: z.string(),
  classId: z.string().optional().or(z.literal("")),
  studentIds: z.array(z.string()).optional(),
  dueOn: dateStringSchema.optional().or(z.literal(""))
});

export const paymentSchema = z.object({
  invoiceId: z.string(),
  email: z.string().email().optional().or(z.literal("")),
  amount: z.coerce.number().min(1),
  method: z.enum(["CASH", "TRANSFER", "BANK_TRANSFER", "POS", "CHEQUE", "ONLINE", "USSD"]).default("ONLINE"),
  provider: z.enum(["PAYSTACK", "FLUTTERWAVE"]).optional(),
  reference: z.string().optional().or(z.literal("")),
  paidAt: dateStringSchema.optional().or(z.literal("")),
  paymentChannel: z.string().optional().or(z.literal("")),
  schoolBankReference: z.string().optional().or(z.literal("")),
  chequeNumber: z.string().optional().or(z.literal("")),
  chequeBankName: z.string().optional().or(z.literal("")),
  chequeDate: dateStringSchema.optional().or(z.literal("")),
  note: z.string().optional().or(z.literal(""))
});

export const adjustmentSchema = z.object({
  invoiceId: z.string(),
  type: z.enum(["DISCOUNT", "WAIVER", "SCHOLARSHIP", "FINE"]),
  valueType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
  value: z.coerce.number().min(0.01),
  reason: z.string().min(3)
});

export const installmentPlanSchema = z.object({
  invoiceId: z.string(),
  notes: z.string().optional().or(z.literal("")),
  installments: z.array(z.object({ dueOn: dateStringSchema, amount: z.coerce.number().min(1) })).min(1)
});

function className(classRoom?: { name: string; arm: string | null } | null) {
  if (!classRoom) return "Unassigned";
  return formatNigeriaClassName(classRoom.arm ? `${classRoom.name} - ${classRoom.arm}` : classRoom.name);
}

function studentName(student: { firstName: string; lastName: string; middleName?: string | null }) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function nextCode(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-8)}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

function jsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class FinanceService {
  async getFinanceDashboard(schoolId: string): Promise<FinanceDashboardView> {
    const [invoices, feeStructures, payments, installmentPlans, auditTrail] = await Promise.all([
      this.listInvoices(schoolId),
      this.listFeeStructures(schoolId),
      this.listPayments(schoolId),
      this.listInstallmentPlans(schoolId),
      env.DEMO_MODE
        ? []
        : prisma.auditLog.findMany({
            where: { schoolId, entityType: { in: ["Invoice", "Payment", "Receipt", "InvoiceAdjustment", "InstallmentPlan"] } },
            orderBy: { createdAt: "desc" },
            take: 20
          })
    ]);

    const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    const collected = toMoney(totalBilled - outstanding);
    const collectionRate = totalBilled === 0 ? 0 : Math.round((collected / totalBilled) * 100);

    return {
      metrics: [
        { label: "Total billed", value: formatMoneyForAudit(totalBilled), tone: "brand" },
        { label: "Collected", value: formatMoneyForAudit(collected), tone: "success" },
        { label: "Outstanding", value: formatMoneyForAudit(outstanding), tone: "warning" },
        { label: "Collection rate", value: `${collectionRate}%`, tone: "ink" }
      ],
      feeStructures,
      invoices,
      payments,
      installmentPlans,
      auditTrail: auditTrail.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        createdAt: item.createdAt.toISOString(),
        detail: JSON.stringify(item.metadata ?? {})
      }))
    };
  }

  async listFeeStructures(schoolId: string): Promise<FeeStructureView[]> {
    if (env.DEMO_MODE) {
      return [
        {
          id: "fees_jss2_second_term",
          name: "JSS 2 Second Term Fees",
          session: "2025/2026",
          term: "Second Term",
          className: "JSS 2 - Gold",
          recurrence: "TERM",
          isOneTime: false,
          isActive: true,
          total: 285000,
          items: [
            { id: "fsi_1", label: "Tuition", componentType: "TUITION", amount: 200000, isOptional: false, isActive: true },
            { id: "fsi_2", label: "Transport", componentType: "TRANSPORT", amount: 60000, isOptional: true, isActive: true },
            { id: "fsi_3", label: "Development Levy", componentType: "DEVELOPMENT_LEVY", amount: 25000, isOptional: false, isActive: true }
          ]
        }
      ];
    }

    const structures = await prisma.feeStructure.findMany({
      where: { schoolId },
      include: { academicSession: true, term: true, classRoom: true, items: true },
      orderBy: { createdAt: "desc" }
    });
    return structures.map((structure) => ({
      id: structure.id,
      name: structure.name,
      session: structure.academicSession?.name,
      term: structure.term?.name,
      className: structure.classRoom ? className(structure.classRoom) : undefined,
      studentCategory: structure.studentCategory ?? undefined,
      recurrence: structure.recurrence,
      isOneTime: structure.isOneTime,
      isActive: structure.isActive,
      dueDate: structure.dueDate?.toISOString(),
      total: structure.items.reduce((sum, item) => sum + Number(item.amount), 0),
      items: structure.items.map((item) => ({
        id: item.id,
        label: item.label,
        componentType: item.componentType,
        amount: Number(item.amount),
        isOptional: item.isOptional,
        isActive: item.isActive
      }))
    }));
  }

  async createFeeStructure(schoolId: string, payload: unknown) {
    const normalized =
      payload && typeof payload === "object" && !Array.isArray(payload) && !("items" in payload)
        ? {
            ...payload,
            items: [
              { label: "Tuition", componentType: "TUITION", amount: Number((payload as Record<string, unknown>).tuition ?? 0), isOptional: false },
              { label: "Development Levy", componentType: "DEVELOPMENT_LEVY", amount: Number((payload as Record<string, unknown>).developmentLevy ?? 0), isOptional: false },
              { label: "Exam Fee", componentType: "EXAM_FEE", amount: Number((payload as Record<string, unknown>).examFee ?? 0), isOptional: false },
              { label: "ICT Fee", componentType: "ICT_FEE", amount: Number((payload as Record<string, unknown>).ictFee ?? 0), isOptional: false },
              { label: "PTA Fee", componentType: "PTA_FEE", amount: Number((payload as Record<string, unknown>).ptaFee ?? 0), isOptional: false },
              { label: "Transport", componentType: "TRANSPORT", amount: Number((payload as Record<string, unknown>).transport ?? 0), isOptional: true },
              { label: "Hostel", componentType: "HOSTEL", amount: Number((payload as Record<string, unknown>).hostel ?? 0), isOptional: true },
              { label: "Books / Uniform", componentType: "BOOKS", amount: Number((payload as Record<string, unknown>).extras ?? 0), isOptional: true }
            ].filter((item) => item.amount > 0)
          }
        : payload;
    const parsed = feeStructureSchema.parse(normalized);
    if (env.DEMO_MODE) return (await this.listFeeStructures(schoolId))[0];

    const structure = await prisma.feeStructure.create({
      data: {
        schoolId,
        academicSessionId: parsed.academicSessionId || null,
        termId: parsed.termId || null,
        classId: parsed.classId || null,
        name: parsed.name,
        studentCategory: parsed.studentCategory || null,
        recurrence: parsed.recurrence,
        isOneTime: parsed.isOneTime || parsed.recurrence === "ONE_TIME",
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        items: {
          create: parsed.items.map((item) => ({
            label: item.label,
            componentType: item.componentType,
            amount: item.amount,
            isOptional: item.isOptional
          }))
        }
      },
      include: { academicSession: true, term: true, classRoom: true, items: true }
    });
    await this.audit(schoolId, undefined, "CREATE", "FeeStructure", structure.id, { name: structure.name });
    return (await this.listFeeStructures(schoolId)).find((item) => item.id === structure.id);
  }

  async listInvoices(schoolId: string) {
    if (env.DEMO_MODE) {
      return getDemoStore().invoices;
    }

    const invoices = await prisma.invoice.findMany({
      where: { schoolId },
      include: {
        student: { include: { currentClass: true } },
        payments: true,
        receipts: true
      },
      orderBy: { issuedOn: "desc" }
    });

    return invoices.map<InvoiceView>((invoice) => this.mapInvoice(invoice));
  }

  async getInvoice(schoolId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { schoolId, id: invoiceId },
      include: {
        student: { include: { currentClass: true } },
        items: true,
        payments: true,
        allocations: true,
        receipts: true,
        adjustments: true,
        installmentPlans: { include: { items: true } }
      }
    });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    return invoice;
  }

  async createInvoice(schoolId: string, createdById: string, payload: unknown) {
    const parsed = createInvoiceSchema.parse(payload);
    const normalizedClassName = formatNigeriaClassName(parsed.className);
    const items = [
      { description: "Tuition", amount: parsed.tuition },
      { description: "Transport", amount: parsed.transport },
      { description: "Development Levy", amount: parsed.developmentLevy }
    ].filter((item) => item.amount > 0);
    if (items.length === 0) throw new BadRequestException("At least one invoice item amount is required.");
    const totals = calculateInvoiceTotals({ items, discount: parsed.discount, fine: parsed.fine });

    if (env.DEMO_MODE) {
      const invoice: InvoiceView = {
        id: randomUUID(),
        invoiceNumber: `INV-2026-${String(getDemoStore().invoices.length + 1).padStart(3, "0")}`,
        studentName: parsed.studentName,
        className: normalizedClassName,
        subtotal: totals.subtotal,
        discount: totals.discount,
        fine: totals.fine,
        total: totals.total,
        paid: 0,
        balance: totals.balance,
        status: parsed.issueAsDraft ? "DRAFT" : totals.status,
        dueOn: new Date(parsed.dueOn).toISOString()
      };
      getDemoStore().invoices.unshift(invoice);
      return invoice;
    }

    if (!parsed.studentId) throw new BadRequestException("studentId is required outside demo mode.");
    const student = await prisma.student.findFirst({ where: { schoolId, id: parsed.studentId }, include: { currentClass: true } });
    if (!student) throw new NotFoundException("Student not found.");

    const invoice = await prisma.invoice.create({
      data: {
        schoolId,
        studentId: parsed.studentId,
        feeStructureId: parsed.feeStructureId || null,
        createdById,
        invoiceNumber: nextCode("INV"),
        issuedOn: new Date(),
        dueOn: new Date(parsed.dueOn),
        subtotal: totals.subtotal,
        discount: totals.discount,
        fine: totals.fine,
        total: totals.total,
        balance: totals.balance,
        status: parsed.issueAsDraft ? "DRAFT" : "ISSUED",
        items: { create: items.map((item) => ({ description: item.description, amount: item.amount, quantity: 1 })) }
      },
      include: { student: { include: { currentClass: true } }, payments: true, receipts: true }
    });
    await this.audit(schoolId, createdById, "CREATE", "Invoice", invoice.id, { total: totals.total, studentId: parsed.studentId });
    await this.notifyStudentGuardians(schoolId, parsed.studentId, "Invoice issued", `${invoice.invoiceNumber} has been issued for ${formatMoneyForAudit(totals.total)}.`);
    return this.mapInvoice(invoice);
  }

  async generateInvoices(schoolId: string, createdById: string, payload: unknown) {
    const parsed = generateInvoicesSchema.parse(payload);
    const structure = await prisma.feeStructure.findFirst({
      where: { schoolId, id: parsed.feeStructureId, isActive: true },
      include: { items: true }
    });
    if (!structure) throw new NotFoundException("Active fee structure not found.");

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        ...(parsed.studentIds?.length ? { id: { in: parsed.studentIds } } : {}),
        ...(parsed.classId ? { currentClassId: parsed.classId } : structure.classId ? { currentClassId: structure.classId } : {})
      },
      include: { currentClass: true }
    });
    const items = structure.items.filter((item) => item.isActive).map((item) => ({ description: item.label, amount: Number(item.amount) }));
    const totals = calculateInvoiceTotals({ items });
    const dueOn = parsed.dueOn ? new Date(parsed.dueOn) : structure.dueDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const created: InvoiceView[] = [];
    for (const student of students) {
      const existing = await prisma.invoice.findFirst({
        where: { schoolId, studentId: student.id, feeStructureId: structure.id, status: { not: "VOID" } }
      });
      if (existing) continue;
      const invoice = await prisma.invoice.create({
        data: {
          schoolId,
          studentId: student.id,
          feeStructureId: structure.id,
          createdById,
          invoiceNumber: nextCode("INV"),
          issuedOn: new Date(),
          dueOn,
          subtotal: totals.subtotal,
          discount: 0,
          fine: 0,
          total: totals.total,
          balance: totals.balance,
          status: "ISSUED",
          items: { create: items.map((item) => ({ description: item.description, amount: item.amount, quantity: 1 })) }
        },
        include: { student: { include: { currentClass: true } }, payments: true, receipts: true }
      });
      created.push(this.mapInvoice(invoice));
      await this.notifyStudentGuardians(schoolId, student.id, "Invoice issued", `${invoice.invoiceNumber} has been issued for ${formatMoneyForAudit(totals.total)}.`);
    }
    await this.audit(schoolId, createdById, "CREATE", "Invoice", structure.id, { generated: created.length, feeStructureId: structure.id });
    return created;
  }

  async initializePaymentFlow(schoolId: string, recordedById: string, payload: unknown, session?: SessionPayload) {
    const parsed = paymentSchema.parse(payload);
    const reference = parsed.reference || nextCode("PAY");
    const provider = parsed.provider ?? "PAYSTACK";

    if (env.DEMO_MODE) {
      const demoInvoice = getDemoStore().invoices.find((item) => item.id === parsed.invoiceId);
      if (!demoInvoice) throw new NotFoundException("Open invoice not found.");
      if (parsed.amount > demoInvoice.balance) {
        throw new BadRequestException("Payment amount cannot exceed the outstanding invoice balance.");
      }
      const checkout = await getPaymentGateway(provider).initializePayment({
        amount: parsed.amount,
        email: parsed.email || "accounts@greenfieldcollege.ng",
        reference,
        callbackUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/finance/payments`,
        metadata: {
          school_id: schoolId,
          invoice_id: parsed.invoiceId,
          student_name: demoInvoice.studentName,
          class_name: demoInvoice.className,
          invoice_number: demoInvoice.invoiceNumber
        }
      });
      demoInvoice.balance = Math.max(demoInvoice.balance - parsed.amount, 0);
      demoInvoice.status = demoInvoice.balance === 0 ? "PAID" : "PARTIALLY_PAID";
      demoInvoice.receiptNumber = nextCode("RCT");
      return checkout;
    }

    const invoice = await this.ensureInvoiceForPayment(schoolId, parsed.invoiceId, session);
    if (parsed.amount > Number(invoice.balance)) {
      throw new BadRequestException("Payment amount cannot exceed the outstanding invoice balance.");
    }
    const gateway = getPaymentGateway(provider);
    const studentFullName = studentName(invoice.student);
    const parentGuardian = invoice.student.guardians[0]?.guardian;
    const callbackUrl =
      session?.role === "PARENT"
        ? `${process.env.APP_URL ?? "http://localhost:3000"}/portals/parent/children/${invoice.studentId}/fees`
        : `${process.env.APP_URL ?? "http://localhost:3000"}/finance/payments`;
    const checkout = await gateway.initializePayment({
      amount: parsed.amount,
      email: parsed.email || parentGuardian?.email || "accounts@greenfieldcollege.ng",
      customerName: parentGuardian ? `${parentGuardian.firstName} ${parentGuardian.lastName}` : studentFullName,
      customerPhone: parentGuardian?.phone,
      reference,
      callbackUrl,
      channels: parsed.paymentChannel ? parsed.paymentChannel.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      metadata: {
        school_id: schoolId,
        student_id: invoice.studentId,
        invoice_id: invoice.id,
        student_name: studentFullName,
        class_name: className(invoice.student.currentClass),
        invoice_number: invoice.invoiceNumber
      },
      customFields: [
        { display_name: "Student Name", variable_name: "student_name", value: studentFullName },
        { display_name: "Class", variable_name: "class_name", value: className(invoice.student.currentClass) },
        { display_name: "Invoice Number", variable_name: "invoice_number", value: invoice.invoiceNumber }
      ]
    });

    await prisma.payment.create({
      data: {
        schoolId,
        studentId: invoice.studentId,
        invoiceId: parsed.invoiceId,
        recordedById,
        reference,
        paymentNumber: reference,
        amount: parsed.amount,
        status: "PENDING",
        method: "ONLINE",
        provider,
        gateway: provider,
        gatewayReference: reference,
        gatewayStatus: "PENDING",
        paymentChannel: parsed.paymentChannel || undefined,
        metadata: jsonValue({ checkoutUrl: checkout.checkoutUrl, gatewayRaw: checkout.raw, note: parsed.note || undefined })
      }
    });
    await this.audit(schoolId, recordedById, "PAYMENT", "Payment", reference, { status: "PENDING", provider });
    return checkout;
  }

  async recordManualPayment(schoolId: string, recordedById: string, payload: unknown) {
    const parsed = paymentSchema.parse(payload);
    if (parsed.method === "ONLINE") throw new BadRequestException("Use online verification for ONLINE payments.");
    const invoice = await this.ensureInvoiceForPayment(schoolId, parsed.invoiceId);
    if (parsed.amount > Number(invoice.balance)) {
      throw new BadRequestException("Payment amount cannot exceed the outstanding invoice balance.");
    }
    return this.createSuccessfulPayment(schoolId, recordedById, invoice, {
      amount: parsed.amount,
      method: parsed.method,
      provider: parsed.provider,
      reference: parsed.reference || nextCode("PAY"),
      paidAt: parsed.paidAt ? new Date(parsed.paidAt) : new Date(),
      paymentChannel: parsed.paymentChannel || undefined,
      schoolBankReference: parsed.schoolBankReference || undefined,
      metadata: {
        note: parsed.note || undefined,
        chequeNumber: parsed.chequeNumber || undefined,
        chequeBankName: parsed.chequeBankName || undefined,
        chequeDate: parsed.chequeDate || undefined
      },
      note: parsed.note
    });
  }

  async verifyOnlinePayment(schoolId: string, actorId: string | undefined, reference: string) {
    const payment = await prisma.payment.findFirst({ where: { schoolId, reference }, include: { invoice: true } });
    if (!payment) throw new NotFoundException("Payment reference not found.");
    if (!payment.invoice) throw new BadRequestException("Payment is not linked to an invoice.");
    if (payment.status === "SUCCESS") return this.generateReceipt(schoolId, actorId, payment.id);
    const provider = payment.provider === "FLUTTERWAVE" ? "FLUTTERWAVE" : "PAYSTACK";
    const verification = await getPaymentGateway(provider).verifyPayment(reference);
    if (verification.status !== "SUCCESS") {
      const paymentStatus = verification.status === "PENDING" ? "PENDING" : "FAILED";
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          gatewayStatus: verification.status,
          metadata: jsonValue({ verification: verification.raw })
        }
      });
      throw new BadRequestException(`Payment verification returned ${verification.status}.`);
    }
    if (verification.amount !== undefined && verification.amount < Number(payment.amount)) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", gatewayStatus: "FAILED", metadata: jsonValue({ verification: verification.raw, failureReason: "Amount mismatch" }) }
      });
      throw new BadRequestException("Gateway amount is lower than expected payment amount.");
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        paidAt: verification.paidAt ? new Date(verification.paidAt) : new Date(),
        verifiedAt: new Date(),
        gatewayStatus: "SUCCESS",
        paymentChannel: verification.channel,
        providerTransactionId: verification.gatewayTransactionId,
        metadata: jsonValue({ verification: verification.raw })
      }
    });
    await this.allocatePayment(schoolId, payment.id);
    await this.notifyStudentGuardians(schoolId, payment.studentId, "Payment received", `Payment ${payment.reference} has been verified.`);
    return this.generateReceipt(schoolId, actorId, payment.id);
  }

  async allocatePayment(schoolId: string, paymentId: string) {
    const payment = await prisma.payment.findFirst({ where: { schoolId, id: paymentId }, include: { invoice: true, allocations: true } });
    if (!payment || !payment.invoice) throw new NotFoundException("Payment or invoice not found.");
    if (payment.status !== "SUCCESS") throw new BadRequestException("Only successful payments can be allocated.");
    if (payment.allocations.length > 0) return payment.allocations;
    const { allocations, overpayment } = allocatePaymentAcrossInvoices({
      amount: Number(payment.amount),
      invoices: [{ invoiceId: payment.invoice.id, balance: Number(payment.invoice.balance) }]
    });
    if (allocations.length === 0) {
      await prisma.payment.update({ where: { id: payment.id }, data: { metadata: { overpayment } } });
      return [];
    }
    const allocation = allocations[0];
    const nextBalance = toMoney(Number(payment.invoice.balance) - allocation.amount);
    await prisma.$transaction([
      prisma.paymentAllocation.create({
        data: { schoolId, paymentId: payment.id, invoiceId: payment.invoice.id, amount: allocation.amount, metadata: { overpayment } }
      }),
      prisma.invoice.update({
        where: { id: payment.invoice.id },
        data: { balance: nextBalance, status: getInvoiceStatus(Number(payment.invoice.total), nextBalance, payment.invoice.dueOn) }
      })
    ]);
    return prisma.paymentAllocation.findMany({ where: { schoolId, paymentId: payment.id } });
  }

  async generateReceipt(schoolId: string, issuedById: string | undefined, paymentId: string): Promise<ReceiptView> {
    const payment = await prisma.payment.findFirst({ where: { schoolId, id: paymentId }, include: { invoice: true, receipts: true } });
    if (!payment?.invoice) throw new NotFoundException("Payment or invoice not found.");
    if (payment.status !== "SUCCESS") throw new BadRequestException("Receipt can only be issued for successful payments.");
    const existing = payment.receipts[0];
    if (existing) return this.mapReceipt(existing, payment.invoice.invoiceNumber);
    const receipt = await prisma.receipt.create({
      data: {
        schoolId,
        invoiceId: payment.invoice.id,
        paymentId: payment.id,
        issuedById,
        receiptNumber: nextCode("RCT"),
        amount: payment.amount,
        currency: payment.currency,
        metadata: { paymentReference: payment.reference }
      }
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { receiptNumber: receipt.receiptNumber } });
    await this.audit(schoolId, issuedById, "CREATE", "Receipt", receipt.id, { receiptNumber: receipt.receiptNumber });
    await this.notifyStudentGuardians(schoolId, payment.studentId, "Receipt available", `Receipt ${receipt.receiptNumber} is ready.`);
    return this.mapReceipt(receipt, payment.invoice.invoiceNumber);
  }

  async applyDiscount(schoolId: string, actorId: string, payload: unknown) {
    return this.applyAdjustment(schoolId, actorId, payload, ["DISCOUNT", "SCHOLARSHIP"]);
  }

  async applyWaiver(schoolId: string, actorId: string, payload: unknown) {
    return this.applyAdjustment(schoolId, actorId, payload, ["WAIVER"]);
  }

  private async applyAdjustment(schoolId: string, actorId: string, payload: unknown, allowedTypes: Array<"DISCOUNT" | "WAIVER" | "SCHOLARSHIP">) {
    const parsed = adjustmentSchema.parse(payload);
    if (!allowedTypes.includes(parsed.type as "DISCOUNT" | "WAIVER" | "SCHOLARSHIP")) {
      throw new BadRequestException("Adjustment type is not allowed on this endpoint.");
    }
    const invoice = await prisma.invoice.findFirst({ where: { schoolId, id: parsed.invoiceId } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    if (invoice.status === "PAID" || invoice.status === "VOID") throw new BadRequestException("Cannot adjust a paid or void invoice.");
    const amount = parsed.valueType === "PERCENTAGE" ? toMoney((Number(invoice.subtotal) * parsed.value) / 100) : toMoney(parsed.value);
    if (amount > Number(invoice.balance)) throw new BadRequestException("Adjustment cannot exceed outstanding balance.");
    const nextDiscount = toMoney(Number(invoice.discount) + amount);
    const nextTotal = toMoney(Number(invoice.subtotal) - nextDiscount + Number(invoice.fine));
    const nextBalance = toMoney(Math.max(Number(invoice.balance) - amount, 0));
    await prisma.$transaction([
      prisma.invoiceAdjustment.create({
        data: {
          schoolId,
          invoiceId: invoice.id,
          appliedById: actorId,
          approvedById: actorId,
          type: parsed.type,
          valueType: parsed.valueType,
          value: parsed.value,
          amount,
          reason: parsed.reason
        }
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { discount: nextDiscount, total: nextTotal, balance: nextBalance, status: getInvoiceStatus(nextTotal, nextBalance, invoice.dueOn) }
      })
    ]);
    await this.audit(schoolId, actorId, "APPROVE", "InvoiceAdjustment", invoice.id, { type: parsed.type, amount, reason: parsed.reason });
    return this.listInvoices(schoolId);
  }

  async createInstallmentPlan(schoolId: string, createdById: string, payload: unknown): Promise<InstallmentPlanView> {
    const normalized =
      payload && typeof payload === "object" && !Array.isArray(payload) && !("installments" in payload)
        ? {
            ...payload,
            installments: [1, 2, 3]
              .map((index) => ({
                dueOn: (payload as Record<string, unknown>)[`installment${index}Due`],
                amount: Number((payload as Record<string, unknown>)[`installment${index}Amount`] ?? 0)
              }))
              .filter((item) => item.dueOn && item.amount > 0)
          }
        : payload;
    const parsed = installmentPlanSchema.parse(normalized);
    const invoice = await prisma.invoice.findFirst({ where: { schoolId, id: parsed.invoiceId }, include: { student: true } });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    const totalAmount = toMoney(parsed.installments.reduce((sum, item) => sum + item.amount, 0));
    if (totalAmount !== Number(invoice.balance)) throw new BadRequestException("Installment total must equal the invoice outstanding balance.");
    const plan = await prisma.installmentPlan.create({
      data: {
        schoolId,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        createdById,
        planNumber: nextCode("PLAN"),
        totalAmount,
        balance: totalAmount,
        notes: parsed.notes || null,
        items: { create: parsed.installments.map((item) => ({ dueOn: new Date(item.dueOn), amount: item.amount })) }
      },
      include: { student: { include: { currentClass: true } }, invoice: true, items: true }
    });
    await this.audit(schoolId, createdById, "CREATE", "InstallmentPlan", plan.id, { invoiceId: invoice.id, totalAmount });
    return this.mapInstallmentPlan(plan);
  }

  async listPayments(schoolId: string): Promise<PaymentView[]> {
    if (env.DEMO_MODE) return [];
    const payments = await prisma.payment.findMany({
      where: { schoolId },
      include: { student: true, invoice: true, receipts: true },
      orderBy: { paidAt: "desc" },
      take: 100
    });
    return payments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      studentName: studentName(payment.student),
      invoiceNumber: payment.invoice?.invoiceNumber,
      receiptNumber: payment.receipts[0]?.receiptNumber,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      provider: payment.provider ?? undefined,
      paidAt: payment.paidAt?.toISOString()
    }));
  }

  async listInstallmentPlans(schoolId: string): Promise<InstallmentPlanView[]> {
    if (env.DEMO_MODE) return [];
    const plans = await prisma.installmentPlan.findMany({
      where: { schoolId },
      include: { student: { include: { currentClass: true } }, invoice: true, items: true },
      orderBy: { createdAt: "desc" }
    });
    return plans.map((plan) => this.mapInstallmentPlan(plan));
  }

  async exportFinanceReport(schoolId: string) {
    const invoices = await this.listInvoices(schoolId);
    const header = ["Invoice", "Student", "Class", "Total", "Paid", "Balance", "Status", "Due"];
    const rows = invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.studentName,
      invoice.className,
      String(invoice.total),
      String(invoice.paid ?? 0),
      String(invoice.balance),
      invoice.status,
      invoice.dueOn
    ]);
    return [header, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  }

  async handlePaystackWebhook(payload: Record<string, unknown>) {
    const eventType = String(payload.event ?? "unknown");
    const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
    const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
    const reference = String(data.reference ?? "");
    if (!reference) throw new BadRequestException("Webhook reference is missing.");

    const existingPayment = await prisma.payment.findFirst({ where: { reference }, include: { invoice: true } });
    const schoolId = String(metadata.school_id ?? existingPayment?.schoolId ?? "");
    if (!schoolId) throw new BadRequestException("Webhook school context is missing.");

    const gatewayLog = await this.logGatewayTransaction({
      schoolId,
      paymentId: existingPayment?.id,
      gateway: "PAYSTACK",
      eventType,
      reference,
      amount: typeof data.amount === "number" ? data.amount / 100 : 0,
      currency: String(data.currency ?? "NGN"),
      customerEmail: ((data.customer as Record<string, unknown> | undefined)?.email as string | undefined) ?? undefined,
      customerPhone: ((data.customer as Record<string, unknown> | undefined)?.phone as string | undefined) ?? undefined,
      payload
    });

    if (gatewayLog.processed) return { processed: false, duplicate: true };
    if (!existingPayment) return { processed: false, missingPayment: true };

    if (eventType === "charge.success") {
      await this.verifyOnlinePayment(schoolId, existingPayment.recordedById ?? undefined, reference);
    } else if (eventType === "charge.failed") {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { status: "FAILED", gatewayStatus: "FAILED", metadata: jsonValue({ webhook: payload }) }
      });
    } else if (eventType === "refund.processed") {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { gatewayStatus: "REFUNDED", metadata: jsonValue({ webhook: payload }) }
      });
    }

    await prisma.gatewayTransaction.update({
      where: { id: gatewayLog.id },
      data: { processed: true, processedAt: new Date() }
    });
    return { processed: true };
  }

  async handleFlutterwaveWebhook(payload: Record<string, unknown>) {
    const eventType = String(payload.event ?? payload["event.type"] ?? "unknown");
    const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
    const meta = (data.meta && typeof data.meta === "object" ? data.meta : {}) as Record<string, unknown>;
    const reference = String(data.tx_ref ?? data.reference ?? "");
    if (!reference) throw new BadRequestException("Webhook reference is missing.");

    const existingPayment = await prisma.payment.findFirst({ where: { reference }, include: { invoice: true } });
    const schoolId = String(meta.school_id ?? existingPayment?.schoolId ?? "");
    if (!schoolId) throw new BadRequestException("Webhook school context is missing.");

    const gatewayLog = await this.logGatewayTransaction({
      schoolId,
      paymentId: existingPayment?.id,
      gateway: "FLUTTERWAVE",
      eventType,
      reference,
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? "NGN"),
      customerEmail: ((data.customer as Record<string, unknown> | undefined)?.email as string | undefined) ?? undefined,
      customerPhone: ((data.customer as Record<string, unknown> | undefined)?.phone_number as string | undefined) ?? undefined,
      payload
    });

    if (gatewayLog.processed) return { processed: false, duplicate: true };
    if (!existingPayment) return { processed: false, missingPayment: true };

    if (String(data.status) === "successful" || eventType === "charge.completed") {
      await this.verifyOnlinePayment(schoolId, existingPayment.recordedById ?? undefined, reference);
    } else if (String(data.status) === "failed") {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { status: "FAILED", gatewayStatus: "FAILED", metadata: jsonValue({ webhook: payload }) }
      });
    }

    await prisma.gatewayTransaction.update({
      where: { id: gatewayLog.id },
      data: { processed: true, processedAt: new Date() }
    });
    return { processed: true };
  }

  private async logGatewayTransaction(input: {
    schoolId: string;
    paymentId?: string;
    gateway: "PAYSTACK" | "FLUTTERWAVE";
    eventType: string;
    reference: string;
    amount: number;
    currency: string;
    customerEmail?: string;
    customerPhone?: string;
    payload: Record<string, unknown>;
  }) {
    try {
      return await prisma.gatewayTransaction.create({
        data: {
          schoolId: input.schoolId,
          paymentId: input.paymentId,
          gateway: input.gateway,
          eventType: input.eventType,
          reference: input.reference,
          amount: input.amount,
          currency: input.currency,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          gatewayResponse: input.payload as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      const existing = await prisma.gatewayTransaction.findFirst({
        where: { gateway: input.gateway, reference: input.reference, eventType: input.eventType }
      });
      if (existing) return existing;
      throw error;
    }
  }

  private async createSuccessfulPayment(
    schoolId: string,
    recordedById: string,
    invoice: { id: string; studentId: string; invoiceNumber: string; total: unknown; balance: unknown; dueOn: Date },
    input: {
      amount: number;
      method: "CASH" | "TRANSFER" | "BANK_TRANSFER" | "POS" | "CHEQUE" | "ONLINE" | "USSD";
      provider?: "PAYSTACK" | "FLUTTERWAVE";
      reference: string;
      paidAt: Date;
      paymentChannel?: string;
      schoolBankReference?: string;
      metadata?: Record<string, unknown>;
      note?: string;
    }
  ) {
    const existing = await prisma.payment.findFirst({ where: { schoolId, reference: input.reference } });
    if (existing) throw new BadRequestException("Payment reference already exists.");
    const payment = await prisma.payment.create({
      data: {
        schoolId,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        recordedById,
        reference: input.reference,
        paymentNumber: input.reference,
        amount: input.amount,
        status: "SUCCESS",
        method: input.method,
        provider: input.provider,
        paymentChannel: input.paymentChannel,
        schoolBankReference: input.schoolBankReference,
        paidAt: input.paidAt,
        verifiedAt: input.paidAt,
        metadata: { ...(input.metadata ?? {}), note: input.note || undefined }
      }
    });
    await this.allocatePayment(schoolId, payment.id);
    await this.audit(schoolId, recordedById, "PAYMENT", "Payment", payment.id, { amount: input.amount, method: input.method });
    await this.notifyStudentGuardians(schoolId, invoice.studentId, "Payment received", `${formatMoneyForAudit(input.amount)} was recorded for ${invoice.invoiceNumber}.`);
    return this.generateReceipt(schoolId, recordedById, payment.id);
  }

  private async ensureInvoiceForPayment(schoolId: string, invoiceId: string, session?: SessionPayload) {
    const invoice = await prisma.invoice.findFirst({
      where: { schoolId, id: invoiceId, status: { notIn: ["VOID", "PAID"] } },
      include: { student: { include: { currentClass: true, guardians: { include: { guardian: true } } } } }
    });
    if (!invoice) throw new NotFoundException("Open invoice not found.");
    if (session?.role === "PARENT") {
      const ownsInvoice = invoice.student.guardians.some((link) => link.guardian.userId === session.userId && link.guardian.schoolId === session.schoolId);
      if (!ownsInvoice) throw new ForbiddenException("Parents can only pay invoices for linked children.");
    }
    return invoice;
  }

  private mapInvoice(invoice: {
    id: string;
    invoiceNumber: string;
    studentId: string;
    student: { firstName: string; lastName: string; middleName?: string | null; currentClass?: { name: string; arm: string | null } | null };
    subtotal: unknown;
    discount: unknown;
    fine: unknown;
    total: unknown;
    balance: unknown;
    status: string;
    issuedOn: Date;
    dueOn: Date;
    payments?: Array<{ amount: unknown; status: string }>;
    receipts?: Array<{ receiptNumber: string }>;
  }): InvoiceView {
    const paid = (invoice.payments ?? []).filter((payment) => payment.status === "SUCCESS").reduce((sum, payment) => sum + Number(payment.amount), 0);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
      studentName: studentName(invoice.student),
      className: className(invoice.student.currentClass),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      fine: Number(invoice.fine),
      total: Number(invoice.total),
      paid,
      balance: Number(invoice.balance),
      status: invoice.status,
      issuedOn: invoice.issuedOn.toISOString(),
      dueOn: invoice.dueOn.toISOString(),
      receiptNumber: invoice.receipts?.[0]?.receiptNumber
    };
  }

  private mapReceipt(receipt: { id: string; invoiceId: string; paymentId: string | null; receiptNumber: string; amount: unknown; currency: string; status: string; issuedAt: Date }, invoiceNumber: string): ReceiptView {
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      invoiceId: receipt.invoiceId,
      invoiceNumber,
      paymentId: receipt.paymentId ?? undefined,
      amount: Number(receipt.amount),
      currency: receipt.currency,
      status: receipt.status,
      issuedAt: receipt.issuedAt.toISOString()
    };
  }

  private mapInstallmentPlan(plan: {
    id: string;
    planNumber: string;
    totalAmount: unknown;
    balance: unknown;
    status: string;
    student: { firstName: string; lastName: string; middleName?: string | null; currentClass?: { name: string; arm: string | null } | null };
    invoice?: { invoiceNumber: string } | null;
    items: Array<{ id: string; dueOn: Date; amount: unknown; paidAmount: unknown; status: string }>;
  }): InstallmentPlanView {
    return {
      id: plan.id,
      planNumber: plan.planNumber,
      studentName: studentName(plan.student),
      invoiceNumber: plan.invoice?.invoiceNumber,
      totalAmount: Number(plan.totalAmount),
      balance: Number(plan.balance),
      status: plan.status,
      items: plan.items.map((item) => ({
        id: item.id,
        dueOn: item.dueOn.toISOString(),
        amount: Number(item.amount),
        paidAmount: Number(item.paidAmount),
        status: item.status
      }))
    };
  }

  private async notifyStudentGuardians(schoolId: string, studentId: string, title: string, body: string) {
    if (env.DEMO_MODE) return;
    const guardians = await prisma.guardian.findMany({
      where: { schoolId, students: { some: { studentId } }, userId: { not: null } },
      select: { userId: true }
    });
    await prisma.notificationLog.createMany({
      data: guardians.map((guardian) => ({
        schoolId,
        userId: guardian.userId,
        channel: "IN_APP",
        title,
        body,
        status: "QUEUED",
        sentAt: new Date()
      }))
    });
  }

  private async audit(schoolId: string, actorId: string | undefined, action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "APPROVE" | "REJECT" | "PAYMENT", entityType: string, entityId: string, metadata: Record<string, unknown>) {
    if (env.DEMO_MODE) return;
    await prisma.auditLog.create({ data: { schoolId, actorId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue } });
  }
}
