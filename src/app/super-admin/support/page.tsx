import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminCannedResponse, SuperAdminTicketAnalytics, SuperAdminTicketRow } from "@/lib/domain/types";
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

function tabHref(tab: string) {
  return tab === "queue" ? "/super-admin/support" : `/super-admin/support?tab=${tab}`;
}

export default async function SupportTicketsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "queue";

  const tabs = [
    { label: "Ticket Queue", href: tabHref("queue"), active: tab === "queue" },
    { label: "Canned Responses", href: tabHref("canned"), active: tab === "canned" },
    { label: "Analytics", href: tabHref("analytics"), active: tab === "analytics" }
  ];

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
          {tab === "queue" ? (
            <ResourceActionDialog
              triggerLabel="Create Ticket"
              title="Create support ticket"
              description="Open a support ticket for a school and optionally assign it to a support agent."
              endpoint="/api/super-admin/support/tickets"
              fields={[
                { name: "schoolId", label: "School ID", required: true },
                { name: "subject", label: "Subject", required: true },
                { name: "description", label: "Description", type: "textarea", required: true },
                { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: categoryOptions },
                { name: "priority", label: "Priority", type: "select", defaultValue: "MEDIUM", options: priorityOptions },
                { name: "assignedToId", label: "Assigned agent user ID" }
              ]}
              submitLabel="Create Ticket"
              confirmLabel="Confirm Ticket"
            />
          ) : null}
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "queue" ? <TicketQueueTab params={params} /> : null}
      {tab === "canned" ? <CannedResponsesTab /> : null}
      {tab === "analytics" ? <AnalyticsTab /> : null}
    </div>
  );
}

async function TicketQueueTab({ params }: { params: Record<string, string | undefined> }) {
  const query = new URLSearchParams();
  for (const key of ["search", "status", "schoolId", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<SuperAdminTicketRow[]>(`/api/super-admin/support/tickets?${query.toString()}`);
  const tickets = envelope.data ?? [];

  return (
    <>
      <FilterToolbar
        action="/super-admin/support"
        resultCount={envelope.pagination?.total}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Ticket or subject", defaultValue: params.search },
          { name: "schoolId", label: "School ID", type: "search", defaultValue: params.schoolId },
          { name: "status", label: "Status", type: "select", defaultValue: params.status, options: statusFilterOptions }
        ]}
      />

      <TableCard
        title="Ticket Queue"
        description={`${envelope.pagination?.total ?? tickets.length} ticket(s) found — sorted by priority, then most recently updated.`}
        items={tickets}
        emptyState="No support tickets match the current filters."
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <Link href={`/super-admin/support/${item.id}`} className="font-semibold text-brand-700">{item.ticketNo}</Link> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "category", header: "Category", render: (item) => item.category.replaceAll("_", " ") },
          { key: "priority", header: "Priority", render: (item) => <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{item.priority}</span> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "assigned", header: "Assigned", render: (item) => item.assignedTo },
          { key: "sla", header: "SLA", render: (item) => item.slaDueAt ? (item.slaBreached ? <span className="font-bold text-rose-700">Breached — {formatDate(item.slaDueAt)}</span> : formatDate(item.slaDueAt)) : "Not set" }
        ]}
      />
    </>
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
        { key: "body", header: "Body", render: (item) => <span className="line-clamp-2 text-sm text-ink/60">{item.body}</span> },
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
    <section className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Opened (30d)", value: analytics.totalOpened },
          { label: "Resolved (30d)", value: analytics.totalResolved },
          { label: "Resolved within SLA", value: `${slaRate}%` },
          { label: "Categories tracked", value: analytics.categoryBreakdown.length }
        ].map((item) => (
          <article key={item.label} className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">{item.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-xl font-bold text-ink">Avg resolution time by priority</h3>
          <div className="mt-4 grid gap-2">
            {Object.entries(analytics.avgResolutionByPriority).map(([priority, hours]) => (
              <div key={priority} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{priority}</span>
                <span className="font-[var(--font-mono)] text-sm font-black text-ink">{hours}h</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h3 className="font-[var(--font-heading)] text-xl font-bold text-ink">Category breakdown (30d)</h3>
          <div className="mt-4 grid gap-2">
            {analytics.categoryBreakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{item.category.replaceAll("_", " ")}</span>
                <span className="font-[var(--font-mono)] text-sm font-black text-ink">{item.count}</span>
              </div>
            ))}
            {analytics.categoryBreakdown.length === 0 ? <p className="text-center text-sm text-ink/50">No tickets in the last 30 days.</p> : null}
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
