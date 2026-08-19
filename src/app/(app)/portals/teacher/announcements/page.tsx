import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AnnouncementView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherAnnouncementsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/announcements")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const announcements = await apiGet<AnnouncementView[]>("/api/v1/teacher-portal/announcements");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/teacher" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to teacher portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Teacher announcements</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Staff and school-wide notices relevant to your teaching work.
        </p>
      </section>

      <TableCard
        title="Announcements"
        description="Recent teacher-visible announcements."
        items={announcements}
        columns={[
          {
            key: "title",
            header: "Announcement",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.body}</p>
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
