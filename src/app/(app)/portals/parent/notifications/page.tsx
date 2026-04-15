import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalNotificationView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function ParentNotificationsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const notifications = await apiGet<StudentPortalNotificationView[]>("/api/v1/parent-portal/notifications");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/parent" className="text-sm font-semibold text-brand-700">Back to parent portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Notifications</h1>
      </section>
      <TableCard
        title="Notification log"
        description="Fee, attendance, result, and event notices visible to your guardian account."
        items={notifications}
        columns={[
          { key: "title", header: "Title", render: (item) => item.title },
          { key: "body", header: "Message", render: (item) => item.body },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "sentAt", header: "Sent", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "-") }
        ]}
      />
    </div>
  );
}
