import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole, hasRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { InstallmentPlanView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function InstallmentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/finance")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const plans = await apiGet<InstallmentPlanView[]>("/api/v1/finance/installment-plans");
  const canManageFinance = hasRole(session.role, ["SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT"]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/finance" className="text-sm font-semibold text-brand-700">Back to finance</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Installment plans</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">Split an outstanding invoice balance into scheduled payment commitments.</p>
      </section>

      {canManageFinance ? (
        <ResourceForm
          title="Create installment plan"
          description="The total of the installment rows must equal the invoice outstanding balance."
          endpoint="/api/v1/finance/installment-plans"
          submitLabel="Create plan"
          fields={[
            { name: "invoiceId", label: "Invoice ID", required: true },
            { name: "installment1Due", label: "Installment 1 due", type: "date", required: true },
            { name: "installment1Amount", label: "Installment 1 amount", type: "number", required: true, min: 1 },
            { name: "installment2Due", label: "Installment 2 due", type: "date" },
            { name: "installment2Amount", label: "Installment 2 amount", type: "number", min: 0 },
            { name: "installment3Due", label: "Installment 3 due", type: "date" },
            { name: "installment3Amount", label: "Installment 3 amount", type: "number", min: 0 },
            { name: "notes", label: "Notes", type: "textarea", placeholder: "Approval note or payment agreement." }
          ]}
        />
      ) : null}

      <TableCard
        title="Plans"
        description="Scheduled payment plans by student and invoice."
        items={plans}
        columns={[
          { key: "plan", header: "Plan", render: (item) => <span className="font-semibold text-ink">{item.planNumber}</span> },
          { key: "student", header: "Student", render: (item) => item.studentName },
          { key: "invoice", header: "Invoice", render: (item) => item.invoiceNumber ?? "-" },
          { key: "total", header: "Total", render: (item) => formatCurrency(item.totalAmount) },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "next", header: "Next due", render: (item) => item.items[0] ? formatDate(item.items[0].dueOn) : "-" },
          { key: "status", header: "Status", render: (item) => item.status }
        ]}
      />
    </div>
  );
}
