import { AccessDenied } from "@/components/feedback/access-denied";
import { FinanceFeeStructuresStudio } from "@/components/finance/finance-fee-structures-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FeeStructureView } from "@/lib/domain/types";

export default async function FeeStructuresPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/fee-structures"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [structures, permissions] = await Promise.all([
    apiGet<FeeStructureView[]>("/api/v1/bursary/fee-structures"),
    getServerPermissions(session),
  ]);

  const canManageFinance = permissions.some((permission) =>
    ["fees.create", "fees.edit", "fees.delete"].includes(permission),
  );

  return (
    <FinanceFeeStructuresStudio
      structures={structures}
      canManageFinance={canManageFinance}
    />
  );
}
