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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={`/subjects/${id}`} className="text-sm font-semibold text-brand-700">Back to subject</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Scheme of work overview</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{subject.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
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
              <div key={label} className="rounded-[1.35rem] border border-white/70 bg-white px-4 py-3 text-center shadow-[0_12px_28px_rgba(18,33,23,0.05)]">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</p>
                <p className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
        {draft > 0 ? <p className="mt-4 text-sm text-ink/58">{draft} class schemes are still in draft or returned status.</p> : null}
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
                <p className="font-semibold text-ink">{item.className}</p>
                <p className="text-xs text-ink/52">{item.category ?? "Class"} · {item.arm ?? "Arm"}</p>
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
                <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                  <span className="block h-full rounded-full bg-brand-600" style={{ width: `${item.coveragePercent}%` }} />
                </div>
                <p className="mt-2 text-xs text-ink/55">{item.coveredWeeks}/{item.teachingWeeks} teaching weeks · {item.coveragePercent}%</p>
              </div>
            )
          },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <Link href={`/subjects/${id}/scheme-of-work/${item.classId}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                Open class SOW
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
