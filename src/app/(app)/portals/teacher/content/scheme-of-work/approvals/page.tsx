import Link from "next/link";
import { BookMarked, CheckCircle2, Clock3, ShieldCheck, Target } from "lucide-react";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkSummaryView, TeacherPortalView } from "@/lib/domain/types";

type TeachingLane = {
  key: string;
  subjectId: string;
  classId: string;
  subject: string;
  className: string;
  learners: number;
};

function buildTeachingLanes(portal: TeacherPortalView): TeachingLane[] {
  return Array.from(
    new Map(
      portal.assignedClasses
        .filter((item): item is typeof item & { subjectId: string; classId: string } => Boolean(item.subjectId && item.classId))
        .map((item) => [
          `${item.subjectId}:${item.classId}`,
          {
            key: `${item.subjectId}:${item.classId}`,
            subjectId: item.subjectId,
            classId: item.classId,
            subject: item.subject,
            className: item.className,
            learners: item.learners,
          },
        ]),
    ).values(),
  ).sort((left, right) =>
    `${left.subject} ${left.className}`.localeCompare(`${right.subject} ${right.className}`),
  );
}

function statusTone(status: SchemeOfWorkSummaryView["status"]) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "SUBMITTED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "RETURNED":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default async function TeacherSchemeOfWorkApprovalsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/content/scheme-of-work/approvals")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [portal, summaries] = await Promise.all([
    apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard"),
    apiGet<SchemeOfWorkSummaryView[]>("/api/v1/scheme-of-work/my").catch(() => []),
  ]);

  const lanes = buildTeachingLanes(portal);
  const initializedKeys = new Set(summaries.map((summary) => `${summary.subjectId}:${summary.classId}`));
  const missingLanes = lanes.filter((lane) => !initializedKeys.has(lane.key));
  const submitted = summaries.filter((summary) => summary.status === "SUBMITTED");
  const returned = summaries.filter((summary) => summary.status === "RETURNED");
  const approved = summaries.filter((summary) => summary.status === "APPROVED");
  const drafts = summaries.filter((summary) => summary.status === "DRAFT");

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.9rem] border border-white/65 bg-white/92 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Submission board
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">
              Approval readiness across every teaching lane
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
              This view is for checking review status, returned work, and which schemes are still
              sitting in draft instead of moving toward approval.
            </p>
          </div>
          <Link href="/portals/teacher/content/scheme-of-work/coverage" className="btn-secondary px-4">
            <BookMarked className="h-4 w-4" />
            Back to coverage editor
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.4rem] border border-amber-100 bg-amber-50/70 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Submitted
            </p>
            <p className="mt-2 text-3xl font-black text-amber-900">{submitted.length}</p>
          </article>
          <article className="rounded-[1.4rem] border border-rose-100 bg-rose-50/70 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">
              Returned
            </p>
            <p className="mt-2 text-3xl font-black text-rose-900">{returned.length}</p>
          </article>
          <article className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/70 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Approved
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-900">{approved.length}</p>
          </article>
          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Missing lanes
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">{missingLanes.length}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <article className="min-w-0 rounded-[1.9rem] border border-white/65 bg-white/92 p-5 shadow-panel">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <ShieldCheck className="h-4 w-4 text-primary-700" />
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
              Scheme status matrix
            </h2>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Class", "Subject", "Status", "Coverage", "Covered weeks", "Next week", "Action"].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {summaries.map((summary) => (
                  <tr key={summary.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{summary.className}</td>
                    <td className="px-4 py-3 text-slate-900">{summary.subjectName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusTone(summary.status)}`}>
                        {summary.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{summary.coveragePercent}%</td>
                    <td className="px-4 py-3 text-slate-600">
                      {summary.coveredWeeks}/{summary.teachingWeeks}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{summary.nextWeek ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/portals/teacher/content/scheme-of-work/coverage?sow=${summary.id}`}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                      >
                        Open lane
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!summaries.length ? (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
              No scheme records are available yet.
            </div>
          ) : null}
        </article>

        <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-600" />
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">
                Needs attention
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <article className="rounded-[1.35rem] border border-amber-100 bg-amber-50/70 px-4 py-4">
                <p className="text-sm font-semibold text-amber-900">
                  {submitted.length} scheme{submitted.length === 1 ? "" : "s"} currently waiting for
                  review.
                </p>
              </article>
              <article className="rounded-[1.35rem] border border-rose-100 bg-rose-50/70 px-4 py-4">
                <p className="text-sm font-semibold text-rose-900">
                  {returned.length} scheme{returned.length === 1 ? "" : "s"} need revision before
                  approval.
                </p>
              </article>
              <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">
                  {drafts.length} scheme{drafts.length === 1 ? "" : "s"} still sitting in draft.
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-[1.85rem] border border-white/65 bg-white/92 p-5 shadow-panel">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" />
              <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">
                Quick recovery
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <Link href="/portals/teacher/content/scheme-of-work/coverage" className="btn-secondary px-4">
                <CheckCircle2 className="h-4 w-4" />
                Work coverage lanes
              </Link>
              <Link href="/portals/teacher/content/lesson-notes/queue" className="btn-secondary px-4">
                <BookMarked className="h-4 w-4" />
                Review lesson queue
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
