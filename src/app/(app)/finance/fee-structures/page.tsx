import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole, hasRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { FeeStructureView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export default async function FeeStructuresPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/finance")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const structures = await apiGet<FeeStructureView[]>("/api/v1/finance/fee-structures");
  const canManageFinance = hasRole(session.role, ["SUPER_ADMIN", "SCHOOL_OWNER", "ADMIN_OFFICER", "ACCOUNTANT"]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/finance" className="text-sm font-semibold text-brand-700">Back to finance</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Fee structures</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">Configure term, session, or one-time fee components by class and category.</p>
      </section>

      {canManageFinance ? (
        <ResourceForm
          title="New fee structure"
          description="Simple form for common O-Level charges. The backend stores each value as a fee component."
          endpoint="/api/v1/finance/fee-structures"
          submitLabel="Create fee structure"
          fields={[
            { name: "name", label: "Structure name", required: true, placeholder: "JSS 2 Second Term Fees" },
            { name: "classId", label: "Class ID", placeholder: "Optional class database ID" },
            { name: "studentCategory", label: "Student category", placeholder: "Boarding, day, scholarship..." },
            { name: "recurrence", label: "Recurrence", type: "select", options: [{ label: "Term", value: "TERM" }, { label: "Session", value: "SESSION" }, { label: "One-time", value: "ONE_TIME" }] },
            { name: "dueDate", label: "Default due date", type: "date" },
            { name: "tuition", label: "Tuition", type: "number", defaultValue: 200000, min: 0 },
            { name: "developmentLevy", label: "Development levy", type: "number", defaultValue: 25000, min: 0 },
            { name: "examFee", label: "Exam fee", type: "number", defaultValue: 15000, min: 0 },
            { name: "ictFee", label: "ICT fee", type: "number", defaultValue: 10000, min: 0 },
            { name: "ptaFee", label: "PTA fee", type: "number", defaultValue: 5000, min: 0 },
            { name: "transport", label: "Transport", type: "number", defaultValue: 0, min: 0 },
            { name: "hostel", label: "Hostel", type: "number", defaultValue: 0, min: 0 },
            { name: "extras", label: "Books / uniform / extras", type: "number", defaultValue: 0, min: 0 }
          ]}
        />
      ) : null}

      <TableCard
        title="Configured structures"
        description="Active and historical fee templates available for invoice generation."
        items={structures}
        columns={[
          { key: "name", header: "Name", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
          { key: "className", header: "Class", render: (item) => item.className ? formatNigeriaClassName(item.className) : "All classes" },
          { key: "recurrence", header: "Recurrence", render: (item) => item.recurrence },
          { key: "total", header: "Total", render: (item) => formatCurrency(item.total) },
          { key: "dueDate", header: "Due", render: (item) => item.dueDate ? formatDate(item.dueDate) : "Per invoice" },
          { key: "status", header: "Status", render: (item) => item.isActive ? "Active" : "Inactive" }
        ]}
      />
    </div>
  );
}
