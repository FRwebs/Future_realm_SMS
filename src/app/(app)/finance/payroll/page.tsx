import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PayrollWorkspace } from "@/components/finance/payroll-workspace";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { PayrollWorkspaceView } from "@/lib/domain/types";

export default async function FinancePayrollPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/finance/payroll"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const workspace = await apiGet<PayrollWorkspaceView>("/api/v1/bursary/payroll/workspace");

  return (
    <div className="portal-page">
      <nav className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
        <Link href="/finance" className="inline-flex items-center gap-2 font-medium text-[var(--color-text-accent)] transition hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Finance
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text-primary)]">Staff Payroll</span>
      </nav>

      <PayrollWorkspace workspace={workspace} />
    </div>
  );
}
