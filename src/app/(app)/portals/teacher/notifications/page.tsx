import Link from "next/link";

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
  if (!canAccessPath(session.role, "/portals/teacher/notifications")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const notifications = await apiGet<StudentPortalNotificationView[]>("/api/v1/teacher-portal/notifications");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/teacher" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to teacher portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Teacher notifications</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
                <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.body}</p>
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
