import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkSummaryView, SubjectView } from "@/lib/domain/types";

export default async function SubjectSchemeOfWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/subjects"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [subject, sows] = await Promise.all([
    apiGet<SubjectView>(`/api/v1/academics/subjects/${id}`),
    apiGet<SchemeOfWorkSummaryView[]>(`/api/v1/scheme-of-work?subjectId=${id}`).catch(() => []),
  ]);
  const approved = sows.filter((item) => item.status === "APPROVED").length;
  const submitted = sows.filter((item) => item.status === "SUBMITTED").length;
  const draft = sows.filter((item) => item.status === "DRAFT" || item.status === "RETURNED").length;
  const averageCoverage = sows.length === 0 ? 0 : Math.round(sows.reduce((sum, item) => sum + item.coveragePercent, 0) / sows.length);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={`/subjects/${id}`} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to subject</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">Scheme of work overview</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{subject.name}</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Track this subject across every class and arm that currently offers it this term.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Total classes", String(sows.length)],
              ["Approved", String(approved)],
              ["Submitted", String(submitted)],
              ["Avg coverage", `${averageCoverage}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
                <p className="mt-2 font-[var(--font-heading)] text-[22px] font-black text-[var(--color-text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </div>
        {draft > 0 ? <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">{draft} class schemes are still in draft or returned status.</p> : null}
      </section>

      <TableCard
        title="Class schemes"
        description="Each row represents one class-arm scheme of work for this subject in the active term."
        items={sows}
        emptyState="No scheme-of-work records have been initialized for this subject yet."
        columns={[
          {
            key: "class",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.category ?? "Class"} · {item.arm ?? "Arm"}</p>
              </div>
            )
          },
          {
            key: "teacher",
            header: "Teacher",
            render: (item) => item.teacherName ?? "Not assigned"
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <SchemeOfWorkStatusBadge status={item.status} size="sm" />
          },
          {
            key: "coverage",
            header: "Coverage",
            render: (item) => (
              <div className="min-w-[150px]">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <span className="block h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${item.coveragePercent}%` }} />
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.coveredWeeks}/{item.teachingWeeks} teaching weeks · {item.coveragePercent}%</p>
              </div>
            )
          },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <Link href={`/subjects/${id}/scheme-of-work/${item.classId}`} className="text-sm font-semibold text-[var(--color-text-accent)] hover:opacity-80">
                Open class SOW
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
