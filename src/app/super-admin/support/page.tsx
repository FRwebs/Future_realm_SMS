import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminCannedResponse, SuperAdminDataCorrectionRow, SuperAdminInternalMember, SuperAdminSchoolRow, SuperAdminTicketAnalytics, SuperAdminTicketRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const categoryOptions = ["BILLING", "TECHNICAL_BUG", "FEATURE_REQUEST", "ACCOUNT_ACCESS", "DATA_ISSUE", "RESULT_COMPUTATION", "NOTIFICATION_DELIVERY", "SYNC_OFFLINE_ISSUE", "DATA_CORRECTION_REQUEST", "OTHER"].map((value) => ({ label: value.replaceAll("_", " "), value }));
const priorityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ label: value, value }));
const statusFilterOptions = [
  { label: "Any status", value: "" },
  { label: "Open", value: "OPEN" },
  { label: "Triaged", value: "TRIAGED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Awaiting school response", value: "AWAITING_SCHOOL_RESPONSE" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" }
];

const boardColumns = [
  { status: "OPEN", label: "New" },
  { status: "TRIAGED", label: "Triaged" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "AWAITING_SCHOOL_RESPONSE", label: "Awaiting School" },
  { status: "ESCALATED", label: "Escalated" },
  { status: "RESOLVED", label: "Resolved" },
  { status: "CLOSED", label: "Closed" }
];

const priorityTone: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  HIGH: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  MEDIUM: { bg: "var(--color-info-dim)", fg: "var(--color-info)" },
  LOW: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

const correctionStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Pending approval" },
  COMPLETED: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Completed" },
  REJECTED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Rejected" }
};

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "board" ? "/super-admin/support" : `/super-admin/support?tab=${tab}`;
}

export default async function SupportTicketsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "board";
  const showCreateTicket = tab === "board" || tab === "queue";
  const [schoolsEnvelope, agentsEnvelope] = showCreateTicket
    ? await Promise.all([
        apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
        apiGetEnvelope<SuperAdminInternalMember[]>("/api/super-admin/internal-team?status=ACTIVE")
      ])
    : [{ data: [] }, { data: [] }];
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const agentOptions = [
    { label: "Unassigned", value: "" },
    ...(agentsEnvelope.data ?? []).map((agent) => ({ label: `${agent.name} (${agent.role.replaceAll("_", " ")})`, value: agent.id }))
  ];

  const tabs = [
    { label: "Ticket Board", href: tabHref("board"), active: tab === "board" },
    { label: "All Tickets", href: tabHref("queue"), active: tab === "queue" },
    { label: "Data Corrections", href: tabHref("corrections"), active: tab === "corrections" },
    { label: "Canned Responses", href: tabHref("canned"), active: tab === "canned" },
    { label: "Analytics", href: tabHref("analytics"), active: tab === "analytics" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">Customer support</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Support Tickets</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Support queue for school issues, internal notes, SLA tracking, and escalation to platform admins or developers.
            </p>
          </div>
          {tab === "board" || tab === "queue" ? (
            <ResourceActionDialog
              triggerLabel="Create Ticket"
              title="Create support ticket"
              description="Open a support ticket for a school and optionally assign it to a support agent."
              endpoint="/api/super-admin/support/tickets"
              fields={[
                { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
                { name: "subject", label: "Subject", required: true },
                { name: "description", label: "Description", type: "textarea", required: true },
                { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: categoryOptions },
                { name: "priority", label: "Priority", type: "select", defaultValue: "MEDIUM", options: priorityOptions },
                { name: "assignedToId", label: "Assigned agent", type: "select", defaultValue: "", options: agentOptions }
              ]}
              submitLabel="Create Ticket"
              confirmLabel="Confirm Ticket"
            />
          ) : null}
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "board" ? <TicketBoardTab /> : null}
      {tab === "queue" ? <TicketQueueTab params={params} schoolOptions={schoolOptions} /> : null}
      {tab === "corrections" ? <DataCorrectionsTab /> : null}
      {tab === "canned" ? <CannedResponsesTab /> : null}
      {tab === "analytics" ? <AnalyticsTab /> : null}
    </div>
  );
}

async function TicketBoardTab() {
  const envelope = await apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?limit=100");
  const tickets = envelope.data ?? [];
  const byColumn = new Map<string, SuperAdminTicketRow[]>(boardColumns.map((column) => [column.status, []]));
  for (const ticket of tickets) {
    (byColumn.get(ticket.status) ?? byColumn.get("OPEN"))?.push(ticket);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-flow-col auto-cols-[260px] gap-3">
        {boardColumns.map((column) => {
          const columnTickets = byColumn.get(column.status) ?? [];
          return (
            <section key={column.status} className="surface-card flex max-h-[70vh] flex-col p-3">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{column.label}</p>
                <span className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-text-muted)]">
                  {columnTickets.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {columnTickets.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-[var(--color-border-default)] px-3 py-4 text-center text-[11px] text-[var(--color-text-muted)]">
                    No tickets
                  </p>
                ) : (
                  columnTickets.map((ticket) => {
                    const tone = priorityTone[ticket.priority] ?? priorityTone.LOW;
                    return (
                      <Link
                        key={ticket.id}
                        href={`/super-admin/support/${ticket.id}`}
                        className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 transition hover:border-[var(--color-accent-primary)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-[var(--font-mono)] text-[11px] font-bold text-[var(--color-text-muted)]">{ticket.ticketNo}</span>
                          <StatusPill bg={tone.bg} fg={tone.fg} label={ticket.priority} />
                        </div>
                        <p className="mt-2 line-clamp-2 text-[12.5px] font-semibold text-[var(--color-text-primary)]">{ticket.subject}</p>
                        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                          {ticket.schoolName} · {ticket.assignedTo || "Unassigned"}
                        </p>
                        {ticket.slaDueAt ? (
                          <p className="mt-1 text-[11px] font-semibold" style={{ color: ticket.slaBreached ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                            {ticket.slaBreached ? "SLA breached" : `Due ${formatDate(ticket.slaDueAt)}`}
                          </p>
                        ) : null}
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

async function TicketQueueTab({ params, schoolOptions }: { params: Record<string, string | undefined>; schoolOptions: Array<{ label: string; value: string }> }) {
  const query = new URLSearchParams();
  for (const key of ["search", "status", "schoolId", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<SuperAdminTicketRow[]>(`/api/super-admin/support/tickets?${query.toString()}`);
  const tickets = envelope.data ?? [];
  const filterSchoolOptions = [{ label: "All schools", value: "" }, ...schoolOptions];

  return (
    <>
      <FilterToolbar
        action="/super-admin/support"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Ticket or subject", defaultValue: params.search },
          { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: filterSchoolOptions },
          { name: "status", label: "Status", type: "select", defaultValue: params.status, options: statusFilterOptions }
        ]}
      />

      <TableCard
        title="Ticket registry"
        description={`${envelope.pagination?.total ?? tickets.length} ticket(s) found — sorted by priority, then most recently updated.`}
        items={tickets}
        emptyState="No support tickets match the current filters."
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <Link href={`/super-admin/support/${item.id}`} className="font-[var(--font-mono)] font-bold text-[var(--color-text-accent)]">{item.ticketNo}</Link> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "category", header: "Category", render: (item) => item.category.replaceAll("_", " ") },
          {
            key: "priority",
            header: "Priority",
            render: (item) => {
              const tone = priorityTone[item.priority] ?? priorityTone.LOW;
              return <StatusPill bg={tone.bg} fg={tone.fg} label={item.priority} />;
            }
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "assigned", header: "Assigned", render: (item) => item.assignedTo || "Unassigned" },
          {
            key: "sla",
            header: "SLA",
            render: (item) =>
              item.slaDueAt ? (
                item.slaBreached ? (
                  <span className="font-bold" style={{ color: "var(--color-danger)" }}>Breached — {formatDate(item.slaDueAt)}</span>
                ) : (
                  formatDate(item.slaDueAt)
                )
              ) : (
                "Not set"
              )
          }
        ]}
      />
    </>
  );
}

async function DataCorrectionsTab() {
  const envelope = await apiGetEnvelope<SuperAdminDataCorrectionRow[]>("/api/super-admin/support/data-corrections");
  const records = envelope.data ?? [];

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Accountability workflow</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Data correction requests</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every correction request carries the requesting agent, the exact before and after values, and the approving
          Super Admin. No correction is ever made without explicit approval — this cannot be bypassed. Requests are
          raised from a ticket via the &quot;Request data correction&quot; action.
        </p>
      </section>

      <TableCard
        title="All requests"
        description={`${records.length} correction request(s) recorded.`}
        items={records}
        emptyState="No data correction requests have been raised yet."
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <Link href={`/super-admin/support/${item.ticketId}`} className="font-[var(--font-mono)] font-bold text-[var(--color-text-accent)]">{item.ticketNo}</Link> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "field", header: "Field corrected", render: (item) => item.fieldCorrected },
          { key: "old", header: "Old value", render: (item) => <span className="text-[var(--color-text-muted)] line-through">{item.oldValue}</span> },
          { key: "new", header: "New value", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.newValue}</span> },
          { key: "requested", header: "Requested by", render: (item) => item.requestedBy ?? "—" },
          {
            key: "status",
            header: "Status",
            render: (item) => {
              const tone = correctionStatusTone[item.status] ?? correctionStatusTone.PENDING;
              return <StatusPill bg={tone.bg} fg={tone.fg} label={tone.label} />;
            }
          },
          {
            key: "actions",
            header: "Actions",
            render: (item) =>
              item.status === "PENDING" ? (
                <div className="flex gap-2">
                  <ResourceActionDialog
                    triggerLabel="Approve"
                    title={`Approve correction — ${item.fieldCorrected}`}
                    description={`This confirms changing "${item.oldValue}" to "${item.newValue}" and writes an immutable audit entry. This is a Super Admin-only action.`}
                    endpoint={`/api/super-admin/support/data-correction/${item.id}/approve`}
                    method="PATCH"
                    variant="secondary"
                    submitLabel="Approve"
                    confirmLabel="Confirm approval"
                    fields={[]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Reject"
                    title={`Reject correction — ${item.fieldCorrected}`}
                    description="Reject this correction request with a logged reason."
                    endpoint={`/api/super-admin/support/data-correction/${item.id}/reject`}
                    method="PATCH"
                    variant="menuDanger"
                    submitLabel="Reject"
                    confirmLabel="Confirm"
                    fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
                  />
                </div>
              ) : (
                <span className="text-[12px] text-[var(--color-text-muted)]">{item.approvedBy ?? "—"}</span>
              )
          }
        ]}
      />
    </section>
  );
}

async function CannedResponsesTab() {
  const envelope = await apiGetEnvelope<SuperAdminCannedResponse[]>("/api/super-admin/support/canned-responses");
  const responses = envelope.data ?? [];

  return (
    <TableCard
      title="Canned responses"
      description="Pre-written responses agents can personalize and send for common questions in each category."
      items={responses}
      actions={
        <ResourceActionDialog
          triggerLabel="New canned response"
          title="Create canned response"
          description="Add a reusable response for a ticket category."
          endpoint="/api/super-admin/support/canned-responses"
          method="POST"
          submitLabel="Create"
          fields={[
            { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: categoryOptions },
            { name: "title", label: "Title", required: true },
            { name: "body", label: "Response body", type: "textarea", required: true }
          ]}
        />
      }
      columns={[
        { key: "category", header: "Category", render: (item) => item.category.replaceAll("_", " ") },
        { key: "title", header: "Title", render: (item) => item.title },
        { key: "body", header: "Body", render: (item) => <span className="line-clamp-2 text-[13px] text-[var(--color-text-secondary)]">{item.body}</span> },
        { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ResourceActionDialog
              triggerLabel="Edit"
              title={`Edit ${item.title}`}
              description="Update this canned response."
              endpoint={`/api/super-admin/support/canned-responses/${item.id}`}
              method="PATCH"
              variant="secondary"
              submitLabel="Save"
              fields={[
                { name: "category", label: "Category", type: "select", defaultValue: item.category, options: categoryOptions },
                { name: "title", label: "Title", defaultValue: item.title, required: true },
                { name: "body", label: "Response body", type: "textarea", defaultValue: item.body, required: true }
              ]}
            />
          )
        }
      ]}
      emptyState="No canned responses yet — the Support Lead maintains this library."
    />
  );
}

async function AnalyticsTab() {
  const analytics = await apiGet<SuperAdminTicketAnalytics>("/api/super-admin/support/analytics");
  const slaRate = analytics.totalResolved > 0 ? Math.round((analytics.resolvedWithinSla / analytics.totalResolved) * 1000) / 10 : 0;

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Opened (30d)", value: analytics.totalOpened },
          { label: "Resolved (30d)", value: analytics.totalResolved },
          { label: "Resolved within SLA", value: `${slaRate}%` },
          { label: "Categories tracked", value: analytics.categoryBreakdown.length }
        ].map((item) => (
          <article key={item.label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Response time</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Avg resolution time by priority</h3>
          <div className="mt-4 grid gap-2">
            {Object.entries(analytics.avgResolutionByPriority).map(([priority, hours]) => (
              <div key={priority} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{priority}</span>
                <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{hours}h</span>
              </div>
            ))}
          </div>
        </section>
        <section className="surface-card p-6">
          <p className="section-eyebrow">Issue mix</p>
          <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Category breakdown (30d)</h3>
          <div className="mt-4 grid gap-2">
            {analytics.categoryBreakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.category.replaceAll("_", " ")}</span>
                <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{item.count}</span>
              </div>
            ))}
            {analytics.categoryBreakdown.length === 0 ? <p className="text-center text-[13px] text-[var(--color-text-muted)]">No tickets in the last 30 days.</p> : null}
          </div>
        </section>
      </section>

      <TableCard
        title="Per-agent performance (30d)"
        description="Ticket volume and average CSAT per assigned agent."
        items={analytics.perAgent}
        columns={[
          { key: "agent", header: "Agent", render: (item) => item.agentName },
          { key: "tickets", header: "Tickets handled", render: (item) => item.ticketsHandled },
          { key: "csat", header: "Avg CSAT", render: (item) => (item.avgCsat !== null ? `${item.avgCsat} / 5` : "No ratings yet") }
        ]}
        emptyState="No agent activity in the last 30 days."
      />
    </section>
  );
}
