import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils/formatters";

type StudentAnnouncement = { id: string; title: string; detail: string; time: string };

function displayTime(value: string) {
  return Number.isNaN(new Date(value).getTime()) ? value : formatDate(value);
}

export default async function StudentAnnouncementsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const announcements = await apiGet<StudentAnnouncement[]>("/api/v1/student-portal/announcements");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/student" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Announcements</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">School-wide, student, and class notices visible to your account.</p>
      </section>
      <section className="grid gap-3">
        {announcements.map((item) => (
          <article key={item.id} className="surface-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{displayTime(item.time)}</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{item.title}</h2>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">{item.detail}</p>
          </article>
        ))}
        {announcements.length === 0 ? (
          <article className="surface-card p-6 text-[13px] text-[var(--color-text-secondary)]">
            No announcements are available right now.
          </article>
        ) : null}
      </section>
    </div>
  );
}
