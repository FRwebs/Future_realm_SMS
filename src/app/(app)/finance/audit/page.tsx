import { AccessDenied } from "@/components/feedback/access-denied";
import { FinanceAuditStudio } from "@/components/finance/finance-audit-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AuditLogView } from "@/lib/domain/types";

export default async function FinanceAuditPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/audit"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const logs = await apiGet<AuditLogView[]>("/api/v1/bursary/audit-logs");

  return <FinanceAuditStudio logs={logs} />;
}
