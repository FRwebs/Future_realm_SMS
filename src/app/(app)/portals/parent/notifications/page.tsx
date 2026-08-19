import Link from "next/link";
import type { Route } from "next";

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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to parent portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Notifications</h1>
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
