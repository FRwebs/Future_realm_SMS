import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  LifeBuoy,
  MessageSquareText,
  UserRoundCheck
} from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminCannedResponse, SuperAdminDataCorrectionRow, SuperAdminInternalMember, SuperAdminKnowledgeBaseArticle, SuperAdminSchoolRow, SuperAdminTicketAnalytics, SuperAdminTicketRow } from "@/lib/domain/types";
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

const articleStatusTone: Record<string, { bg: string; fg: string }> = {
  PUBLISHED: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  DRAFT: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

const articleStatusOptions = [
  { label: "Published", value: "PUBLISHED" },
  { label: "Draft", value: "DRAFT" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function hoursUntil(value?: string) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60));
}

function TicketMiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
      <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-[13px] font-extrabold text-[var(--color-text-primary)] tabular-nums" title={String(value)}>
        {value}
      </p>
    </div>
  );
}

function TicketPreviewCard({ ticket }: { ticket: SuperAdminTicketRow }) {
  const tone = priorityTone[ticket.priority] ?? priorityTone.LOW;
  const dueHours = hoursUntil(ticket.slaDueAt);

  return (
    <Link href={`/super-admin/support/${ticket.id}`} className="surface-card grid gap-4 p-4 transition hover:border-[var(--color-accent-primary)] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-[var(--font-mono)] text-[11px] font-bold text-[var(--color-text-muted)]">{ticket.ticketNo}</p>
          <h3 className="mt-1 line-clamp-2 text-[15px] font-extrabold text-[var(--color-text-primary)]">{ticket.subject}</h3>
          <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">{ticket.schoolName}</p>
        </div>
        <StatusPill bg={tone.bg} fg={tone.fg} label={priorityLabel[ticket.priority] ?? ticket.priority} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <TicketMiniMetric label="Status" value={formatLabel(ticket.status)} />
        <TicketMiniMetric label="Messages" value={ticket.messageCount} />
        <TicketMiniMetric label="Agent" value={ticket.assignedTo || "Unassigned"} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">SLA</p>
          <p className="mt-1 text-[12.5px] font-semibold text-[var(--color-text-primary)]">
            {ticket.slaDueAt ? (ticket.slaBreached ? "Breached" : `${dueHours ?? 0}h remaining`) : "Not set"}
          </p>
        </div>
        {ticket.slaBreached ? (
          <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Breach" />
        ) : (
          <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="On track" />
        )}
      </div>
    </Link>
  );
}

const flowToneStyle: Record<string, { bg: string; fg: string }> = {
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  ink: { bg: "var(--color-bg-elevated)", fg: "var(--color-text-primary)" },
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
};

function FlowSteps({ title, sub, steps }: { title: string; sub?: string; steps: Array<{ label: string; note: string; tone?: string }> }) {
  return (
    <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-5">
      <p className="font-[var(--font-display)] text-[16px] font-bold text-[#0D2315]">{title}</p>
      {sub ? <p className="sr-only">{sub}</p> : null}
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
        {steps.map((step, index) => {
          const tone = flowToneStyle[step.tone ?? "mute"];
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div className="min-w-[9.5rem] rounded-[11px] border px-3.5 py-2.5" style={{ background: tone.bg, borderColor: tone.bg }}>
                <p className="text-[12px] font-bold" style={{ color: tone.fg }}>{step.label}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-[var(--color-text-secondary)]">{step.note}</p>
              </div>
              {index < steps.length - 1 ? <span className="shrink-0 text-[var(--color-text-muted)]">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function tabHref(tab: string) {
  return tab === "board" ? "/super-admin/support" : `/super-admin/support?tab=${tab}`;
}

export default async function SupportTicketsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "board";
  const showCreateTicket = tab === "board" || tab === "tickets";
  const [schoolsEnvelope, agentsEnvelope, openTicketsEnvelope, correctionsEnvelope] = await Promise.all([
    showCreateTicket
      ? apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100")
      : Promise.resolve({ data: [] as SuperAdminSchoolRow[] }),
    showCreateTicket
      ? apiGetEnvelope<SuperAdminInternalMember[]>("/api/super-admin/internal-team?status=ACTIVE")
      : Promise.resolve({ data: [] as SuperAdminInternalMember[] }),
    apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?status=OPEN&limit=1"),
    apiGetEnvelope<SuperAdminDataCorrectionRow[]>("/api/super-admin/support/data-corrections")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const agentOptions = [
    { label: "Unassigned", value: "" },
    ...(agentsEnvelope.data ?? []).map((agent) => ({ label: `${agent.name} (${agent.role.replaceAll("_", " ")})`, value: agent.id }))
  ];
  const openTicketCount = openTicketsEnvelope.pagination?.total ?? (openTicketsEnvelope.data ?? []).length;
  const correctionRecords = correctionsEnvelope.data ?? [];
  const pendingCorrectionCount = correctionRecords.filter((record) => record.status === "PENDING").length;

  const tabs = [
    { label: "Board", href: tabHref("board"), active: tab === "board", badge: openTicketCount },
    { label: "Tickets", href: tabHref("tickets"), active: tab === "tickets" },
    { label: "Data Corrections", href: tabHref("corrections"), active: tab === "corrections", badge: pendingCorrectionCount },
    { label: "Knowledge", href: tabHref("knowledge"), active: tab === "knowledge" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Operations"
        title="Support Tickets"
        description="One queue for school issues, internal notes, SLA ownership, escalation, data corrections, and reusable answers."
        action={
          tab === "board" || tab === "tickets" ? (
            <ResourceActionDialog
              triggerLabel="Create Ticket"
              title="Create support ticket"
              description="Open a support ticket for a school and optionally assign it to a support agent."
              endpoint="/api/super-admin/support/tickets"
              variant="heroWhite"
              fields={[
                { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "Who and what" },
                {
                  name: "raisedBy",
                  label: "Raised by",
                  type: "static",
                  placeholder: "You — attributed automatically",
                  note: "Not a form field — every ticket is attributed to the admin creating it.",
                  section: "Who and what"
                },
                { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: categoryOptions, section: "Who and what" },
                { name: "priority", label: "Priority", type: "select", defaultValue: "MEDIUM", options: priorityOptions, section: "Who and what" },
                { name: "subject", label: "Subject", required: true, section: "The problem" },
                { name: "description", label: "Description", type: "textarea", required: true, section: "The problem" },
                { name: "assignedToId", label: "Assign to", type: "select", defaultValue: "", options: agentOptions, section: "Ownership" },
                {
                  name: "target",
                  label: "Target",
                  type: "static",
                  placeholder: "Set from priority · 1h Critical / 4h High / 8h Medium / 24h Low",
                  note: "Runs as flat hours from creation, not the school's local working hours yet.",
                  section: "Ownership"
                }
              ]}
              submitLabel="Create Ticket"
              confirmLabel="Confirm Ticket"
            />
          ) : undefined
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "board" ? <TicketBoardTab /> : null}
      {tab === "tickets" ? <TicketQueueTab params={params} schoolOptions={schoolOptions} /> : null}
      {tab === "corrections" ? <DataCorrectionsTab records={correctionRecords} /> : null}
      {tab === "knowledge" ? <KnowledgeTab /> : null}
    </div>
  );
}

async function TicketBoardTab() {
  const envelope = await apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?limit=100");
  const tickets = envelope.data ?? [];
  const openTickets = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status));
  const breachedTickets = openTickets.filter((ticket) => ticket.slaBreached);
  const criticalTickets = openTickets.filter((ticket) => ticket.priority === "CRITICAL");
  const byColumn = new Map<string, SuperAdminTicketRow[]>(boardColumns.map((column) => [column.status, []]));
  for (const ticket of tickets) {
    (byColumn.get(ticket.status) ?? byColumn.get("OPEN"))?.push(ticket);
  }

  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
  const resolvedToday = tickets.filter((ticket) => ticket.resolvedAt && isToday(ticket.resolvedAt));
  const resolutionHours = resolvedToday
    .map((ticket) => (new Date(ticket.resolvedAt as string).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60))
    .filter((hours) => hours >= 0);
  const avgResolutionHours = resolutionHours.length ? Math.round((resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length) * 10) / 10 : null;
  const csatScores = tickets.map((ticket) => ticket.csatScore).filter((score): score is number => score !== null);
  const avgCsat = csatScores.length ? Math.round((csatScores.reduce((sum, s) => sum + s, 0) / csatScores.length) * 10) / 10 : null;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Open workload" value={openTickets.length} detail="Tickets not closed" icon={Inbox} tone="dark" />
        <StatCard label="Critical priority" value={criticalTickets.length} detail="Highest urgency" icon={Activity} tone={criticalTickets.length ? "warning" : "neutral"} />
        <StatCard label="SLA breaches" value={breachedTickets.length} detail="Needs escalation" icon={AlertTriangle} tone={breachedTickets.length ? "danger" : "neutral"} />
        <StatCard label="Resolved today" value={resolvedToday.length} detail="Across this 100-ticket window" icon={CheckCircle2} tone="success" />
        <StatCard label="Avg resolution (today)" value={avgResolutionHours !== null ? `${avgResolutionHours}h` : "N/A"} detail={avgResolutionHours !== null ? "Created-to-resolved" : "Nothing resolved today yet"} icon={Clock3} tone="info" />
        <StatCard label="CSAT (recent)" value={avgCsat !== null ? `${avgCsat} / 5` : "N/A"} detail={csatScores.length ? `From ${csatScores.length} response(s)` : "No responses in this window"} icon={MessageSquareText} tone={avgCsat !== null && avgCsat < 3.5 ? "warning" : "neutral"} />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {openTickets
          .sort((a, b) => Number(b.slaBreached) - Number(a.slaBreached) || new Date(a.slaDueAt ?? a.createdAt).getTime() - new Date(b.slaDueAt ?? b.createdAt).getTime())
          .slice(0, 6)
          .map((ticket) => <TicketPreviewCard key={ticket.id} ticket={ticket} />)}
      </section>

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

      <SlaSection tickets={tickets} />
    </div>
  );
}

const priorityLabel: Record<string, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Standard", LOW: "Low" };
const slaTargetHours: Record<string, number> = { CRITICAL: 1, HIGH: 4, MEDIUM: 8, LOW: 24 };
const priorityDefinition: Record<string, string> = {
  CRITICAL: "Result or data visibility issue, login failure, data loss",
  HIGH: "Core workflow broken — results, fees, attendance — with no workaround",
  MEDIUM: "Feature not behaving as expected; a workaround exists",
  LOW: "How-to question, minor inconvenience, feature request"
};

function SlaSection({ tickets }: { tickets: SuperAdminTicketRow[] }) {
  const openTickets = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status));
  const priorityRows = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((priority) => ({
    priority,
    openNow: openTickets.filter((ticket) => ticket.priority === priority).length
  }));
  const categoryCounts = new Map<string, number>();
  for (const ticket of openTickets) {
    categoryCounts.set(ticket.category, (categoryCounts.get(ticket.category) ?? 0) + 1);
  }
  const categoryRows = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <section className="grid gap-5">
      <TableCard
        title="Priority and service levels"
        items={priorityRows}
        getRowKey={(row) => row.priority}
        columns={[
          {
            key: "priority",
            header: "Priority",
            render: (row) => {
              const tone = priorityTone[row.priority] ?? priorityTone.LOW;
              return <StatusPill bg={tone.bg} fg={tone.fg} label={priorityLabel[row.priority]} />;
            }
          },
          { key: "target", header: "Target", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{slaTargetHours[row.priority]} hour(s)</span> },
          { key: "definition", header: "Definition", render: (row) => <span className="text-[var(--color-text-secondary)]">{priorityDefinition[row.priority]}</span> },
          { key: "openNow", header: "Open now", render: (row) => row.openNow }
        ]}
        emptyState="—"
      />

      <TableCard
        title="Issue categories"
        items={categoryRows}
        getRowKey={(row) => row.category}
        columns={[
          { key: "category", header: "Category", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{formatLabel(row.category)}</span> },
          { key: "count", header: "Open volume", render: (row) => row.count }
        ]}
        emptyState="No open tickets right now."
      />
    </section>
  );
}

async function TicketAnalyticsSection() {
  const analytics = await apiGet<SuperAdminTicketAnalytics>("/api/super-admin/support/analytics");
  const slaRate = analytics.totalResolved > 0 ? Math.round((analytics.resolvedWithinSla / analytics.totalResolved) * 1000) / 10 : 0;

  return (
    <section className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Opened (30d)", value: analytics.totalOpened, tone: "dark" as const },
          { label: "Resolved (30d)", value: analytics.totalResolved, tone: "success" as const },
          { label: "Resolved within SLA", value: `${slaRate}%`, tone: "accent" as const },
          { label: "Categories tracked", value: analytics.categoryBreakdown.length, tone: "warning" as const }
        ].map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} icon={item.label.includes("Resolved") ? CheckCircle2 : MessageSquareText} />
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
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{formatLabel(item.category)}</span>
                <span className="font-[var(--font-mono)] text-[13px] font-bold text-[var(--color-text-primary)]">{item.count}</span>
              </div>
            ))}
            {analytics.categoryBreakdown.length === 0 ? <p className="text-center text-[13px] text-[var(--color-text-muted)]">No tickets in the last 30 days.</p> : null}
          </div>
        </section>
      </section>

      <TableCard
        title="Per-agent performance (30d)"
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

async function TicketQueueTab({ params, schoolOptions }: { params: Record<string, string | undefined>; schoolOptions: Array<{ label: string; value: string }> }) {
  const query = new URLSearchParams();
  for (const key of ["search", "status", "schoolId", "page"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const envelope = await apiGetEnvelope<SuperAdminTicketRow[]>(`/api/super-admin/support/tickets?${query.toString()}`);
  const tickets = envelope.data ?? [];
  const activeTickets = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status));
  const breachedTickets = activeTickets.filter((ticket) => ticket.slaBreached);
  const unassignedTickets = activeTickets.filter((ticket) => !ticket.assignedTo);
  const filterSchoolOptions = [{ label: "All schools", value: "" }, ...schoolOptions];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Tickets in view" value={envelope.pagination?.total ?? tickets.length} detail={`${activeTickets.length} active on this page`} icon={LifeBuoy} tone="dark" />
        <StatCard label="SLA breached" value={breachedTickets.length} detail="Visible in this view" icon={AlertTriangle} tone={breachedTickets.length ? "danger" : "neutral"} />
        <StatCard label="Unassigned" value={unassignedTickets.length} detail="No agent owner" icon={UserRoundCheck} tone={unassignedTickets.length ? "warning" : "success"} />
        <StatCard label="Messages" value={tickets.reduce((sum, ticket) => sum + ticket.messageCount, 0)} detail="Conversation volume" icon={MessageSquareText} tone="info" />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {tickets.slice(0, 6).map((ticket) => <TicketPreviewCard key={ticket.id} ticket={ticket} />)}
      </section>

      <TableCard
        title="Ticket registry"
        items={tickets}
        emptyState="No support tickets match the current filters."
        filterBar={
          <FilterToolbar
            action="/super-admin/support"
            resultCount={envelope.pagination?.total}
            controls={[
              { name: "search", label: "Search", type: "search", placeholder: "Ticket or subject", defaultValue: params.search },
              { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: filterSchoolOptions },
              { name: "status", label: "Status", type: "select", defaultValue: params.status, options: statusFilterOptions }
            ]}
          />
        }
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <Link href={`/super-admin/support/${item.id}`} className="font-[var(--font-mono)] font-bold text-[var(--color-text-accent)]">{item.ticketNo}</Link> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "category", header: "Category", render: (item) => formatLabel(item.category) },
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

      <TicketAnalyticsSection />
    </div>
  );
}

async function DataCorrectionsTab({ records }: { records: SuperAdminDataCorrectionRow[] }) {
  return (
    <section className="grid gap-5">
      <FlowSteps
        title="Data correction request workflow"
        sub="No correction is ever made without explicit approval and a logged audit entry — this cannot be bypassed in the code."
        steps={[
          { label: "Raised from a ticket", note: "Any support agent can request one via the ticket's \"Request data correction\" action.", tone: "mute" },
          { label: "Platform Owner or Super Admin approves", note: "Mandatory — the approve/reject endpoints reject any other role.", tone: "ink" },
          { label: "Correction recorded", note: "An audit log entry is written with the field, old value and new value.", tone: "good" },
          { label: "School notified", note: "Not automated — there's no notification sent to the school on completion today.", tone: "warn" }
        ]}
      />

      <TableCard
        title="All requests"
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

async function KnowledgeTab() {
  const [articlesEnvelope, responsesEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminKnowledgeBaseArticle[]>("/api/super-admin/support/knowledge-base"),
    apiGetEnvelope<SuperAdminCannedResponse[]>("/api/super-admin/support/canned-responses")
  ]);
  const articles = articlesEnvelope.data ?? [];
  const responses = responsesEnvelope.data ?? [];

  return (
    <div className="grid gap-8">
      <TableCard
        title="Knowledge base articles"
        items={articles}
        getRowKey={(item) => item.id}
        actions={
          <ResourceActionDialog
            triggerLabel="New article"
            title="Create knowledge base article"
            description="Publish a help article for school staff or the internal support team."
            endpoint="/api/super-admin/support/knowledge-base"
            method="POST"
            submitLabel="Create article"
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "category", label: "Category", required: true, placeholder: "e.g. Billing, Attendance, Getting started" },
              { name: "body", label: "Content", type: "textarea", required: true },
              { name: "status", label: "Status", type: "select", defaultValue: "PUBLISHED", options: articleStatusOptions }
            ]}
          />
        }
        columns={[
          { key: "title", header: "Title", render: (item) => item.title },
          { key: "category", header: "Category", render: (item) => item.category },
          { key: "status", header: "Status", render: (item) => { const tone = articleStatusTone[item.status] ?? articleStatusTone.DRAFT; return <StatusPill bg={tone.bg} fg={tone.fg} label={item.status} />; } },
          { key: "author", header: "Author", render: (item) => item.author },
          { key: "views", header: "Views", render: (item) => item.views },
          { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt) }
        ]}
        emptyState="No knowledge base articles yet — create the first one for school staff."
      />

      <TableCard
        title="Canned responses"
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
    </div>
  );
}
