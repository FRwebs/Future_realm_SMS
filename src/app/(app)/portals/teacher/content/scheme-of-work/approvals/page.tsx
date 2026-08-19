import type { Route } from "next";
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
      return { background: "var(--color-success-dim)", color: "var(--color-success)" };
    case "SUBMITTED":
      return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
    case "RETURNED":
      return { background: "var(--color-danger-dim)", color: "var(--color-danger)" };
    default:
      return { background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" };
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
    <div className="portal-page">
      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-eyebrow">
              Submission board
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Approval readiness across every teaching lane
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              This view is for checking review status, returned work, and which schemes are still
              sitting in draft instead of moving toward approval.
            </p>
          </div>
          <Link href={"/portals/teacher/content/scheme-of-work/coverage" as Route} className="btn-secondary px-4">
            <BookMarked className="h-4 w-4" />
            Back to coverage editor
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">
              Submitted
            </p>
            <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{submitted.length}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-danger-dim)] px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-danger)]">
              Returned
            </p>
            <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{returned.length}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">
              Approved
            </p>
            <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{approved.length}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Missing lanes
            </p>
            <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{missingLanes.length}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <article className="surface-card min-w-0 p-5">
          <div className="flex items-center gap-2 border-b border-[var(--color-border-default)] pb-4">
            <ShieldCheck className="h-4 w-4 text-[var(--color-text-accent)]" />
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
              Scheme status matrix
            </h2>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {["Class", "Subject", "Status", "Coverage", "Covered weeks", "Next week", "Action"].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-muted)] bg-[var(--color-bg-surface)]">
                {summaries.map((summary) => (
                  <tr key={summary.id}>
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{summary.className}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">{summary.subjectName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={statusTone(summary.status)}>
                        {summary.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{summary.coveragePercent}%</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {summary.coveredWeeks}/{summary.teachingWeeks}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{summary.nextWeek ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/portals/teacher/content/scheme-of-work/coverage?sow=${summary.id}` as Route}
                        className="inline-flex items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
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
            <div className="mt-5 rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-10 text-center text-[13px] text-[var(--color-text-secondary)]">
              No scheme records are available yet.
            </div>
          ) : null}
        </article>

        <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
              <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
                Needs attention
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-4 py-4">
                <p className="text-[13px] font-semibold" style={{ color: "var(--color-warning)" }}>
                  {submitted.length} scheme{submitted.length === 1 ? "" : "s"} currently waiting for
                  review.
                </p>
              </article>
              <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-danger-dim)] px-4 py-4">
                <p className="text-[13px] font-semibold" style={{ color: "var(--color-danger)" }}>
                  {returned.length} scheme{returned.length === 1 ? "" : "s"} need revision before
                  approval.
                </p>
              </article>
              <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {drafts.length} scheme{drafts.length === 1 ? "" : "s"} still sitting in draft.
                </p>
              </article>
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: "var(--color-success)" }} />
              <h2 className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
                Quick recovery
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <Link href={"/portals/teacher/content/scheme-of-work/coverage" as Route} className="btn-secondary px-4">
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
