import { AccessDenied } from "@/components/feedback/access-denied";
import { FinanceReportsStudio } from "@/components/finance/finance-reports-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FinanceDashboardView } from "@/lib/domain/types";

export default async function FinanceReportsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/reports"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const dashboard = await apiGet<FinanceDashboardView>("/api/v1/bursary/dashboard");

  return <FinanceReportsStudio dashboard={dashboard} />;
}
