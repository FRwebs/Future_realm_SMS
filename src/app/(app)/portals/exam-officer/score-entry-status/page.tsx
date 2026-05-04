import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerScoreStatusView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function ExamOfficerScoreStatusPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer/score-entry-status"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const statuses = await apiGet<ExamOfficerScoreStatusView[]>(
    "/api/v1/exam-officer/score-entry-status",
  );

  const summary = {
    complete: statuses.filter((item) => item.status === "COMPLETE").length,
    inProgress: statuses.filter((item) => item.status === "IN_PROGRESS").length,
    notStarted: statuses.filter((item) => item.status === "NOT_STARTED").length,
  };

  return (
    <div className="grid gap-6">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Score entry control room</p>
        <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
          Completion tracking across every exam sheet
        </h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
          Monitor which class-subject combinations are complete, who still needs
          intervention, and jump straight into the working score sheet.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Complete</p>
          <p className="mt-3 font-[var(--font-display)] text-[32px] font-black text-[var(--color-success)]">{summary.complete}</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">In progress</p>
          <p className="mt-3 font-[var(--font-display)] text-[32px] font-black text-[var(--color-warning)]">{summary.inProgress}</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Not started</p>
          <p className="mt-3 font-[var(--font-display)] text-[32px] font-black text-[var(--color-danger)]">{summary.notStarted}</p>
        </article>
      </section>

      <TableCard
        title="Score entry board"
        description="Use this board to direct daily marking work and see which exam sheets are ready for moderation."
        items={statuses}
        getRowKey={(item) => `${item.assessmentId}-${item.className}-${item.subject}`}
        primaryColumnKey="examTitle"
        featuredColumnKeys={["status"]}
        columns={[
          {
            key: "examTitle",
            header: "Exam",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.examTitle}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.className} · {item.subject}</p>
              </div>
            ),
          },
          { key: "date", header: "Date", render: (item) => formatDate(item.assessmentDate) },
          {
            key: "entry",
            header: "Entered",
            render: (item) => (
              <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
                {item.entered}/{item.total}
              </span>
            ),
          },
          { key: "progress", header: "Progress", render: (item) => `${item.completionRate}%` },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "action",
            header: "Action",
            render: (item) => (
              <Link href={`/academics/results/assessment-format/${item.assessmentId}`} className="text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline">
                Open sheet
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
