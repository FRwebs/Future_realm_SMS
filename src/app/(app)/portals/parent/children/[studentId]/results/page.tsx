import Link from "next/link";
import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { PortalResultHistory } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ studentId: string }> };

export default async function ParentChildResultsPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const results = await apiGet<PortalResultHistory[]>(`/api/v1/parent-portal/children/${studentId}/results`);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={`/portals/parent/children/${studentId}` as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to child overview</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Child results</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Only published result sheets are visible to parents.</p>
      </section>
      {results.map((result) => (
        <section key={result.id} className="surface-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{result.session} · {result.term}</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">Published {formatDate(result.publishedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <span className="rounded-full bg-[var(--color-bg-subtle)] px-4 py-2 font-semibold text-[var(--color-text-primary)]">Average {result.average.toFixed(1)}%</span>
              <span className="rounded-full bg-[var(--color-bg-subtle)] px-4 py-2 font-semibold text-[var(--color-text-primary)]">Grade {result.grade}</span>
              <span className="rounded-full bg-[var(--color-bg-subtle)] px-4 py-2 font-semibold text-[var(--color-text-primary)]">Position {result.position ?? "-"}</span>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {result.subjects.map((subject) => (
              <article key={subject.subject} className="rounded-[10px] bg-[var(--color-bg-subtle)] p-4 text-[13px]">
                <p className="font-semibold text-[var(--color-text-primary)]">{subject.subject}</p>
                <p className="mt-2 text-[var(--color-text-secondary)]">CA: {subject.continuousAssessment ?? "-"} · Exam: {subject.exam ?? "-"}</p>
                <p className="text-[var(--color-text-secondary)]">Total: {subject.score}% · {subject.grade}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-3 text-[13px] text-[var(--color-text-secondary)] md:grid-cols-2">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Teacher comment:</span> {result.teacherComment ?? "Not published"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Principal comment:</span> {result.principalComment ?? "Not published"}</p>
          </div>
          {result.reportCardUrl ? (
            <a href={result.reportCardUrl} className="btn-primary mt-5 inline-flex px-4">
              Preview / print report card
            </a>
          ) : null}
        </section>
      ))}
      {results.length === 0 ? (
        <section className="surface-card p-6 text-[13px] text-[var(--color-text-secondary)]">
          No published results are available for this child yet.
        </section>
      ) : null}
    </div>
  );
}
