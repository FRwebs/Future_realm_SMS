import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type CrmAccount = {
  id: string;
  name: string;
  plan: string;
  status: string;
  healthScore: number;
  accountManager: string;
  supportTickets: number;
  interactions: number;
  nextBillingAt?: string | null;
};

type CrmInteraction = {
  id: string;
  type: string;
  summary: string;
  outcome?: string | null;
  nextAction?: string | null;
  followUpAt?: string | null;
  createdAt: string;
  school?: { name: string } | null;
  createdBy?: { firstName: string; lastName: string } | null;
};

type Lead = {
  id: string;
  prospectName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  source?: string | null;
  stage: string;
  estimatedMrr: number;
  notes?: string | null;
  wonReason?: string | null;
  lostReason?: string | null;
  updatedAt: string;
};

type Nps = {
  id: string;
  score: number;
  comment?: string | null;
  school?: { name: string } | null;
  createdAt: string;
};

type CrmView = {
  accounts: CrmAccount[];
  interactions: CrmInteraction[];
  leads: Lead[];
  nps: Nps[];
};

const leadStages = ["LEAD", "CONTACTED", "DEMO_SCHEDULED", "TRIAL", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"].map((value) => ({
  label: value.replaceAll("_", " "),
  value,
}));

const boardColumns = [
  { stage: "LEAD", label: "Lead" },
  { stage: "CONTACTED", label: "Contacted" },
  { stage: "DEMO_SCHEDULED", label: "Demo Scheduled" },
  { stage: "TRIAL", label: "Trial" },
  { stage: "PROPOSAL_SENT", label: "Proposal Sent" },
  { stage: "NEGOTIATION", label: "Negotiation" },
  { stage: "WON", label: "Won" },
  { stage: "LOST", label: "Lost" }
];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
    </article>
  );
}

function healthTone(score: number) {
  if (score >= 75) return { bg: "var(--color-success-dim)", fg: "var(--color-success)" };
  if (score >= 50) return { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" };
  return { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" };
}

function npsTone(score: number) {
  if (score >= 9) return { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Promoter" };
  if (score >= 7) return { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Passive" };
  return { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Detractor" };
}

function tabHref(tab: string) {
  return tab === "accounts" ? "/super-admin/crm" : `/super-admin/crm?tab=${tab}`;
}

export default async function SuperAdminCrmPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "accounts" } = searchParams ? await searchParams : {};
  const data = await apiGet<CrmView>("/api/super-admin/crm");
  const atRisk = (data.accounts ?? []).filter((account) => account.healthScore < 60).length;
  const pipelineValue = (data.leads ?? []).filter((lead) => lead.stage !== "WON" && lead.stage !== "LOST").reduce((sum, lead) => sum + Number(lead.estimatedMrr ?? 0), 0);
  const averageNps = data.nps?.length
    ? Math.round(data.nps.reduce((sum, response) => sum + response.score, 0) / data.nps.length)
    : 0;

  const schoolOptions = (data.accounts ?? []).map((account) => ({ label: account.name, value: account.id }));

  const tabs = [
    { label: "Accounts", href: tabHref("accounts"), active: tab === "accounts" },
    { label: "Pipeline", href: tabHref("pipeline"), active: tab === "pipeline" },
    { label: "Interactions", href: tabHref("interactions"), active: tab === "interactions" },
    { label: "Customer Feedback", href: tabHref("feedback"), active: tab === "feedback" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">Customer success</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">CRM & Sales</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              School health, sales pipeline, account interactions, and NPS feedback — everything needed to keep
              schools happy and grow the book of business.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ResourceActionDialog
              triggerLabel="Log Interaction"
              title="Log customer interaction"
              description="Record calls, emails, demos, renewal follow-ups, or onboarding sessions."
              endpoint="/api/super-admin/crm/interactions"
              fields={[
                { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
                { name: "type", label: "Interaction Type", required: true, placeholder: "Call, Email, Demo, Meeting" },
                { name: "summary", label: "Summary", type: "textarea", required: true },
                { name: "outcome", label: "Outcome" },
                { name: "nextAction", label: "Next Action" },
                { name: "followUpAt", label: "Follow-up Date", type: "date" }
              ]}
              submitLabel="Log Interaction"
            />
            <ResourceActionDialog
              triggerLabel="Add Lead"
              title="Create sales lead"
              description="Add a prospect to the SaaS sales pipeline."
              endpoint="/api/super-admin/crm/leads"
              variant="secondary"
              fields={[
                { name: "prospectName", label: "Prospect / School Name", required: true },
                { name: "contactName", label: "Contact Name", required: true },
                { name: "email", label: "Contact Email", type: "email", required: true },
                { name: "phone", label: "Phone" },
                { name: "source", label: "Lead Source" },
                { name: "stage", label: "Stage", type: "select", options: leadStages, defaultValue: "LEAD" },
                { name: "estimatedMrr", label: "Estimated MRR", type: "number", defaultValue: 0, min: 0 },
                { name: "notes", label: "Notes", type: "textarea" }
              ]}
              submitLabel="Create Lead"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <KpiTile label="Accounts" value={String(data.accounts?.length ?? 0)} />
        <KpiTile label="At risk (health < 60)" value={String(atRisk)} />
        <KpiTile label="Open pipeline" value={formatCurrency(pipelineValue)} />
        <KpiTile label="Avg NPS" value={String(averageNps)} />
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "accounts" ? <AccountsTab accounts={data.accounts ?? []} /> : null}
      {tab === "pipeline" ? <PipelineTab leads={data.leads ?? []} /> : null}
      {tab === "interactions" ? <InteractionsTab interactions={data.interactions ?? []} /> : null}
      {tab === "feedback" ? <FeedbackTab nps={data.nps ?? []} /> : null}
    </div>
  );
}

function AccountsTab({ accounts }: { accounts: CrmAccount[] }) {
  return (
    <TableCard
      title="Customer accounts"
      description="School health and customer-success workload, sorted lowest health first."
      items={accounts}
      emptyState="No customer accounts are available."
      columns={[
        { key: "name", header: "School", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "plan", header: "Plan", render: (item) => item.plan },
        {
          key: "health",
          header: "Health",
          render: (item) => {
            const tone = healthTone(item.healthScore);
            return <StatusPill bg={tone.bg} fg={tone.fg} label={`${item.healthScore}%`} />;
          }
        },
        { key: "manager", header: "Account manager", render: (item) => item.accountManager },
        { key: "tickets", header: "Tickets", render: (item) => item.supportTickets },
        { key: "interactions", header: "Interactions", render: (item) => item.interactions },
        { key: "renewal", header: "Next billing", render: (item) => item.nextBillingAt ? formatDate(item.nextBillingAt) : "-" }
      ]}
    />
  );
}

function PipelineTab({ leads }: { leads: Lead[] }) {
  const byColumn = new Map<string, Lead[]>(boardColumns.map((column) => [column.stage, []]));
  for (const lead of leads) {
    (byColumn.get(lead.stage) ?? byColumn.get("LEAD"))?.push(lead);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-flow-col auto-cols-[260px] gap-3">
        {boardColumns.map((column) => {
          const columnLeads = byColumn.get(column.stage) ?? [];
          const tone =
            column.stage === "WON"
              ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" }
              : column.stage === "LOST"
                ? { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" }
                : { bg: "var(--color-accent-primary-dim)", fg: "var(--color-text-accent)" };

          return (
            <section key={column.stage} className="surface-card flex max-h-[70vh] flex-col p-3">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{column.label}</p>
                <span className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-text-muted)]">
                  {columnLeads.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {columnLeads.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-[var(--color-border-default)] px-3 py-4 text-center text-[11px] text-[var(--color-text-muted)]">
                    No leads
                  </p>
                ) : (
                  columnLeads.map((lead) => (
                    <div key={lead.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[12.5px] font-semibold text-[var(--color-text-primary)]">{lead.prospectName}</p>
                        <StatusPill bg={tone.bg} fg={tone.fg} label={column.label} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">{lead.contactName} · {lead.email}</p>
                      <p className="mt-1.5 font-[var(--font-mono)] text-[12px] font-bold text-[var(--color-text-primary)]">{formatCurrency(lead.estimatedMrr)}</p>
                      {lead.stage !== "WON" && lead.stage !== "LOST" ? (
                        <ResourceActionDialog
                          triggerLabel="Move stage"
                          title={`Move — ${lead.prospectName}`}
                          description="Advance or close this lead. A reason is required when marking Won or Lost."
                          endpoint={`/api/super-admin/crm/leads/${lead.id}`}
                          method="PATCH"
                          variant="secondary"
                          submitLabel="Save"
                          fields={[
                            { name: "stage", label: "Stage", type: "select", defaultValue: lead.stage, options: leadStages },
                            { name: "wonReason", label: "Won reason (if marking Won)" },
                            { name: "lostReason", label: "Lost reason (if marking Lost)" }
                          ]}
                        />
                      ) : (
                        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                          {(lead.stage === "WON" ? lead.wonReason : lead.lostReason) || "No reason recorded"}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function InteractionsTab({ interactions }: { interactions: CrmInteraction[] }) {
  return (
    <TableCard
      title="Recent interactions"
      description="Calls, emails, meetings, demos, and renewal touchpoints."
      items={interactions}
      emptyState="No CRM interactions have been logged."
      columns={[
        { key: "school", header: "School", render: (item) => item.school?.name ?? "Unknown" },
        { key: "type", header: "Type", render: (item) => item.type },
        { key: "summary", header: "Summary", render: (item) => item.summary },
        { key: "next", header: "Next action", render: (item) => item.nextAction ?? "-" },
        { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
      ]}
    />
  );
}

function FeedbackTab({ nps }: { nps: Nps[] }) {
  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Sentiment</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Recent NPS responses</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Read-only view of the most recent Net Promoter Score responses across all schools. Full NPS trends and
          survey management live in{" "}
          <Link href="/super-admin/analytics?tab=nps" className="font-semibold text-[var(--color-text-accent)] underline">
            Analytics &amp; BI
          </Link>
          .
        </p>
      </section>

      <TableCard
        title="Responses"
        description="Most recent first."
        items={nps}
        emptyState="No NPS responses recorded yet."
        columns={[
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Unknown" },
          {
            key: "score",
            header: "Score",
            render: (item) => {
              const tone = npsTone(item.score);
              return <StatusPill bg={tone.bg} fg={tone.fg} label={`${item.score} · ${tone.label}`} />;
            }
          },
          { key: "comment", header: "Comment", render: (item) => item.comment ?? "-" },
          { key: "created", header: "Received", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
