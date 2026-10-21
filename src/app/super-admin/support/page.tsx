import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, LifeBuoy, MessageSquareText, Repeat2, Activity } from "lucide-react";

import { BarList } from "@/components/data-display/bar-list";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { FlowSteps } from "@/components/data-display/flow-steps";
import { ModuleHero } from "@/components/data-display/module-hero";
import { ReferenceList } from "@/components/data-display/reference-list";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminCannedResponse, SuperAdminDataCorrectionRow, SuperAdminInternalMember, SuperAdminSchoolRow, SuperAdminTicketRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const categoryOptions = ["BILLING", "TECHNICAL_BUG", "FEATURE_REQUEST", "ACCOUNT_ACCESS", "DATA_ISSUE", "RESULT_COMPUTATION", "NOTIFICATION_DELIVERY", "SYNC_OFFLINE_ISSUE", "DATA_CORRECTION_REQUEST", "FEE_MANAGEMENT", "DATA_MIGRATION", "ONBOARDING_SETUP", "OTHER"].map((value) => ({ label: value.replaceAll("_", " "), value }));
const priorityOptions = [
  { label: "Low", value: "LOW" },
  { label: "Standard", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Critical", value: "CRITICAL" }
];
const statusFilterOptions = [
  { label: "Open tickets", value: "" },
  { label: "Any status", value: "all" },
  { label: "New", value: "OPEN" },
  { label: "Triaged", value: "TRIAGED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Awaiting school", value: "AWAITING_SCHOOL_RESPONSE" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" }
];

/** The mockup's six columns. A ticket that has been escalated stays in In Progress and says so on its card. */
const boardColumns = [
  { label: "New", statuses: ["OPEN"] },
  { label: "Triaged", statuses: ["TRIAGED"] },
  { label: "In Progress", statuses: ["IN_PROGRESS", "ESCALATED"] },
  { label: "Awaiting School", statuses: ["AWAITING_SCHOOL_RESPONSE"] },
  { label: "Resolved", statuses: ["RESOLVED"] },
  { label: "Closed", statuses: ["CLOSED"] }
];

const priorityLabel: Record<string, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Standard", LOW: "Low" };
const priorityTone: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  HIGH: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  MEDIUM: { bg: "var(--color-info-dim)", fg: "var(--color-info)" },
  LOW: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};
const correctionStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Pending" },
  VALIDATED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Validated · awaiting approval" },
  COMPLETED: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Completed" },
  REJECTED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Rejected" }
};
const toneBg: Record<string, { bg: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  teal: { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

type Board = { open: number; critical: number; breaching: number; resolvedToday: number; resolvedTodayWithinSla: number; avgResolutionWeek: number | null; avgResolutionLastWeek: number | null; csat: number | null; csatResponses: number };
type ServiceLevels = {
  levels: Array<{ key: string; label: string; hours: number; definition: string; escalation: string; open: number }>;
  categories: Array<{ key: string; label: string; covers: string; volume: number; open: number }>;
  termVolume: number; newCategoryVolume: number;
  countries: Array<{ country: string; hours: string | null; holidays: number | null; live: boolean; configured: boolean; timeZone: string | null; workStart: string | null; workEnd: string | null; holidayDates: string[] }>;
};
type Analytics = {
  kpis: { openedWeek: number; openedPrev: number; withinSla: number | null; resolvedWeek: number; criticalMinutes: number | null; criticalCount: number; repeatRate: number | null; sampled: number; csat: number | null; csatResponses: number };
  perAgent: Array<{ id: string; name: string; assigned: number; resolved: number; withinSla: number | null; csat: number | null; responses: number; standing: string; tone: string }>;
  byPriority: Array<{ key: string; label: string; target: number; hours: number | null; count: number }>;
};
type Knowledge = {
  responses: Array<{ id: string; title: string; category: string; used: number; updatedAt: string; needsReview: boolean }>;
  articles: Array<{ id: string; title: string; category: string; status: string; views: number; updatedAt: string }>;
};

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

const tonePill = (label: string, tone: string) => <StatusPill bg={(toneBg[tone] ?? toneBg.mute).bg} fg={(toneBg[tone] ?? toneBg.mute).fg} label={label} />;
const formatLabel = (value: string) => value.replaceAll("_", " ");
const duration = (hours: number) => (hours < 1 ? `${Math.round(hours * 60)} min` : `${hours}h`);

function tabHref(tab: string) {
  return tab === "board" ? "/super-admin/support" : `/super-admin/support?tab=${tab}`;
}

export default async function SupportTicketsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "board";
  const showCreateTicket = tab === "board" || tab === "tickets";
  const [schoolsEnvelope, agentsEnvelope, board, correctionsEnvelope] = await Promise.all([
    apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?limit=100"),
    apiGetEnvelope<SuperAdminInternalMember[]>("/api/super-admin/internal-team?status=ACTIVE"),
    apiGet<Board>("/api/super-admin/support-desk/board"),
    apiGetEnvelope<SuperAdminDataCorrectionRow[]>("/api/super-admin/support/data-corrections")
  ]);
  const schoolOptions = (schoolsEnvelope.data ?? []).map((school) => ({ label: school.name, value: school.id }));
  const agents = agentsEnvelope.data ?? [];
  const agentOptions = [{ label: "Unassigned", value: "" }, ...agents.map((agent) => ({ label: `${agent.name} (${agent.role.replaceAll("_", " ")})`, value: agent.id }))];
  const correctionRecords = correctionsEnvelope.data ?? [];
  const openCorrections = correctionRecords.filter((record) => record.status === "PENDING").length;

  const tabs = [
    { label: "Board", href: tabHref("board"), active: tab === "board", badge: board.breaching },
    { label: "Tickets", href: tabHref("tickets"), active: tab === "tickets" },
    { label: "Data Corrections", href: tabHref("corrections"), active: tab === "corrections", badge: openCorrections },
    { label: "Knowledge", href: tabHref("knowledge"), active: tab === "knowledge" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Operations"
        title="Support"
        description="No school’s problem unseen, unowned or unmeasured."
        action={
          showCreateTicket ? (
            <ResourceActionDialog
              triggerLabel="New ticket"
              title="New ticket"
              description="Owned from the moment it is raised. The countdown runs in the school’s own working hours where its country has them, else in flat hours from now."
              endpoint="/api/super-admin/support/tickets"
              variant="heroWhite"
              fields={[
                { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions, section: "Who and what" },
                { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: categoryOptions, section: "Who and what" },
                { name: "priority", label: "Priority", type: "select", defaultValue: "MEDIUM", options: priorityOptions, section: "Who and what" },
                { name: "subject", label: "Subject", required: true, section: "The problem" },
                { name: "description", label: "Description", type: "textarea", required: true, section: "The problem" },
                { name: "assignedToId", label: "Assign to", type: "select", defaultValue: "", options: agentOptions, section: "Ownership" },
                { name: "target", label: "Target", type: "static", placeholder: "Set from priority · 1h Critical / 4h High / 8h Standard / 24h Low", note: "Countdowns run in the school’s own working hours and time zone where its country has them set.", section: "Ownership" }
              ]}
              submitLabel="Create ticket"
              confirmLabel="Confirm ticket"
            />
          ) : undefined
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "board" ? <TicketBoardTab board={board} /> : null}
      {tab === "tickets" ? <TicketQueueTab params={params} schoolOptions={schoolOptions} agents={agents} board={board} /> : null}
      {tab === "corrections" ? <DataCorrectionsTab records={correctionRecords} /> : null}
      {tab === "knowledge" ? <KnowledgeTab /> : null}
    </div>
  );
}

async function TicketBoardTab({ board }: { board: Board }) {
  const [envelope, levels] = await Promise.all([
    apiGetEnvelope<SuperAdminTicketRow[]>("/api/super-admin/support/tickets?status=all&limit=100"),
    apiGet<ServiceLevels>("/api/super-admin/support-desk/service-levels")
  ]);
  const tickets = envelope.data ?? [];
  const weekDelta =
    board.avgResolutionWeek !== null && board.avgResolutionLastWeek !== null ? `vs ${duration(board.avgResolutionLastWeek)} last week` : board.avgResolutionWeek === null ? "Nothing resolved this week yet" : "No resolutions the week before";

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Open tickets" value={board.open} detail="Across all channels" icon={Inbox} tone="dark" />
        <StatCard label="Critical open" value={board.critical} detail="1 hour resolution target" icon={Activity} tone={board.critical ? "warning" : "neutral"} />
        <StatCard label="Breaching SLA now" value={board.breaching} detail="Support leads alerted" icon={AlertTriangle} tone={board.breaching ? "danger" : "neutral"} />
        <StatCard label="Resolved today" value={board.resolvedToday} detail={`${board.resolvedTodayWithinSla} within SLA`} icon={CheckCircle2} tone="success" />
        <StatCard label="Avg resolution (week)" value={board.avgResolutionWeek !== null ? duration(board.avgResolutionWeek) : "—"} detail={weekDelta} icon={Clock3} tone="info" />
        <StatCard label="CSAT this week" value={board.csat !== null ? `${board.csat} / 5` : "—"} detail={board.csatResponses ? `From ${board.csatResponses} response${board.csatResponses === 1 ? "" : "s"}` : "No responses this week"} icon={MessageSquareText} tone={board.csat !== null && board.csat < 3.5 ? "warning" : "info"} />
      </section>

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-flow-col auto-cols-[260px] gap-3">
          {boardColumns.map((column) => {
            const columnTickets = tickets.filter((ticket) => column.statuses.includes(ticket.status));
            return (
              <section key={column.label} className="surface-card flex max-h-[70vh] flex-col p-3">
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-[11.5px] font-bold text-[var(--color-text-primary)]">{column.label}</p>
                  <span className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">{columnTickets.length}</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {columnTickets.length === 0 ? (
                    <p className="rounded-[9px] border border-dashed border-[var(--color-border-default)] px-3 py-4 text-center text-[10px] text-[var(--color-text-muted)]">No tickets</p>
                  ) : (
                    columnTickets.map((ticket) => {
                      const tone = priorityTone[ticket.priority] ?? priorityTone.LOW;
                      return (
                        <Link key={ticket.id} href={`/super-admin/support/${ticket.id}`} className="rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 transition hover:border-[var(--color-accent-primary)]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-[var(--font-mono)] text-[10px] font-bold text-[var(--color-text-muted)]">{ticket.ticketNo}</span>
                            <StatusPill bg={tone.bg} fg={tone.fg} label={priorityLabel[ticket.priority] ?? ticket.priority} />
                          </div>
                          <p className="mt-2 line-clamp-2 text-[11.5px] font-semibold text-[var(--color-text-primary)]">{ticket.subject}</p>
                          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">{ticket.schoolName} · {ticket.assignedTo || "Unassigned"}</p>
                          {ticket.status === "ESCALATED" ? <p className="mt-1 text-[10px] font-bold text-[var(--color-danger)]">Escalated</p> : null}
                          {ticket.slaDueAt && !["RESOLVED", "CLOSED"].includes(ticket.status) ? (
                            <p className="mt-1 text-[10px] font-semibold" style={{ color: ticket.slaBreached ? "var(--color-danger)" : "var(--color-text-muted)" }}>{ticket.slaBreached ? "SLA breached" : `Due ${formatDate(ticket.slaDueAt)}`}</p>
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

      <TableCard
        title="Priority and service levels"
        description="Targets are measured in the school’s own working hours in the school’s own time zone, not ours. Working hours and public holidays are a per-country configuration record; a school whose country has none yet is measured in flat hours."
        items={levels.levels}
        getRowKey={(row) => row.key}
        pageSize={false}
        footnote="A four-hour target that expires overnight in Nairobi while our office is closed is a promise we cannot keep and should not make."
        columns={[
          { key: "priority", header: "Priority", render: (row) => { const tone = priorityTone[row.key] ?? priorityTone.LOW; return <StatusPill bg={tone.bg} fg={tone.fg} label={row.label} />; } },
          { key: "target", header: "Target", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.hours} hour{row.hours === 1 ? "" : "s"}</span> },
          { key: "definition", header: "Definition", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.definition}</span> },
          { key: "escalation", header: "Escalation", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.escalation}</span> },
          { key: "open", header: "Open now", render: (row) => row.open }
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <TableCard
          title="Issue categories"
          description="Every ticket is categorised at triage — category and priority are both mandatory before a ticket can leave New."
          items={levels.categories}
          getRowKey={(row) => row.key}
          pageSize={false}
          footnote={`Data Migration and Onboarding and Setup are new in v4.0 — together they account for ${levels.newCategoryVolume} ticket${levels.newCategoryVolume === 1 ? "" : "s"} in the last 120 days, which would previously have been filed as Other. Volume counts tickets opened in the last 120 days.`}
          columns={[
            { key: "label", header: "Category", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.label}</span> },
            { key: "covers", header: "Covers", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.covers}</span> },
            { key: "volume", header: "Volume", render: (row) => row.volume }
          ]}
        />
        <TableCard
          title="Working hours by country"
          description="Service level clocks pause outside them."
          items={levels.countries}
          getRowKey={(row) => row.country}
          pageSize={false}
          emptyState="No country has been configured yet."
          actions={
            <ResourceActionDialog
              triggerLabel="Add or edit hours"
              title="Working hours for a country"
              description="Service-level clocks for a school in this country stop outside these hours and on these dates. Creates the country’s configuration record if it does not exist yet."
              endpoint="/api/super-admin/support-desk/countries"
              method="POST"
              variant="secondary"
              submitLabel="Save hours"
              fields={[
                { name: "country", label: "Country", required: true, placeholder: "e.g. Ghana" },
                { name: "timeZone", label: "Time zone (IANA name)", required: true, placeholder: "Africa/Lagos" },
                { name: "workStart", label: "Desk opens", required: true, placeholder: "08:00" },
                { name: "workEnd", label: "Desk closes", required: true, placeholder: "17:00" },
                { name: "workDays", label: "Days open", type: "select", defaultValue: "MON_FRI", options: [{ label: "Monday to Friday", value: "MON_FRI" }, { label: "Monday to Saturday", value: "MON_SAT" }, { label: "Sunday to Thursday", value: "SUN_THU" }] },
                { name: "holidayDates", label: "Public holidays (YYYY-MM-DD, comma-separated)", type: "textarea", placeholder: "2026-12-25, 2026-12-26" }
              ]}
            />
          }
          footnote={`${levels.countries.filter((c) => c.live).map((c) => c.country).join(", ") || "No country"} ${levels.countries.filter((c) => c.live).length === 1 ? "is" : "are"} live. The others exist as configuration records so that a launch is a data change.`}
          columns={[
            { key: "country", header: "Country", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.country}</span> },
            { key: "hours", header: "Working hours", render: (row) => (row.configured ? row.hours : <span className="text-[var(--color-text-muted)]">Not set — clocks run in flat hours</span>) },
            { key: "holidays", header: "Holidays", render: (row) => (row.holidays === null ? <span className="text-[var(--color-text-muted)]">Not set</span> : `${row.holidays} public`) }
          ]}
        />
      </div>
    </div>
  );
}

async function TicketQueueTab({ params, schoolOptions, agents, board }: { params: Record<string, string | undefined>; schoolOptions: Array<{ label: string; value: string }>; agents: SuperAdminInternalMember[]; board: Board }) {
  const query = new URLSearchParams();
  for (const key of ["search", "status", "schoolId", "page", "priority", "category", "assignedToId", "sla"]) {
    if (params[key]) query.set(key, params[key] as string);
  }
  const [envelope, levels, analytics] = await Promise.all([
    apiGetEnvelope<SuperAdminTicketRow[]>(`/api/super-admin/support/tickets?${query.toString()}`),
    apiGet<ServiceLevels>("/api/super-admin/support-desk/service-levels"),
    apiGet<Analytics>("/api/super-admin/support-desk/analytics")
  ]);
  const tickets = envelope.data ?? [];
  const agentChoice = agents.map((agent) => ({ label: agent.name, value: agent.id }));
  const maxCategory = Math.max(...levels.categories.map((c) => c.volume), 1);
  const k = analytics.kpis;
  const opened = k.openedPrev ? Math.round(((k.openedWeek - k.openedPrev) / k.openedPrev) * 100) : null;

  return (
    <div className="grid gap-5">
      <TableCard
        title="Ticket registry"
        description={`Default view: open tickets sorted by priority, then SLA deadline · ${board.open} open · ${levels.termVolume} in the last 120 days`}
        items={tickets}
        getRowKey={(item) => item.id}
        emptyState="No support tickets match the current filters."
        footnote="Every ticket carries exactly one mandatory category on creation. Tickets categorised as Other must be reclassified before they can be closed."
        selection={{
          noun: "ticket",
          nounPlural: "tickets",
          actions: [
            { label: "Assign to an agent", kind: "primary", endpoint: "/api/super-admin/support-desk/tickets/assign", idsField: "ticketIds", choice: { field: "assignedToId", label: "Choose an agent", options: agentChoice } },
            { label: "Change priority", endpoint: "/api/super-admin/support-desk/tickets/priority", idsField: "ticketIds", choice: { field: "priority", label: "Choose a priority", options: priorityOptions } },
            { label: "Close the selected tickets", endpoint: "/api/super-admin/support-desk/tickets/close", idsField: "ticketIds", confirm: "Close the ticked tickets? One categorised as Other is left open until it is reclassified." }
          ]
        }}
        filterBar={
          <FilterToolbar
            action="/super-admin/support"
            hidden={{ tab: "tickets" }}
            resultCount={envelope.pagination?.total}
            controls={[
              { name: "search", label: "Search", type: "search", placeholder: "Ticket ID, school or subject", defaultValue: params.search },
              { name: "priority", label: "Priority", type: "select", defaultValue: params.priority ?? "", options: [{ label: "Any priority", value: "" }, ...priorityOptions] },
              { name: "category", label: "Category", type: "select", defaultValue: params.category ?? "", options: [{ label: "All categories", value: "" }, ...levels.categories.map((c) => ({ label: c.label, value: c.key }))] },
              { name: "assignedToId", label: "Agent", type: "select", defaultValue: params.assignedToId ?? "", options: [{ label: "All agents", value: "" }, { label: "Unassigned", value: "none" }, ...agentChoice] },
              { name: "sla", label: "SLA", type: "select", defaultValue: params.sla ?? "", options: [{ label: "Any SLA", value: "" }, { label: "Breached", value: "breached" }] },
              { name: "schoolId", label: "School", type: "select", defaultValue: params.schoolId ?? "", options: [{ label: "All schools", value: "" }, ...schoolOptions] },
              { name: "status", label: "Status", type: "select", defaultValue: params.status ?? "", options: statusFilterOptions }
            ]}
          />
        }
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <Link href={`/super-admin/support/${item.id}`} className="block"><span className="font-[var(--font-mono)] font-bold text-[var(--color-text-accent)]">{item.ticketNo}</span><span className="block max-w-[260px] truncate text-[10px] text-[var(--color-text-muted)]">{item.subject}</span></Link> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "category", header: "Category", render: (item) => categoryOptions.find((option) => option.value === item.category)?.label.toLowerCase().replace(/^./, (c) => c.toUpperCase()) ?? formatLabel(item.category) },
          { key: "priority", header: "Priority", render: (item) => { const tone = priorityTone[item.priority] ?? priorityTone.LOW; return <StatusPill bg={tone.bg} fg={tone.fg} label={priorityLabel[item.priority] ?? item.priority} />; } },
          { key: "assigned", header: "Assigned", render: (item) => item.assignedTo || "Unassigned" },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "sla",
            header: "SLA",
            render: (item) =>
              item.slaDueAt ? (
                ["RESOLVED", "CLOSED"].includes(item.status) ? <span className="text-[var(--color-text-muted)]">Done</span> : item.slaBreached ? <span className="font-bold text-[var(--color-danger)]">Breached — {formatDate(item.slaDueAt)}</span> : formatDate(item.slaDueAt)
              ) : "Not set"
          }
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <BarList
          title="Issue categories this term"
          sub="Top recurring issues drive the knowledge base and the product roadmap"
          items={[...levels.categories]
            .filter((c) => c.volume > 0)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 8)
            .map((c, index) => ({ label: c.label, value: String(c.volume), pct: Math.round((c.volume / maxCategory) * 100), tone: index === 0 ? ("bad" as const) : index < 3 ? ("warn" as const) : ("teal" as const) }))}
          empty="No tickets in the last 120 days."
        />
        <TableCard
          title="Priority and SLA framework"
          description="Resolution targets measured in school hours"
          items={levels.levels}
          getRowKey={(row) => row.key}
          pageSize={false}
          columns={[
            { key: "priority", header: "Priority", render: (row) => { const tone = priorityTone[row.key] ?? priorityTone.LOW; return <StatusPill bg={tone.bg} fg={tone.fg} label={row.label} />; } },
            { key: "target", header: "Target", render: (row) => `${row.hours} hour${row.hours === 1 ? "" : "s"}` },
            { key: "trigger", header: "Alert trigger", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.escalation} — {row.definition.toLowerCase()}</span> }
          ]}
        />
      </div>

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Tickets opened (week)" value={k.openedWeek} detail={opened === null ? "No tickets the week before" : `${opened > 0 ? "+" : opened < 0 ? "−" : ""}${Math.abs(opened)}% vs last week`} icon={LifeBuoy} tone="dark" />
        <StatCard label="Resolved within SLA" value={k.withinSla === null ? "—" : `${k.withinSla}%`} detail={k.resolvedWeek ? `${k.resolvedWeek} resolved this week · target 95%` : "Nothing resolved this week · target 95%"} icon={CheckCircle2} tone={k.withinSla !== null && k.withinSla < 95 ? "warning" : "success"} />
        <StatCard label="Avg resolution — Critical" value={k.criticalMinutes === null ? "—" : duration(Math.round((k.criticalMinutes / 60) * 10) / 10)} detail={k.criticalCount ? `Target 1 hour · ${k.criticalCount} in 30 days` : "Target 1 hour · none in 30 days"} icon={Clock3} tone="info" />
        <StatCard label="Repeat issue rate" value={k.repeatRate === null ? "—" : `${k.repeatRate}%`} detail="Same school, same category, within 30 days" icon={Repeat2} tone="neutral" />
        <StatCard label="CSAT average" value={k.csat === null ? "—" : `${k.csat} / 5`} detail={k.csatResponses ? `From ${k.csatResponses} response${k.csatResponses === 1 ? "" : "s"} (30 days)` : "No responses in 30 days"} icon={MessageSquareText} tone="info" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <TableCard
          title="Per-agent performance"
          description="Volume and CSAT visible to Support Lead and above · this week (CSAT over 30 days)"
          items={analytics.perAgent}
          getRowKey={(row) => row.id}
          pageSize={false}
          emptyState="No agent has handled a ticket this week."
          footnote="Agents with consistently low CSAT are flagged for coaching review before the drop appears in platform NPS."
          columns={[
            { key: "agent", header: "Agent", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.name}</span> },
            { key: "assigned", header: "Assigned", render: (row) => row.assigned },
            { key: "resolved", header: "Resolved", render: (row) => row.resolved },
            { key: "sla", header: "Within SLA", render: (row) => (row.withinSla === null ? "—" : `${row.withinSla}%`) },
            { key: "csat", header: "Avg CSAT", render: (row) => (row.csat === null ? "—" : `${row.csat} / 5`) },
            { key: "standing", header: "Standing", render: (row) => tonePill(row.standing, row.tone) }
          ]}
        />
        <BarList
          title="Resolution time by priority"
          sub="Average across the last 30 days, measured in the school’s working hours where its country has them, else elapsed hours"
          items={analytics.byPriority
            .filter((row) => row.hours !== null)
            .map((row) => {
              const hours = row.hours as number;
              const ratio = hours / row.target;
              return { label: `${row.label} — target ${row.target}h`, value: duration(hours), pct: Math.round(ratio * 100), tone: ratio > 1 ? ("bad" as const) : ratio > 0.8 ? ("warn" as const) : ("good" as const), note: ratio > 1 ? "Above target" : undefined };
            })}
          empty="Nothing has been resolved in the last 30 days."
        />
      </div>
    </div>
  );
}

async function DataCorrectionsTab({ records }: { records: SuperAdminDataCorrectionRow[] }) {
  const open = records.filter((r) => r.status === "PENDING").length;
  const thisTerm = records.filter((r) => Date.now() - new Date(r.createdAt).getTime() < 120 * 86_400_000).length;
  return (
    <section className="grid gap-5">
      <FlowSteps
        title="Data correction request workflow"
        sub="No correction is ever made without Super Admin approval and a logged audit entry — this process cannot be bypassed"
        steps={[
          { label: "School submits in writing", note: "Error described, correct value stated" },
          { label: "Operations Admin validates", note: "Checks the evidence supplied", tone: "warn" },
          { label: "Super Admin approves", note: "Mandatory — no exceptions", tone: "ink" },
          { label: "Correction made", note: "Audit log entry created", tone: "good" },
          { label: "School notified", note: "Correction summary provided", tone: "good" }
        ]}
      />

      <TableCard
        title="Data correction requests"
        description={`Each entry records the field, the old value, the new value and who approved it · ${open} open · ${thisTerm} in the last 120 days`}
        items={records}
        getRowKey={(item) => item.id}
        emptyState="No data correction requests have been raised yet."
        footnote="Approval is the audit record and the school’s notice. The change itself is made on the school’s record by the person who approves it."
        columns={[
          { key: "ticket", header: "Ticket", render: (item) => <Link href={`/super-admin/support/${item.ticketId}`} className="font-[var(--font-mono)] font-bold text-[var(--color-text-accent)]">{item.ticketNo}</Link> },
          { key: "school", header: "School", render: (item) => item.schoolName },
          { key: "field", header: "Field corrected", render: (item) => item.fieldCorrected },
          { key: "old", header: "Old value", render: (item) => <span className="text-[var(--color-text-muted)] line-through">{item.oldValue}</span> },
          { key: "new", header: "New value", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.newValue}</span> },
          { key: "approved", header: "Approved by", render: (item) => item.approvedBy ?? <span className="text-[var(--color-text-muted)]">{item.requestedBy ? `Requested by ${item.requestedBy}` : "—"}</span> },
          {
            key: "status",
            header: "Status",
            render: (item) => {
              const key = item.status === "PENDING" && item.validatedAt ? "VALIDATED" : item.status;
              const tone = correctionStatusTone[key] ?? correctionStatusTone.PENDING;
              return (
                <div className="grid gap-1.5">
                  <StatusPill bg={tone.bg} fg={tone.fg} label={tone.label} />
                  {item.status === "PENDING" ? (
                    <div className="flex gap-2">
                      {!item.validatedAt ? (
                        <ResourceActionDialog triggerLabel="Validate" title={`Validate — ${item.fieldCorrected}`} description="Confirm the school supplied evidence for this correction. A Super Admin can approve it once it is validated." endpoint={`/api/super-admin/support-desk/corrections/${item.id}/validate`} method="POST" variant="textAction" submitLabel="Validate" confirmLabel="Confirm" fields={[]} />
                      ) : (
                        <ResourceActionDialog triggerLabel="Approve" title={`Approve correction — ${item.fieldCorrected}`} description={`This confirms changing "${item.oldValue}" to "${item.newValue}", writes an audit entry and tells the school. Super Admin only.`} endpoint={`/api/super-admin/support/data-correction/${item.id}/approve`} method="PATCH" variant="textAction" submitLabel="Approve" confirmLabel="Confirm approval" fields={[]} />
                      )}
                      <ResourceActionDialog triggerLabel="Reject" title={`Reject correction — ${item.fieldCorrected}`} description="Reject this correction request with a logged reason." endpoint={`/api/super-admin/support/data-correction/${item.id}/reject`} method="PATCH" variant="textActionDanger" submitLabel="Reject" confirmLabel="Confirm" fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]} />
                    </div>
                  ) : null}
                </div>
              );
            }
          }
        ]}
      />
    </section>
  );
}

async function KnowledgeTab() {
  const knowledge = await apiGet<Knowledge>("/api/super-admin/support-desk/knowledge");
  const responsesEnvelope = await apiGetEnvelope<SuperAdminCannedResponse[]>("/api/super-admin/support/canned-responses");
  const full = new Map((responsesEnvelope.data ?? []).map((row) => [row.id, row]));
  const lead = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ReferenceList
        title="Canned responses"
        sub="Selected, personalised and sent — cutting response time on routine queries. Use {{school}} and {{ticket_no}} in the text and they are filled in when sent."
        items={knowledge.responses.map((row) => ({ label: `${lead(row.category)} — ${row.title}`, detail: `Used ${row.used} time${row.used === 1 ? "" : "s"} in total`, pill: row.needsReview ? "Needs review" : `Updated ${formatDate(row.updatedAt)}`, tone: row.needsReview ? ("warn" as const) : ("good" as const) }))}
      />

      <TableCard
        title="Knowledge base"
        description="Internally searchable diagnostic articles, maintained by the Support Lead"
        items={knowledge.articles}
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
              { name: "status", label: "Status", type: "select", defaultValue: "PUBLISHED", options: [{ label: "Published", value: "PUBLISHED" }, { label: "Draft", value: "DRAFT" }] }
            ]}
          />
        }
        footnote="Canned responses and articles are updated by the Support Lead based on recurring ticket patterns — the top categories on the Tickets tab feed this list directly."
        emptyState="No knowledge base articles yet — create the first one for school staff."
        columns={[
          { key: "title", header: "Article", render: (item) => item.title },
          { key: "category", header: "Category", render: (item) => item.category },
          { key: "updated", header: "Last updated", render: (item) => formatDate(item.updatedAt), sortValue: (item) => item.updatedAt }
        ]}
      />

      <div className="xl:col-span-2">
        <TableCard
          title="Manage canned responses"
          description="Add or edit the reusable answers an agent can send from a ticket."
          items={Array.from(full.values())}
          getRowKey={(item) => item.id}
          emptyState="No canned responses yet — the Support Lead maintains this library."
          actions={
            <ResourceActionDialog triggerLabel="New canned response" title="Create canned response" description="Add a reusable response for a ticket category." endpoint="/api/super-admin/support/canned-responses" method="POST" submitLabel="Create" fields={[
              { name: "category", label: "Category", type: "select", defaultValue: "OTHER", options: categoryOptions },
              { name: "title", label: "Title", required: true },
              { name: "body", label: "Response body", type: "textarea", required: true }
            ]} />
          }
          columns={[
            { key: "category", header: "Category", render: (item) => lead(item.category) },
            { key: "title", header: "Title", render: (item) => item.title },
            { key: "body", header: "Body", render: (item) => <span className="line-clamp-2 text-[11.5px] text-[var(--color-text-secondary)]">{item.body}</span> },
            { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt) },
            {
              key: "actions",
              header: "",
              render: (item) => (
                <ResourceActionDialog triggerLabel="Edit" title={`Edit ${item.title}`} description="Update this canned response." endpoint={`/api/super-admin/support/canned-responses/${item.id}`} method="PATCH" variant="textAction" submitLabel="Save" fields={[
                  { name: "category", label: "Category", type: "select", defaultValue: item.category, options: categoryOptions },
                  { name: "title", label: "Title", defaultValue: item.title, required: true },
                  { name: "body", label: "Response body", type: "textarea", defaultValue: item.body, required: true }
                ]} />
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
