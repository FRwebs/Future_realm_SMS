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
    <div className="grid gap-6">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/finance" className="inline-flex items-center gap-2 font-medium text-brand-700 transition hover:text-brand-800">
          <ArrowLeft className="h-4 w-4" />
          Finance
        </Link>
        <span>/</span>
        <span className="text-slate-700">Staff Payroll</span>
      </nav>

      <PayrollWorkspace workspace={workspace} />
    </div>
  );
}
