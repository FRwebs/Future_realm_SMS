import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";

import { verifyPassword } from "../../../../src/lib/auth/password";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import {
  allocatePaymentAcrossInvoices,
  calculateInvoiceTotals,
  formatMoneyForAudit,
  getInvoiceStatus,
  toMoney
} from "../../../../src/lib/domain/finance";
import {
  AuditLogView,
  BudgetAllocationView,
  ExpenditureView,
  FeeAssignmentView,
  FeeStructureView,
  FinanceDashboardView,
  FinanceSettingsView,
  InstallmentPlanView,
  InvoiceView,
  PaymentView,
  PayrollStaffMemberView,
  PayrollItemView,
  PayrollRunView,
  PayrollWorkspaceView,
  ReceiptView,
  StudentFinanceLedgerView
} from "../../../../src/lib/domain/types";
import { getPaymentGateway } from "../../../../src/lib/integrations/payment-gateways";
import { formatNigeriaClassName, normalizeNigeriaClassValue } from "../../../../src/lib/school-options";

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
  allowOverpayment: z.coerce.boolean().default(false),
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

export const feeAssignmentSchema = z.object({
  studentId: z.string(),
  feeStructureId: z.string(),
  dueDate: dateStringSchema.optional().or(z.literal("")),
});

export const bulkFeeAssignmentSchema = z.object({
  classId: z.string(),
  feeStructureId: z.string(),
  studentIds: z.array(z.string()).optional(),
  dueDate: dateStringSchema.optional().or(z.literal("")),
});

export const feeAssignmentDiscountSchema = z.object({
  discountType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
  value: z.coerce.number().min(0.01),
  reason: z.string().min(3),
  approvalStatus: z.string().optional().or(z.literal("")),
});

export const reversePaymentSchema = z.object({
  reason: z.string().min(20),
  password: z.string().min(8),
});

export const expenditureSchema = z.object({
  category: z.string().min(2),
  description: z.string().min(3),
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.string().min(2),
  paidTo: z.string().min(2),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  expenditureDate: dateStringSchema,
  notes: z.string().optional().or(z.literal("")),
});

export const payrollRunSchema = z.object({
  academicSessionId: z.string().optional().or(z.literal("")),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  staffItems: z.array(z.object({
    staffId: z.string(),
    basicSalary: z.coerce.number().min(0),
    allowances: z.record(z.coerce.number().min(0)).optional(),
    deductions: z.record(z.coerce.number().min(0)).optional(),
  })).min(1),
});

export const sensitiveActionSchema = z.object({
  password: z.string().min(8),
});

export const financeSettingsSchema = z.object({
  paymentMethods: z.array(z.string()).default(["CASH", "BANK_TRANSFER", "POS", "ONLINE"]),
  allowOverpayment: z.coerce.boolean().default(false),
  reminderScheduleDays: z.array(z.coerce.number().int().min(0)).default([3, 0]),
  receiptPrefix: z.string().min(2).max(6).default("RCT"),
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

function sumJsonAmounts(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 0;
  return Object.values(payload as Record<string, unknown>).reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

@Injectable()
export class FinanceService {
  private static readonly dashboardCache = new Map<string, { expiresAt: number; value: FinanceDashboardView }>();

  private readDashboardCache(schoolId: string) {
    const entry = FinanceService.dashboardCache.get(schoolId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      FinanceService.dashboardCache.delete(schoolId);
      return null;
    }
    return entry.value;
  }

  private writeDashboardCache(schoolId: string, value: FinanceDashboardView, ttlMs = 20_000) {
    FinanceService.dashboardCache.set(schoolId, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  async getFinanceDashboard(schoolId: string): Promise<FinanceDashboardView> {
    const cached = this.readDashboardCache(schoolId);
    if (cached) {
      return cached;
    }

    const today = new Date();
    const paymentWindowStart = subMonths(today, 6);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const [invoiceRows, paymentRows, expenditureRows, auditTrail] = await Promise.all([
      prisma.invoice.findMany({
        where: { schoolId, balance: { gt: 0 } },
        select: {
          id: true,
          invoiceNumber: true,
          studentId: true,
          status: true,
          total: true,
          balance: true,
          dueOn: true,
          student: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              admissionNumber: true,
              currentClass: {
                select: {
                  id: true,
                  name: true,
                  arm: true,
                  classLevel: { select: { name: true } },
                },
              },
            },
          },
          classRoom: {
            select: {
              id: true,
              name: true,
              arm: true,
              classLevel: { select: { name: true } },
            },
          },
          academicSession: { select: { id: true, name: true } },
          term: { select: { id: true, name: true } },
          payments: {
            select: { paidAt: true },
            orderBy: { paidAt: "desc" },
            take: 1,
          },
          receipts: {
            select: { receiptNumber: true },
            orderBy: { issuedAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ balance: "desc" }, { issuedOn: "desc" }],
        take: 250,
      }),
      prisma.payment.findMany({
        where: { schoolId, paidAt: { gte: paymentWindowStart } },
        select: {
          id: true,
          reference: true,
          studentId: true,
          amount: true,
          status: true,
          method: true,
          provider: true,
          paymentNumber: true,
          paymentChannel: true,
          schoolBankReference: true,
          gatewayStatus: true,
          isReversed: true,
          reversalReason: true,
          reversedAt: true,
          paidAt: true,
          student: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              admissionNumber: true,
              currentClass: {
                select: {
                  id: true,
                  name: true,
                  arm: true,
                  classLevel: { select: { name: true } },
                },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              academicSession: { select: { id: true, name: true } },
              term: { select: { id: true, name: true } },
              classRoom: {
                select: {
                  id: true,
                  name: true,
                  arm: true,
                  classLevel: { select: { name: true } },
                },
              },
            },
          },
          receipts: {
            select: { receiptNumber: true },
            orderBy: { issuedAt: "desc" },
            take: 1,
          },
          recordedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { paidAt: "desc" },
        take: 180,
      }),
      prisma.expense.findMany({
        where: { schoolId, deletedAt: null, expenseDate: { gte: monthStart, lte: monthEnd } },
        select: {
          id: true,
          category: true,
          title: true,
          amount: true,
          paymentMethod: true,
          paidTo: true,
          receiptUrl: true,
          recordedById: true,
          expenseDate: true,
          notes: true,
        },
        orderBy: { expenseDate: "desc" },
        take: 80,
      }),
      prisma.auditLog.findMany({
        where: { schoolId, entityType: { in: ["Invoice", "Payment", "Receipt", "InvoiceAdjustment", "InstallmentPlan"] } },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
    ]);

    const invoices = invoiceRows.map<InvoiceView>((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId ?? undefined,
      studentName: invoice.student ? studentName(invoice.student) : "Walk-in student",
      admissionNumber: invoice.student?.admissionNumber ?? undefined,
      classId: invoice.classRoom?.id ?? invoice.student?.currentClass?.id ?? undefined,
      className: invoice.classRoom
        ? className(invoice.classRoom)
        : invoice.student?.currentClass
          ? className(invoice.student.currentClass)
          : "Unassigned",
      classLevel: invoice.classRoom?.classLevel?.name ?? invoice.student?.currentClass?.classLevel?.name ?? undefined,
      sessionId: invoice.academicSession?.id ?? undefined,
      session: invoice.academicSession?.name ?? undefined,
      termId: invoice.term?.id ?? undefined,
      term: invoice.term?.name ?? undefined,
      total: Number(invoice.total),
      balance: Number(invoice.balance),
      status: invoice.status,
      dueOn: invoice.dueOn.toISOString(),
      receiptNumber: invoice.receipts[0]?.receiptNumber,
      paymentCount: invoice.payments.length,
      lastPaymentAt: invoice.payments[0]?.paidAt?.toISOString(),
    }));

    const payments = paymentRows.map<PaymentView>((payment) => ({
      id: payment.id,
      reference: payment.reference,
      studentId: payment.studentId ?? undefined,
      studentName: payment.student ? studentName(payment.student) : "Walk-in student",
      admissionNumber: payment.student?.admissionNumber ?? undefined,
      classId: payment.student?.currentClass?.id ?? payment.invoice?.classRoom?.id ?? undefined,
      className: payment.student?.currentClass
        ? className(payment.student.currentClass)
        : payment.invoice?.classRoom
          ? className(payment.invoice.classRoom)
          : undefined,
      classLevel: payment.student?.currentClass?.classLevel?.name ?? payment.invoice?.classRoom?.classLevel?.name ?? undefined,
      sessionId: payment.invoice?.academicSession?.id ?? undefined,
      session: payment.invoice?.academicSession?.name ?? undefined,
      termId: payment.invoice?.term?.id ?? undefined,
      term: payment.invoice?.term?.name ?? undefined,
      invoiceId: payment.invoice?.id ?? undefined,
      invoiceNumber: payment.invoice?.invoiceNumber ?? undefined,
      receiptNumber: payment.receipts[0]?.receiptNumber,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      provider: payment.provider ?? undefined,
      paymentNumber: payment.paymentNumber ?? undefined,
      paymentChannel: payment.paymentChannel ?? undefined,
      schoolBankReference: payment.schoolBankReference ?? undefined,
      gatewayStatus: payment.gatewayStatus ?? undefined,
      recordedByName: payment.recordedBy ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}` : undefined,
      isReversed: payment.isReversed,
      reversalReason: payment.reversalReason ?? undefined,
      reversedAt: payment.reversedAt?.toISOString(),
      paidAt: payment.paidAt?.toISOString(),
      paymentDate: payment.paidAt?.toISOString(),
      createdAt: payment.paidAt?.toISOString(),
    }));

    const expenditures = expenditureRows.map<ExpenditureView>((expense) => ({
      id: expense.id,
      category: expense.category,
      description: expense.title,
      amount: Number(expense.amount),
      paymentMethod: expense.paymentMethod ?? undefined,
      paidTo: expense.paidTo ?? undefined,
      receiptUrl: expense.receiptUrl ?? undefined,
      recordedById: expense.recordedById ?? undefined,
      expenditureDate: expense.expenseDate.toISOString(),
      notes: expense.notes ?? undefined,
    }));

    const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    const collected = toMoney(totalBilled - outstanding);
    const collectionRate = totalBilled === 0 ? 0 : Math.round((collected / totalBilled) * 100);

    return this.writeDashboardCache(schoolId, {
      metrics: [
        { label: "Total billed", value: formatMoneyForAudit(totalBilled), tone: "brand" },
        { label: "Collected", value: formatMoneyForAudit(collected), tone: "success" },
        { label: "Outstanding", value: formatMoneyForAudit(outstanding), tone: "warning" },
        { label: "Collection rate", value: `${collectionRate}%`, tone: "ink" }
      ],
      feeStructures: [],
      feeAssignments: [],
      invoices,
      payments,
      installmentPlans: [],
      expenditures,
      payrollRuns: [],
      auditTrail: auditTrail.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        createdAt: item.createdAt.toISOString(),
        detail: JSON.stringify(item.metadata ?? {})
      }))
    });
  }

  async listFeeStructures(schoolId: string): Promise<FeeStructureView[]> {
    const structures = await prisma.feeStructure.findMany({
      where: { schoolId, deletedAt: null },
      include: { academicSession: true, term: true, classRoom: true, items: true },
      orderBy: { createdAt: "desc" }
    });
    return structures.map((structure) => ({
      id: structure.id,
      name: structure.name,
      currency: structure.currency,
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

  async updateFeeStructure(schoolId: string, feeStructureId: string, actorId: string, payload: unknown) {
    const parsed = feeStructureSchema.partial().parse(payload);
    const existing = await prisma.feeStructure.findFirst({
      where: { schoolId, id: feeStructureId, deletedAt: null },
      include: { items: true, invoices: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException("Fee structure not found.");

    const nextItems = parsed.items
      ? {
          deleteMany: {},
          create: parsed.items.map((item) => ({
            label: item.label,
            componentType: item.componentType,
            amount: item.amount,
            isOptional: item.isOptional,
          })),
        }
      : undefined;

    const updated = await prisma.feeStructure.update({
      where: { id: feeStructureId },
      data: {
        name: parsed.name ?? undefined,
        academicSessionId: parsed.academicSessionId === "" ? null : parsed.academicSessionId ?? undefined,
        termId: parsed.termId === "" ? null : parsed.termId ?? undefined,
        classId: parsed.classId === "" ? null : parsed.classId ?? undefined,
        studentCategory: parsed.studentCategory === "" ? null : parsed.studentCategory ?? undefined,
        recurrence: parsed.recurrence ?? undefined,
        isOneTime: parsed.isOneTime ?? undefined,
        dueDate: parsed.dueDate === "" ? null : parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        items: nextItems,
      },
      include: { academicSession: true, term: true, classRoom: true, items: true },
    });

    await this.audit(
      schoolId,
      actorId,
      "UPDATE",
      "FeeStructure",
      feeStructureId,
      { name: updated.name },
      {
        oldValue: { name: existing.name, totalItems: existing.items.length },
        newValue: { name: updated.name, totalItems: updated.items.length },
      },
    );
    return (await this.listFeeStructures(schoolId)).find((item) => item.id === updated.id);
  }

  async archiveFeeStructure(schoolId: string, feeStructureId: string, actorId: string) {
    const structure = await prisma.feeStructure.findFirst({
      where: { schoolId, id: feeStructureId, deletedAt: null },
      include: { invoices: { select: { id: true } } },
    });
    if (!structure) throw new NotFoundException("Fee structure not found.");
    const hadPayments = await prisma.payment.count({
      where: { schoolId, invoice: { feeStructureId: feeStructureId } },
    });
    await prisma.feeStructure.update({
      where: { id: feeStructureId },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.audit(
      schoolId,
      actorId,
      "DELETE",
      "FeeStructure",
      feeStructureId,
      { softDeleted: true, hadLinkedPayments: hadPayments > 0 },
      {
        oldValue: { isActive: structure.isActive, deletedAt: null },
        newValue: { isActive: false, deletedAt: new Date().toISOString() },
      },
    );
    return { id: feeStructureId, softDeleted: true, hadLinkedPayments: hadPayments > 0 };
  }

  async listInvoices(schoolId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { schoolId },
      include: {
        student: {
          include: {
            currentClass: { include: { classLevel: true } },
          },
        },
        classRoom: { include: { classLevel: true } },
        academicSession: true,
        term: true,
        payments: { orderBy: { paidAt: "desc" } },
        receipts: true,
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

  async listFeeAssignments(schoolId: string): Promise<FeeAssignmentView[]> {
    const assignments = await prisma.feeAssignment.findMany({
      where: { schoolId },
      include: {
        student: { include: { currentClass: { include: { classLevel: true } } } },
        feeStructure: true,
        academicSession: true,
        term: true,
        invoice: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return assignments.map((assignment) => this.mapFeeAssignment(assignment));
  }

  async assignFeeToStudent(schoolId: string, createdById: string, payload: unknown) {
    const parsed = feeAssignmentSchema.parse(payload);
    const [student, feeStructure] = await Promise.all([
      prisma.student.findFirst({
        where: { schoolId, id: parsed.studentId },
        include: { currentClass: { include: { classLevel: true } } },
      }),
      prisma.feeStructure.findFirst({
        where: { schoolId, id: parsed.feeStructureId, deletedAt: null, isActive: true },
        include: { items: true, academicSession: true, term: true },
      }),
    ]);
    if (!student) throw new NotFoundException("Student not found.");
    if (!feeStructure) throw new NotFoundException("Fee structure not found.");

    const amountDue = toMoney(feeStructure.items.filter((item) => item.isActive).reduce((sum, item) => sum + Number(item.amount), 0));
    const assignment = await prisma.feeAssignment.create({
      data: {
        schoolId,
        studentId: student.id,
        feeStructureId: feeStructure.id,
        academicSessionId: feeStructure.academicSessionId ?? student.currentSessionId ?? null,
        termId: feeStructure.termId ?? null,
        amountDue,
        finalAmount: amountDue,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : feeStructure.dueDate ?? null,
        createdById,
      },
      include: {
        student: { include: { currentClass: { include: { classLevel: true } } } },
        feeStructure: true,
        academicSession: true,
        term: true,
        invoice: true,
      },
    });

    await this.audit(schoolId, createdById, "CREATE", "FeeAssignment", assignment.id, {
      studentId: student.id,
      feeStructureId: feeStructure.id,
      amountDue,
    });
    return this.mapFeeAssignment(assignment);
  }

  async assignFeeToClass(schoolId: string, createdById: string, payload: unknown) {
    const parsed = bulkFeeAssignmentSchema.parse(payload);
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { schoolId, id: parsed.feeStructureId, deletedAt: null, isActive: true },
      include: { items: true },
    });
    if (!feeStructure) throw new NotFoundException("Fee structure not found.");

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        currentClassId: parsed.classId,
        status: "ACTIVE",
        ...(parsed.studentIds?.length ? { id: { in: parsed.studentIds } } : {}),
      },
      include: { currentClass: { include: { classLevel: true } } },
    });
    const amountDue = toMoney(feeStructure.items.filter((item) => item.isActive).reduce((sum, item) => sum + Number(item.amount), 0));
    const createdAssignments: FeeAssignmentView[] = [];

    for (const student of students) {
      const exists = await prisma.feeAssignment.findFirst({
        where: {
          schoolId,
          studentId: student.id,
          feeStructureId: feeStructure.id,
          status: { not: "CANCELLED" },
        },
      });
      if (exists) continue;
      const assignment = await prisma.feeAssignment.create({
        data: {
          schoolId,
          studentId: student.id,
          feeStructureId: feeStructure.id,
          academicSessionId: feeStructure.academicSessionId ?? student.currentSessionId ?? null,
          termId: feeStructure.termId ?? null,
          amountDue,
          finalAmount: amountDue,
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : feeStructure.dueDate ?? null,
          createdById,
        },
        include: {
          student: { include: { currentClass: { include: { classLevel: true } } } },
          feeStructure: true,
          academicSession: true,
          term: true,
          invoice: true,
        },
      });
      createdAssignments.push(this.mapFeeAssignment(assignment));
    }

    await this.audit(schoolId, createdById, "CREATE", "FeeAssignment", parsed.classId, {
      classId: parsed.classId,
      feeStructureId: parsed.feeStructureId,
      created: createdAssignments.length,
    });
    return createdAssignments;
  }

  async applyFeeAssignmentDiscount(schoolId: string, assignmentId: string, actorId: string, payload: unknown) {
    const parsed = feeAssignmentDiscountSchema.parse(payload);
    const assignment = await prisma.feeAssignment.findFirst({
      where: { schoolId, id: assignmentId },
      include: { invoice: true, feeStructure: true },
    });
    if (!assignment) throw new NotFoundException("Fee assignment not found.");

    const discountAmount =
      parsed.discountType === "PERCENTAGE"
        ? toMoney((Number(assignment.amountDue) * parsed.value) / 100)
        : toMoney(parsed.value);
    const finalAmount = toMoney(Math.max(Number(assignment.amountDue) - discountAmount, 0));

    const updated = await prisma.feeAssignment.update({
      where: { id: assignmentId },
      data: {
        discount: discountAmount,
        finalAmount,
        discountReason: parsed.reason,
        approvalStatus: parsed.approvalStatus || (parsed.discountType === "PERCENTAGE" && parsed.value > 20 ? "PENDING_APPROVAL" : "APPROVED"),
      },
      include: {
        student: { include: { currentClass: { include: { classLevel: true } } } },
        feeStructure: true,
        academicSession: true,
        term: true,
        invoice: true,
      },
    });

    if (assignment.invoiceId) {
      const currentInvoice = assignment.invoice;
      if (currentInvoice) {
        const nextTotal = toMoney(Number(currentInvoice.total) - discountAmount);
        const nextBalance = toMoney(Math.max(Number(currentInvoice.balance) - discountAmount, 0));
        await prisma.invoice.update({
          where: { id: currentInvoice.id },
          data: {
            discount: toMoney(Number(currentInvoice.discount) + discountAmount),
            total: nextTotal,
            balance: nextBalance,
            status: getInvoiceStatus(nextTotal, nextBalance, currentInvoice.dueOn),
          },
        });
      }
    }

    await this.audit(
      schoolId,
      actorId,
      "APPROVE",
      "FeeAssignment",
      assignmentId,
      { discountAmount, reason: parsed.reason },
      {
        oldValue: { discount: Number(assignment.discount), finalAmount: Number(assignment.finalAmount) },
        newValue: { discount: discountAmount, finalAmount },
      },
    );
    return this.mapFeeAssignment(updated);
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
    if (!parsed.studentId) throw new BadRequestException("studentId is required.");
    const student = await prisma.student.findFirst({ where: { schoolId, id: parsed.studentId }, include: { currentClass: true } });
    if (!student) throw new NotFoundException("Student not found.");

    const invoice = await prisma.invoice.create({
      data: {
        schoolId,
        studentId: parsed.studentId,
        classId: student.currentClassId ?? null,
        academicSessionId: student.currentSessionId ?? null,
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
      include: {
        student: { include: { currentClass: { include: { classLevel: true } } } },
        classRoom: { include: { classLevel: true } },
        academicSession: true,
        term: true,
        payments: true,
        receipts: true,
      }
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
          classId: student.currentClassId ?? null,
          academicSessionId: student.currentSessionId ?? null,
          termId: structure.termId ?? null,
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
        include: {
          student: { include: { currentClass: { include: { classLevel: true } } } },
          classRoom: { include: { classLevel: true } },
          academicSession: true,
          term: true,
          payments: true,
          receipts: true,
        }
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

    const invoice = await this.ensureInvoiceForPayment(schoolId, parsed.invoiceId, session);
    if (parsed.amount > Number(invoice.balance) && !parsed.allowOverpayment) {
      throw new BadRequestException("Payment amount exceeds the outstanding balance. Re-submit with overpayment confirmation if intentional.");
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
    if (parsed.amount > Number(invoice.balance) && !parsed.allowOverpayment) {
      throw new BadRequestException("Payment amount exceeds the outstanding balance. Re-submit with overpayment confirmation if intentional.");
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
        receiptNumber: await this.nextReceiptNumber(schoolId, payment.invoice.termId ?? undefined),
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
    const payments = await prisma.payment.findMany({
      where: { schoolId },
      include: {
        student: { include: { currentClass: { include: { classLevel: true } } } },
        invoice: {
          include: {
            academicSession: true,
            term: true,
            classRoom: { include: { classLevel: true } },
          },
        },
        receipts: true,
        recordedBy: true,
      },
      orderBy: { paidAt: "desc" },
    });
    return payments.map((payment) => this.mapPayment(payment));
  }

  async listInstallmentPlans(schoolId: string): Promise<InstallmentPlanView[]> {
    const plans = await prisma.installmentPlan.findMany({
      where: { schoolId },
      include: {
        student: { include: { currentClass: { include: { classLevel: true } } } },
        invoice: {
          include: {
            academicSession: true,
            term: true,
            classRoom: { include: { classLevel: true } },
          },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" }
    });
    return plans.map((plan) => this.mapInstallmentPlan(plan));
  }

  async getStudentFinanceLedger(schoolId: string, studentId: string): Promise<StudentFinanceLedgerView> {
    const student = await prisma.student.findFirst({
      where: { schoolId, id: studentId },
      include: {
        currentClass: { include: { classLevel: true } },
        currentSession: true,
        guardians: { include: { guardian: true } },
      },
    });
    if (!student) throw new NotFoundException("Student not found.");

    const [invoicesRaw, paymentsRaw, plansRaw] = await Promise.all([
      prisma.invoice.findMany({
        where: { schoolId, studentId },
        include: {
          student: { include: { currentClass: { include: { classLevel: true } } } },
          classRoom: { include: { classLevel: true } },
          academicSession: true,
          term: true,
          payments: { orderBy: { paidAt: "desc" } },
          receipts: true,
          adjustments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { issuedOn: "desc" },
      }),
      prisma.payment.findMany({
        where: { schoolId, studentId },
        include: {
          student: { include: { currentClass: { include: { classLevel: true } } } },
          invoice: {
            include: {
              academicSession: true,
              term: true,
              classRoom: { include: { classLevel: true } },
            },
          },
          receipts: true,
          recordedBy: true,
        },
        orderBy: { paidAt: "desc" },
      }),
      prisma.installmentPlan.findMany({
        where: { schoolId, studentId },
        include: {
          student: { include: { currentClass: { include: { classLevel: true } } } },
          invoice: {
            include: {
              academicSession: true,
              term: true,
              classRoom: { include: { classLevel: true } },
            },
          },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const invoices = invoicesRaw.map((invoice) => this.mapInvoice(invoice));
    const payments = paymentsRaw.map((payment) => this.mapPayment(payment));
    const installmentPlans = plansRaw.map((plan) => this.mapInstallmentPlan(plan));
    const adjustments = invoicesRaw.flatMap((invoice) =>
      invoice.adjustments.map((adjustment) => ({
        id: adjustment.id,
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: Number(adjustment.value),
        amount: Number(adjustment.amount),
        reason: adjustment.reason,
        createdAt: adjustment.createdAt.toISOString(),
        invoiceNumber: invoice.invoiceNumber,
        session: invoice.academicSession?.name ?? undefined,
        term: invoice.term?.name ?? undefined,
      })),
    );

    const primaryGuardian =
      student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian;

    return {
      studentId: student.id,
      studentName: studentName(student),
      admissionNumber: student.admissionNumber,
      status: student.status,
      className: className(student.currentClass),
      classLevel: student.currentClass?.classLevel?.name ?? undefined,
      currentSession: student.currentSession?.name ?? undefined,
      guardianName: primaryGuardian ? `${primaryGuardian.firstName} ${primaryGuardian.lastName}` : undefined,
      guardianPhone: primaryGuardian?.phone ?? undefined,
      guardianEmail: primaryGuardian?.email ?? undefined,
      metrics: {
        totalBilled: invoices.reduce((sum, item) => sum + item.total, 0),
        totalPaid: invoices.reduce((sum, item) => sum + (item.paid ?? 0), 0),
        outstanding: invoices.reduce((sum, item) => sum + item.balance, 0),
        overdueInvoices: invoices.filter((item) => item.status === "OVERDUE").length,
        activeInstallmentPlans: installmentPlans.filter((item) => item.status !== "COMPLETED").length,
        lastPaymentAt: payments.find((item) => item.paidAt)?.paidAt,
      },
      invoices,
      payments,
      installmentPlans,
      adjustments,
    };
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

  async reversePayment(schoolId: string, actorId: string, paymentId: string, payload: unknown, ipAddress?: string) {
    const parsed = reversePaymentSchema.parse(payload);
    await this.assertPassword(actorId, parsed.password);
    const payment = await prisma.payment.findFirst({
      where: { schoolId, id: paymentId },
      include: { invoice: true, allocations: true, student: true },
    });
    if (!payment || !payment.invoice) throw new NotFoundException("Payment not found.");
    if (payment.isReversed || payment.status === "REVERSED") {
      throw new BadRequestException("Payment has already been reversed.");
    }
    const currentBalance = Number(payment.invoice.balance);
    const restoredBalance = toMoney(currentBalance + Number(payment.amount));

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "REVERSED",
          isReversed: true,
          reversalReason: parsed.reason,
          reversedById: actorId,
          reversedAt: new Date(),
          gatewayStatus: payment.gateway ? "REVERSED" : payment.gatewayStatus,
        },
      }),
      prisma.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          balance: restoredBalance,
          status: getInvoiceStatus(Number(payment.invoice.total), restoredBalance, payment.invoice.dueOn),
        },
      }),
      prisma.invoiceAdjustment.create({
        data: {
          schoolId,
          invoiceId: payment.invoice.id,
          appliedById: actorId,
          approvedById: actorId,
          type: "REVERSAL",
          valueType: "FIXED",
          value: Number(payment.amount),
          amount: Number(payment.amount),
          reason: parsed.reason,
          metadata: jsonValue({ paymentId: payment.id, paymentReference: payment.reference }),
        },
      }),
    ]);

    await this.audit(
      schoolId,
      actorId,
      "UPDATE",
      "Payment",
      payment.id,
      { reversed: true, reason: parsed.reason },
      {
        oldValue: {
          status: payment.status,
          isReversed: payment.isReversed,
          balance: currentBalance,
        },
        newValue: {
          status: "REVERSED",
          isReversed: true,
          balance: restoredBalance,
        },
        ipAddress,
      },
    );
    return { ok: true, paymentId: payment.id, invoiceId: payment.invoice.id };
  }

  async buildReceiptPdf(schoolId: string, paymentId: string) {
    const payment = await prisma.payment.findFirst({
      where: { schoolId, id: paymentId },
      include: {
        student: { include: { currentClass: true } },
        invoice: { include: { items: true, term: true, academicSession: true } },
        recordedBy: true,
        receipts: true,
      },
    });
    if (!payment?.invoice) throw new NotFoundException("Payment not found.");
    const receipt = payment.receipts[0] ?? await this.generateReceipt(schoolId, payment.recordedById ?? undefined, payment.id);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found.");

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    page.drawRectangle({ x: 32, y: height - 110, width: width - 64, height: 78, color: rgb(0.96, 0.98, 0.97) });
    page.drawText(school.name, { x: 48, y: height - 62, size: 20, font: bold, color: rgb(0.07, 0.13, 0.09) });
    page.drawText([school.address, school.city, school.state].filter(Boolean).join(", ") || "School address", {
      x: 48, y: height - 82, size: 10, font: regular, color: rgb(0.33, 0.39, 0.36),
    });
    page.drawText("OFFICIAL RECEIPT", { x: 48, y: height - 136, size: 16, font: bold, color: rgb(0.07, 0.13, 0.09) });

    const topMetaY = height - 170;
    const lineGap = 18;
    const metaRows = [
      ["Receipt Number", typeof receipt === "string" ? receipt : receipt.receiptNumber],
      ["Date", new Date(payment.paidAt ?? new Date()).toLocaleDateString("en-NG")],
      ["Student", studentName(payment.student)],
      ["Class", className(payment.student.currentClass)],
      ["Session / Term", `${payment.invoice.academicSession?.name ?? "-"} / ${payment.invoice.term?.name ?? "-"}`],
      ["Reference", payment.reference],
      ["Payment Method", payment.method],
      ["Cashier", payment.recordedBy ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}` : "Bursary Desk"],
    ];
    metaRows.forEach(([label, value], index) => {
      const y = topMetaY - index * lineGap;
      page.drawText(`${label}:`, { x: 48, y, size: 10, font: bold, color: rgb(0.25, 0.3, 0.28) });
      page.drawText(String(value), { x: 170, y, size: 10, font: regular, color: rgb(0.07, 0.13, 0.09) });
    });

    const tableTop = height - 360;
    page.drawRectangle({ x: 48, y: tableTop, width: width - 96, height: 24, color: rgb(0.11, 0.2, 0.14) });
    page.drawText("Fee description", { x: 56, y: tableTop + 8, size: 10, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Amount", { x: width - 140, y: tableTop + 8, size: 10, font: bold, color: rgb(1, 1, 1) });

    payment.invoice.items.forEach((item, index) => {
      const y = tableTop - 26 - index * 20;
      page.drawText(item.description, { x: 56, y, size: 10, font: regular, color: rgb(0.07, 0.13, 0.09) });
      page.drawText(formatMoneyForAudit(Number(item.amount), payment.currency), { x: width - 180, y, size: 10, font: regular, color: rgb(0.07, 0.13, 0.09) });
    });

    const amountY = tableTop - 26 - payment.invoice.items.length * 20 - 24;
    page.drawText(`Amount Paid: ${formatMoneyForAudit(Number(payment.amount), payment.currency)}`, {
      x: 48, y: amountY, size: 14, font: bold, color: rgb(0.07, 0.13, 0.09),
    });
    page.drawText(`Outstanding Balance: ${formatMoneyForAudit(Number(payment.invoice.balance), payment.currency)}`, {
      x: 48, y: amountY - 24, size: 11, font: regular, color: rgb(0.57, 0.11, 0.11),
    });
    page.drawRectangle({ x: width - 180, y: amountY - 46, width: 116, height: 48, borderWidth: 1, borderColor: rgb(0.82, 0.84, 0.83) });
    page.drawText("Official Stamp", { x: width - 155, y: amountY - 22, size: 10, font: regular, color: rgb(0.45, 0.49, 0.47) });
    page.drawText("This receipt is computer-generated and valid without a signature.", {
      x: 48, y: 72, size: 9, font: regular, color: rgb(0.42, 0.46, 0.44),
    });

    return Buffer.from(await pdf.save());
  }

  async listExpenditures(schoolId: string): Promise<ExpenditureView[]> {
    const expenses = await prisma.expense.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { expenseDate: "desc" },
    });
    return expenses.map((expense) => ({
      id: expense.id,
      category: expense.category,
      description: expense.title,
      amount: Number(expense.amount),
      paymentMethod: expense.paymentMethod ?? undefined,
      paidTo: expense.paidTo ?? undefined,
      receiptUrl: expense.receiptUrl ?? undefined,
      recordedById: expense.recordedById ?? undefined,
      expenditureDate: expense.expenseDate.toISOString(),
      notes: expense.notes ?? undefined,
    }));
  }

  async createExpenditure(schoolId: string, actorId: string, payload: unknown, ipAddress?: string) {
    const parsed = expenditureSchema.parse(payload);
    const expense = await prisma.expense.create({
      data: {
        schoolId,
        title: parsed.description,
        category: parsed.category,
        amount: parsed.amount,
        paymentMethod: parsed.paymentMethod,
        paidTo: parsed.paidTo,
        receiptUrl: parsed.receiptUrl || null,
        recordedById: actorId,
        expenseDate: new Date(parsed.expenditureDate),
        notes: parsed.notes || null,
      },
    });
    await this.audit(
      schoolId,
      actorId,
      "CREATE",
      "Expense",
      expense.id,
      { category: expense.category, amount: Number(expense.amount) },
      { newValue: { description: expense.title, paidTo: expense.paidTo }, ipAddress },
    );
    return this.listExpenditures(schoolId);
  }

  async listPayrollRuns(schoolId: string): Promise<PayrollRunView[]> {
    const runs = await prisma.payrollRun.findMany({
      where: { schoolId },
      include: {
        academicSession: true,
        items: { include: { staff: { include: { user: true, department: true } } } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return runs.map((run) => this.mapPayrollRun(run));
  }

  async listPayrollStaffRoster(schoolId: string): Promise<PayrollStaffMemberView[]> {
    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        schoolId,
        user: {
          deletedAt: null,
        },
      },
      include: {
        user: true,
        department: true,
        payrollItems: {
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          include: { payrollRun: true },
        },
      },
      orderBy: [{ department: { name: "asc" } }, { employeeNo: "asc" }],
    });

    return staffProfiles.map((profile) => {
      const latestPayroll = profile.payrollItems[0];
      return {
        id: profile.id,
        userId: profile.userId,
        staffName: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
        employeeNo: profile.employeeNo,
        departmentName: profile.department?.name ?? undefined,
        designation: profile.designation,
        employmentType: profile.employmentType ?? undefined,
        salaryBand: profile.salaryBand ?? undefined,
        accountStatus: profile.user.accountStatus,
        isActive: profile.user.isActive,
        lastBasicSalary: latestPayroll ? Number(latestPayroll.basicSalary) : undefined,
        lastNetSalary: latestPayroll ? Number(latestPayroll.netSalary) : undefined,
        lastPayrollMonth: latestPayroll?.payrollRun.month,
        lastPayrollYear: latestPayroll?.payrollRun.year,
      };
    });
  }

  async getPayrollWorkspace(schoolId: string): Promise<PayrollWorkspaceView> {
    const [currentSession, sessions, staff, payrollRuns] = await Promise.all([
      prisma.academicSession.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true, name: true },
      }),
      prisma.academicSession.findMany({
        where: { schoolId },
        select: { id: true, name: true, isCurrent: true, startDate: true },
        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
      }),
      this.listPayrollStaffRoster(schoolId),
      this.listPayrollRuns(schoolId),
    ]);

    return {
      currentSessionId: currentSession?.id,
      currentSessionName: currentSession?.name,
      sessions: sessions.map((session) => ({ id: session.id, name: session.name })),
      staff,
      payrollRuns,
    };
  }

  async processPayrollRun(schoolId: string, actorId: string, payload: unknown, ipAddress?: string) {
    const normalized =
      payload && typeof payload === "object" && !Array.isArray(payload) && "staffItemsJson" in payload
        ? {
            ...payload,
            staffItems: (() => {
              const raw = (payload as Record<string, unknown>).staffItemsJson;
              if (typeof raw !== "string" || !raw.trim()) return [];
              try {
                return JSON.parse(raw);
              } catch {
                return [];
              }
            })(),
          }
        : payload;
    const parsed = payrollRunSchema.parse(normalized);
    const existing = await prisma.payrollRun.findFirst({
      where: { schoolId, month: parsed.month, year: parsed.year },
    });
    if (existing?.status === "PUBLISHED") {
      throw new BadRequestException("Payroll has already been published for that month.");
    }

    if (existing) {
      await prisma.payrollItem.deleteMany({ where: { payrollRunId: existing.id } });
    }

    const run = existing
      ? await prisma.payrollRun.update({
          where: { id: existing.id },
          data: {
            academicSessionId: parsed.academicSessionId || null,
            status: "PROCESSED",
            processedById: actorId,
            processedAt: new Date(),
          },
        })
      : await prisma.payrollRun.create({
          data: {
            schoolId,
            academicSessionId: parsed.academicSessionId || null,
            month: parsed.month,
            year: parsed.year,
            status: "PROCESSED",
            processedById: actorId,
            processedAt: new Date(),
          },
        });

    for (const item of parsed.staffItems) {
      const allowances = (item.allowances ?? {}) as Record<string, number>;
      const deductions = (item.deductions ?? {}) as Record<string, number>;
      const netSalary = toMoney(item.basicSalary + sumJsonAmounts(allowances) - sumJsonAmounts(deductions));
      await prisma.payrollItem.create({
        data: {
          schoolId,
          payrollRunId: run.id,
          staffId: item.staffId,
          basicSalary: item.basicSalary,
          allowances: allowances as Prisma.InputJsonValue,
          deductions: deductions as Prisma.InputJsonValue,
          netSalary,
        },
      });
    }

    await this.audit(
      schoolId,
      actorId,
      "CREATE",
      "PayrollRun",
      run.id,
      { month: parsed.month, year: parsed.year, staffCount: parsed.staffItems.length },
      { ipAddress },
    );
    return (await this.listPayrollRuns(schoolId)).find((item) => item.id === run.id);
  }

  async getPayrollRunItems(schoolId: string, payrollRunId: string): Promise<PayrollItemView[]> {
    const run = await prisma.payrollRun.findFirst({
      where: { schoolId, id: payrollRunId },
      include: { items: { include: { staff: { include: { user: true } } } } },
    });
    if (!run) throw new NotFoundException("Payroll run not found.");
    return run.items.map((item) => this.mapPayrollItem(item));
  }

  async publishPayrollRun(schoolId: string, actorId: string, payrollRunId: string, payload: unknown, ipAddress?: string) {
    const parsed = sensitiveActionSchema.parse(payload);
    await this.assertPassword(actorId, parsed.password);
    const run = await prisma.payrollRun.findFirst({
      where: { schoolId, id: payrollRunId },
      include: { items: { include: { staff: { include: { user: true } } } }, academicSession: true },
    });
    if (!run) throw new NotFoundException("Payroll run not found.");
    if (run.status === "PUBLISHED") {
      throw new BadRequestException("Payroll has already been published.");
    }
    await prisma.$transaction([
      prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: { status: "PUBLISHED", publishedAt: new Date(), processedById: actorId, processedAt: new Date() },
      }),
      prisma.payrollItem.updateMany({
        where: { payrollRunId },
        data: { payslipSent: true, paidAt: new Date() },
      }),
    ]);
    await this.notifyStaffPayroll(schoolId, run.items.map((item) => item.staff), run.month, run.year);
    await this.audit(
      schoolId,
      actorId,
      "APPROVE",
      "PayrollRun",
      payrollRunId,
      { published: true, staffCount: run.items.length },
      { ipAddress, oldValue: { status: run.status }, newValue: { status: "PUBLISHED" } },
    );
    return (await this.listPayrollRuns(schoolId)).find((item) => item.id === payrollRunId);
  }

  async listFinanceAuditLogs(schoolId: string): Promise<AuditLogView[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        schoolId,
        entityType: {
          in: ["FeeStructure", "FeeAssignment", "Invoice", "Payment", "Receipt", "InvoiceAdjustment", "InstallmentPlan", "Expense", "PayrollRun"],
        },
      },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return logs.map((log) => ({
      id: log.id,
      userId: log.actorId ?? undefined,
      userName: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : undefined,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValue: (log.oldValue as Record<string, unknown> | null | undefined) ?? undefined,
      newValue: (log.newValue as Record<string, unknown> | null | undefined) ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      detail: JSON.stringify(log.metadata ?? {}),
      timestamp: log.createdAt.toISOString(),
    }));
  }

  async getFinanceSettings(schoolId: string): Promise<FinanceSettingsView> {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException("School not found.");
    const config = await prisma.configurationItem.findFirst({
      where: { schoolId, resource: "finance", code: "BURSARY_SETTINGS", deletedAt: null },
    });
    const data = (config?.data ?? {}) as Record<string, unknown>;
    const contextConfig = await prisma.configurationItem.findFirst({
      where: { schoolId, resource: "academic-context", code: "CURRENT_ACADEMIC_CONTEXT", deletedAt: null },
    });
    const contextData = (contextConfig?.data ?? {}) as Record<string, unknown>;
    return {
      currency: school.currency,
      paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods.map(String) : ["CASH", "BANK_TRANSFER", "POS", "ONLINE"],
      allowOverpayment: Boolean(data.allowOverpayment),
      reminderScheduleDays: Array.isArray(data.reminderScheduleDays) ? data.reminderScheduleDays.map((item) => Number(item)) : [3, 0],
      receiptPrefix: typeof data.receiptPrefix === "string" ? data.receiptPrefix : "RCT",
      sessionConfig: {
        currentSession: typeof contextData.academicSessionName === "string" ? contextData.academicSessionName : undefined,
        currentTerm: typeof contextData.activeTermName === "string" ? contextData.activeTermName : undefined,
      },
    };
  }

  async updateFinanceSettings(schoolId: string, actorId: string, payload: unknown, ipAddress?: string) {
    const normalized =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? {
            ...payload,
            paymentMethods:
              Array.isArray((payload as Record<string, unknown>).paymentMethods)
                ? (payload as Record<string, unknown>).paymentMethods
                : String((payload as Record<string, unknown>).paymentMethodsCsv ?? "")
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
            reminderScheduleDays:
              Array.isArray((payload as Record<string, unknown>).reminderScheduleDays)
                ? (payload as Record<string, unknown>).reminderScheduleDays
                : String((payload as Record<string, unknown>).reminderScheduleCsv ?? "")
                    .split(",")
                    .map((item) => Number(item.trim()))
                    .filter((item) => Number.isFinite(item)),
          }
        : payload;
    const parsed = financeSettingsSchema.parse(normalized);
    const existing = await this.getFinanceSettings(schoolId);
    const config = await prisma.configurationItem.upsert({
      where: {
        schoolId_resource_code: {
          schoolId,
          resource: "finance",
          code: "BURSARY_SETTINGS",
        },
      },
      update: {
        name: "Bursary Settings",
        description: "Accountant and bursary operational settings",
        data: parsed as Prisma.InputJsonValue,
        status: "ACTIVE",
      },
      create: {
        schoolId,
        resource: "finance",
        name: "Bursary Settings",
        code: "BURSARY_SETTINGS",
        description: "Accountant and bursary operational settings",
        data: parsed as Prisma.InputJsonValue,
        status: "ACTIVE",
      },
    });
    await this.audit(
      schoolId,
      actorId,
      "SETTINGS_UPDATE",
      "FinanceSettings",
      config.id,
      { updated: true },
      { oldValue: existing as unknown as Record<string, unknown>, newValue: parsed as unknown as Record<string, unknown>, ipAddress },
    );
    return this.getFinanceSettings(schoolId);
  }

  async sendInvoiceReminder(schoolId: string, actorId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { schoolId, id: invoiceId },
      include: { student: true, term: true, academicSession: true },
    });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    await this.notifyStudentGuardians(
      schoolId,
      invoice.studentId,
      "Invoice reminder",
      `${invoice.invoiceNumber} for ${invoice.academicSession?.name ?? "current session"} ${invoice.term?.name ?? ""} is due on ${invoice.dueOn.toLocaleDateString("en-NG")}. Outstanding balance: ${formatMoneyForAudit(Number(invoice.balance))}.`,
    );
    await this.audit(schoolId, actorId, "UPDATE", "Invoice", invoiceId, { reminderSent: true });
    return { ok: true, sentAt: new Date().toISOString() };
  }

  async getFeeCollectionReport(schoolId: string) {
    const payments = await this.listPayments(schoolId);
    const totalCollected = payments.filter((item) => item.status === "SUCCESS").reduce((sum, item) => sum + item.amount, 0);
    const byMethod = Array.from(
      payments.reduce((map, item) => {
        map.set(item.method, (map.get(item.method) ?? 0) + item.amount);
        return map;
      }, new Map<string, number>()),
    ).map(([method, amount]) => ({ method, amount }));
    return { totalCollected, count: payments.length, byMethod, payments };
  }

  async getDefaultersReport(schoolId: string) {
    const invoices = (await this.listInvoices(schoolId)).filter((invoice) => invoice.balance > 0);
    const grouped = new Map<string, { studentId?: string; studentName: string; className: string; billed: number; paid: number; balance: number; lastPaymentAt?: string }>();
    for (const invoice of invoices) {
      const key = invoice.studentId ?? invoice.studentName;
      const current = grouped.get(key) ?? {
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        className: invoice.className,
        billed: 0,
        paid: 0,
        balance: 0,
        lastPaymentAt: invoice.lastPaymentAt,
      };
      current.billed += invoice.total;
      current.paid += invoice.paid ?? 0;
      current.balance += invoice.balance;
      current.lastPaymentAt = current.lastPaymentAt ?? invoice.lastPaymentAt;
      grouped.set(key, current);
    }
    return Array.from(grouped.values()).sort((left, right) => right.balance - left.balance);
  }

  async getPayrollReport(schoolId: string) {
    const runs = await this.listPayrollRuns(schoolId);
    return {
      totalRuns: runs.length,
      totalNetSalary: runs.reduce((sum, item) => sum + item.totalNetSalary, 0),
      runs,
    };
  }

  async getExpenditureReport(schoolId: string) {
    const expenditures = await this.listExpenditures(schoolId);
    const byCategory = Array.from(
      expenditures.reduce((map, item) => {
        map.set(item.category, (map.get(item.category) ?? 0) + item.amount);
        return map;
      }, new Map<string, number>()),
    ).map(([category, amount]) => ({ category, amount }));
    return { totalSpent: expenditures.reduce((sum, item) => sum + item.amount, 0), byCategory, expenditures };
  }

  async getIncomeVsExpenditureReport(schoolId: string) {
    const [feeCollection, expenditure] = await Promise.all([
      this.getFeeCollectionReport(schoolId),
      this.getExpenditureReport(schoolId),
    ]);
    return {
      income: feeCollection.totalCollected,
      expenditure: expenditure.totalSpent,
      net: toMoney(feeCollection.totalCollected - expenditure.totalSpent),
      feeCollection,
      expenditureReport: expenditure,
    };
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
    classId?: string | null;
    academicSessionId?: string | null;
    termId?: string | null;
    student: {
      admissionNumber: string;
      firstName: string;
      lastName: string;
      middleName?: string | null;
      currentClass?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    };
    classRoom?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    academicSession?: { name: string } | null;
    term?: { name: string } | null;
    subtotal: unknown;
    discount: unknown;
    fine: unknown;
    total: unknown;
    balance: unknown;
    status: string;
    issuedOn: Date;
    dueOn: Date;
    payments?: Array<{ amount: unknown; status: string; paidAt?: Date | null }>;
    receipts?: Array<{ receiptNumber: string }>;
  }): InvoiceView {
    const paid = (invoice.payments ?? []).filter((payment) => payment.status === "SUCCESS").reduce((sum, payment) => sum + Number(payment.amount), 0);
    const successfulPayments = (invoice.payments ?? []).filter((payment) => payment.status === "SUCCESS");
    const ledgerClass = invoice.classRoom ?? invoice.student.currentClass;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
      studentName: studentName(invoice.student),
      admissionNumber: invoice.student.admissionNumber,
      classId: invoice.classId ?? undefined,
      className: className(ledgerClass),
      classLevel: ledgerClass?.classLevel?.name ?? undefined,
      sessionId: invoice.academicSessionId ?? undefined,
      session: invoice.academicSession?.name ?? undefined,
      termId: invoice.termId ?? undefined,
      term: invoice.term?.name ?? undefined,
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      fine: Number(invoice.fine),
      total: Number(invoice.total),
      paid,
      balance: Number(invoice.balance),
      status: invoice.status,
      issuedOn: invoice.issuedOn.toISOString(),
      dueOn: invoice.dueOn.toISOString(),
      receiptNumber: invoice.receipts?.[0]?.receiptNumber,
      paymentCount: successfulPayments.length,
      lastPaymentAt: successfulPayments.find((payment) => payment.paidAt)?.paidAt?.toISOString(),
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

  private mapFeeAssignment(assignment: {
    id: string;
    studentId: string;
    feeStructureId: string;
    amountDue: unknown;
    discount: unknown;
    finalAmount: unknown;
    dueDate: Date | null;
    status: string;
    discountReason: string | null;
    approvalStatus: string | null;
    createdAt: Date;
    student: {
      admissionNumber: string;
      firstName: string;
      lastName: string;
      middleName?: string | null;
      currentClass?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    };
    feeStructure: { id: string; name: string };
    academicSession?: { name: string } | null;
    term?: { name: string } | null;
    invoice?: { id: string; invoiceNumber: string } | null;
  }): FeeAssignmentView {
    return {
      id: assignment.id,
      studentId: assignment.studentId,
      studentName: studentName(assignment.student),
      admissionNumber: assignment.student.admissionNumber,
      className: assignment.student.currentClass ? className(assignment.student.currentClass) : undefined,
      classLevel: assignment.student.currentClass?.classLevel?.name ?? undefined,
      feeStructureId: assignment.feeStructureId,
      feeStructureName: assignment.feeStructure.name,
      session: assignment.academicSession?.name ?? undefined,
      term: assignment.term?.name ?? undefined,
      amountDue: Number(assignment.amountDue),
      discount: Number(assignment.discount),
      finalAmount: Number(assignment.finalAmount),
      dueDate: assignment.dueDate?.toISOString(),
      status: assignment.status,
      discountReason: assignment.discountReason ?? undefined,
      approvalStatus: assignment.approvalStatus ?? undefined,
      invoiceId: assignment.invoice?.id ?? undefined,
      invoiceNumber: assignment.invoice?.invoiceNumber ?? undefined,
      createdAt: assignment.createdAt.toISOString(),
    };
  }

  private mapPayment(payment: {
    id: string;
    studentId: string;
    invoiceId: string | null;
    reference: string;
    amount: unknown;
    status: string;
    method: string;
    provider: string | null;
    paymentChannel: string | null;
    schoolBankReference: string | null;
    gatewayStatus: string | null;
    paidAt: Date | null;
    student: {
      admissionNumber: string;
      firstName: string;
      lastName: string;
      middleName?: string | null;
      currentClassId?: string | null;
      currentClass?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    };
    invoice?: {
      invoiceNumber: string;
      classId?: string | null;
      termId?: string | null;
      academicSessionId?: string | null;
      academicSession?: { name: string } | null;
      term?: { name: string } | null;
      classRoom?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    } | null;
    receipts: Array<{ receiptNumber: string }>;
    recordedBy?: {
      firstName: string;
      lastName: string;
    } | null;
  }): PaymentView {
    return {
      id: payment.id,
      reference: payment.reference,
      studentId: payment.studentId,
      studentName: studentName(payment.student),
      admissionNumber: payment.student.admissionNumber,
      classId: payment.invoice?.classId ?? payment.student.currentClassId ?? undefined,
      className: payment.invoice?.classRoom ? className(payment.invoice.classRoom) : payment.student.currentClass ? className(payment.student.currentClass) : undefined,
      classLevel: payment.invoice?.classRoom?.classLevel?.name ?? payment.student.currentClass?.classLevel?.name ?? undefined,
      sessionId: payment.invoice?.academicSessionId ?? undefined,
      session: payment.invoice?.academicSession?.name ?? undefined,
      termId: payment.invoice?.termId ?? undefined,
      term: payment.invoice?.term?.name ?? undefined,
      invoiceId: payment.invoiceId ?? undefined,
      invoiceNumber: payment.invoice?.invoiceNumber,
      receiptNumber: payment.receipts[0]?.receiptNumber,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      provider: payment.provider ?? undefined,
      paymentChannel: payment.paymentChannel ?? undefined,
      schoolBankReference: payment.schoolBankReference ?? undefined,
      gatewayStatus: payment.gatewayStatus ?? undefined,
      recordedByName: payment.recordedBy
        ? [payment.recordedBy.firstName, payment.recordedBy.lastName].filter(Boolean).join(" ")
        : undefined,
      paidAt: payment.paidAt?.toISOString(),
    };
  }

  private mapInstallmentPlan(plan: {
    id: string;
    planNumber: string;
    totalAmount: unknown;
    balance: unknown;
    status: string;
    notes?: string | null;
    student: {
      firstName: string;
      lastName: string;
      middleName?: string | null;
      currentClass?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    };
    invoice?: {
      invoiceNumber: string;
      academicSessionId?: string | null;
      termId?: string | null;
      academicSession?: { name: string } | null;
      term?: { name: string } | null;
      classRoom?: { name: string; arm: string | null; classLevel?: { name: string } | null } | null;
    } | null;
    items: Array<{ id: string; dueOn: Date; amount: unknown; paidAmount: unknown; status: string }>;
  }): InstallmentPlanView {
    const ledgerClass = plan.invoice?.classRoom ?? plan.student.currentClass;
    return {
      id: plan.id,
      planNumber: plan.planNumber,
      studentName: studentName(plan.student),
      className: ledgerClass ? className(ledgerClass) : undefined,
      classLevel: ledgerClass?.classLevel?.name ?? undefined,
      sessionId: plan.invoice?.academicSessionId ?? undefined,
      session: plan.invoice?.academicSession?.name ?? undefined,
      termId: plan.invoice?.termId ?? undefined,
      term: plan.invoice?.term?.name ?? undefined,
      invoiceNumber: plan.invoice?.invoiceNumber,
      totalAmount: Number(plan.totalAmount),
      balance: Number(plan.balance),
      status: plan.status,
      notes: plan.notes ?? undefined,
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
    const guardians = await prisma.guardian.findMany({
      where: { schoolId, students: { some: { studentId } }, userId: { not: null } },
      select: { userId: true, email: true, phone: true, canReceiveEmail: true, canReceiveSms: true }
    });
    const records = guardians.flatMap((guardian) => {
      const items: Array<Prisma.NotificationLogCreateManyInput> = [];
      if (guardian.userId) {
        items.push({
          schoolId,
          userId: guardian.userId,
          channel: "IN_APP",
          title,
          body,
          status: "QUEUED",
          sentAt: new Date(),
        });
      }
      if (guardian.canReceiveEmail && guardian.email) {
        items.push({
          schoolId,
          userId: guardian.userId ?? undefined,
          channel: "EMAIL",
          title,
          body,
          status: "QUEUED",
          metadata: { email: guardian.email } as Prisma.InputJsonValue,
          sentAt: new Date(),
        });
      }
      if (guardian.canReceiveSms && guardian.phone) {
        items.push({
          schoolId,
          userId: guardian.userId ?? undefined,
          channel: "SMS",
          title,
          body,
          status: "QUEUED",
          metadata: { phone: guardian.phone } as Prisma.InputJsonValue,
          sentAt: new Date(),
        });
      }
      return items;
    });
    if (records.length) {
      await prisma.notificationLog.createMany({ data: records });
    }
  }

  private async notifyStaffPayroll(schoolId: string, staffProfiles: Array<{ user?: { id: string } | null }>, month: number, year: number) {
    const userIds = staffProfiles.map((item) => item.user?.id).filter((value): value is string => Boolean(value));
    if (!userIds.length) return;
    await prisma.notificationLog.createMany({
      data: userIds.map((userId) => ({
        schoolId,
        userId,
        channel: "IN_APP",
        title: "Payroll published",
        body: `Your payslip summary for ${month}/${year} is ready.`,
        status: "QUEUED",
        sentAt: new Date(),
      })),
    });
  }

  private async assertPassword(actorId: string, password: string) {
    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || !verifyPassword(password, actor.passwordHash)) {
      throw new ForbiddenException("Password confirmation failed.");
    }
  }

  private async nextReceiptNumber(schoolId: string, termId?: string) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const settings = await this.getFinanceSettings(schoolId);
    const year = new Date().getFullYear();
    const term = termId
      ? await prisma.term.findFirst({ where: { schoolId, id: termId } })
      : await prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
    const termCode = term?.order ? `T${term.order}` : "T1";
    const count = await prisma.receipt.count({
      where: {
        schoolId,
        receiptNumber: { startsWith: `${settings.receiptPrefix}-${year}-${termCode}-` },
      },
    });
    const sequence = String(count + 1).padStart(5, "0");
    return `${settings.receiptPrefix}-${year}-${termCode}-${sequence}`;
  }

  private mapPayrollItem(item: {
    id: string;
    staffId: string;
    basicSalary: unknown;
    allowances: Prisma.JsonValue | null;
    deductions: Prisma.JsonValue | null;
    netSalary: unknown;
    payslipSent: boolean;
    paidAt: Date | null;
    staff: {
      employeeNo: string;
      designation?: string;
      department?: { name: string } | null;
      user: { firstName: string; lastName: string };
    };
  }): PayrollItemView {
    const allowances = (item.allowances && typeof item.allowances === "object" && !Array.isArray(item.allowances)
      ? item.allowances
      : {}) as Record<string, number>;
    const deductions = (item.deductions && typeof item.deductions === "object" && !Array.isArray(item.deductions)
      ? item.deductions
      : {}) as Record<string, number>;
    return {
      id: item.id,
      staffId: item.staffId,
      staffName: `${item.staff.user.firstName} ${item.staff.user.lastName}`,
      employeeNo: item.staff.employeeNo,
      designation: item.staff.designation,
      departmentName: item.staff.department?.name ?? undefined,
      basicSalary: Number(item.basicSalary),
      allowances,
      deductions,
      netSalary: Number(item.netSalary),
      payslipSent: item.payslipSent,
      paidAt: item.paidAt?.toISOString(),
    };
  }

  private mapPayrollRun(run: {
    id: string;
    month: number;
    year: number;
    status: string;
    processedById: string | null;
    processedAt: Date | null;
    publishedAt: Date | null;
    academicSession?: { name: string } | null;
    items: Array<{
      id: string;
      staffId: string;
      basicSalary: unknown;
      allowances: Prisma.JsonValue | null;
      deductions: Prisma.JsonValue | null;
      netSalary: unknown;
      payslipSent: boolean;
      paidAt: Date | null;
      staff: {
        employeeNo: string;
        designation: string;
        department?: { name: string } | null;
        user: { firstName: string; lastName: string };
      };
    }>;
  }): PayrollRunView {
    const items = run.items.map((item) => this.mapPayrollItem(item));
    return {
      id: run.id,
      session: run.academicSession?.name ?? undefined,
      month: run.month,
      year: run.year,
      status: run.status,
      processedById: run.processedById ?? undefined,
      processedAt: run.processedAt?.toISOString(),
      publishedAt: run.publishedAt?.toISOString(),
      totalNetSalary: items.reduce((sum, item) => sum + item.netSalary, 0),
      staffCount: items.length,
      items,
    };
  }

  private async audit(
    schoolId: string,
    actorId: string | undefined,
    action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "APPROVE" | "REJECT" | "PAYMENT" | "SETTINGS_UPDATE",
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    options?: {
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      ipAddress?: string;
    },
  ) {
    await prisma.auditLog.create({
      data: {
        schoolId,
        actorId,
        action,
        entityType,
        entityId,
        oldValue: options?.oldValue ? (options.oldValue as Prisma.InputJsonValue) : undefined,
        newValue: options?.newValue ? (options.newValue as Prisma.InputJsonValue) : undefined,
        ipAddress: options?.ipAddress,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
