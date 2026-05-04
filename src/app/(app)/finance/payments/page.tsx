import { AccessDenied } from "@/components/feedback/access-denied";
import { FinancePaymentsStudio } from "@/components/finance/finance-payments-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { InvoiceView, PaymentView } from "@/lib/domain/types";

export default async function PaymentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/payments"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [payments, invoices, permissions] = await Promise.all([
    apiGet<PaymentView[]>("/api/v1/bursary/payments"),
    apiGet<InvoiceView[]>("/api/v1/bursary/invoices"),
    getServerPermissions(session),
  ]);

  const canManageFinance = permissions.some((permission) =>
    ["fees.collect", "fees.edit_payment", "fees.approve", "fees.create_receipt", "fees.apply_waiver"].includes(permission),
  );

  return (
    <FinancePaymentsStudio
      payments={payments}
      invoices={invoices}
      canManageFinance={canManageFinance}
    />
  );
}
