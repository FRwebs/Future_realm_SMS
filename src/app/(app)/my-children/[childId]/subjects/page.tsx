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
  if ((percent ?? 0) >= 80) return "var(--color-success)";
  if ((percent ?? 0) >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
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
      <div className="portal-page">
        <section className="surface-hero p-6 md:p-7">
          <Link href={`/my-children/${childId}/subjects` as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to subjects</Link>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Parent portal</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{child.studentName}&apos;s {selectedSow.subjectName}</h1>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            {child.className}
            {child.departmentTrack ? ` · ${child.departmentTrack}` : ""}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Coverage</p>
            <p className="mt-2 text-[22px] font-bold" style={{ color: progressTone(selectedSow.stats.coveragePercent) }}>{selectedSow.stats.coveragePercent}%</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Covered weeks</p>
            <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{selectedSow.stats.coveredWeeks}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Teaching weeks</p>
            <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{selectedSow.stats.teachingWeeks}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Teacher</p>
            <p className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">{selectedSow.teacherName ?? "To be assigned"}</p>
          </article>
        </section>

        <section className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-5">
          <p className="text-[13px] font-bold text-[var(--color-text-primary)]">A clear view of this term&apos;s learning journey</p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            You can follow what has already been covered, what is coming next, and the homework attached to each topic so support at home stays aligned with classwork.
          </p>
        </section>

        <SchemeOfWorkTopicList topics={selectedSow.topics} mode="parent" />
      </div>
    );
  }

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={`/portals/parent/children/${childId}` as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to child profile</Link>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Parent portal</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{child.studentName}&apos;s Subjects</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {child.className}
          {child.departmentTrack ? ` · ${child.departmentTrack}` : ""}
          {child.admissionNumber ? ` · ${child.admissionNumber}` : ""}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Subjects</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{subjects.length}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Track</p>
          <p className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">{child.departmentTrack ?? "General"}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Outstanding balance</p>
          <p className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">{formatCurrency(child.outstandingBalance)}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Latest result</p>
          <p className="mt-2 text-[15px] font-bold text-[var(--color-text-primary)]">{child.latestResult ? `${child.latestResult.average.toFixed(1)}%` : "Not published"}</p>
        </article>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <article key={subject.id} className="surface-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">{subject.code ?? "Subject"}</p>
            <h2 className="mt-3 text-[17px] font-bold text-[var(--color-text-primary)]">{subject.name}</h2>
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Teacher: {subject.teacherName ?? "To be assigned"}</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Track: {subject.track ?? subject.departmentName ?? child.departmentTrack ?? "General"}</p>
            <div className="mt-4 flex items-center justify-between">
              <SchemeOfWorkStatusBadge status={subject.schemeStatus ?? "DRAFT"} size="sm" />
              <span className="text-[13px] font-bold" style={{ color: progressTone(subject.coveragePercent) }}>{subject.coveragePercent ?? 0}%</span>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{subject.coveredWeeks ?? 0}/{subject.teachingWeeks ?? 0} teaching weeks covered</p>
            <Link
              href={`/my-children/${childId}/subjects?subjectId=${subject.id}` as Route}
              className="btn-primary mt-5 inline-flex px-4"
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
