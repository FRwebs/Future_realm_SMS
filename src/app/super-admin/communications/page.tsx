import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminCampaignRow, SuperAdminConsentRow, SuperAdminMessageTemplateRow, SuperAdminUserRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type Announcement = {
  id: string;
  title: string;
  type: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  _count?: { views: number };
};

type MaintenanceWindow = {
  id: string;
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type CommunicationsView = {
  announcements: Announcement[];
  maintenance: MaintenanceWindow[];
};

const announcementTypes = ["INFO", "WARNING", "CRITICAL", "NEW_FEATURE", "PROMOTION"].map((value) => ({ label: value.replaceAll("_", " "), value }));
const channelOptions = ["EMAIL", "SMS", "WHATSAPP"].map((v) => ({ label: v, value: v }));
const campaignTypeOptions = [{ label: "Operational", value: "OPERATIONAL" }, { label: "Promotional", value: "PROMOTIONAL" }];
const templateCategoryOptions = ["ONBOARDING", "SUBSCRIPTION", "OPERATIONAL", "COMMERCIAL"].map((v) => ({ label: v, value: v }));
const planFilterOptions = [{ label: "Any", value: "" }, { label: "Starter", value: "BASIC" }, { label: "Standard", value: "STANDARD" }, { label: "Trial", value: "PROFESSIONAL" }, { label: "Elite", value: "ENTERPRISE" }, { label: "NGO / Mission", value: "CUSTOM" }];
const yesNo = [{ label: "Yes", value: "true" }, { label: "No", value: "false" }];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "campaigns" ? "/super-admin/communications" : `/super-admin/communications?tab=${tab}`;
}

export default async function SuperAdminCommunicationsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "campaigns" } = searchParams ? await searchParams : {};

  const campaigns = (await apiGet<SuperAdminCampaignRow[]>("/api/super-admin/communications/campaigns")) ?? [];
  const sentCampaigns = campaigns.filter((c) => c.status === "SENT");
  const scheduledCampaigns = campaigns.filter((c) => Boolean(c.scheduledAt));
  const recentDeliveryFailures = sentCampaigns.reduce((sum, c) => sum + c.failedCount, 0);

  // "Platform Notices" (in-app announcements & maintenance windows) doesn't map to any of the
  // 5 mockup tabs below — it stays fully functional at ?tab=notices, just no longer a visible tab.
  const tabs = [
    { label: "Campaigns", href: tabHref("campaigns"), active: tab === "campaigns" },
    { label: "Templates", href: tabHref("templates"), active: tab === "templates" },
    { label: "Triggers", href: tabHref("triggers"), active: tab === "triggers" },
    { label: "Delivery", href: tabHref("delivery"), active: tab === "delivery", badge: recentDeliveryFailures },
    { label: "Consent", href: tabHref("consent"), active: tab === "consent" }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Platform messaging"
        title="Notification & Communication Command Center"
        description="FutureRealm's own broadcast channel into every school, teacher, parent, and student — targeted campaigns with an approval workflow, a message template library, delivery and consent tracking."
        action={
          <ResourceActionDialog
            triggerLabel="New campaign"
            title="Compose a campaign"
            description="Write a message and define the audience. SMS is limited to 160 characters. The recipient count is computed from your filters when the draft is saved — review it in the Campaigns tab before approving. Set a schedule time to queue it as a triggered send instead of a manual one."
            endpoint="/api/super-admin/communications/campaigns"
            variant="heroWhite"
            submitLabel="Save draft"
            confirmLabel="Confirm draft"
            fields={[
              { name: "name", label: "Campaign name", required: true, placeholder: "e.g. Term 2 fee reminder" },
              { name: "type", label: "Type", type: "select", defaultValue: "OPERATIONAL", options: campaignTypeOptions },
              { name: "channel", label: "Channel", type: "select", defaultValue: "EMAIL", options: channelOptions },
              { name: "subject", label: "Subject (email)" },
              { name: "body", label: "Message body", type: "textarea", required: true },
              { name: "role", label: "Audience: role (optional)", placeholder: "e.g. SCHOOL_ADMIN, PARENT" },
              { name: "plan", label: "Audience: tier (optional)", type: "select", options: planFilterOptions },
              { name: "state", label: "Audience: state (optional)" },
              { name: "scheduledAt", label: "Schedule for (optional)", type: "date" }
            ]}
          />
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "campaigns" ? <CampaignsTab campaigns={campaigns} /> : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "triggers" ? <TriggersTab scheduled={scheduledCampaigns} totalCampaigns={campaigns.length} /> : null}
      {tab === "delivery" ? <DeliveryTab sent={sentCampaigns} /> : null}
      {tab === "consent" ? <ConsentTab /> : null}
      {tab === "notices" ? <NoticesTab announcementTypes={announcementTypes} /> : null}
    </div>
  );
}

function CampaignsTab({ campaigns }: { campaigns: SuperAdminCampaignRow[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
      <TableCard
        title="Campaign queue"
        description="Draft → approve (operational: dept lead; promotional: Super Admin/Marketing) → send. Promotional sends honour opt-outs automatically."
        items={campaigns}
        emptyState="No campaigns yet — use New campaign above to draft one."
        columns={[
          { key: "name", header: "Campaign", render: (item) => item.name },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "recipients", header: "Recipients", render: (item) => item.recipientCount },
          { key: "delivered", header: "Delivered", render: (item) => (item.status === "SENT" ? `${item.deliveredCount} (${item.failedCount} failed)` : "-") },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <ActionMenu triggerLabel={`Actions for ${item.name}`}>
                {item.status === "DRAFT" ? (
                  <ResourceActionDialog
                    triggerLabel="Approve"
                    title={`Approve ${item.name}`}
                    description={item.type === "PROMOTIONAL" ? "Promotional campaigns require Super Admin / Marketing Lead sign-off." : "Operational campaigns require department-lead approval."}
                    endpoint={`/api/super-admin/communications/campaigns/${item.id}/approve`}
                    method="PATCH"
                    variant="menu"
                    submitLabel="Approve"
                    fields={[]}
                  />
                ) : null}
                {item.status === "APPROVED" || item.status === "SCHEDULED" ? (
                  <ResourceActionDialog
                    triggerLabel="Send now"
                    title={`Send ${item.name}`}
                    description="Delivers the campaign to the computed audience immediately."
                    endpoint={`/api/super-admin/communications/campaigns/${item.id}/send`}
                    method="POST"
                    variant="menu"
                    submitLabel="Send now"
                    confirmLabel="Confirm send"
                    confirmMessage="This sends the campaign to all matching recipients."
                    fields={[]}
                  />
                ) : null}
              </ActionMenu>
            )
          }
        ]}
      />

      <section className="surface-card p-6">
        <p className="section-eyebrow">How sending works</p>
        <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Draft → approve → send</h3>
        <div className="mt-4 grid gap-3">
          {[
            { step: "1. Draft", detail: "Composed from New campaign, saved with a computed recipient count based on your audience filters." },
            { step: "2. Approve", detail: "Operational campaigns need a department lead; promotional campaigns need Super Admin or Marketing Lead sign-off." },
            { step: "3. Send", detail: "Delivered immediately to the computed audience. Promotional sends automatically honour opt-outs." }
          ].map((item) => (
            <div key={item.step} className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
              <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{item.step}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{item.detail}</p>
            </div>
          ))}
        </div>
        <a href="/super-admin/communications?tab=triggers" className="btn-secondary mt-4 w-full justify-center">
          View scheduled sends in Triggers
        </a>
      </section>
    </div>
  );
}

async function TemplatesTab() {
  const templates = (await apiGet<SuperAdminMessageTemplateRow[]>("/api/super-admin/communications/templates")) ?? [];
  const approved = templates.filter((t) => t.approvalStatus === "APPROVED").length;
  const awaitingMeta = templates.filter((t) => t.approvalStatus === "PENDING_META_APPROVAL").length;
  const rejected = templates.filter((t) => t.approvalStatus === "REJECTED").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Templates in the library", value: templates.length },
          { label: "Approved and in use", value: approved },
          { label: "Awaiting Meta approval", value: awaitingMeta },
          { label: "Rejected — needs revision", value: rejected }
        ].map((item) => (
          <article key={item.label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
          </article>
        ))}
      </section>

      <TableCard
      title="Message templates"
      description="Reusable message bodies for Email, SMS, and WhatsApp. WhatsApp templates additionally require Meta approval before use. Only Super Admin can add or retire templates."
      items={templates ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="New template"
          title="Create a message template"
          description="Use {{placeholders}} for variable fields like school name or amount due."
          endpoint="/api/super-admin/communications/templates"
          submitLabel="Create template"
          fields={[
            { name: "name", label: "Template name", required: true },
            { name: "channel", label: "Channel", type: "select", defaultValue: "WHATSAPP", options: channelOptions },
            { name: "category", label: "Category", type: "select", defaultValue: "OPERATIONAL", options: templateCategoryOptions },
            { name: "body", label: "Body", type: "textarea", required: true },
            { name: "metaTemplateId", label: "Meta template ID (WhatsApp)" }
          ]}
        />
      }
      emptyState="No message templates yet."
      columns={[
        { key: "category", header: "Category", render: (item) => item.category },
        { key: "name", header: "Template", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "channel", header: "Channel", render: (item) => item.channel },
        { key: "approval", header: "Approval", render: (item) => <StatusBadge status={item.approvalStatus} tone={item.approvalStatus === "APPROVED" ? "success" : item.approvalStatus === "REJECTED" ? "danger" : "warning"} /> },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ResourceActionDialog
              triggerLabel="Set approval"
              title={`Set approval — ${item.name}`}
              description="Reflect the Meta approval decision for this template."
              endpoint={`/api/super-admin/communications/templates/${item.id}/approval`}
              method="PATCH"
              variant="secondary"
              submitLabel="Save"
              fields={[{ name: "approvalStatus", label: "Approval status", type: "select", defaultValue: item.approvalStatus, options: ["PENDING_META_APPROVAL", "APPROVED", "REJECTED"].map((v) => ({ label: v.replaceAll("_", " "), value: v })) }]}
            />
          )
        }
      ]}
    />

    <ReferenceList
      title="What editing a template can and cannot do"
      sub="What this platform actually lets you change today — not a description of an ideal system."
      items={[
        { label: "You can create a new template", detail: "Any Super Admin or Platform Owner can add one from New template above.", tone: "good" },
        { label: "You can change its approval status", detail: "Reflects Meta's real decision for WhatsApp templates — this doesn't send anything itself.", tone: "good" },
        { label: "You cannot edit the body, name, or channel of an existing template", detail: "There's no update endpoint for those fields — the only way to change the wording is to create a new template.", tone: "bad" },
        { label: "You cannot delete or retire a template", detail: "No delete endpoint exists yet — an old template just stops being referenced.", tone: "bad" }
      ]}
    />
    </div>
  );
}

function ReferenceList({ title, sub, items }: { title: string; sub?: string; items: Array<{ label: string; detail: string; tone: "good" | "warn" | "bad" | "mute" }> }) {
  const tone: Record<string, { bg: string; fg: string }> = {
    good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
    warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
    bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
    mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
  };
  return (
    <section className="surface-card p-6">
      <p className="text-[14px] font-bold text-[var(--color-text-primary)]">{title}</p>
      {sub ? <p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{sub}</p> : null}
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
            <div>
              <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">{item.label}</p>
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--color-text-secondary)]">{item.detail}</p>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={{ background: tone[item.tone].bg, color: tone[item.tone].fg }}>
              {item.tone === "good" ? "Allowed" : item.tone === "bad" ? "Not built" : item.tone === "warn" ? "Partial" : "Not tracked"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const triggerRows: Array<{ event: string; recipient: string; channel: string; firesFrom: string }> = [
  { event: "Invoice issued", recipient: "Guardian", channel: "Per guardian's notification preference", firesFrom: "Finance — staff creates an invoice" },
  { event: "Invoice reminder sent", recipient: "Guardian", channel: "Per guardian's notification preference", firesFrom: "Finance — staff clicks \"Send reminder\"" },
  { event: "Payment recorded / receipt ready", recipient: "Guardian", channel: "Per guardian's notification preference", firesFrom: "Finance — staff records a payment" },
  { event: "Student marked absent", recipient: "Parent", channel: "SMS", firesFrom: "Attendance — teacher marks the register" },
  { event: "Admissions lifecycle (submitted, screening, decision, offer, enrollment — 7 steps)", recipient: "Guardian", channel: "Email, falling back to SMS", firesFrom: "Admissions — staff advances the application" },
  { event: "Welcome email at signup", recipient: "New account owner", channel: "Email", firesFrom: "Onboarding — self-service signup, once" }
];

function TriggersTab({ scheduled, totalCampaigns }: { scheduled: SuperAdminCampaignRow[]; totalCampaigns: number }) {
  const manualCount = totalCampaigns - scheduled.length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Time-triggered campaigns", value: scheduled.length },
          { label: "Manually-sent campaigns", value: manualCount },
          { label: "Already dispatched (of triggered)", value: scheduled.filter((c) => Boolean(c.sentAt)).length }
        ].map((item) => (
          <article key={item.label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
          </article>
        ))}
      </section>

      <TableCard
        title="Automated trigger points"
        description="Every place this codebase sends a notification as a side effect of something else — not from a Communications campaign. None of these run on a schedule or a cron job: each one fires synchronously, inline, the moment a staff member performs the triggering action. The underlying send is fully mocked for every channel here — nothing actually leaves the system through this path."
        items={triggerRows}
        getRowKey={(row) => row.event}
        columns={[
          { key: "event", header: "Event", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.event}</span> },
          { key: "recipient", header: "Recipient", render: (row) => row.recipient },
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "firesFrom", header: "Fires from", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.firesFrom}</span> }
        ]}
      />

      <TableCard
        title="Scheduled sends"
        description="Campaigns composed with a Schedule for time, instead of being sent manually. Scheduling sets the campaign's intended send time — approval and dispatch (Send now, in Campaigns) still trigger the actual delivery once that time is reached."
        items={scheduled}
        emptyState="No campaign has a schedule time set. Add one from New campaign → Schedule for (optional) to see it here."
        columns={[
          { key: "name", header: "Campaign", render: (item) => item.name },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "scheduledAt", header: "Scheduled for", render: (item) => (item.scheduledAt ? formatDate(item.scheduledAt) : "—") },
          { key: "sentAt", header: "Dispatched", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "Not yet sent") }
        ]}
      />
    </div>
  );
}

function DeliveryTab({ sent }: { sent: SuperAdminCampaignRow[] }) {
  const totalRecipients = sent.reduce((sum, c) => sum + c.recipientCount, 0);
  const totalDelivered = sent.reduce((sum, c) => sum + c.deliveredCount, 0);
  const totalOpened = sent.reduce((sum, c) => sum + c.openedCount, 0);
  const avgDeliveryRate = totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 1000) / 10 : 0;
  const avgOpenRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 1000) / 10 : 0;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Campaigns sent", value: sent.length },
          { label: "Recipients reached", value: totalRecipients.toLocaleString() },
          { label: "Avg delivery rate", value: `${avgDeliveryRate}%` },
          { label: "Avg open rate", value: `${avgOpenRate}%` }
        ].map((item) => (
          <article key={item.label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
          </article>
        ))}
      </section>

      <TableCard
        title="Delivery & engagement by campaign"
        description="Delivery and open rates for every sent campaign, most recent first. The Delivery tab badge is the total number of failed deliveries across sent campaigns."
        items={sent}
        emptyState="No campaigns have been sent yet."
        columns={[
          { key: "name", header: "Campaign", render: (item) => item.name },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "sent", header: "Sent", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "—") },
          { key: "recipients", header: "Recipients", render: (item) => item.recipientCount },
          {
            key: "delivery",
            header: "Delivery rate",
            render: (item) => {
              const rate = item.recipientCount > 0 ? Math.round((item.deliveredCount / item.recipientCount) * 1000) / 10 : 0;
              return (
                <div className="w-32">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${rate}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">{rate}% · {item.failedCount} failed</p>
                </div>
              );
            }
          },
          {
            key: "open",
            header: "Open rate",
            render: (item) => {
              const rate = item.deliveredCount > 0 ? Math.round((item.openedCount / item.deliveredCount) * 1000) / 10 : 0;
              return (
                <div className="w-32">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                    <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${rate}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">{rate}% · {item.openedCount} opened</p>
                </div>
              );
            }
          }
        ]}
      />
    </div>
  );
}

async function ConsentTab() {
  const [records, usersEnvelope] = await Promise.all([
    apiGet<SuperAdminConsentRow[]>("/api/super-admin/communications/consent"),
    apiGetEnvelope<SuperAdminUserRow[]>("/api/super-admin/users?limit=100")
  ]);
  const optedOut = (records ?? []).filter((r) => !r.optedIn).length;
  const userOptions = (usersEnvelope.data ?? []).map((user) => ({ label: `${user.name} (${user.email})`, value: user.id }));

  return (
    <div className="grid gap-5">
      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-eyebrow">Compliance</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Consent & opt-out registry</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            {(records ?? []).length} consent record(s) tracked · {optedOut} opted out. Promotional campaigns automatically
            exclude opted-out recipients — this registry is also where a manually received opt-out (phone, email) is
            recorded.
          </p>
        </div>
        <ResourceActionDialog
          triggerLabel="Record consent"
          title="Record a consent decision"
          description="Manually record an opt-in or opt-out for a user and channel — for example, a phone or email opt-out request."
          endpoint="/api/super-admin/communications/consent"
          submitLabel="Save"
          fields={[
            { name: "userId", label: "User", type: "select", required: true, options: userOptions },
            { name: "channel", label: "Channel", type: "select", defaultValue: "EMAIL", options: channelOptions },
            { name: "optedIn", label: "Opted in", type: "select", defaultValue: "false", options: yesNo }
          ]}
        />
      </section>

      <TableCard
        title="Consent records"
        description="Most recently updated first."
        items={records ?? []}
        emptyState="No consent records yet."
        columns={[
          { key: "user", header: "User", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.userName}</p><p className="text-xs text-[var(--color-text-muted)]">{item.userEmail}</p></div> },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          {
            key: "status",
            header: "Status",
            render: (item) =>
              item.optedIn ? (
                <StatusPill bg="var(--color-success-dim)" fg="var(--color-success)" label="Opted in" />
              ) : (
                <StatusPill bg="var(--color-danger-dim)" fg="var(--color-danger)" label="Opted out" />
              )
          },
          { key: "optedOutAt", header: "Opted out", render: (item) => (item.optedOutAt ? formatDate(item.optedOutAt) : "—") },
          { key: "updated", header: "Updated", render: (item) => formatDate(item.updatedAt) }
        ]}
      />

      <TableCard
        title="Third-party commercial messaging — the only form in which this ships"
        description="Third-party commercial campaigns to parents are not built in this version. Every row below is either enforced today or genuinely not implemented — nothing here is aspirational marketing copy."
        items={[
          { requirement: "School opts in as controller", spec: "A school explicitly enabling third-party communications to its own parent community, with a named category list.", state: "Not built" },
          { requirement: "Instruction is documented", spec: "A recorded processing instruction with version, acceptor and timestamp.", state: "Not built" },
          { requirement: "Revenue is shared with the school", spec: "A defined share paid back to the school for access to its parent community.", state: "Not built" },
          { requirement: "Parents keep an independent opt-out", spec: "A parent's own opt-out always overrides anything a school enables.", state: "Enforced" },
          { requirement: "Withdrawal is one action", spec: "A school can withdraw consent for its community at any time, taking effect immediately.", state: "Not built" },
          { requirement: "Category restrictions", spec: "No categories touching children's health, finance, religion or political content; no offers directed at students.", state: "Not applicable yet" },
          { requirement: "Separate reporting", spec: "Commercial revenue tracked and disclosed to the school separately from platform billing.", state: "Not built" }
        ]}
        getRowKey={(row) => row.requirement}
        columns={[
          { key: "requirement", header: "Requirement", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.requirement}</span> },
          { key: "spec", header: "Specification", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.spec}</span> },
          {
            key: "state",
            header: "State",
            render: (row) => {
              const tone = row.state === "Enforced" ? { bg: "var(--color-success-dim)", fg: "var(--color-success)" } : { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" };
              return <StatusPill bg={tone.bg} fg={tone.fg} label={row.state} />;
            }
          }
        ]}
      />

      <ReferenceList
        title="What sending is actually permitted today, and to whom"
        sub="Set by who a campaign's audience is, not decided at send time."
        items={[
          { label: "Operational — to school staff", detail: "Maintenance, billing, security notices. Bypasses promotional opt-out, because it concerns the service the school is paying for.", tone: "good" },
          { label: "Promotional — FutureRealm's own offers, to school staff only", detail: "Tier upgrade offers, training, feature launches. Excludes anyone opted out.", tone: "warn" },
          { label: "Third-party commercial — to parents", detail: "Not permitted in this build, in any form.", tone: "bad" },
          { label: "No role can override an opt-out", detail: "The function doesn't exist in this codebase, so it can't be granted to anyone.", tone: "bad" }
        ]}
      />
    </div>
  );
}

async function NoticesTab({ announcementTypes }: { announcementTypes: Array<{ label: string; value: string }> }) {
  const data = await apiGet<CommunicationsView>("/api/super-admin/communications");

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">In-app notices</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Platform announcements & maintenance</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Lightweight in-app notices shown inside every school portal — separate from full campaigns. Use these for
          platform-wide notices and scheduled maintenance windows.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ResourceActionDialog
            triggerLabel="New Announcement"
            title="Create platform announcement"
            description="Target all schools or a filtered audience using JSON targeting rules."
            endpoint="/api/super-admin/communications/announcements"
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "body", label: "Message", type: "textarea", required: true },
              { name: "type", label: "Type", type: "select", options: announcementTypes, defaultValue: "INFO" },
              { name: "target", label: "Target JSON", type: "textarea", defaultValue: "{ \"audience\": \"ALL_SCHOOLS\" }", parse: "json" },
              { name: "scheduledAt", label: "Schedule Date", type: "date" },
              { name: "expiresAt", label: "Expiry Date", type: "date" }
            ]}
            submitLabel="Publish Announcement"
            confirmLabel="Confirm Publish"
          />
          <ResourceActionDialog
            triggerLabel="Schedule Maintenance"
            title="Create maintenance window"
            description="Schedule a maintenance window and optionally activate it immediately."
            endpoint="/api/super-admin/communications/maintenance"
            variant="secondary"
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "message", label: "Maintenance Message", type: "textarea", required: true },
              { name: "startsAt", label: "Start Date", type: "date", required: true },
              { name: "endsAt", label: "End Date", type: "date", required: true },
              { name: "isActive", label: "Activate Now", type: "select", defaultValue: "false", options: yesNo }
            ]}
            submitLabel="Save Window"
            confirmLabel="Confirm Window"
          />
        </div>
      </section>

      <TableCard
        title="Announcements"
        description="Platform-wide and targeted messages shown inside school portals."
        items={data.announcements ?? []}
        emptyState="No announcements have been created yet."
        columns={[
          { key: "title", header: "Title", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
          { key: "type", header: "Type", render: (item) => item.type.replaceAll("_", " ") },
          { key: "published", header: "Published", render: (item) => item.publishedAt ? formatDate(item.publishedAt) : "Scheduled" },
          { key: "expires", header: "Expires", render: (item) => item.expiresAt ? formatDate(item.expiresAt) : "No expiry" },
          { key: "views", header: "Seen", render: (item) => item._count?.views ?? 0 }
        ]}
      />

      <TableCard
        title="Maintenance Windows"
        description="Scheduled and active maintenance notices."
        items={data.maintenance ?? []}
        emptyState="No maintenance windows are scheduled."
        columns={[
          { key: "title", header: "Title", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
          { key: "status", header: "Status", render: (item) => item.isActive ? "Active" : "Scheduled" },
          { key: "starts", header: "Starts", render: (item) => formatDate(item.startsAt) },
          { key: "ends", header: "Ends", render: (item) => formatDate(item.endsAt) }
        ]}
      />
    </div>
  );
}
