import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalNotificationView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherNotificationsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const notifications = await apiGet<StudentPortalNotificationView[]>("/api/v1/teacher-portal/notifications");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Teacher notifications</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          In-app, SMS, email, and push records visible to your teacher account.
        </p>
      </section>

      <TableCard
        title="Notifications"
        description="Recent notification records."
        items={notifications}
        columns={[
          {
            key: "title",
            header: "Notification",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs text-ink/55">{item.body}</p>
              </div>
            )
          },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "sentAt", header: "Sent", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "-") }
        ]}
      />
    </div>
  );
}
