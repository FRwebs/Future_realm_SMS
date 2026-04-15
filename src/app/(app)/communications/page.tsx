import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AnnouncementView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function CommunicationsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/communications")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const announcements = await apiGet<AnnouncementView[]>("/api/v1/communications/announcements");
  const canManageCommunications = canManagePath(session.role, "/communications");

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      {canManageCommunications ? (
        <ResourceForm
          title="Broadcast communication"
          description="Send announcements by audience and delivery channel for reminders, events, and operational notices."
          endpoint="/api/v1/communications/announcements"
          submitLabel="Publish announcement"
          fields={[
            { name: "title", label: "Title", required: true, placeholder: "Fee deadline reminder" },
            {
              name: "audience",
              label: "Audience",
              required: true,
              placeholder: "Parents, JSS 2, School-wide"
            },
            {
              name: "channel",
              label: "Channel",
              type: "select",
              options: [
                { label: "In-app", value: "IN_APP" },
                { label: "SMS", value: "SMS" },
                { label: "Email", value: "EMAIL" },
                { label: "Push", value: "PUSH" }
              ]
            },
            {
              name: "body",
              label: "Announcement body",
              type: "textarea",
              required: true,
              placeholder: "Fee balances should be cleared before Friday..."
            }
          ]}
        />
      ) : null}
      <TableCard
        title="Announcement feed"
        description="Published messages, channels, and audience segments across the school community."
        items={announcements}
        columns={[
          {
            key: "title",
            header: "Announcement",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-ink/55">{item.body}</p>
              </div>
            )
          },
          { key: "audience", header: "Audience", render: (item) => item.audience },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "publishedAt", header: "Published", render: (item) => formatDate(item.publishedAt) }
        ]}
      />
    </div>
  );
}
