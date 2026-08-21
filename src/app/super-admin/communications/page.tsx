import { DetailTabs } from "@/components/data-display/detail-tabs";
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
const planFilterOptions = [{ label: "Any", value: "" }, { label: "Basic", value: "BASIC" }, { label: "Standard", value: "STANDARD" }, { label: "Professional", value: "PROFESSIONAL" }, { label: "Enterprise", value: "ENTERPRISE" }];
const yesNo = [{ label: "Yes", value: "true" }, { label: "No", value: "false" }];

function StatusPill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function tabHref(tab: string) {
  return tab === "compose" ? "/super-admin/communications" : `/super-admin/communications?tab=${tab}`;
}

export default async function SuperAdminCommunicationsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "compose" } = searchParams ? await searchParams : {};

  const tabs = [
    { label: "Compose", href: tabHref("compose"), active: tab === "compose" },
    { label: "Campaign Queue", href: tabHref("campaigns"), active: tab === "campaigns" },
    { label: "WhatsApp Templates", href: tabHref("templates"), active: tab === "templates" },
    { label: "Delivery & Engagement", href: tabHref("delivery"), active: tab === "delivery" },
    { label: "Consent & Opt-out", href: tabHref("consent"), active: tab === "consent" },
    { label: "Commercial (Phase 2)", href: tabHref("commercial"), active: tab === "commercial" },
    { label: "Platform Notices", href: tabHref("notices"), active: tab === "notices" }
  ];

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-strong)] bg-[#0d2315] p-6 text-white md:p-7">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
          <path d="M-50 180 Q 200 120 400 170 T 850 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <path d="M-50 20 Q 240 -20 460 20 T 850 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <circle cx="700" cy="20" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
          <circle cx="700" cy="20" r="90" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </svg>
        <div className="relative z-[1]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Platform messaging</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-white">Notification & Communication Command Center</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[rgba(255,255,255,0.74)]">
            FutureRealm&apos;s own broadcast channel into every school, teacher, parent, and student — targeted campaigns with
            an approval workflow, a WhatsApp template library, delivery and consent tracking. Operational today; a
            commercial channel as the platform scales.
          </p>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "compose" ? <ComposeTab /> : null}
      {tab === "campaigns" ? <CampaignsTab /> : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "delivery" ? <DeliveryTab /> : null}
      {tab === "consent" ? <ConsentTab /> : null}
      {tab === "commercial" ? <CommercialTab /> : null}
      {tab === "notices" ? <NoticesTab announcementTypes={announcementTypes} /> : null}
    </div>
  );
}

async function ComposeTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="surface-card p-6">
        <p className="section-eyebrow">New campaign</p>
        <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Compose a campaign</h3>
        <p className="mt-2 max-w-md text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Write a message and define the audience. SMS is limited to 160 characters. The recipient count is computed
          from your filters when the draft is saved — review it in Campaign Queue before approving.
        </p>
        <div className="mt-5">
          <ResourceActionDialog
            triggerLabel="Compose message"
            title="Compose a campaign"
            description="Compose a message and define the audience. SMS is limited to 160 characters. The recipient count is computed from your filters when the draft is saved — review it in Campaign Queue before approving."
            endpoint="/api/super-admin/communications/campaigns"
            submitLabel="Save draft"
            confirmLabel="Confirm draft"
            presentation="drawer"
            fields={[
              { name: "name", label: "Campaign name", required: true, placeholder: "e.g. Term 2 fee reminder" },
              { name: "type", label: "Type", type: "select", defaultValue: "OPERATIONAL", options: campaignTypeOptions },
              { name: "channel", label: "Channel", type: "select", defaultValue: "EMAIL", options: channelOptions },
              { name: "subject", label: "Subject (email)" },
              { name: "body", label: "Message body", type: "textarea", required: true },
              { name: "role", label: "Audience: role (optional)", placeholder: "e.g. SCHOOL_ADMIN, PARENT" },
              { name: "plan", label: "Audience: tier (optional)", type: "select", options: planFilterOptions },
              { name: "state", label: "Audience: state (optional)" }
            ]}
          />
        </div>
      </section>

      <section className="surface-card p-6">
        <p className="section-eyebrow">How sending works</p>
        <h3 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Draft → approve → send</h3>
        <div className="mt-4 grid gap-3">
          {[
            { step: "1. Draft", detail: "Composed here, saved with a computed recipient count based on your audience filters." },
            { step: "2. Approve", detail: "Operational campaigns need a department lead; promotional campaigns need Super Admin or Marketing Lead sign-off." },
            { step: "3. Send", detail: "Delivered immediately to the computed audience. Promotional sends automatically honour opt-outs." }
          ].map((item) => (
            <div key={item.step} className="rounded-[10px] bg-[var(--color-bg-subtle)] px-4 py-3">
              <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{item.step}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{item.detail}</p>
            </div>
          ))}
        </div>
        <a href="/super-admin/communications?tab=campaigns" className="btn-secondary mt-4 w-full justify-center">
          Go to Campaign Queue
        </a>
      </section>
    </div>
  );
}

async function CampaignsTab() {
  const campaigns = await apiGet<SuperAdminCampaignRow[]>("/api/super-admin/communications/campaigns");

  return (
    <TableCard
      title="Campaign queue"
      description="Draft → approve (operational: dept lead; promotional: Super Admin/Marketing) → send. Promotional sends honour opt-outs automatically."
      items={campaigns ?? []}
      emptyState="No campaigns yet — start in Compose."
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
  );
}

async function TemplatesTab() {
  const templates = await apiGet<SuperAdminMessageTemplateRow[]>("/api/super-admin/communications/templates");

  return (
    <TableCard
      title="Message templates"
      description="WhatsApp templates require Meta approval before use. Only Super Admin can add or retire templates."
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
  );
}

async function DeliveryTab() {
  const campaigns = await apiGet<SuperAdminCampaignRow[]>("/api/super-admin/communications/campaigns");
  const sent = (campaigns ?? []).filter((c) => c.status === "SENT");
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
        description="Delivery and open rates for every sent campaign, most recent first."
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
    </div>
  );
}

function CommercialTab() {
  return (
    <section className="surface-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-primary-dim)]">
        <span className="text-[22px]">🚀</span>
      </div>
      <p className="section-eyebrow mt-4">Roadmap</p>
      <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Commercial messaging — Phase 2</h2>
      <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
        The Notification & Communication Command Center is operational infrastructure today — reminders, alerts, and
        platform announcements. As the platform scales, this channel is planned to open to monetised commercial
        messaging: sponsored placements, partner offers, and paid promotional sends to opted-in schools. Not yet
        available in this build.
      </p>
    </section>
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
