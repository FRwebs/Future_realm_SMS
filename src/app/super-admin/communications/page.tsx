import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/utils/formatters";

type Announcement = {
  id: string;
  title: string;
  body: string;
  type: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
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

const announcementTypes = ["INFO", "WARNING", "CRITICAL", "NEW_FEATURE", "PROMOTION"].map((value) => ({
  label: value.replaceAll("_", " "),
  value,
}));

export default async function SuperAdminCommunicationsPage() {
  const data = await apiGet<CommunicationsView>("/api/super-admin/communications");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Platform messaging</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-4xl font-bold text-ink">Communications</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Publish platform announcements, maintenance notices, and operational messages to targeted schools.
            </p>
          </div>
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
              confirmMessage="Announcements are visible to school admins based on targeting. Please confirm the audience and message."
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
                { name: "isActive", label: "Activate Now", type: "select", defaultValue: "false", options: [
                  { label: "No", value: "false" },
                  { label: "Yes", value: "true" }
                ] }
              ]}
              submitLabel="Save Window"
              confirmLabel="Confirm Window"
            />
          </div>
        </div>
      </section>

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
          { key: "ends", header: "Ends", render: (item) => formatDate(item.endsAt) },
          { key: "message", header: "Message", render: (item) => item.message }
        ]}
      />
    </div>
  );
}
