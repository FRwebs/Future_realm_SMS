import { AccessDenied } from "@/components/feedback/access-denied";
import { FinanceDashboardStudio } from "@/components/finance/finance-dashboard-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FinanceDashboardView } from "@/lib/domain/types";

export default async function FinancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [dashboard, permissions] = await Promise.all([
    apiGet<FinanceDashboardView>("/api/v1/bursary/dashboard"),
    getServerPermissions(session),
  ]);

  const canManageFinance = permissions.some((permission) =>
    [
      "fees.create",
      "fees.edit",
      "fees.collect",
      "fees.approve",
      "fees.apply_waiver",
      "fees.create_receipt",
      "fees.edit_payment",
    ].includes(permission),
  );

  return (
    <FinanceDashboardStudio
      dashboard={dashboard}
      canManageFinance={canManageFinance}
    />
  );
}
