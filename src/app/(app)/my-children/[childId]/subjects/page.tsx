import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { SchemeOfWorkTopicList } from "@/components/scheme-of-work/topic-list";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { ParentChildPortalView, PortalSubjectOffering, SchemeOfWorkDetailView } from "@/lib/domain/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type PageProps = {
  params: Promise<{ childId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function progressTone(percent?: number) {
  if ((percent ?? 0) >= 80) return "text-emerald-700";
  if ((percent ?? 0) >= 50) return "text-amber-700";
  return "text-rose-700";
}

export default async function ParentChildSubjectsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { childId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const subjectId = normalizeSearchValue(resolvedSearch.subjectId);

  const child = await apiGet<ParentChildPortalView>(`/api/v1/parent-portal/children/${childId}`);
  const subjects = await apiGet<PortalSubjectOffering[]>(`/api/v1/parent-portal/children/${childId}/subjects`).catch(() => child.subjects ?? []);
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedSow = selectedSubject
    ? await apiGet<SchemeOfWorkDetailView>(`/api/v1/parent-portal/children/${childId}/subjects/${selectedSubject.id}/scheme-of-work`).catch(() => undefined)
    : undefined;

  if (selectedSubject && selectedSow) {
    return (
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
          <Link href={`/my-children/${childId}/subjects` as Route} className="text-sm font-semibold text-brand-700">Back to subjects</Link>
          <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Parent portal</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{child.studentName}'s {selectedSow.subjectName}</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            {child.className}
            {child.departmentTrack ? ` · ${child.departmentTrack}` : ""}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Coverage</p>
            <p className={`mt-3 text-3xl font-bold ${progressTone(selectedSow.stats.coveragePercent)}`}>{selectedSow.stats.coveragePercent}%</p>
          </article>
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Covered weeks</p>
            <p className="mt-3 text-3xl font-bold text-ink">{selectedSow.stats.coveredWeeks}</p>
          </article>
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Teaching weeks</p>
            <p className="mt-3 text-3xl font-bold text-ink">{selectedSow.stats.teachingWeeks}</p>
          </article>
          <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">Teacher</p>
            <p className="mt-3 text-lg font-bold text-ink">{selectedSow.teacherName ?? "To be assigned"}</p>
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-brand-100 bg-brand-50/70 p-5 shadow-[0_14px_36px_rgba(18,33,23,0.05)]">
          <p className="text-sm font-bold text-ink">A clear view of this term's learning journey</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            You can follow what has already been covered, what is coming next, and the homework attached to each topic so support at home stays aligned with classwork.
          </p>
        </section>

        <SchemeOfWorkTopicList topics={selectedSow.topics} mode="parent" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={`/portals/parent/children/${childId}` as Route} className="text-sm font-semibold text-brand-700">Back to child profile</Link>
        <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Parent portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{child.studentName}'s Subjects</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          {child.className}
          {child.departmentTrack ? ` · ${child.departmentTrack}` : ""}
          {child.admissionNumber ? ` · ${child.admissionNumber}` : ""}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Subjects</p>
          <p className="mt-3 text-3xl font-bold text-ink">{subjects.length}</p>
        </article>
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Track</p>
          <p className="mt-3 text-lg font-bold text-ink">{child.departmentTrack ?? "General"}</p>
        </article>
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Outstanding balance</p>
          <p className="mt-3 text-lg font-bold text-ink">{formatCurrency(child.outstandingBalance)}</p>
        </article>
        <article className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Latest result</p>
          <p className="mt-3 text-lg font-bold text-ink">{child.latestResult ? `${child.latestResult.average.toFixed(1)}%` : "Not published"}</p>
        </article>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <article key={subject.id} className="rounded-[1.6rem] border border-white/70 bg-white/92 p-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{subject.code ?? "Subject"}</p>
            <h2 className="mt-3 text-xl font-bold text-ink">{subject.name}</h2>
            <p className="mt-2 text-sm text-ink/58">Teacher: {subject.teacherName ?? "To be assigned"}</p>
            <p className="mt-1 text-sm text-ink/52">Track: {subject.track ?? subject.departmentName ?? child.departmentTrack ?? "General"}</p>
            <div className="mt-4 flex items-center justify-between">
              <SchemeOfWorkStatusBadge status={subject.schemeStatus ?? "DRAFT"} size="sm" />
              <span className={`text-sm font-bold ${progressTone(subject.coveragePercent)}`}>{subject.coveragePercent ?? 0}%</span>
            </div>
            <p className="mt-2 text-xs text-ink/52">{subject.coveredWeeks ?? 0}/{subject.teachingWeeks ?? 0} teaching weeks covered</p>
            <Link
              href={`/my-children/${childId}/subjects?subjectId=${subject.id}` as Route}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              View SOW
            </Link>
          </article>
        ))}
      </div>

      <TableCard
        title="Fee history"
        description="Recent finance records remain visible here for quick parent follow-up."
        items={child.finance}
        emptyState="No finance records are visible for this child yet."
        columns={[
          { key: "title", header: "Invoice", render: (item) => item.title },
          { key: "issuedOn", header: "Issued", render: (item) => (item.issuedOn ? formatDate(item.issuedOn) : "-") },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
          { key: "status", header: "Status", render: (item) => item.status },
        ]}
      />
    </div>
  );
}
