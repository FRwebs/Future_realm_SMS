import { MetricCard } from "@/components/dashboard/metric-card";
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
  stage: string;
  estimatedMrr: number;
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

export default async function SuperAdminCrmPage() {
  const data = await apiGet<CrmView>("/api/super-admin/crm");
  const atRisk = (data.accounts ?? []).filter((account) => account.healthScore < 60).length;
  const pipelineValue = (data.leads ?? []).reduce((sum, lead) => sum + Number(lead.estimatedMrr ?? 0), 0);
  const averageNps = data.nps?.length
    ? Math.round(data.nps.reduce((sum, response) => sum + response.score, 0) / data.nps.length)
    : 0;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Customer success</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">CRM & Sales</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Track school health, sales pipeline, account interactions, NPS feedback, and renewal follow-ups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ResourceActionDialog
              triggerLabel="Log Interaction"
              title="Log customer interaction"
              description="Record calls, emails, demos, renewal follow-ups, or onboarding sessions."
              endpoint="/api/super-admin/crm/interactions"
              fields={[
                { name: "schoolId", label: "School ID", required: true },
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

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard metric={{ label: "Accounts", value: String(data.accounts?.length ?? 0), change: "Tracked schools" }} />
        <MetricCard metric={{ label: "At Risk", value: String(atRisk), change: "Health score below 60" }} />
        <MetricCard metric={{ label: "Pipeline", value: formatCurrency(pipelineValue), change: "Estimated MRR" }} />
        <MetricCard metric={{ label: "Avg NPS", value: String(averageNps), change: "Latest responses" }} />
      </section>

      <TableCard
        title="Customer Accounts"
        description="School health and customer-success workload."
        items={data.accounts ?? []}
        emptyState="No customer accounts are available."
        columns={[
          { key: "name", header: "School", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
          { key: "plan", header: "Plan", render: (item) => item.plan },
          { key: "health", header: "Health", render: (item) => `${item.healthScore}%` },
          { key: "manager", header: "Account Manager", render: (item) => item.accountManager },
          { key: "tickets", header: "Tickets", render: (item) => item.supportTickets },
          { key: "renewal", header: "Next Billing", render: (item) => item.nextBillingAt ? formatDate(item.nextBillingAt) : "-" }
        ]}
      />

      <TableCard
        title="Pipeline"
        description="Prospects and trial opportunities."
        items={data.leads ?? []}
        emptyState="No leads are in the pipeline."
        columns={[
          { key: "prospect", header: "Prospect", render: (item) => <span className="font-semibold text-ink">{item.prospectName}</span> },
          { key: "contact", header: "Contact", render: (item) => `${item.contactName} · ${item.email}` },
          { key: "stage", header: "Stage", render: (item) => item.stage.replaceAll("_", " ") },
          { key: "mrr", header: "Estimated MRR", render: (item) => formatCurrency(item.estimatedMrr) },
          { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt) }
        ]}
      />

      <TableCard
        title="Recent Interactions"
        description="Calls, emails, meetings, demos, and renewal touchpoints."
        items={data.interactions ?? []}
        emptyState="No CRM interactions have been logged."
        columns={[
          { key: "school", header: "School", render: (item) => item.school?.name ?? "Unknown" },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "summary", header: "Summary", render: (item) => item.summary },
          { key: "next", header: "Next Action", render: (item) => item.nextAction ?? "-" },
          { key: "created", header: "Created", render: (item) => formatDate(item.createdAt) }
        ]}
      />
    </div>
  );
}
