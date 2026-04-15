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
  if (!canAccessPath(session.role, "/portals/teacher")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const announcements = await apiGet<AnnouncementView[]>("/api/v1/teacher-portal/announcements");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/teacher" className="text-sm font-semibold text-brand-700">Back to teacher portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Teacher announcements</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
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
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs text-ink/55">{item.body}</p>
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
