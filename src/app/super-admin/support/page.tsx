import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGetEnvelope } from "@/lib/api/server";
import { formatDate } from "@/lib/utils/formatters";

type Ticket = {
  id: string;
  ticketNo: string;
  schoolName: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: string;
  messageCount: number;
  slaDueAt?: string;
  createdAt: string;
};

export default async function SupportTicketsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const key of ["search", "status", "schoolId", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<Ticket[]>(`/api/super-admin/support/tickets?${query.toString()}`);
  const tickets = envelope.data ?? [];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Customer support</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">Support Tickets</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Support queue for school issues, internal notes, SLA tracking, and escalation to platform admins or developers.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Create Ticket"
            title="Create support ticket"
            description="Open a support ticket for a school and optionally assign it to a support agent."
            endpoint="/api/super-admin/support/tickets"
            fields={[
              { name: "schoolId", label: "School ID", required: true },
              { name: "subject", label: "Subject", required: true },
              { name: "description", label: "Description", type: "textarea", required: true },
              { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: ["BILLING", "TECHNICAL_BUG", "FEATURE_REQUEST", "ACCOUNT_ACCESS", "DATA_ISSUE", "OTHER"].map((value) => ({ label: value.replaceAll("_", " "), value })) },
              { name: "priority", label: "Priority", type: "select", defaultValue: "MEDIUM", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ label: value, value })) },
              { name: "assignedToId", label: "Assigned agent user ID" }
            ]}
            submitLabel="Create Ticket"
            confirmLabel="Confirm Ticket"
          />
        </div>
      </section>

      <FilterToolbar
        action="/super-admin/support"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Ticket or subject", defaultValue: params.search },
          { name: "schoolId", label: "School ID", type: "search", defaultValue: params.schoolId },
          { name: "status", label: "Status", type: "select", defaultValue: params.status, options: [
            { label: "Any status", value: "" },
            { label: "Open", value: "OPEN" },
            { label: "In progress", value: "IN_PROGRESS" },
            { label: "Resolved", value: "RESOLVED" },
            { label: "Closed", value: "CLOSED" }
          ] }
        ]}
      />

      <TableCard
        title="Ticket Queue"
        description={`${envelope.pagination?.total ?? tickets.length} ticket(s) found.`}
        items={tickets}
        emptyState="No support tickets match the current filters."
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <span className="font-semibold text-ink">{item.ticketNo}</span> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "priority", header: "Priority", render: (item) => <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{item.priority}</span> },
          { key: "status", header: "Status", render: (item) => item.status.replaceAll("_", " ") },
          { key: "assigned", header: "Assigned", render: (item) => item.assignedTo },
          { key: "sla", header: "SLA", render: (item) => item.slaDueAt ? formatDate(item.slaDueAt) : "Not set" }
        ]}
      />
    </div>
  );
}
