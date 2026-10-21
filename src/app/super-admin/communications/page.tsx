import { BadgeCheck, Clock3, FileWarning, MessageSquare, Radio, ShieldOff, Users2 } from "lucide-react";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { ReferenceList } from "@/components/data-display/reference-list";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { TRIGGERS } from "@/lib/domain/message-triggers";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet, apiGetEnvelope } from "@/lib/api/server";
import type { SuperAdminCampaignRow, SuperAdminConsentRow, SuperAdminMessageTemplateRow, SuperAdminUserRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";
import { CampaignComposer } from "./_campaign-composer";

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
const templateCategoryOptions = ["ONBOARDING", "SUBSCRIPTION", "OPERATIONAL", "COMMERCIAL"].map((v) => ({ label: v, value: v }));
const planFilterOptions = [{ label: "Any", value: "" }, { label: "Starter", value: "BASIC" }, { label: "Standard", value: "STANDARD" }, { label: "Trial", value: "PROFESSIONAL" }, { label: "Elite", value: "ENTERPRISE" }, { label: "NGO / Mission", value: "CUSTOM" }];
const yesNo = [{ label: "Yes", value: "true" }, { label: "No", value: "false" }];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "campaigns" ? "/super-admin/communications" : `/super-admin/communications?tab=${tab}`;
}

export default async function SuperAdminCommunicationsPage({ searchParams }: { searchParams?: Promise<{ tab?: string; compose?: string; campaign?: string; status?: string }> }) {
  const { tab = "campaigns", compose, campaign: campaignFocus, status: statusFilter } = searchParams ? await searchParams : {};

  const campaigns = (await apiGet<SuperAdminCampaignRow[]>("/api/super-admin/communications/campaigns")) ?? [];
  const sentCampaigns = campaigns.filter((c) => c.status === "SENT" || c.status === "SENDING");
  const scheduledCampaigns = campaigns.filter((c) => Boolean(c.scheduledAt));
  const recentDeliveryFailures = sentCampaigns.reduce((sum, c) => sum + c.failedCount, 0);
  const templates = (await apiGet<SuperAdminMessageTemplateRow[]>("/api/super-admin/communications/templates")) ?? [];
  const templateOptions = [
    { label: "No template — write the message below", value: "" },
    ...templates.map((template) => ({ label: `${template.name} (${template.channel})`, value: template.id }))
  ];

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
        eyebrow="Operations"
        title="Communications"
        description="FutureRealm's own broadcast channel into every school, teacher, parent, and student — targeted campaigns with an approval workflow, a message template library, delivery and consent tracking."
        action={
          <Link href="/super-admin/communications?tab=campaigns&compose=1" className="whitespace-nowrap rounded-full bg-white px-5 py-3 text-[11.5px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]">
            New campaign
          </Link>
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "campaigns" ? (
        compose === "1" ? (
          <CampaignComposer templateOptions={templateOptions} planFilterOptions={planFilterOptions} />
        ) : (
          <CampaignsTab campaigns={campaigns} />
        )
      ) : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "triggers" ? <TriggersTab scheduled={scheduledCampaigns} totalCampaigns={campaigns.length} templates={(await apiGet<SuperAdminMessageTemplateRow[]>("/api/super-admin/communications/templates")) ?? []} /> : null}
      {tab === "delivery" ? <DeliveryTab sent={sentCampaigns} focus={campaignFocus} status={statusFilter} /> : null}
      {tab === "consent" ? <ConsentTab /> : null}
      {tab === "notices" ? <NoticesTab announcementTypes={announcementTypes} /> : null}
    </div>
  );
}


function CampaignsTab({ campaigns }: { campaigns: SuperAdminCampaignRow[] }) {
  return (
    <div className="grid gap-3.5 xl:grid-cols-[1.8fr_1fr]">
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
          { key: "delivered", header: "Delivered", render: (item) => (item.status === "SENT" || item.status === "SENDING" ? <span className="text-[11px]">{item.deliveredCount} delivered · {item.failedCount} failed{item.queuedCount ? ` · ${item.queuedCount} waiting` : ""}</span> : "-") },
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
                    description="Queues one message to every matching recipient now. Each is delivered by the delivery worker; what happened to it appears under Delivery."
                    endpoint={`/api/super-admin/communications/campaigns/${item.id}/send`}
                    method="POST"
                    variant="menu"
                    submitLabel="Send now"
                    confirmLabel="Confirm send"
                    confirmMessage="This queues the campaign to all matching recipients."
                    fields={[]}
                  />
                ) : null}
              </ActionMenu>
            )
          }
        ]}
      />

      <div className="flex flex-col gap-3.5">
        <section className="surface-card p-5">
          <p className="mb-3.5 text-[12.5px] font-semibold text-[var(--color-text-primary)]">Recurring and scheduled</p>
          <div className="grid gap-2.5">
            {campaigns.filter((c) => c.status === "SCHEDULED").length === 0 ? (
              <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">Nothing is scheduled. In New campaign, set Schedule for and, to make it recur, Repeat. Once approved, the platform sends it at that time by itself, and a recurring one lines up its next run.</p>
            ) : (
              campaigns.filter((c) => c.status === "SCHEDULED").map((c) => (
                <div key={c.id} className="border-b border-[var(--color-border-muted)] pb-2.5 last:border-b-0 last:pb-0">
                  <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{c.name}</p>
                  <p className="text-[10.5px] text-[var(--color-text-muted)]">{c.scheduledAt ? formatDate(c.scheduledAt) : "—"} · {c.recurrence === "WEEKLY" ? "every week" : c.recurrence === "MONTHLY" ? "every month" : "once"}{c.approvedBy ? ` · approved by ${c.approvedBy}` : " · waiting for approval"}</p>
                </div>
              ))
            )}
          </div>
          <p className="mt-3.5 text-[10px] leading-relaxed text-[var(--color-text-muted)]">Checked every minute. A scheduled campaign that has not been approved does not send.</p>
        </section>

        <section className="rounded-[12.5px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-5">
          <p className="mb-2 text-[11.5px] font-semibold text-[var(--color-text-primary)]">Approval path</p>
          <p className="text-[11.5px] leading-relaxed text-[var(--color-text-secondary)]">
            Operational campaigns require a platform administrator to approve. Promotional campaigns need Super Admin or
            Marketing Lead sign-off, from someone other than the person who wrote them, and are never sent to students
            or to anyone who opted out. There is no third-party commercial campaign type in this build — a send to
            parents on behalf of another organisation isn&apos;t possible in any form.
          </p>
        </section>
      </div>
    </div>
  );
}

async function TemplatesTab() {
  const templates = (await apiGet<SuperAdminMessageTemplateRow[]>("/api/super-admin/communications/templates")) ?? [];
  const approved = templates.filter((t) => t.approvalStatus === "APPROVED").length;
  const awaitingMeta = templates.filter((t) => t.approvalStatus === "PENDING_META_APPROVAL").length;
  const rejected = templates.filter((t) => t.approvalStatus === "REJECTED").length;
  const awaitingReview = templates.filter((t) => t.approvalStatus === "PENDING_REVIEW").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Templates in the library" value={templates.length} detail="Across every channel and category" icon={MessageSquare} tone="dark" />
        <StatCard label="Approved and in use" value={approved} detail="Cleared to send" icon={BadgeCheck} tone="success" />
        <StatCard label="Awaiting Meta approval" value={awaitingMeta} detail="WhatsApp templates must be pre-approved" icon={Clock3} tone={awaitingMeta ? "warning" : "neutral"} />
        <StatCard label="Rejected — needs revision" value={rejected} detail="Meta's reason is on the record" icon={FileWarning} tone={rejected ? "danger" : "neutral"} />
        <StatCard label="Awaiting a second reviewer" value={awaitingReview} detail="Written, not yet approved by somebody else" icon={ShieldOff} tone={awaitingReview ? "warning" : "neutral"} />
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
            { name: "triggerKey", label: "Attach to a platform trigger", type: "select", defaultValue: "", options: [{ label: "None — used by campaigns only", value: "" }, ...TRIGGERS.map((t) => ({ label: `${t.label} — {{${t.vars.join("}}, {{")}}}`, value: t.key }))], note: "Email only. Once approved, the platform's own notice for that moment is worded from this template instead of the built-in text." },
            { name: "metaTemplateId", label: "Meta template ID (WhatsApp)" }
          ]}
        />
      }
      emptyState="No message templates yet."
      columns={[
        { key: "category", header: "Group", render: (item) => item.category },
        { key: "name", header: "Template", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "channel", header: "Channel", render: (item) => item.channel },
        { key: "approval", header: "Status", render: (item) => <StatusBadge status={item.approvalStatus} tone={item.approvalStatus === "APPROVED" ? "success" : item.approvalStatus === "REJECTED" ? "danger" : "warning"} /> },
        { key: "trigger", header: "Trigger", render: (item) => (item.triggerKey ? <span className="text-[11.5px]">{TRIGGERS.find((t) => t.key === item.triggerKey)?.label ?? item.triggerKey}</span> : <span className="text-[var(--color-text-muted)]">—</span>) },
        { key: "version", header: "Version", render: (item) => `v${item.version ?? 1}` },
        { key: "uses", header: "Uses", render: (item) => `${item.uses ?? 0} campaign${(item.uses ?? 0) === 1 ? "" : "s"}` },
        { key: "edited", header: "Edited", render: (item) => formatDate(item.updatedAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Actions for ${item.name}`}>
            <ResourceActionDialog
              triggerLabel="Edit (makes a new version)"
              title={`Edit — ${item.name}`}
              description="The wording that already went out stays exactly as it was. Saving creates version ${(item.version ?? 1) + 1}, which waits for a second person to approve it before it can be used."
              endpoint={`/api/super-admin/communications/templates/${item.id}`}
              method="PATCH"
              variant="secondary"
              submitLabel="Save as a new version"
              fields={[
                { name: "name", label: "Template name", defaultValue: item.name },
                { name: "body", label: "Body", type: "textarea", defaultValue: item.body },
                { name: "channel", label: "Channel", type: "select", defaultValue: item.channel, options: channelOptions },
                { name: "category", label: "Category", type: "select", defaultValue: item.category, options: templateCategoryOptions },
                { name: "triggerKey", label: "Attach to a platform trigger", type: "select", defaultValue: item.triggerKey ?? "", options: [{ label: "None — used by campaigns only", value: "" }, ...TRIGGERS.map((t) => ({ label: `${t.label} — {{${t.vars.join("}}, {{")}}}`, value: t.key }))] }
              ]}
            />
            {item.channel === "WHATSAPP" && item.approvalStatus !== "APPROVED" ? (
              <ResourceActionDialog triggerLabel="Submit to Meta" title={`Submit to Meta — ${item.name}`} description="Sends this wording to Meta for approval. Meta's answer comes back by itself through the webhook; until then the template waits. Needs the WhatsApp business keys on this deployment." endpoint={`/api/super-admin/whatsapp/templates/${item.id}/submit`} method="POST" variant="menu" submitLabel="Submit" fields={[]} />
            ) : null}
            <ResourceActionDialog
              triggerLabel={item.channel === "WHATSAPP" ? "Record Meta's decision" : "Review"}
              title={`Review — ${item.name}`}
              description={item.channel === "WHATSAPP" ? "Record the decision Meta sent back for this template." : "Somebody other than the person who wrote it approves or rejects the wording."}
              endpoint={`/api/super-admin/communications/templates/${item.id}/approval`}
              method="PATCH"
              variant="secondary"
              submitLabel="Save"
              fields={[
                { name: "approvalStatus", label: "Decision", type: "select", defaultValue: item.approvalStatus, options: (item.channel === "WHATSAPP" ? ["PENDING_META_APPROVAL", "APPROVED", "REJECTED"] : ["PENDING_REVIEW", "APPROVED", "REJECTED"]).map((v) => ({ label: v.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), value: v })) },
                { name: "reviewNote", label: "Note", type: "textarea" }
              ]}
            />
            </ActionMenu>
          )
        }
      ]}
    />

    <section className="grid gap-5 lg:grid-cols-2">
      <ReferenceList
        title="What editing a template can and cannot do"
        sub="The library is deliberately narrow. It changes words, never who receives them."
        items={[
          { label: "You can rewrite the words", detail: "Subject, body and the order of the fields. Editing makes a new version; what went out under the old one stays readable", pill: "Allowed", tone: "good" },
          { label: "You can add or remove a channel", detail: "Adding WhatsApp needs Meta approval first, so the new version waits for it", pill: "Allowed", tone: "good" },
          { label: "You cannot change the time it sends", detail: "Timing is held by the trigger, in the platform’s settings and code — not on the template", pill: "Refused", tone: "bad" },
          { label: "You cannot change who receives it", detail: "That is the trigger’s job, and it is deliberately separate", pill: "Refused", tone: "bad" },
          { label: "You cannot add a field the recipient may not see", detail: "A draft attached to a trigger is blocked if it uses a {{field}} that trigger cannot fill in", pill: "Refused", tone: "bad" }
        ]}
      />

      <ReferenceList
        title="Before a new template can be used"
        sub="Gates, in order. A draft that skips one cannot be attached to a trigger."
        items={[
          { label: "1 · Written and saved", detail: "A new template, or a new version, waits for review and cannot be used until it is approved", tone: "teal" },
          { label: "2 · Fields validated", detail: "Every {{field}} must be one the chosen trigger can fill in, or the draft is blocked", tone: "teal" },
          { label: "3 · Meta approval, WhatsApp only", detail: "Recorded on the template, with Meta’s own decision, once it comes back", tone: "warn" },
          { label: "4 · Reviewed by a second person", detail: "A platform administrator other than the author. Nobody publishes their own copy", tone: "warn" },
          { label: "5 · Attached to a trigger, or sent by hand", detail: "An approved email template attached to a platform notice is used in place of the built-in wording", tone: "good" }
        ]}
      />
    </section>
    </div>
  );
}

type TriggerRule = { key?: string; event: string; recipient: string; channel: string; tier: string; template: string | null; when: string; enabled: boolean };

const triggerTiming: Record<string, string> = {
  "trial.ending": "Days before the trial ends, as set in Settings",
  "trial.ended": "The moment the trial ends",
  "trial.lock_reminder": "Days before the read-only window closes",
  "trial.locked": "When the read-only window closes",
  "discount.reverify": "30 days before a discount ends",
  "discount.ended": "The day a discount runs out",
  "dormant.notice": "After the dormancy threshold with no sign-in",
  "address.released": "When the release date passes with no sign-in",
  "trial.day1": "Day 1 of the trial",
  "trial.day3": "Day 3 of the trial",
  "trial.day7": "Day 7 of the trial",
  "trial.day14": "Day 14 of the trial",
  "trial.pricing": "Nine days before the trial ends"
};

const schoolRules: TriggerRule[] = [
  { event: "Invoice issued", recipient: "Guardian", channel: "Guardian's preference", tier: "All tiers", template: null, when: "When staff create an invoice", enabled: true },
  { event: "Invoice reminder sent", recipient: "Guardian", channel: "Guardian's preference", tier: "All tiers", template: null, when: "When staff press Send reminder", enabled: true },
  { event: "Payment recorded / receipt ready", recipient: "Guardian", channel: "Guardian's preference", tier: "All tiers", template: null, when: "When staff record a payment", enabled: true },
  { event: "Student marked absent", recipient: "Parent", channel: "SMS", tier: "All tiers", template: null, when: "When the teacher marks the register", enabled: true },
  { event: "Admissions lifecycle (submitted, screening, decision, offer, enrolment)", recipient: "Guardian", channel: "Email, falling back to SMS", tier: "All tiers", template: null, when: "When staff advance the application", enabled: true },
  { event: "Welcome email at signup", recipient: "New account owner", channel: "Email", tier: "All tiers", template: null, when: "Once, at signup", enabled: true }
];

async function TriggersTab({ scheduled, totalCampaigns, templates }: { scheduled: SuperAdminCampaignRow[]; totalCampaigns: number; templates: SuperAdminMessageTemplateRow[] }) {
  const policy = await apiGet<{ messaging: { disabledTriggers: string[] } }>("/api/super-admin/platform-policy");
  const disabled = new Set(policy.messaging.disabledTriggers ?? []);
  const manualCount = totalCampaigns - scheduled.length;
  const attached = new Map(templates.filter((t) => t.triggerKey && t.approvalStatus === "APPROVED").map((t) => [t.triggerKey as string, t.name]));
  const platformRules: TriggerRule[] = TRIGGERS.map((trigger) => ({ key: trigger.key, event: trigger.label, recipient: "School owner", channel: "Email + in-app", tier: "All tiers", template: attached.get(trigger.key) ?? null, when: triggerTiming[trigger.key] ?? "—", enabled: !disabled.has(trigger.key) }));
  const groups = [
    { editable: true, title: "Platform notices to schools", sub: "Event → recipient → channel → tier → template → when. A notice with an approved template attached is worded from it; with none it uses the built-in wording.", rules: platformRules },
    { editable: false, title: "Messages the school sends its families", sub: "Fired by the school's own staff actions. Their wording is built in; they are not yet drawn from the template library.", rules: schoolRules }
  ];
  const all = groups.flatMap((g) => g.rules);
  const channels = new Set(all.flatMap((r) => r.channel.split(/,| \+ /).map((c) => c.trim()))).size;
  const recipients = new Set(all.map((r) => r.recipient)).size;
  const behind = new Set(all.filter((r) => r.template).map((r) => r.template)).size;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Trigger rules defined" value={all.length} detail={`${groups.length} groups`} icon={Radio} tone="dark" />
        <StatCard label="Enabled" value={all.filter((r) => r.enabled).length} detail={`${all.filter((r) => !r.enabled).length} switched off by hand`} icon={MessageSquare} tone="success" />
        <StatCard label="Channels in use" value={channels} detail="Email · SMS · In-app" icon={Users2} tone="info" />
        <StatCard label="Recipient roles" value={recipients} detail="Never a role that did not consent" icon={Clock3} tone="neutral" />
        <StatCard label="Templates behind them" value={behind} detail="Versioned · a sent message renders as sent" icon={ShieldOff} tone={behind ? "success" : "warning"} />
      </section>

      {groups.map((group) => (
        <TableCard
          key={group.title}
          title={group.title}
          description={`${group.sub} · ${group.rules.length} rule${group.rules.length === 1 ? "" : "s"} · ${group.rules.filter((r) => r.enabled).length} enabled`}
          items={group.rules}
          getRowKey={(row) => row.event}
          pageSize={false}
          actions={
            group.editable ? (
              <div className="flex gap-2">
                <ResourceActionDialog triggerLabel="Disable this group" title="Disable platform notices" description="Every notice in this group stops being sent to schools until it is switched back on. The school's state still changes — a trial still ends — only the message is held back. Say why." endpoint="/api/super-admin/platform-policy/triggers" method="POST" variant="secondary" submitLabel="Disable" confirmLabel="Confirm" confirmMessage="Schools will no longer be told about these events." fields={[
                  { name: "keys", label: "Notices", type: "multiselect", options: group.rules.map((rule) => ({ label: rule.event, value: rule.key as string })) },
                  { name: "enabled", label: "Switch", type: "select", defaultValue: "false", options: [{ label: "Off", value: "false" }, { label: "On", value: "true" }] },
                  { name: "reason", label: "Reason", type: "textarea", required: true }
                ]} />
              </div>
            ) : (
              <span className="text-[11px] text-[var(--color-text-muted)]">No controls — fired by the school’s own staff actions</span>
            )
          }
          columns={[
            { key: "event", header: "Event", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.event}</span> },
            { key: "recipient", header: "Recipient", render: (row) => row.recipient },
            { key: "channel", header: "Channel", render: (row) => row.channel },
            { key: "tier", header: "Tier", render: (row) => row.tier },
            { key: "template", header: "Template", render: (row) => (row.template ? <span className="font-[var(--font-mono)] text-[11px]">{row.template}</span> : <span className="text-[var(--color-text-muted)]">Built-in wording</span>) },
            { key: "when", header: "When it sends", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.when}</span> },
            { key: "state", header: "", sortable: false, render: (row) => <StatusPill bg={row.enabled ? "var(--color-success-dim)" : "var(--color-warning-dim)"} fg={row.enabled ? "var(--color-success)" : "var(--color-warning)"} label={row.enabled ? "Enabled" : "Disabled"} /> }
          ]}
        />
      ))}

      <TableCard
        title="Scheduled sends"
        description={`Campaigns composed with a Schedule for time, instead of being sent manually. ${scheduled.length} of ${totalCampaigns} campaign(s) are scheduled (${manualCount} sent manually); ${scheduled.filter((c) => Boolean(c.sentAt)).length} already dispatched. Scheduling sets the campaign's intended send time — approval and dispatch (Send now, in Campaigns) still trigger the actual delivery once that time is reached.`}
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

type DeliveryLine = { id: string; recipient: string; school: string; address: string | null; channel: string; status: string; error: string | null; deliveredAt: string | null; provider: string | null; attempts: number };
type Failures = { sent: number; failed: number; held: number; reasons: Array<{ reason: string; channel: string; count: number }> };

async function DeliveryTab({ sent, focus, status }: { sent: SuperAdminCampaignRow[]; focus?: string; status?: string }) {
  const failures = await apiGet<Failures>("/api/super-admin/communications/delivery-failures");
  const current = sent.find((c) => c.id === focus) ?? sent[0];
  const lines = current ? ((await apiGet<DeliveryLine[]>(`/api/super-admin/communications/campaigns/${current.id}/deliveries${status ? `?status=${status}` : ""}`).catch(() => [])) ?? []) : [];
  const totalRecipients = sent.reduce((sum, c) => sum + c.recipientCount, 0);
  const totalDelivered = sent.reduce((sum, c) => sum + c.deliveredCount, 0);
  const emailsSent = sent.reduce((sum, c) => sum + (c.emailsSent ?? 0), 0);
  const openedTotal = sent.reduce((sum, c) => sum + (c.openedCount ?? 0), 0);
  const opensTracked = sent.some((c) => c.openedCount !== null);
  const totalFailed = sent.reduce((sum, c) => sum + c.failedCount, 0);
  const totalWaiting = sent.reduce((sum, c) => sum + (c.queuedCount ?? 0), 0);
  const settled = totalDelivered + totalFailed;
  const deliveryRate = settled > 0 ? Math.round((totalDelivered / settled) * 1000) / 10 : null;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Recipients targeted" value={totalRecipients.toLocaleString()} detail={`Across ${sent.length} sent campaign(s)`} icon={Radio} tone="dark" />
        <StatCard label="Delivered" value={totalDelivered.toLocaleString()} detail={deliveryRate === null ? "Nothing has been settled yet" : `${deliveryRate}% of the messages that have settled`} icon={BadgeCheck} tone="success" />
        <StatCard label="Failed" value={totalFailed.toLocaleString()} detail="Counted from the messages themselves, with the reason on each" icon={FileWarning} tone={totalFailed ? "danger" : "neutral"} />
        <StatCard label="Waiting" value={totalWaiting.toLocaleString()} detail="Queued or held — quiet hours, a daily cap, or delivery switched off" icon={Clock3} tone="info" />
        <StatCard label="Opened (email)" value={emailsSent > 0 && opensTracked ? `${openedTotal.toLocaleString()} of ${emailsSent.toLocaleString()}` : "Not measured"} detail={opensTracked ? "Emails whose one-pixel image was fetched — approximate, since some mail apps load images for the reader. SMS has no open." : "Set PUBLIC_API_URL so each email carries the one-pixel image that records an open. SMS has no open."} icon={ShieldOff} tone={opensTracked ? "info" : "neutral"} />
      </section>

      <div className="grid gap-3.5 xl:grid-cols-[1.3fr_1fr]">
        <TableCard
          title="Campaign performance"
          description="Every sent campaign, most recent first. Open one to see its delivery log."
          items={sent}
          emptyState="No campaigns have been sent yet."
          columns={[
            { key: "name", header: "Campaign", render: (item) => <div><Link href={`/super-admin/communications?tab=delivery&campaign=${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.name}</Link><p className="text-[10px] text-[var(--color-text-muted)]">{item.sentAt ? formatDate(item.sentAt) : "—"}</p></div> },
            { key: "channel", header: "Channel", render: (item) => item.channel },
            { key: "sent", header: "Recipients", render: (item) => item.recipientCount.toLocaleString() },
            { key: "delivered", header: "Delivered", render: (item) => item.deliveredCount.toLocaleString() },
            { key: "failed", header: "Failed", render: (item) => <span className={item.recipientCount > 0 && item.failedCount / item.recipientCount > 0.05 ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}>{item.failedCount.toLocaleString()}</span> },
            { key: "waiting", header: "Waiting", render: (item) => (item.queuedCount ?? 0).toLocaleString() }
          ]}
        />

        <TableCard
          title="Failure reasons"
          description={`The carrier's own words, counted, across every message in the last 30 days. ${failures.sent.toLocaleString()} delivered · ${failures.failed.toLocaleString()} failed · ${failures.held.toLocaleString()} held.`}
          items={failures.reasons}
          emptyState="Nothing has failed in the last 30 days."
          pageSize={false}
          getRowKey={(row) => `${row.channel}:${row.reason}`}
          columns={[
            { key: "reason", header: "Reason", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.reason}</span> },
            { key: "channel", header: "Channel", render: (row) => row.channel },
            { key: "count", header: "Messages", render: (row) => <span className="font-bold">{row.count.toLocaleString()}</span> }
          ]}
        />
      </div>

      <TableCard
        title={current ? `Delivery log · ${current.name}` : "Delivery log"}
        description="One line per recipient: where it went, what happened, and the carrier's reason when it did not arrive. Showing the first 500."
        items={lines}
        emptyState={current ? "No messages match." : "No campaign has been sent yet."}
        getRowKey={(line) => line.id}
        actions={
          <div className="flex gap-2 text-[11px] font-semibold">
            {[["", "All"], ["SENT", "Delivered"], ["FAILED", "Failed"], ["QUEUED", "Waiting"], ["HELD", "Held"]].map(([value, label]) => (
              <Link key={label} href={`/super-admin/communications?tab=delivery${current ? `&campaign=${current.id}` : ""}${value ? `&status=${value}` : ""}`} className={(status ?? "") === value ? "text-[var(--color-text-accent)]" : "text-[var(--color-text-muted)]"}>{label}</Link>
            ))}
          </div>
        }
        columns={[
          { key: "recipient", header: "Recipient", render: (line) => <div><p className="font-semibold text-[var(--color-text-primary)]">{line.recipient}</p><p className="text-[10px] text-[var(--color-text-muted)]">{line.school}</p></div> },
          { key: "address", header: "Sent to", render: (line) => <span className="font-[var(--font-mono)] text-[11px]">{line.address ?? "—"}</span> },
          { key: "status", header: "State", render: (line) => <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={line.status === "SENT" ? { background: "var(--color-success-dim)", color: "var(--color-success)" } : line.status === "FAILED" ? { background: "var(--color-danger-dim)", color: "var(--color-danger)" } : { background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>{line.status === "SENT" ? "Delivered" : line.status === "FAILED" ? "Failed" : line.status === "HELD" ? "Held" : "Waiting"}</span> },
          { key: "detail", header: "Detail", render: (line) => <span className="text-[11px] text-[var(--color-text-muted)]">{line.error ?? (line.deliveredAt ? `${line.provider ?? "Carrier"} · ${new Date(line.deliveredAt).toLocaleString("en-GB")}` : line.attempts ? `${line.attempts} attempt${line.attempts === 1 ? "" : "s"} so far` : "—")}</span> }
        ]}
        footnote="A message waits when delivery is switched off, when quiet hours or a daily cap apply, or after a carrier outage; it fails when the carrier refuses it or after the allowed number of attempts."
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

  const roleBuckets: Array<{ label: string; match: (role: string) => boolean }> = [
    { label: "School admins opted in", match: (role) => !["TEACHER", "PARENT", "STUDENT"].includes(role) },
    { label: "Parents opted in", match: (role) => role === "PARENT" },
    { label: "Teachers opted in", match: (role) => role === "TEACHER" }
  ];
  const consentStats = roleBuckets.map((bucket) => {
    const bucketRecords = (records ?? []).filter((r) => bucket.match(r.userRole));
    const opted = bucketRecords.filter((r) => r.optedIn).length;
    const pct = bucketRecords.length > 0 ? Math.round((opted / bucketRecords.length) * 100) : null;
    return { label: bucket.label, value: pct === null ? "No records yet" : `${pct}%`, pct: pct ?? 0, recordCount: bucketRecords.length };
  });

  const consentRules = [
    "Every user's opt-in status is stored per channel and respected — who recorded it and when, via updatedAt.",
    "Opt-outs are honoured immediately for promotional sends — excluded automatically, verified in the real send path.",
    "No admin at any level can override an opt-out. The function does not exist, so it cannot be granted to anyone.",
    "Operational messages — maintenance, billing, security — bypass promotional opt-out, because they concern the service the school is paying for.",
    "Third-party commercial messages to parents are not permitted in this build, in any form — there is no third campaign type beyond Operational and Promotional.",
    "Each decision records the school the person belonged to when they answered, and how it was given.",
    "A promotional campaign is never sent to a student account — students are minors, and consent for a child comes from a guardian."
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-3.5 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-5">
          <p className="mb-4 text-[12.5px] font-semibold text-[#0D2315]">Promotional opt-in status</p>
          {consentStats.map((stat) => (
            <div key={stat.label} className="mb-4 last:mb-0">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11.5px] text-[#435048]">{stat.label}</p>
                <p className="font-[var(--font-display)] text-[11.5px] font-bold">{stat.value}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#EDF3EF]">
                <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${stat.pct}%` }} />
              </div>
              <p className="mt-1 text-[9.5px] text-[#8C9A92]">{stat.recordCount} recorded decision(s) for this role</p>
            </div>
          ))}
          <div className="mt-4 border-t border-[#F2F7F4] pt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11.5px] text-[#435048]">Opted out (all-time)</p>
              <p className="font-[var(--font-display)] text-[11.5px] font-bold">{optedOut}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-5">
          <p className="text-[12.5px] font-semibold text-[#0D2315]">Consent rules enforced at system level</p>
          <p className="mt-1 mb-3.5 text-[10.5px] text-[#8C9A92]">Verified against the real consent and campaign-send code, not stated as intent.</p>
          {consentRules.map((rule) => (
            <div key={rule} className="flex gap-2.5 border-b border-[#F2F7F4] py-2.5 last:border-0">
              <div className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[5.5px] bg-[var(--color-accent-primary)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
              </div>
              <p className="text-[11.5px] leading-relaxed text-[#435048]">{rule}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-eyebrow">Compliance</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Consent & opt-out registry</h2>
          <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
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
          { key: "role", header: "Role", render: (item) => item.userRole.replaceAll("_", " ") },
          { key: "school", header: "School", render: (item) => item.school ?? "—" },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "source", header: "How it was given", render: (item) => <span className="text-[11px] text-[var(--color-text-muted)]">{item.source ?? "—"}</span> },
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
        title="What remains permitted, and to whom"
        sub="Set by who a campaign’s audience is, not decided at send time"
        items={[
          { label: "Operational — to school staff", detail: "Maintenance, billing, security notices. Bypasses promotional opt-out, because it concerns the service the school is paying for.", tone: "good" },
          { label: "Promotional — FutureRealm's own offers, to school staff only", detail: "Tier upgrade offers, training, feature launches. Excludes anyone opted out.", tone: "warn" },
          { label: "Third-party commercial — to parents", detail: "Not permitted in this build, in any form.", tone: "bad" },
          { label: "No role may override an opt-out", detail: "The function does not exist, so it cannot be granted to anyone", tone: "bad" },
          { label: "Where consent was captured by the school", detail: "The record stores which school captured it, how, and when — that is the chain we would have to evidence", tone: "teal" }
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
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Platform announcements & maintenance</h2>
        <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
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
