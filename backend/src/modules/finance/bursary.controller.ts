import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Request, Response } from "express";

import { hasRole } from "../../../../src/lib/auth/roles";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { formatCurrency } from "../../../../src/lib/utils/formatters";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { PaymentRecordingRateLimitGuard } from "../../common/guards/payment-recording-rate-limit.guard";
import { FinanceService } from "./finance.service";

const bursaryRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "ADMIN_OFFICER", "BURSAR", "ACCOUNTANT", "ACCOUNT_OFFICER"] as const;
const bursaryOversightRoles = [...bursaryRoles, "PRINCIPAL"] as const;

function assertBursaryRole(session: SessionPayload) {
  if (!hasRole(session.role, [...bursaryRoles])) {
    throw new ForbiddenException("This action belongs to the bursary team.");
  }
}

function csv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}

async function buildTabularPdf(title: string, headers: string[], rows: string[][]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  page.drawText(title, { x: 36, y: height - 42, size: 18, font: bold, color: rgb(0.07, 0.13, 0.09) });
  const usableWidth = width - 72;
  const colWidth = usableWidth / headers.length;
  let y = height - 78;

  headers.forEach((header, index) => {
    page.drawText(header, { x: 36 + index * colWidth, y, size: 9, font: bold, color: rgb(0.25, 0.3, 0.28) });
  });

  y -= 18;
  rows.slice(0, 24).forEach((row) => {
    row.forEach((cell, index) => {
      page.drawText(String(cell).slice(0, 28), { x: 36 + index * colWidth, y, size: 8, font: regular, color: rgb(0.07, 0.13, 0.09) });
    });
    y -= 16;
  });

  return Buffer.from(await pdf.save());
}

@ApiTags("bursary")
@Controller("v1/bursary")
@UseGuards(SessionGuard, RolesGuard)
export class BursaryController {
  constructor(private readonly financeService: FinanceService) {}

  @Get("dashboard")
  @Roles(...bursaryOversightRoles)
  async dashboard(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.getFinanceDashboard(session.schoolId) };
  }

  @Get("fee-structures")
  @Roles(...bursaryOversightRoles)
  async listFeeStructures(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listFeeStructures(session.schoolId) };
  }

  @Post("fee-structures")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async createFeeStructure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.createFeeStructure(session.schoolId, body) };
  }

  @Put("fee-structures/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async updateFeeStructure(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.updateFeeStructure(session.schoolId, id, session.userId, body) };
  }

  @Delete("fee-structures/:id")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async deleteFeeStructure(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.archiveFeeStructure(session.schoolId, id, session.userId) };
  }

  @Post("fee-assignments/bulk")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async bulkFeeAssignments(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.assignFeeToClass(session.schoolId, session.userId, body) };
  }

  @Post("fee-assignments/single")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async singleFeeAssignment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.assignFeeToStudent(session.schoolId, session.userId, body) };
  }

  @Get("fee-assignments")
  @Roles(...bursaryOversightRoles)
  async listFeeAssignments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listFeeAssignments(session.schoolId) };
  }

  @Patch("fee-assignments/:id/discount")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async feeAssignmentDiscount(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.applyFeeAssignmentDiscount(session.schoolId, id, session.userId, body) };
  }

  @Post("payments")
  @UseGuards(SessionGuard, CsrfGuard, PaymentRecordingRateLimitGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async recordPayment(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.recordManualPayment(session.schoolId, session.userId, body) };
  }

  @Get("payments")
  @Roles(...bursaryOversightRoles)
  async listPayments(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listPayments(session.schoolId) };
  }

  @Get("payments/:id/receipt")
  @Roles(...bursaryOversightRoles)
  async paymentReceipt(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const bytes = await this.financeService.buildReceiptPdf(session.schoolId, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="receipt-${id}.pdf"`);
    response.end(bytes);
  }

  @Post("payments/:id/reverse")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async reversePayment(
    @CurrentSession() session: SessionPayload,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
  ) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.reversePayment(session.schoolId, session.userId, id, body, request.ip) };
  }

  @Post("invoices/generate")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async generateInvoices(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.generateInvoices(session.schoolId, session.userId, body) };
  }

  @Post("invoices/:id/send")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async sendInvoice(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.sendInvoiceReminder(session.schoolId, session.userId, id) };
  }

  @Get("invoices")
  @Roles(...bursaryOversightRoles)
  async listInvoices(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listInvoices(session.schoolId) };
  }

  @Post("payroll/run")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async payrollRun(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>, @Req() request: Request) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.processPayrollRun(session.schoolId, session.userId, body, request.ip) };
  }

  @Get("payroll/runs")
  @Roles(...bursaryOversightRoles)
  async payrollRuns(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listPayrollRuns(session.schoolId) };
  }

  @Get("payroll/workspace")
  @Roles(...bursaryOversightRoles)
  async payrollWorkspace(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.getPayrollWorkspace(session.schoolId) };
  }

  @Get("payroll/runs/:id/items")
  @Roles(...bursaryOversightRoles)
  async payrollRunItems(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return { ok: true, data: await this.financeService.getPayrollRunItems(session.schoolId, id) };
  }

  @Post("payroll/runs/:id/publish")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async publishPayroll(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() request: Request) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.publishPayrollRun(session.schoolId, session.userId, id, body, request.ip) };
  }

  @Post("expenditures")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async createExpenditure(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>, @Req() request: Request) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.createExpenditure(session.schoolId, session.userId, body, request.ip) };
  }

  @Get("expenditures")
  @Roles(...bursaryOversightRoles)
  async listExpenditures(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listExpenditures(session.schoolId) };
  }

  @Get("reports/fee-collection")
  @Roles(...bursaryOversightRoles)
  async feeCollectionReport(@CurrentSession() session: SessionPayload, @Query("format") format: string | undefined, @Res() response: Response) {
    const report = await this.financeService.getFeeCollectionReport(session.schoolId);
    if (format === "excel") {
      response.setHeader("Content-Type", "text/csv");
      return response.end(csv([["Reference", "Student", "Amount", "Method", "Status", "Paid At"], ...report.payments.map((item) => [item.reference, item.studentName, String(item.amount), item.method, item.status, item.paidAt ?? "-"])]));
    }
    if (format === "pdf") {
      const bytes = await buildTabularPdf("Fee Collection Report", ["Reference", "Student", "Amount", "Method", "Status", "Paid"], report.payments.map((item) => [item.reference, item.studentName, formatCurrency(item.amount), item.method, item.status, item.paidAt ?? "-"]));
      response.setHeader("Content-Type", "application/pdf");
      return response.end(bytes);
    }
    return response.json({ ok: true, data: report });
  }

  @Get("reports/defaulters")
  @Roles(...bursaryOversightRoles)
  async defaultersReport(@CurrentSession() session: SessionPayload, @Query("format") format: string | undefined, @Res() response: Response) {
    const report = await this.financeService.getDefaultersReport(session.schoolId);
    const rows = report.map((item) => [item.studentName, item.className, String(item.billed), String(item.paid), String(item.balance), item.lastPaymentAt ?? "-"]);
    if (format === "excel") {
      response.setHeader("Content-Type", "text/csv");
      return response.end(csv([["Student", "Class", "Total Billed", "Paid", "Balance", "Last Payment"], ...rows]));
    }
    if (format === "pdf") {
      const bytes = await buildTabularPdf("Defaulters Report", ["Student", "Class", "Billed", "Paid", "Balance", "Last Payment"], rows);
      response.setHeader("Content-Type", "application/pdf");
      return response.end(bytes);
    }
    return response.json({ ok: true, data: report });
  }

  @Get("reports/payroll")
  @Roles(...bursaryOversightRoles)
  async payrollReport(@CurrentSession() session: SessionPayload, @Query("format") format: string | undefined, @Res() response: Response) {
    const report = await this.financeService.getPayrollReport(session.schoolId);
    const rows = report.runs.map((item) => [String(item.month), String(item.year), item.status, String(item.staffCount), String(item.totalNetSalary)]);
    if (format === "excel") {
      response.setHeader("Content-Type", "text/csv");
      return response.end(csv([["Month", "Year", "Status", "Staff Count", "Total Net Salary"], ...rows]));
    }
    if (format === "pdf") {
      const bytes = await buildTabularPdf("Payroll Report", ["Month", "Year", "Status", "Staff", "Net Salary"], rows);
      response.setHeader("Content-Type", "application/pdf");
      return response.end(bytes);
    }
    return response.json({ ok: true, data: report });
  }

  @Get("reports/expenditure")
  @Roles(...bursaryOversightRoles)
  async expenditureReport(@CurrentSession() session: SessionPayload, @Query("format") format: string | undefined, @Res() response: Response) {
    const report = await this.financeService.getExpenditureReport(session.schoolId);
    const rows = report.expenditures.map((item) => [item.category, item.description, String(item.amount), item.paidTo ?? "-", item.expenditureDate]);
    if (format === "excel") {
      response.setHeader("Content-Type", "text/csv");
      return response.end(csv([["Category", "Description", "Amount", "Paid To", "Date"], ...rows]));
    }
    if (format === "pdf") {
      const bytes = await buildTabularPdf("Expenditure Report", ["Category", "Description", "Amount", "Paid To", "Date"], rows);
      response.setHeader("Content-Type", "application/pdf");
      return response.end(bytes);
    }
    return response.json({ ok: true, data: report });
  }

  @Get("reports/income-vs-expenditure")
  @Roles(...bursaryOversightRoles)
  async incomeVsExpenditure(@CurrentSession() session: SessionPayload, @Query("format") format: string | undefined, @Res() response: Response) {
    const report = await this.financeService.getIncomeVsExpenditureReport(session.schoolId);
    const rows = [
      ["Income", String(report.income)],
      ["Expenditure", String(report.expenditure)],
      ["Net", String(report.net)],
    ];
    if (format === "excel") {
      response.setHeader("Content-Type", "text/csv");
      return response.end(csv([["Metric", "Amount"], ...rows]));
    }
    if (format === "pdf") {
      const bytes = await buildTabularPdf("Income vs Expenditure", ["Metric", "Amount"], rows);
      response.setHeader("Content-Type", "application/pdf");
      return response.end(bytes);
    }
    return response.json({ ok: true, data: report });
  }

  @Get("audit-logs")
  @Roles(...bursaryOversightRoles)
  async auditLogs(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.listFinanceAuditLogs(session.schoolId) };
  }

  @Get("settings")
  @Roles(...bursaryOversightRoles)
  async settings(@CurrentSession() session: SessionPayload) {
    return { ok: true, data: await this.financeService.getFinanceSettings(session.schoolId) };
  }

  @Put("settings")
  @UseGuards(SessionGuard, CsrfGuard, RolesGuard)
  @Roles(...bursaryRoles)
  async updateSettings(@CurrentSession() session: SessionPayload, @Body() body: Record<string, unknown>, @Req() request: Request) {
    assertBursaryRole(session);
    return { ok: true, data: await this.financeService.updateFinanceSettings(session.schoolId, session.userId, body, request.ip) };
  }
}
