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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Announcements</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">School-wide, student, and class notices visible to your account.</p>
      </section>
      <section className="grid gap-4">
        {announcements.map((item) => (
          <article key={item.id} className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/40">{displayTime(item.time)}</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-ink">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">{item.detail}</p>
          </article>
        ))}
        {announcements.length === 0 ? (
          <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 text-sm text-ink/65 shadow-panel">
            No announcements are available right now.
          </article>
        ) : null}
      </section>
    </div>
  );
}
