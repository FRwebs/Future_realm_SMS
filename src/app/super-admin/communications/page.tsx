import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet } from "@/lib/api/server";
import type { SuperAdminCampaignRow, SuperAdminMessageTemplateRow } from "@/lib/domain/types";
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

function tabHref(tab: string) {
  return tab === "campaigns" ? "/super-admin/communications" : `/super-admin/communications?tab=${tab}`;
}

export default async function SuperAdminCommunicationsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const { tab = "campaigns" } = searchParams ? await searchParams : {};

  const tabs = [
    { label: "Campaigns", href: tabHref("campaigns"), active: tab === "campaigns" },
    { label: "Message Templates", href: tabHref("templates"), active: tab === "templates" },
    { label: "Announcements", href: tabHref("announcements"), active: tab === "announcements" }
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Platform messaging</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Communications</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Targeted email/SMS/WhatsApp campaigns with an approval workflow, WhatsApp template library, and platform announcements.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "campaigns" ? <CampaignsTab /> : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "announcements" ? <AnnouncementsTab announcementTypes={announcementTypes} /> : null}
    </div>
  );
}

async function CampaignsTab() {
  const campaigns = await apiGet<SuperAdminCampaignRow[]>("/api/super-admin/communications/campaigns");

  return (
    <TableCard
      title="Campaigns"
      description="Draft → approve (operational: dept lead; promotional: Super Admin/Marketing) → send. Promotional sends honour opt-outs automatically."
      items={campaigns ?? []}
      actions={
        <ResourceActionDialog
          triggerLabel="New campaign"
          title="Create a campaign"
          description="Compose a message and define the audience. SMS is limited to 160 characters. The recipient count is computed from your filters."
          endpoint="/api/super-admin/communications/campaigns"
          submitLabel="Save draft"
          fields={[
            { name: "name", label: "Campaign name", required: true },
            { name: "type", label: "Type", type: "select", defaultValue: "OPERATIONAL", options: campaignTypeOptions },
            { name: "channel", label: "Channel", type: "select", defaultValue: "EMAIL", options: channelOptions },
            { name: "subject", label: "Subject (email)" },
            { name: "body", label: "Message body", type: "textarea", required: true },
            { name: "role", label: "Audience: role (optional)", placeholder: "e.g. SCHOOL_ADMIN, PARENT" },
            { name: "plan", label: "Audience: tier (optional)", type: "select", options: [{ label: "Any", value: "" }, { label: "Basic", value: "BASIC" }, { label: "Standard", value: "STANDARD" }, { label: "Professional", value: "PROFESSIONAL" }, { label: "Enterprise", value: "ENTERPRISE" }] },
            { name: "state", label: "Audience: state (optional)" }
          ]}
        />
      }
      emptyState="No campaigns yet."
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
        { key: "name", header: "Template", render: (item) => <span className="font-semibold text-ink">{item.name}</span> },
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

async function AnnouncementsTab({ announcementTypes }: { announcementTypes: Array<{ label: string; value: string }> }) {
  const data = await apiGet<CommunicationsView>("/api/super-admin/communications");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
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
            { name: "isActive", label: "Activate Now", type: "select", defaultValue: "false", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] }
          ]}
          submitLabel="Save Window"
          confirmLabel="Confirm Window"
        />
      </div>

      <TableCard
        title="Announcements"
        description="Platform-wide and targeted messages shown inside school portals."
        items={data.announcements ?? []}
        emptyState="No announcements have been created yet."
        columns={[
          { key: "title", header: "Title", render: (item) => <span className="font-semibold text-ink">{item.title}</span> },
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
          { key: "title", header: "Title", render: (item) => <span className="font-semibold text-ink">{item.title}</span> },
          { key: "status", header: "Status", render: (item) => item.isActive ? "Active" : "Scheduled" },
          { key: "starts", header: "Starts", render: (item) => formatDate(item.startsAt) },
          { key: "ends", header: "Ends", render: (item) => formatDate(item.endsAt) }
        ]}
      />
    </div>
  );
}
