import { AccessDenied } from "@/components/feedback/access-denied";
import { FinanceExpendituresStudio } from "@/components/finance/finance-expenditures-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { ExpenditureView } from "@/lib/domain/types";

export default async function FinanceExpendituresPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/expenditures"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const expenditures = await apiGet<ExpenditureView[]>("/api/v1/bursary/expenditures");

  return <FinanceExpendituresStudio expenditures={expenditures} />;
}
