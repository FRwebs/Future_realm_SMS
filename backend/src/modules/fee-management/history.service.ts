import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { PAYMENT_MODE, armName, currentTerm, fullName, isoDay, loadFamilies, num } from "./fees.shared";

/**
 * History: the ledger. Every term, every section, every receipt — and a statement a school can
 * hand a board, a bank or an auditor, read off the payments themselves rather than re-keyed.
 */

const sectionOf = (section: string) => (/NURSERY|PRIMARY|CRECHE|EARLY/i.test(section) ? "Nursery and Primary" : /JUNIOR|JSS/i.test(section) ? "Junior Secondary" : /SENIOR|SSS|SECONDARY/i.test(section) ? "Senior Secondary" : "Other");

const statementSchema = z.object({
  scope: z.string().default("The whole school"),
  which: z.string().optional(),
  period: z.string().default("This session"),
  from: z.string().optional(),
  to: z.string().optional(),
  include: z.string().optional(),
  groupBy: z.string().optional()
});

@Injectable()
export class HistoryService {
  async ok<T>(dataPromise: Promise<T>, message?: string) {
    return { ok: true, success: true, ...(message ? { message } : {}), data: await dataPromise };
  }

  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const current = await currentTerm(schoolId);
    const [terms, invoices, receipts, reversed, sessionRow] = await Promise.all([
      prisma.term.findMany({ where: { schoolId }, include: { academicSession: true }, orderBy: { startDate: "desc" } }),
      prisma.invoice.findMany({ where: { schoolId, status: { not: "VOID" } }, include: { payments: { where: { status: "SUCCESS", isReversed: false }, select: { amount: true, id: true } }, student: { select: { currentClass: { select: { classLevel: { select: { schoolSection: true, section: true } } } } } } } }),
      prisma.receipt.findMany({ where: { schoolId, status: "ISSUED" }, include: { payment: { include: { student: { include: { currentClass: true } }, recordedBy: { select: { firstName: true, lastName: true } } } }, invoice: { select: { invoiceNumber: true } } }, orderBy: { issuedAt: "desc" }, take: 300 }),
      prisma.payment.aggregate({ where: { schoolId, isReversed: true }, _count: { id: true }, _sum: { amount: true } }),
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } })
    ]);
    const received = (invoice: (typeof invoices)[number]) => invoice.payments.reduce((sum, payment) => sum + num(payment.amount), 0);
    const termRows = terms.map((term) => {
      // An invoice with no term of its own belongs to the term the school is in.
      const own = invoices.filter((invoice) => invoice.termId === term.id || (!invoice.termId && current?.id === term.id));
      const expected = own.reduce((sum, invoice) => sum + num(invoice.total), 0);
      const collected = own.reduce((sum, invoice) => sum + received(invoice), 0);
      return { id: term.id, session: term.academicSession?.name ?? "", term: term.name, expected, collected, rate: expected ? Math.round((collected / expected) * 100) : null, never: expected - collected, receipts: own.reduce((sum, invoice) => sum + invoice.payments.length, 0), state: term.id === current?.id ? "In progress" : term.endDate < new Date() ? "Closed" : "Upcoming" };
    }).filter((row) => row.expected > 0 || row.state === "In progress");

    const sessionTerms = new Set(terms.filter((term) => term.academicSessionId === sessionRow?.id).map((term) => term.id));
    const inSession = invoices.filter((invoice) => (invoice.termId && sessionTerms.has(invoice.termId)) || !invoice.termId);
    const sections = new Map<string, { expected: number; collected: number; students: Set<string> }>();
    for (const invoice of inSession) {
      const key = sectionOf(String(invoice.student.currentClass?.classLevel?.schoolSection ?? invoice.student.currentClass?.classLevel?.section ?? "Other"));
      const entry = sections.get(key) ?? { expected: 0, collected: 0, students: new Set<string>() };
      entry.expected += num(invoice.total);
      entry.collected += received(invoice);
      entry.students.add(invoice.studentId);
      sections.set(key, entry);
    }
    const collectedSession = inSession.reduce((sum, invoice) => sum + received(invoice), 0);
    const termNow = termRows.find((row) => row.state === "In progress");
    const people = new Map<string, string>();
    for (const receipt of receipts) if (receipt.payment?.recordedBy) people.set(fullName(receipt.payment.recordedBy), "");

    return {
      session: sessionRow?.name ?? "",
      kpis: {
        collectedSession,
        collectedTerm: termNow?.collected ?? 0,
        expectedTerm: termNow?.expected ?? 0,
        receipts: await prisma.receipt.count({ where: { schoolId, status: "ISSUED" } }),
        reversals: reversed._count.id,
        reversalValue: num(reversed._sum.amount),
        outstanding: inSession.reduce((sum, invoice) => sum + num(invoice.balance), 0)
      },
      terms: termRows,
      sections: Array.from(sections.entries()).map(([name, value]) => ({ name, students: value.students.size, expected: value.expected, collected: value.collected, rate: value.expected ? Math.round((value.collected / value.expected) * 100) : null })),
      receipts: receipts.map((receipt) => ({
        id: receipt.paymentId ?? receipt.id,
        ref: receipt.receiptNumber,
        student: receipt.payment ? fullName(receipt.payment.student) : "—",
        adm: receipt.payment?.student.admissionNumber ?? "",
        arm: armName(receipt.payment?.student.currentClass),
        amount: num(receipt.amount),
        mode: receipt.payment ? PAYMENT_MODE[String(receipt.payment.method)] ?? String(receipt.payment.method) : "—",
        bankRef: receipt.payment?.schoolBankReference ?? null,
        by: receipt.payment?.recordedBy ? fullName(receipt.payment.recordedBy) : "—",
        at: receipt.issuedAt.toISOString()
      })),
      recorders: Array.from(people.keys()),
      options: { sessions: Array.from(new Set(terms.map((term) => term.academicSession?.name ?? ""))).filter(Boolean) }
    };
  }

  /** Rows of a statement, as the scope and period ask for them. */
  async statement(session: SessionPayload, query: unknown) {
    const input = statementSchema.parse(query);
    const schoolId = session.schoolId;
    const now = new Date();
    const term = await currentTerm(schoolId);
    const sessionRow = await prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } });
    const from = input.period === "This term" ? term?.startDate : input.period === "This session" ? sessionRow?.startDate : input.period === "A date range" && input.from ? new Date(input.from) : undefined;
    const to = input.period === "A date range" && input.to ? new Date(`${input.to}T23:59:59`) : now;
    const payments = await prisma.payment.findMany({
      where: { schoolId, status: "SUCCESS", ...(from ? { paidAt: { gte: from, lte: to } } : {}) },
      include: { student: { include: { currentClass: { include: { classLevel: true } }, guardians: { include: { guardian: true } } } }, recordedBy: { select: { firstName: true, lastName: true } }, invoice: { select: { invoiceNumber: true } }, receipts: { select: { receiptNumber: true } } },
      orderBy: { paidAt: "desc" }
    });
    const which = (input.which ?? "").toLowerCase();
    const rows = payments.filter((payment) => {
      const level = payment.student.currentClass?.classLevel;
      if (input.scope === "A section") return which && sectionOf(String(level?.schoolSection ?? level?.section ?? "")).toLowerCase() === which;
      if (input.scope === "A class") return which && (level?.name ?? "").toLowerCase() === which;
      if (input.scope === "An arm") return which && armName(payment.student.currentClass).toLowerCase() === which;
      if (input.scope === "One family") return which && payment.student.guardians.some((link) => link.guardianId === input.which || `${link.guardian.lastName} family`.toLowerCase() === which);
      return true;
    });
    const families = /outstanding/i.test(input.include ?? "") ? await loadFamilies(schoolId) : [];
    return {
      rows: rows.map((payment) => ({
        receipt: payment.receipts[0]?.receiptNumber ?? payment.receiptNumber ?? payment.paymentNumber ?? payment.reference,
        student: fullName(payment.student),
        adm: payment.student.admissionNumber,
        arm: armName(payment.student.currentClass),
        section: sectionOf(String(payment.student.currentClass?.classLevel?.schoolSection ?? payment.student.currentClass?.classLevel?.section ?? "")),
        amount: num(payment.amount),
        mode: PAYMENT_MODE[String(payment.method)] ?? String(payment.method),
        reference: payment.schoolBankReference ?? payment.reference,
        by: payment.recordedBy ? fullName(payment.recordedBy) : "",
        date: payment.paidAt ? isoDay(payment.paidAt) : "",
        invoice: payment.invoice?.invoiceNumber ?? ""
      })),
      outstanding: families.map((family) => ({ family: family.name, owing: family.owing, days: family.days })),
      scope: input.scope,
      period: input.period
    };
  }
}
