import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminTicketDetail } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const statusOptions = [
  { label: "Open", value: "OPEN" },
  { label: "Triaged", value: "TRIAGED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Awaiting School Response", value: "AWAITING_SCHOOL_RESPONSE" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" }
];

export default async function SuperAdminTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const ticket = await apiGet<SuperAdminTicketDetail>(`/api/super-admin/support/tickets/${ticketId}`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/super-admin/support" className="text-sm font-semibold text-brand-700">Back to support</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">{ticket.ticketNo} · {ticket.schoolName}</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{ticket.subject}</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink/60">{ticket.description}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={ticket.status} />
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{ticket.priority}</span>
            {ticket.slaBreached ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">SLA BREACHED</span> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Category</p>
          <p className="mt-2 font-semibold text-ink">{ticket.category.replaceAll("_", " ")}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Assigned to</p>
          <p className="mt-2 font-semibold text-ink">{ticket.assignedTo?.name ?? "Unassigned"}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">SLA deadline</p>
          <p className="mt-2 font-semibold text-ink">{ticket.slaDueAt ? formatDate(ticket.slaDueAt) : "Not set"}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">CSAT</p>
          <p className="mt-2 font-semibold text-ink">{ticket.csat ? `${ticket.csat.score} / 5` : "Not yet rated"}</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-wrap gap-2">
          <ResourceActionDialog
            triggerLabel="Change status"
            title={`Change status — ${ticket.ticketNo}`}
            description="Move this ticket through its lifecycle. Resolving triggers a CSAT survey to the school."
            endpoint={`/api/super-admin/support/tickets/${ticket.id}/status`}
            method="PATCH"
            variant="secondary"
            submitLabel="Update status"
            fields={[{ name: "status", label: "New status", type: "select", defaultValue: ticket.status, options: statusOptions }]}
          />
          <ResourceActionDialog
            triggerLabel="Reassign"
            title={`Reassign ${ticket.ticketNo}`}
            description="Assign this ticket to a different support agent."
            endpoint={`/api/super-admin/support/tickets/${ticket.id}/assign`}
            method="PATCH"
            variant="secondary"
            submitLabel="Reassign"
            fields={[{ name: "assignedToId", label: "Agent user ID", required: true, defaultValue: ticket.assignedTo?.id }]}
          />
          <ResourceActionDialog
            triggerLabel="Log CSAT response"
            title="Log CSAT response"
            description="Record the satisfaction score the school gave when this ticket was resolved."
            endpoint={`/api/super-admin/support/tickets/${ticket.id}/csat`}
            method="POST"
            variant="secondary"
            submitLabel="Log CSAT"
            fields={[
              { name: "score", label: "Score (1-5)", type: "number", required: true, min: 1, max: 5 },
              { name: "comment", label: "Comment", type: "textarea" }
            ]}
          />
          <ResourceActionDialog
            triggerLabel="Request data correction"
            title="Request data correction"
            description="Submit a data correction for Super Admin approval. No correction is ever made without approval and an audit entry."
            endpoint={`/api/super-admin/support/tickets/${ticket.id}/data-correction`}
            method="POST"
            variant="danger"
            submitLabel="Submit request"
            fields={[
              { name: "fieldCorrected", label: "Field to correct", required: true, placeholder: "e.g. Student.admissionNumber" },
              { name: "oldValue", label: "Current (incorrect) value", required: true },
              { name: "newValue", label: "Correct value", required: true }
            ]}
          />
        </div>
      </section>

      {ticket.dataCorrectionRecords.length > 0 ? (
        <TableCard
          title="Data correction requests"
          description="Every correction requires Super Admin approval and is logged before it is made."
          items={ticket.dataCorrectionRecords}
          columns={[
            { key: "field", header: "Field", render: (item) => item.fieldCorrected },
            { key: "old", header: "Old value", render: (item) => item.oldValue },
            { key: "new", header: "New value", render: (item) => item.newValue },
            { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
            {
              key: "actions",
              header: "Actions",
              render: (item) =>
                item.status === "PENDING" ? (
                  <ResourceActionDialog
                    triggerLabel="Approve"
                    title="Approve data correction"
                    description="This is a Super Admin-only action and is fully audited."
                    endpoint={`/api/super-admin/support/data-correction/${item.id}/approve`}
                    method="PATCH"
                    variant="secondary"
                    submitLabel="Approve"
                    confirmLabel="Confirm"
                    confirmMessage="This logs an approved correction to the audit trail."
                    fields={[]}
                  />
                ) : (
                  <span className="text-xs text-ink/50">{item.completedAt ? formatDate(item.completedAt) : "-"}</span>
                )
            }
          ]}
          emptyState=""
        />
      ) : null}

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Conversation</h2>
            <p className="mt-2 text-sm text-ink/60">Internal notes are only visible to the platform team.</p>
          </div>
          <ResourceActionDialog
            triggerLabel="Add message"
            title="Add message"
            description="Reply to the school or add an internal note."
            endpoint={`/api/super-admin/support/tickets/${ticket.id}/messages`}
            method="POST"
            submitLabel="Send"
            fields={[
              { name: "body", label: "Message", type: "textarea", required: true },
              { name: "internalOnly", label: "Internal note only", type: "select", defaultValue: "false", options: [{ label: "No — visible to school", value: "false" }, { label: "Yes — internal only", value: "true" }] }
            ]}
          />
        </div>
        <div className="mt-5 grid gap-3">
          {ticket.messages.map((message) => (
            <div key={message.id} className={`rounded-2xl px-4 py-3 ${message.internalOnly ? "bg-amber-50" : "bg-sand/60"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{message.author}{message.internalOnly ? " · Internal note" : ""}</span>
                <span className="text-xs text-ink/45">{formatDate(message.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-ink/70">{message.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
