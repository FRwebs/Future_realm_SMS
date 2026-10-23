import { BadgeCheck, Clock3, FileWarning, MessageSquare, Radio, ShieldOff, Users2 } from "lucide-react";
import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { BarList } from "@/components/data-display/bar-list";
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
    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "campaigns" ? "/super-admin/communications" : `/super-admin/communications?tab=${tab}`;
}

export default async function SuperAdminCommunicationsPage({ searchParams }: { searchParams?: Promise<{ tab?: string; compose?: string; campaign?: string; status?: string; tgroup?: string; tchannel?: string; tstatus?: string }> }) {
  const { tab = "campaigns", compose, campaign: campaignFocus, status: statusFilter, tgroup, tchannel, tstatus } = searchParams ? await searchParams : {};

  const campaigns = (await apiGet<SuperAdminCampaignRow[]>("/api/super-admin/communications/campaigns")) ?? [];
  const identity = await apiGet<{ identity: { platformName: string } }>("/api/super-admin/platform-policy").catch(() => null);
  const platformName = identity?.identity?.platformName ?? "FutureRealm";
  const sentCampaigns = campaigns.filter((c) => c.status === "SENT" || c.status === "SENDING");
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
    <div className="grid gap-[14px]">
      <ModuleHero
        eyebrow="MODULE 04"
        title="Communications"
        description="Reach every school reliably, and never contact someone who said no."
        action={
          <Link href="/super-admin/communications?tab=campaigns&compose=1" className="whitespace-nowrap rounded-full bg-white px-5 py-3 text-[11.5px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]">
            New campaign
          </Link>
        }
      />

      <DetailTabs tabs={tabs} />

      {tab === "campaigns" ? (
        compose === "1" ? (
          <CampaignComposer templateOptions={templateOptions} planFilterOptions={planFilterOptions} platformName={platformName} />
        ) : (
          <CampaignsTab campaigns={campaigns} />
        )
      ) : null}
      {tab === "templates" ? <TemplatesTab group={tgroup} channel={tchannel} status={tstatus} /> : null}
      {tab === "triggers" ? <TriggersTab templates={templates} /> : null}
      {tab === "delivery" ? <DeliveryTab sent={sentCampaigns} focus={campaignFocus} status={statusFilter} /> : null}
      {tab === "consent" ? <ConsentTab /> : null}
      {tab === "notices" ? <NoticesTab announcementTypes={announcementTypes} /> : null}
    </div>
  );
}


/** The mockup's status words, read from what the campaign has actually done. */
function campaignState(item: SuperAdminCampaignRow): { label: string; bg: string; fg: string } {
  const failedAll = (item.status === "SENT" || item.status === "SENDING") && item.recipientCount > 0 && item.deliveredCount === 0 && item.queuedCount === 0 && item.failedCount >= item.recipientCount;
  if (failedAll) return { label: "Failed", bg: "#FDF3F3", fg: "#B23B3B" };
  if (item.status === "SENT" || item.status === "SENDING") return { label: item.status === "SENDING" ? "Sending" : "Sent", bg: "#EAF6F0", fg: "#17714F" };
  if (item.status === "SCHEDULED" || item.status === "APPROVED") return { label: item.scheduledAt ? "Scheduled" : "Approved", bg: "#E7F1FB", fg: "#2B5F8F" };
  // A draft that was given a date is waiting for someone to approve it; one with no date is still being written.
  if (item.status === "DRAFT" && item.scheduledAt) return { label: "Awaiting approval", bg: "#FDF6E7", fg: "#8A6410" };
  return { label: "Draft", bg: "#F1F4F2", fg: "#5C6A62" };
}

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", SMS: "SMS", WHATSAPP: "WhatsApp", PUSH: "Push", IN_APP: "In-app" };

async function CampaignsTab({ campaigns }: { campaigns: SuperAdminCampaignRow[] }) {
  const recurring = campaigns.filter((c) => c.recurrence && c.recurrence !== "NONE" && c.status !== "DRAFT");
  const policy = await apiGet<{ messaging: { disabledTriggers: string[] } }>("/api/super-admin/platform-policy").catch(() => null);
  const disabled = new Set(policy?.messaging?.disabledTriggers ?? []);
  const custom = (await apiGet<CustomRule[]>("/api/super-admin/communications/trigger-rules").catch(() => [] as CustomRule[])) ?? [];
  const rules = [
    ...TRIGGERS.map((trigger) => ({ name: trigger.label, rule: triggerTiming[trigger.key] ?? "Fires when the event happens", on: !disabled.has(trigger.key) })),
    ...custom.map((rule) => ({ name: rule.event, rule: rule.condition, on: rule.enabled })),
    ...recurring.map((c) => ({ name: c.name, rule: `${c.scheduledAt ? `Next ${formatDate(c.scheduledAt)}` : "No date set"} · ${c.recurrence === "WEEKLY" ? "every week" : "every month"}`, on: Boolean(c.approvedBy) }))
  ];
  const shown = rules.slice(0, 6);
  return (
    <div className="grid items-start gap-[12.5px] xl:grid-cols-[1.8fr_1fr]">
      <TableCard
        title="Campaigns"
        description="Draft → approve → send. Promotional sends honour opt-outs automatically."
        items={campaigns}
        pageSize={false}
        emptyState="No campaigns yet — use New campaign above to draft one."
        columns={[
          { key: "name", header: "Campaign", render: (item) => <div><p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{item.name}</p><p className="text-[10.5px] text-[#8C9A92]">{item.scheduledAt ? `${item.status === "SENT" || item.status === "SENDING" ? "Sent" : "Scheduled"} ${formatDate(item.scheduledAt)}` : item.sentAt ? `Sent ${formatDate(item.sentAt)}` : "Draft"}</p></div> },
          { key: "type", header: "Type", render: (item) => <StatusPill bg={item.type === "PROMOTIONAL" ? "#FDF6E7" : "#E4F1EC"} fg={item.type === "PROMOTIONAL" ? "#8A6410" : "#17604F"} label={item.type === "PROMOTIONAL" ? "Promotional" : "Operational"} /> },
          { key: "channel", header: "Channel", render: (item) => CHANNEL_LABEL[item.channel] ?? item.channel },
          { key: "audience", header: "Audience", render: (item) => item.recipientCount.toLocaleString() },
          { key: "status", header: "Status", render: (item) => { const state = campaignState(item); return <StatusPill bg={state.bg} fg={state.fg} label={state.label} />; } },
          {
            key: "actions",
            header: "",
            render: (item) => (
              <ActionMenu compact triggerLabel={`Actions for ${item.name}`}>
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

      <div className="grid gap-[12.5px]">
        <section className="rounded-[14px] border border-[#DEE8E2] bg-white p-[18px]">
          <div className="mb-[11px] flex items-center justify-between gap-3">
            <p className="text-[12.5px] font-semibold text-[#0D2315]">Recurring rules</p>
            <Link href="/super-admin/communications?tab=triggers" className="text-[11px] font-semibold text-[#12796A] hover:underline">Manage</Link>
          </div>
          {shown.length ? shown.map((rule) => (
            <div key={rule.name} className="flex items-center gap-[10px] border-b border-[#F2F7F4] py-[10px] last:border-b-0">
              <span aria-label={rule.on ? "On" : "Off"} className="h-[17px] w-[30.5px] flex-none rounded-full p-[2px]" style={{ background: rule.on ? "#12796A" : "#D5E0DA" }}>
                <span className="block h-[13.5px] w-[13.5px] rounded-full bg-white" style={{ marginLeft: rule.on ? 13.5 : 0 }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-[#0D2315]">{rule.name}</p>
                <p className="text-[10.5px] text-[#8C9A92]">{rule.rule}</p>
              </div>
            </div>
          )) : <p className="text-[11px] text-[#8C9A92]">Nothing recurs yet.</p>}
          {rules.length > shown.length ? <p className="mt-2 text-[10.5px] text-[#8C9A92]">{rules.length - shown.length} more under Triggers</p> : null}
        </section>

        <section className="rounded-[14px] border border-[#E6EEE9] bg-[#F7FAF8] p-[18px]">
          <h3 className="mb-[7px] text-[11.5px] font-semibold text-[#0D2315]">Approval path</h3>
          <p className="text-pretty text-[11.5px] leading-[1.6] text-[#435048]">
            Operational campaigns require Department Lead approval. Promotional campaigns to school staff require Marketing Lead sign-off, from someone other than the person who wrote them. Third-party commercial campaigns to parents cannot be scheduled at all in version 1.0 — the audience builder returns zero recipients for them.
          </p>
        </section>
      </div>
    </div>
  );
}

async function TemplatesTab({ group, channel, status }: { group?: string; channel?: string; status?: string }) {
  const templates = (await apiGet<SuperAdminMessageTemplateRow[]>("/api/super-admin/communications/templates")) ?? [];
  const shown = templates.filter((t) => (!group || t.category === group) && (!channel || t.channel === channel) && (!status || (status === "attention" ? t.approvalStatus === "REJECTED" || t.approvalStatus === "PENDING_META_APPROVAL" || t.approvalStatus === "PENDING_REVIEW" : t.approvalStatus === status)));
  const approved = templates.filter((t) => t.approvalStatus === "APPROVED").length;
  const awaitingMeta = templates.filter((t) => t.approvalStatus === "PENDING_META_APPROVAL").length;
  const rejected = templates.filter((t) => t.approvalStatus === "REJECTED").length;
  const awaitingReview = templates.filter((t) => t.approvalStatus === "PENDING_REVIEW").length;

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Templates in the library" value={templates.length} detail="Across every channel and category" icon={MessageSquare} tone="dark" />
        <StatCard label="Approved and in use" value={approved} detail="Cleared to send" icon={BadgeCheck} tone="success" />
        <StatCard label="Awaiting Meta approval" value={awaitingMeta} detail="WhatsApp templates must be pre-approved" icon={Clock3} tone={awaitingMeta ? "warning" : "neutral"} />
        <StatCard label="Rejected — needs revision" value={rejected} detail="Meta's reason is on the record" icon={FileWarning} tone={rejected ? "danger" : "neutral"} />
        <StatCard label="Awaiting a second reviewer" value={awaitingReview} detail="Written, not yet approved by somebody else" icon={ShieldOff} tone={awaitingReview ? "warning" : "neutral"} />
      </section>

      <TableCard
      title="Template library"
      description="Every automatic message on the platform is a template here, not text buried in code — so it can be rewritten without a deployment. Open one to read it, edit it, or see which triggers use it."
      items={shown}
      filterBar={
        <FilterToolbar
          action="/super-admin/communications"
          hidden={{ tab: "templates" }}
          resultCount={shown.length}
          controls={[
            { name: "tgroup", label: "Group", type: "select", defaultValue: group ?? "", options: [{ label: "All groups", value: "" }, ...templateCategoryOptions] },
            { name: "tchannel", label: "Channel", type: "select", defaultValue: channel ?? "", options: [{ label: "Any channel", value: "" }, ...channelOptions] },
            { name: "tstatus", label: "Status", type: "select", defaultValue: status ?? "", options: [{ label: "All statuses", value: "" }, { label: "Approved", value: "APPROVED" }, { label: "Needs attention", value: "attention" }] }
          ]}
        />
      }
      footnote="WhatsApp templates must be pre-approved by Meta before use. A rejected template carries Meta’s own reason, so the revision is not guesswork."
      actions={
        <ResourceActionDialog
          triggerLabel="New template"
          title="New message template"
          description="Words the platform will send on our behalf, thousands of times, without anyone reading them again."
          endpoint="/api/super-admin/communications/templates"
          submitLabel="Save as draft"
          note="A draft cannot be attached to a trigger until a second person has approved it and — for WhatsApp — Meta has cleared it."
          impact={{ label: "On saving", rows: [["Saved as a draft", "Not sendable, not attached, and not visible to any school"], ["Sent for review", "A platform administrator other than you approves or rejects the wording"], ["Once approved", "It is available to triggers and campaigns, and the version counter starts at v1"]] }}
          fields={[
            { name: "name", label: "Template name", required: true, section: "Name and group" },
            { name: "category", label: "Group", type: "select", defaultValue: "OPERATIONAL", options: templateCategoryOptions, section: "Name and group" },
            { name: "channel", label: "Send on", type: "select", defaultValue: "EMAIL", options: channelOptions, note: "Email has no length limit and needs no pre-approval; WhatsApp needs Meta’s approval first", section: "Send on" },
            { name: "wa", label: "A WhatsApp template cannot be sent until Meta approves it", type: "locked", note: "Submitted from the template’s menu; the state comes back on the record", section: "Constraints the channels impose" },
            { name: "consent", label: "Marketing consent is checked per recipient at send time", type: "locked", note: "A promotional template simply does not go to anyone who opted out", section: "Constraints the channels impose" },
            { name: "body", label: "Body", type: "textarea", required: true, note: "Use {{placeholders}} for fields such as school name or amount due", section: "The message" },
            { name: "triggerKey", label: "Attach to a platform trigger", type: "select", defaultValue: "", options: [{ label: "None — used by campaigns only", value: "" }, ...TRIGGERS.map((t) => ({ label: `${t.label} — {{${t.vars.join("}}, {{")}}}`, value: t.key }))], note: "Email only. Once approved, the platform’s own notice for that moment is worded from this template instead of the built-in text", section: "Route it" },
            { name: "metaTemplateId", label: "Meta template ID", note: "WhatsApp only — once Meta has issued one", section: "Route it" }
          ]}
        />
      }
      emptyState="No message templates yet."
      columns={[
        { key: "name", header: "Template", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p><p className="text-[11.5px] text-[#8C9A92]">{item.triggerKey ? `${TRIGGERS.find((t) => t.key === item.triggerKey)?.label ?? item.triggerKey} · ` : ""}v{item.version ?? 1}</p></div> },
        { key: "category", header: "Group", render: (item) => item.category },
        { key: "channel", header: "Channels", render: (item) => item.channel },
        { key: "approval", header: "Status", render: (item) => <StatusBadge status={item.approvalStatus} tone={item.approvalStatus === "APPROVED" ? "success" : item.approvalStatus === "REJECTED" ? "danger" : "warning"} /> },
        { key: "uses", header: "Uses", render: (item) => item.uses ?? 0 },
        { key: "edited", header: "Edited", render: (item) => formatDate(item.updatedAt) },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <ActionMenu triggerLabel={`Actions for ${item.name}`}>
            <ResourceActionDialog
              triggerLabel="Edit (makes a new version)"
              title="Edit template"
              description="Rewriting the words. It changes what every future recipient reads — not who receives it."
              note="The previous version is kept and remains readable. A message already sent is never retrospectively altered."
              impact={{ label: "On saving", rows: [[`Becomes v${(item.version ?? 1) + 1}`, `v${item.version ?? 1} stays readable, and any message already sent under it is unchanged`], ["Waits for a second person", "The new version cannot be used until somebody other than you approves it"], ["Takes effect", "On the next send — nothing already queued is rewritten"]] }}
              endpoint={`/api/super-admin/communications/templates/${item.id}`}
              method="PATCH"
              variant="secondary"
              submitLabel="Save as a new version"
              fields={[
                { name: "current", label: "Current version", type: "static", placeholder: `v${item.version ?? 1} · last edited ${formatDate(item.updatedAt)}`, section: "What you are editing" },
                { name: "uses", label: "Used by", type: "static", placeholder: `${item.uses ?? 0} campaign${(item.uses ?? 0) === 1 ? "" : "s"}${item.triggerKey ? ` · attached to ${TRIGGERS.find((t) => t.key === item.triggerKey)?.label ?? item.triggerKey}` : ""}`, section: "What you are editing" },
                { name: "name", label: "Template name", defaultValue: item.name, section: "The words" },
                { name: "body", label: "Body", type: "textarea", defaultValue: item.body, section: "The words" },
                { name: "channel", label: "Send on", type: "select", defaultValue: item.channel, options: channelOptions, section: "Channels and routing" },
                { name: "category", label: "Group", type: "select", defaultValue: item.category, options: templateCategoryOptions, section: "Channels and routing" },
                { name: "triggerKey", label: "Attach to a platform trigger", type: "select", defaultValue: item.triggerKey ?? "", options: [{ label: "None — used by campaigns only", value: "" }, ...TRIGGERS.map((t) => ({ label: `${t.label} — {{${t.vars.join("}}, {{")}}}`, value: t.key }))], section: "Channels and routing" }
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

    <section className="grid items-start gap-[14px] lg:grid-cols-2">
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

type CustomRule = { id: string; group: string; event: string; condition: string; plan: string | null; recipients: string[]; channels: string[]; template: string | null; sendHour: number; enabled: boolean; fires: number; lastFiredAt: string | null };
type TriggerRule = { key?: string; ruleId?: string; event: string; recipient: string; channel: string; tier: string; template: string | null; when: string; enabled: boolean };

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

const GROUP_OF_PREFIX: Array<[RegExp, string]> = [
  [/^trial\./, "Trial & conversion"],
  [/^discount\./, "Billing & commission"],
  [/^(dormant|address)\./, "Lifecycle & compliance"]
];
const GROUP_OF_SCHOOL_EVENT: Array<[RegExp, string]> = [
  [/^(Invoice|Payment)/, "Billing & commission"],
  [/^(Student|Admissions)/, "Academics & operations"],
  [/^Welcome/, "Onboarding & provisioning"]
];
const GROUP_ORDER = ["Onboarding & provisioning", "Trial & conversion", "Billing & commission", "Academics & operations", "Lifecycle & compliance"];
const GROUP_SUB = "Event → recipient → channel → tier → template → when. A notice with an approved template attached is worded from it; with none it uses the built-in wording.";

async function TriggersTab({ templates }: { templates: SuperAdminMessageTemplateRow[] }) {
  const policy = await apiGet<{ messaging: { disabledTriggers: string[] } }>("/api/super-admin/platform-policy");
  const disabled = new Set(policy.messaging.disabledTriggers ?? []);
  const attached = new Map(templates.filter((t) => t.triggerKey && t.approvalStatus === "APPROVED").map((t) => [t.triggerKey as string, t.name]));
  const platformRules: Array<{ group: string; rule: TriggerRule }> = TRIGGERS.map((trigger) => ({
    group: GROUP_OF_PREFIX.find(([re]) => re.test(trigger.key))?.[1] ?? "Lifecycle & compliance",
    rule: { key: trigger.key, event: trigger.label, recipient: "School owner", channel: "Email + in-app", tier: "All tiers", template: attached.get(trigger.key) ?? null, when: triggerTiming[trigger.key] ?? "—", enabled: !disabled.has(trigger.key) } satisfies TriggerRule
  }));
  const familyRules: Array<{ group: string; rule: TriggerRule }> = schoolRules.map((rule) => ({ group: GROUP_OF_SCHOOL_EVENT.find(([re]) => re.test(rule.event))?.[1] ?? "Academics & operations", rule }));
  const custom = (await apiGet<CustomRule[]>("/api/super-admin/communications/trigger-rules").catch(() => [] as CustomRule[])) ?? [];
  const customEntries: Array<{ group: string; rule: TriggerRule }> = custom.map((rule) => ({
    group: rule.group,
    rule: { ruleId: rule.id, event: `${rule.event} · ${rule.condition}`, recipient: rule.recipients.map((value) => (value === "OWNER" ? "School owner" : value === "BURSAR" ? "Bursar" : "Account manager")).join(" + "), channel: rule.channels.map((value) => (value === "EMAIL" ? "Email" : "In-app")).join(" + "), tier: rule.plan ? rule.plan.charAt(0) + rule.plan.slice(1).toLowerCase() : "All tiers", template: rule.template, when: `From ${String(rule.sendHour).padStart(2, "0")}:00 · once per ${rule.event.toLowerCase().includes("invoice") ? "invoice" : "school"}${rule.fires ? ` · fired ${rule.fires}×` : ""}`, enabled: rule.enabled } satisfies TriggerRule
  }));
  const templateChoices = [{ label: "Built-in wording", value: "" }, ...templates.filter((template) => template.channel === "EMAIL" && template.approvalStatus === "APPROVED").map((template) => ({ label: template.name, value: template.id }))];
  const addRule = (
    <ResourceActionDialog
      triggerLabel="Add a rule"
      title="Add a trigger rule"
      description="An event, a recipient, a channel, a template and a time. Five things — no more, and none optional."
      endpoint="/api/super-admin/communications/trigger-rules"
      method="POST"
      variant="secondary"
      submitLabel="Create rule"
      note="A rule is created disabled. Nothing goes out until someone deliberately enables it."
      impact={{ label: "What happens next", rows: [["The rule is created, disabled", "Visible in its group with a disabled state"], ["Test fire", "Shows the exact message, recipient and school for what it would act on today, without sending anything"], ["Enabling it", "Is its own act, written to the audit log; from then on it fires once per invoice or school"]] }}
      fields={[
        { name: "event", label: "Event", type: "select", defaultValue: "INVOICE_OVERDUE", options: [{ label: "Invoice became overdue", value: "INVOICE_OVERDUE" }, { label: "Invoice is about to fall due", value: "INVOICE_DUE_SOON" }, { label: "School has gone quiet (nobody signed in)", value: "SCHOOL_INACTIVE" }], section: "The event" },
        { name: "days", label: "Condition — number of days", type: "number", required: true, defaultValue: 7, min: 0, max: 730, note: "Days past due, days before due, or days without a sign-in, depending on the event", section: "The event" },
        { name: "plan", label: "Tier", type: "select", defaultValue: "", options: [{ label: "All tiers", value: "" }, { label: "Starter", value: "BASIC" }, { label: "Standard", value: "STANDARD" }, { label: "Premium", value: "PROFESSIONAL" }, { label: "Elite", value: "ENTERPRISE" }, { label: "NGO / Mission", value: "CUSTOM" }], section: "The event" },
        { name: "ownerRecipient", label: "School owner", type: "switch", on: true, note: "The proprietor, owner or principal", section: "Who hears about it" },
        { name: "bursarRecipient", label: "Bursar", type: "switch", on: false, note: "Every active bursar at the school", section: "Who hears about it" },
        { name: "managerRecipient", label: "Account manager", type: "switch", on: false, note: "The platform person who owns the school — by email", section: "Who hears about it" },
        { name: "never", label: "Never sent to guardians or students", type: "locked", note: "A school’s billing and sign-ins are not their business", section: "Who hears about it" },
        { name: "templateId", label: "Template", type: "select", defaultValue: "", options: templateChoices, note: "Only approved email templates are offered. Fields available: {{school}}, {{invoice_no}}, {{amount}}, {{due_date}}, {{days}}", section: "What is sent, and when" },
        { name: "emailChannel", label: "Email", type: "switch", on: true, section: "What is sent, and when" },
        { name: "inAppChannel", label: "In-app", type: "switch", on: false, note: "Shown in the school’s own workspace to its owner and bursar", section: "What is sent, and when" },
        { name: "sendHour", label: "Send from (hour)", type: "number", defaultValue: 9, min: 0, max: 23, note: "In the platform’s time zone. It never sends before this hour", section: "What is sent, and when" },
        { name: "disabled", label: "Create the rule disabled", type: "locked", note: "Mandatory. A new rule never starts sending on its own", section: "On creating" },
        { name: "logged", label: "Every fire is logged", type: "locked", note: "Which school, which invoice, how many people, and when", section: "On creating" }
      ]}
    />
  );
  const grouped = GROUP_ORDER.map((title) => ({ title, rules: [...platformRules, ...familyRules, ...customEntries].filter((entry) => entry.group === title).map((entry) => entry.rule) })).filter((group) => group.rules.length > 0);
  const all = grouped.flatMap((g) => g.rules);
  const channels = new Set(all.flatMap((r) => r.channel.split(/,| \+ /).map((c) => c.trim()))).size;
  const recipients = new Set(all.map((r) => r.recipient)).size;
  const behind = new Set(all.filter((r) => r.template).map((r) => r.template)).size;
  const withheld: TriggerRule[] = [{ event: "Third-party commercial offer to parents", recipient: "Parents", channel: "—", tier: "—", template: null, when: "Not permitted in version 1.0 in any form", enabled: false }];

  return (
    <div className="grid gap-[14px]">
      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Trigger rules defined" value={all.length} detail={`Across ${grouped.length} groups`} icon={Radio} tone="dark" />
        <StatCard label="Enabled" value={all.filter((r) => r.enabled).length} detail={`${all.filter((r) => !r.enabled).length} disabled by hand · 1 withheld by policy`} icon={MessageSquare} tone="success" />
        <StatCard label="Channels in use" value={channels} detail="Email · SMS · In-app" icon={Users2} tone="info" />
        <StatCard label="Recipient roles" value={recipients} detail="Never a role that did not consent" icon={Clock3} tone="neutral" />
        <StatCard label="Templates behind them" value={behind} detail="Versioned · a sent message renders as sent" icon={ShieldOff} tone={behind ? "success" : "warning"} />
      </section>

      {grouped.map((group) => {
        const editable = group.rules.filter((rule) => rule.key);
        return (
          <TableCard
            key={group.title}
            title={group.title}
            description={`${GROUP_SUB} · ${group.rules.length} rule${group.rules.length === 1 ? "" : "s"} · ${group.rules.filter((r) => r.enabled).length} enabled`}
            items={group.rules}
            getRowKey={(row) => row.event}
            pageSize={false}
            actions={
              <div className="flex items-center gap-2">
              {addRule}
              {editable.length ? (
                <ResourceActionDialog triggerLabel="Disable this group" title={`Switch notices — ${group.title}`} description="Every notice picked here stops being sent to schools until it is switched back on. The school's state still changes — a trial still ends — only the message is held back. Say why." endpoint="/api/super-admin/platform-policy/triggers" method="POST" variant="secondary" submitLabel="Save" confirmLabel="Confirm" confirmMessage="Schools will no longer be told about these events." fields={[
                  { name: "keys", label: "Notices", type: "multiselect", options: editable.map((rule) => ({ label: rule.event, value: rule.key as string })) },
                  { name: "enabled", label: "Switch", type: "switch", on: false },
                  { name: "reason", label: "Reason", type: "textarea", required: true }
                ]} />
              ) : null}
              </div>
            }
            columns={[
              { key: "event", header: "Event", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.event}</span> },
              { key: "recipient", header: "Recipient", render: (row) => row.recipient },
              { key: "channel", header: "Channel", render: (row) => row.channel },
              { key: "tier", header: "Tier", render: (row) => row.tier },
              { key: "template", header: "Template", render: (row) => (row.template ? <span className="text-[11.5px]">{row.template}</span> : <span className="text-[var(--color-text-muted)]">Built-in wording</span>) },
              { key: "when", header: "When it sends", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.when}</span> },
              { key: "state", header: "", sortable: false, render: (row) => <StatusPill bg={row.enabled ? "var(--color-success-dim)" : "var(--color-warning-dim)"} fg={row.enabled ? "var(--color-success)" : "var(--color-warning)"} label={row.enabled ? "Enabled" : "Disabled"} /> },
              {
                key: "controls",
                header: "",
                sortable: false,
                render: (row) =>
                  row.ruleId ? (
                    <div className="flex items-center gap-3">
                      <ResourceActionDialog
                        triggerLabel={row.enabled ? "Disable" : "Enable"}
                        title={row.enabled ? "Disable trigger" : "Enable trigger"}
                        description={row.enabled ? "The rule stops firing. What it already sent stays on record, and nothing is queued for later." : "From now on the rule fires once for every invoice or school that meets its condition, from its send hour."}
                        endpoint={`/api/super-admin/communications/trigger-rules/${row.ruleId}/enabled`}
                        method="POST"
                        variant="textAction"
                        submitLabel={row.enabled ? "Disable rule" : "Enable rule"}
                        recorded={{ line: `You · ${row.enabled ? "Disable" : "Enable"} trigger · ${row.event}`, before: row.enabled ? "Enabled" : "Disabled", after: row.enabled ? "Disabled" : "Enabled" }}
                        fields={[{ name: "enabled", label: "Switch", type: "hidden", defaultValue: row.enabled ? "false" : "true" }, { name: "reason", label: "Why", type: "textarea", required: true }]}
                      />
                      <ResourceActionDialog
                        triggerLabel="Test fire"
                        title="Test fire"
                        description="Runs the rule against today’s records and shows what it would send, to whom — without sending anything. The result appears in the notice after you run it."
                        endpoint={`/api/super-admin/communications/trigger-rules/${row.ruleId}/test`}
                        method="POST"
                        variant="textAction"
                        submitLabel="Run the test"
                        keepOpen
                        fields={[]}
                      />
                      <ResourceActionDialog
                        triggerLabel="Remove"
                        title="Remove trigger rule"
                        description="The rule is deleted. Its history stays in the audit log, but the wiring is gone and would have to be rebuilt."
                        endpoint={`/api/super-admin/communications/trigger-rules/${row.ruleId}/delete`}
                        method="POST"
                        variant="textActionDanger"
                        submitLabel="Remove rule"
                        recorded={{ line: `You · Remove trigger rule · ${row.event}`, before: row.enabled ? "Enabled" : "Disabled", after: "Removed" }}
                        fields={[{ name: "reason", label: "Why", type: "textarea", required: true }]}
                      />
                    </div>
                  ) : null
              }
            ]}
          />
        );
      })}

      <TableCard
        title="Withheld by policy"
        description="One rule, shown so that the decision not to build it stays visible and auditable."
        items={withheld}
        getRowKey={(row) => row.event}
        pageSize={false}
        actions={<span className="text-[11.5px] text-[#8C9A92]">No controls — withheld by policy</span>}
        columns={[
          { key: "event", header: "Event", render: (row) => <span className="font-semibold text-[var(--color-text-primary)]">{row.event}</span> },
          { key: "recipient", header: "Recipient", render: (row) => row.recipient },
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "tier", header: "Tier", render: (row) => row.tier },
          { key: "when", header: "When it sends", render: (row) => <span className="text-[var(--color-text-secondary)]">{row.when}</span> }
        ]}
      />
    </div>
  );
}

type DeliveryLine = { id: string; recipient: string; school: string; address: string | null; channel: string; status: string; error: string | null; deliveredAt: string | null; provider: string | null; attempts: number };
type Failures = { sent: number; failed: number; held: number; reasons: Array<{ reason: string; channel: string; count: number }> };

async function DeliveryTab({ sent, focus, status }: { sent: SuperAdminCampaignRow[]; focus?: string; status?: string }) {
  const failures = await apiGet<Failures>("/api/super-admin/communications/delivery-failures");
  const current = focus ? sent.find((c) => c.id === focus) : undefined;
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
    <div className="grid gap-[14px]">
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

        <BarList
          title="Failure reasons"
          sub={`Invalid contact records can be fixed proactively — before a critical renewal or result period. ${failures.sent.toLocaleString()} delivered · ${failures.failed.toLocaleString()} failed · ${failures.held.toLocaleString()} held in the last 30 days.`}
          empty="Nothing has failed in the last 30 days."
          items={failures.reasons.map((row) => ({ label: `${row.reason} · ${row.channel}`, value: row.count.toLocaleString(), pct: (row.count / Math.max(1, ...failures.reasons.map((r) => r.count))) * 100, tone: "bad" as const }))}
        />
      </div>

      {current ? (
      <TableCard
        title={`Delivery log · ${current.name}`}
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
          { key: "status", header: "State", render: (line) => <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={line.status === "SENT" ? { background: "var(--color-success-dim)", color: "var(--color-success)" } : line.status === "FAILED" ? { background: "var(--color-danger-dim)", color: "var(--color-danger)" } : { background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>{line.status === "SENT" ? "Delivered" : line.status === "FAILED" ? "Failed" : line.status === "HELD" ? "Held" : "Waiting"}</span> },
          { key: "detail", header: "Detail", render: (line) => <span className="text-[11px] text-[var(--color-text-muted)]">{line.error ?? (line.deliveredAt ? `${line.provider ?? "Carrier"} · ${new Date(line.deliveredAt).toLocaleString("en-GB")}` : line.attempts ? `${line.attempts} attempt${line.attempts === 1 ? "" : "s"} so far` : "—")}</span> }
        ]}
        footnote="A message waits when delivery is switched off, when quiet hours or a daily cap apply, or after a carrier outage; it fails when the carrier refuses it or after the allowed number of attempts."
      />
      ) : null}
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
    <div className="grid gap-[14px]">
      <div className="grid items-start gap-[14px] lg:grid-cols-[1fr_1.4fr]">
        <BarList
          title="Promotional opt-in status"
          items={[
            ...consentStats.map((stat) => ({ label: stat.label, value: stat.value, pct: stat.pct, tone: "teal" as const, note: `${stat.recordCount} recorded decision(s) for this role` })),
            { label: "Opted out (all-time)", value: String(optedOut), pct: Math.min(100, optedOut), tone: "bad" as const }
          ]}
        />
        <ReferenceList title="Consent rules enforced at system level" sub="Verified against the real consent and campaign-send code, not stated as intent." items={consentRules.map((rule) => ({ label: rule, tone: "good" as const }))} />
      </div>

      <TableCard
        title="Consent records"
        description={`${(records ?? []).length} record(s) tracked · ${optedOut} opted out. Most recently updated first. A manually received opt-out (phone, email) is recorded here.`}
        actions={
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
        }
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
    <div className="grid gap-[14px]">
      <section className="surface-card p-6">
        <p className="section-eyebrow">In-app notices</p>
        <h2 className="mt-2 text-[12.5px] font-semibold text-[var(--color-text-primary)]">Platform announcements & maintenance</h2>
        <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-[var(--color-text-secondary)]">
          Lightweight in-app notices shown inside every school portal — separate from full campaigns. Use these for
          platform-wide notices and scheduled maintenance windows.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ResourceActionDialog
            triggerLabel="New Announcement"
            title="Create platform announcement"
            description="A message the administrators of every school see at the top of their app until it expires or they dismiss it."
            endpoint="/api/super-admin/communications/announcements"
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "body", label: "Message", type: "textarea", required: true },
              { name: "type", label: "Type", type: "select", options: announcementTypes, defaultValue: "INFO" },
              { name: "audience", label: "Who sees it", type: "static", placeholder: "Every school", section: "Audience" },
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
