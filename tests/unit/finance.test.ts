import { allocatePaymentAcrossInvoices, calculateInvoiceTotals, getInvoiceStatus } from "@/lib/domain/finance";

describe("finance domain", () => {
  it("calculates invoice totals with discount and fine", () => {
    expect(
      calculateInvoiceTotals({
        items: [
          { description: "Tuition", amount: 200000 },
          { description: "Transport", amount: 60000 },
          { description: "Development", amount: 25000 }
        ],
        discount: 10000,
        fine: 5000,
        paid: 160000
      })
    ).toEqual({
      subtotal: 285000,
      discount: 10000,
      fine: 5000,
      total: 280000,
      balance: 120000,
      status: "PARTIALLY_PAID"
    });
  });

  it("allocates partial payments and exposes overpayment", () => {
    expect(
      allocatePaymentAcrossInvoices({
        amount: 175000,
        invoices: [
          { invoiceId: "inv_1", balance: 125000 },
          { invoiceId: "inv_2", balance: 25000 }
        ]
      })
    ).toEqual({
      allocations: [
        { invoiceId: "inv_1", amount: 125000 },
        { invoiceId: "inv_2", amount: 25000 }
      ],
      overpayment: 25000
    });
  });

  it("resolves invoice status from balances and due dates", () => {
    expect(getInvoiceStatus(100000, 0)).toBe("PAID");
    expect(getInvoiceStatus(100000, 25000)).toBe("PARTIALLY_PAID");
    expect(getInvoiceStatus(100000, 100000, "2020-01-01")).toBe("OVERDUE");
  });
});
