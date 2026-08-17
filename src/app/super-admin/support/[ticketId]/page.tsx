import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminInternalMember, SuperAdminTicketDetail } from "@/lib/domain/types";
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
  const [ticket, agentsEnvelope] = await Promise.all([
    apiGet<SuperAdminTicketDetail>(`/api/super-admin/support/tickets/${ticketId}`),
    apiGetEnvelope<SuperAdminInternalMember[]>("/api/super-admin/internal-team?status=ACTIVE")
  ]);
  const agentOptions = (agentsEnvelope.data ?? []).map((agent) => ({ label: `${agent.name} (${agent.role.replaceAll("_", " ")})`, value: agent.id }));

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/super-admin/support" className="text-[13px] font-semibold text-[var(--color-text-accent)]">← Back to support</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">{ticket.ticketNo} · {ticket.schoolName}</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-bold text-[var(--color-text-primary)]">{ticket.subject}</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{ticket.description}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={ticket.status} />
            <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>{ticket.priority}</span>
            {ticket.slaBreached ? (
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}>SLA BREACHED</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Category</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{ticket.category.replaceAll("_", " ")}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Assigned to</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{ticket.assignedTo?.name ?? "Unassigned"}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">SLA deadline</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{ticket.slaDueAt ? formatDate(ticket.slaDueAt) : "Not set"}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">CSAT</p>
          <p className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">{ticket.csat ? `${ticket.csat.score} / 5` : "Not yet rated"}</p>
        </article>
      </section>

      <section className="surface-card p-6">
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
            fields={[{ name: "assignedToId", label: "Agent", type: "select", required: true, defaultValue: ticket.assignedTo?.id, options: agentOptions }]}
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
                  <span className="text-xs text-[var(--color-text-muted)]">{item.completedAt ? formatDate(item.completedAt) : "-"}</span>
                )
            }
          ]}
          emptyState=""
        />
      ) : null}

      <section className="surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">Thread</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Conversation</h2>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Internal notes are only visible to the platform team.</p>
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
            <div
              key={message.id}
              className="rounded-[10px] px-4 py-3"
              style={message.internalOnly ? { background: "var(--color-warning-dim)" } : { background: "var(--color-bg-subtle)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{message.author}{message.internalOnly ? " · Internal note" : ""}</span>
                <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(message.createdAt)}</span>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{message.body}</p>
            </div>
          ))}
          {ticket.messages.length === 0 ? (
            <p className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">No messages yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
