import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalNotificationView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function StudentNotificationsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const notifications = await apiGet<StudentPortalNotificationView[]>("/api/v1/student-portal/notifications");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/student" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Notifications</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Result, fee, attendance, exam, and timetable notifications linked to your account.</p>
      </section>

      <TableCard
        title="Notification log"
        description="Recent in-app, email, SMS, or push notices visible to you."
        items={notifications}
        columns={[
          { key: "title", header: "Title", render: (item) => item.title },
          { key: "body", header: "Message", render: (item) => item.body },
          { key: "channel", header: "Channel", render: (item) => item.channel },
          { key: "sentAt", header: "Sent", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "-") }
        ]}
      />
      {notifications.length === 0 ? (
        <section className="surface-card p-6 text-[13px] text-[var(--color-text-secondary)]">
          No notifications are available yet.
        </section>
      ) : null}
    </div>
  );
}
