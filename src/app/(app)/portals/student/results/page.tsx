import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PortalResultHistory } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function StudentResultsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const results = await apiGet<PortalResultHistory[]>("/api/v1/student-portal/results");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My results</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Only published result sheets are visible here. Draft or unreleased scores remain hidden.
        </p>
      </section>

      {results.map((result) => (
        <section key={result.id} className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel print:shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
                {result.session} · {result.term}
              </h2>
              <p className="mt-2 text-sm text-ink/60">Published {formatDate(result.publishedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-sand px-4 py-2 font-semibold text-ink">Average {result.average.toFixed(1)}%</span>
              <span className="rounded-full bg-sand px-4 py-2 font-semibold text-ink">Grade {result.grade}</span>
              <span className="rounded-full bg-sand px-4 py-2 font-semibold text-ink">Position {result.position ?? "-"}</span>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {result.subjects.map((subject) => (
              <article key={subject.subject} className="rounded-2xl bg-sand/65 p-4 text-sm">
                <p className="font-semibold text-ink">{subject.subject}</p>
                <p className="mt-2 text-ink/65">CA: {subject.continuousAssessment ?? "-"} · Exam: {subject.exam ?? "-"}</p>
                <p className="text-ink/65">Total: {subject.score}% · {subject.grade}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-4 text-sm text-ink/70 md:grid-cols-2">
            <p><span className="font-semibold text-ink">Teacher comment:</span> {result.teacherComment ?? "Not published"}</p>
            <p><span className="font-semibold text-ink">Principal comment:</span> {result.principalComment ?? "Not published"}</p>
          </div>
          {result.reportCardUrl ? (
            <a href={result.reportCardUrl} className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Preview / print report card
            </a>
          ) : null}
        </section>
      ))}
      {results.length === 0 ? (
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 text-sm text-ink/65 shadow-panel">
          No published results are available for your account yet.
        </section>
      ) : null}
    </div>
  );
}
