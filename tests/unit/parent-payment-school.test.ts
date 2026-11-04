import { beforeEach, describe, expect, it, vi } from "vitest";

type Invoice = { id: string; schoolId: string; status: string; balance?: number; studentId?: string; invoiceNumber?: string; student: { firstName?: string; lastName?: string; currentClass?: null; guardians: Array<{ guardian: { userId: string | null; schoolId: string; firstName?: string; lastName?: string; email?: string | null; phone?: string } }> } };
const state = { invoices: [] as Invoice[], school: { currency: "GHS" } as { currency: string } | null, seen: [] as string[], charged: [] as Array<{ currency?: string; amount: number }>, payments: [] as Array<Record<string, unknown>> };

vi.mock("../../src/lib/db/prisma", () => ({
  prisma: {
    invoice: { findFirst: async ({ where }: { where: { id: string; schoolId?: string } }) => state.invoices.find((invoice) => invoice.id === where.id && (!where.schoolId || invoice.schoolId === where.schoolId) && !["VOID", "PAID"].includes(invoice.status)) ?? null },
    school: { findUnique: async () => state.school },
    payment: { create: async ({ data }: { data: Record<string, unknown> }) => { state.payments.push(data); return data; } },
    auditLog: { create: async () => ({}) },
  },
}));
vi.mock("../../src/lib/integrations/payment-gateways", () => ({
  getPaymentGateway: () => ({ initializePayment: async (input: { currency?: string; amount: number; reference: string }) => { state.charged.push({ currency: input.currency, amount: input.amount }); return { checkoutUrl: "https://pay.example/x", reference: input.reference, provider: "PAYSTACK", raw: {} }; } }),
}));
vi.mock("../../backend/src/modules/parent-portal/guardian-policy", () => ({
  assertGuardianMaySee: async (schoolId: string, what: string) => { state.seen.push(`${schoolId}:${what}`); },
}));

import { FinanceService } from "../../backend/src/modules/finance/finance.service";

const parent = { userId: "u-funke", schoolId: "school-a", role: "PARENT", email: "f@example.ng", name: "Funke" } as never;
const at = (schoolId: string, userId: string | null = "u-funke") => ({ guardian: { userId, schoolId } });

describe("a parent paying an invoice from another of their schools", () => {
  beforeEach(() => {
    state.seen = [];
    state.charged = [];
    state.payments = [];
    state.invoices = [
      { id: "inv-a", schoolId: "school-a", status: "ISSUED", student: { guardians: [at("school-a")] } },
      { id: "inv-b", schoolId: "school-b", status: "OVERDUE", balance: 23_100, studentId: "kid-b", invoiceNumber: "GIA/INV/26/2-0611", student: { firstName: "Kemi", lastName: "Adebayo", currentClass: null, guardians: [at("school-b")] } },
      { id: "inv-x", schoolId: "school-b", status: "ISSUED", student: { guardians: [at("school-b", "u-someone-else")] } },
      { id: "inv-paid", schoolId: "school-b", status: "PAID", student: { guardians: [at("school-b")] } },
    ];
  });

  it("is made at the school that billed it, not the school they signed in to", async () => {
    const service = new FinanceService();
    expect(await service.parentInvoiceSchool(parent, "inv-a")).toBe("school-a");
    expect(await service.parentInvoiceSchool(parent, "inv-b")).toBe("school-b");
  });

  it("is refused for a child who is not theirs, even at a school they belong to", async () => {
    const service = new FinanceService();
    await expect(service.parentInvoiceSchool(parent, "inv-x")).rejects.toThrow(/linked children/);
  });

  it("says there is no open invoice for one that is paid or does not exist", async () => {
    const service = new FinanceService();
    await expect(service.parentInvoiceSchool(parent, "inv-paid")).rejects.toThrow(/Open invoice not found/);
    await expect(service.parentInvoiceSchool(parent, "nope")).rejects.toThrow(/Open invoice not found/);
  });

  it("asks the billing school whether parents may see its fees, and pays in its own currency", async () => {
    const service = new FinanceService();
    const flow = vi.spyOn(service, "initializePaymentFlow").mockResolvedValue({ checkoutUrl: "x" } as never);
    await service.initializeParentPayment(parent, { invoiceId: "inv-b", amount: 1000 });
    expect(state.seen).toEqual(["school-b:Fees"]);
    expect(flow).toHaveBeenCalledWith("school-b", "u-funke", { invoiceId: "inv-b", amount: 1000 }, parent);
  });

  it("charges the invoice in the billing school's currency and records it against that school", async () => {
    const service = new FinanceService();
    await service.initializeParentPayment(parent, { invoiceId: "inv-b", amount: 11_550 });
    expect(state.charged).toEqual([{ currency: "GHS", amount: 11_550 }]);
    expect(state.payments[0]).toMatchObject({ schoolId: "school-b", invoiceId: "inv-b", status: "PENDING", amount: 11_550 });
  });

  it("does not let the signed-in school's books stand in for the billing school's", async () => {
    const service = new FinanceService();
    // Asked of the wrong school, the invoice simply is not there; asked through the parent route it is found where it lives.
    await expect(service.initializePaymentFlow("school-a", "u-funke", { invoiceId: "inv-b", amount: 100 }, parent)).rejects.toThrow(/Open invoice not found/);
    await expect(service.initializeParentPayment(parent, { invoiceId: "inv-b", amount: 100 })).resolves.toBeTruthy();
  });
});
