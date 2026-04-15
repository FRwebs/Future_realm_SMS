export interface InvoiceCalculationInput {
  items: Array<{ description: string; amount: number; quantity?: number }>;
  discount?: number;
  fine?: number;
  paid?: number;
}

export interface PaymentAllocationInput {
  amount: number;
  invoices: Array<{ invoiceId: string; balance: number }>;
}

const moneyFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function toMoney(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid monetary amount");
  }
  return Math.round(value * 100) / 100;
}

export function assertNonNegativeMoney(value: number, label = "Amount") {
  const amount = toMoney(value);
  if (amount < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  return amount;
}

export function calculateInvoiceTotals(input: InvoiceCalculationInput) {
  const subtotal = toMoney(
    input.items.reduce(
      (sum, item) => sum + assertNonNegativeMoney(item.amount, item.description) * (item.quantity ?? 1),
      0
    )
  );
  const discount = assertNonNegativeMoney(input.discount ?? 0, "Discount");
  const fine = assertNonNegativeMoney(input.fine ?? 0, "Fine");
  const total = toMoney(Math.max(subtotal - discount + fine, 0));
  const paid = assertNonNegativeMoney(input.paid ?? 0, "Paid amount");
  const balance = toMoney(Math.max(total - paid, 0));

  return {
    subtotal,
    discount,
    fine,
    total,
    balance,
    status: balance === 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED"
  };
}

export function getInvoiceStatus(total: number, balance: number, dueOn?: string | Date) {
  const safeTotal = assertNonNegativeMoney(total, "Invoice total");
  const safeBalance = assertNonNegativeMoney(balance, "Invoice balance");
  if (safeBalance === 0) return "PAID";
  if (dueOn && new Date(dueOn).getTime() < Date.now()) return "OVERDUE";
  return safeBalance < safeTotal ? "PARTIALLY_PAID" : "ISSUED";
}

export function allocatePaymentAcrossInvoices(input: PaymentAllocationInput) {
  let remaining = assertNonNegativeMoney(input.amount, "Payment amount");
  const allocations: Array<{ invoiceId: string; amount: number }> = [];

  for (const invoice of input.invoices) {
    if (remaining <= 0) break;
    const balance = assertNonNegativeMoney(invoice.balance, "Invoice balance");
    if (balance === 0) continue;
    const amount = toMoney(Math.min(balance, remaining));
    allocations.push({ invoiceId: invoice.invoiceId, amount });
    remaining = toMoney(remaining - amount);
  }

  return {
    allocations,
    overpayment: remaining
  };
}

export function formatMoneyForAudit(value: number, currency = "NGN") {
  return `${currency} ${moneyFormatter.format(toMoney(value))}`;
}
