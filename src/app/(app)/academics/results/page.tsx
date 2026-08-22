import Link from "next/link";
import type { Route } from "next";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatCard } from "@/components/data-display/stat-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AcademicAssessmentView, ResultAnalyticsView, ResultApprovalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type ResultsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

type StatTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

function tabHref(tab: string) {
  return tab === "entry" ? "/academics/results" : `/academics/results?tab=${tab}`;
}

function metricTone(tone: string): StatTone {
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "info" || tone === "accent") return tone;
  return "neutral";
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const tab = params.tab === "verification" || params.tab === "analysis" ? params.tab : "entry";
  const permissions = await getServerPermissions(session);
  const canApprove = permissions.includes("results.approve");

  const tabs = [
    { label: "Score Entry", href: tabHref("entry"), active: tab === "entry" },
    { label: "Verification", href: tabHref("verification"), active: tab === "verification" },
    { label: "Result Analysis", href: tabHref("analysis"), active: tab === "analysis" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Academic Operations</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Score Entry & Result Computation</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Track score-entry progress by class and subject, verify submitted result sheets, and review computed
              term performance — all from the live school database.
            </p>
          </div>
          <Link href={"/academics/results/broadsheets" as Route} className="btn-secondary px-5 py-3 text-sm font-semibold">
            Open broadsheets
          </Link>
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "entry" ? <ScoreEntryTab /> : null}
      {tab === "verification" ? <VerificationTab canApprove={canApprove} /> : null}
      {tab === "analysis" ? <ResultAnalysisTab /> : null}
    </div>
  );
}

async function ScoreEntryTab() {
  const assessments = await apiGet<AcademicAssessmentView[]>("/api/v1/academics/academic-assessments");

  const fullyEntered = assessments.filter((item) => item.candidateCount > 0 && item.enteredCount >= item.candidateCount).length;
  const notStarted = assessments.filter((item) => item.candidateCount > 0 && item.enteredCount === 0).length;
  const outstandingEntries = assessments.reduce((sum, item) => sum + Math.max(item.candidateCount - item.enteredCount, 0), 0);

  const rows = [...assessments].sort(
    (a, b) => Math.max(b.candidateCount - b.enteredCount, 0) - Math.max(a.candidateCount - a.enteredCount, 0)
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assessments" value={assessments.length} detail="Assessment components configured across classes and subjects." tone="neutral" />
        <StatCard label="Fully entered" value={fullyEntered} detail="Assessments with scores captured for every candidate." tone="success" />
        <StatCard label="Not started" value={notStarted} detail="Assessments with candidates but no scores entered yet." tone="danger" />
        <StatCard label="Entries outstanding" value={outstandingEntries} detail="Individual candidate scores still needed to close out entry." tone="warning" />
      </section>

      <TableCard
        title="Score entry progress"
        description="Per-class, per-subject assessment entry status for the current configuration. Open the score entry workspace to record marks."
        items={rows}
        emptyState="No assessment components have been configured yet."
        primaryColumnKey="subject"
        columns={[
          {
            key: "subject",
            header: "Class & subject",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.subject}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}{item.arm ? ` ${item.arm}` : ""}</p>
              </div>
            )
          },
          {
            key: "title",
            header: "Assessment",
            render: (item) => (
              <div>
                <p className="text-[13px] text-[var(--color-text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.assessmentType.replaceAll("_", " ")} · {formatDate(item.assessmentDate)}</p>
              </div>
            )
          },
          {
            key: "progress",
            header: "Entered",
            render: (item) => (
              <span className="font-semibold text-[var(--color-text-primary)]">
                {item.enteredCount}/{item.candidateCount}
              </span>
            ),
            sortValue: (item) => (item.candidateCount === 0 ? 0 : item.enteredCount / item.candidateCount)
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "action",
            header: "Workspace",
            sortable: false,
            render: (item) => (
              <Link
                className="font-semibold text-[var(--color-text-accent)]"
                href={`/academics/results/assessment-format?className=${encodeURIComponent(item.className)}&subject=${encodeURIComponent(item.subject)}` as Route}
              >
                Enter scores
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}

async function VerificationTab({ canApprove }: { canApprove: boolean }) {
  if (!canApprove) {
    return (
      <section className="surface-card p-6 text-[13px] leading-6 text-[var(--color-text-secondary)]">
        You do not have permission to review or approve result sheets.
      </section>
    );
  }

  const queue = await apiGet<ResultApprovalView[]>("/api/v1/academics/approval-queue");
  const actionable = queue.filter((item) => item.status === "SUBMITTED" || item.status === "UNDER_REVIEW");
  const approved = queue.filter((item) => item.status === "APPROVED");
  const returned = queue.filter((item) => item.status === "RETURNED");

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting review" value={actionable.length} detail="Submitted result sheets that need an approval decision." tone="warning" />
        <StatCard label="Approved" value={approved.length} detail="Result sheets approved and ready to compile or publish." tone="success" />
        <StatCard label="Returned" value={returned.length} detail="Result sheets sent back for correction." tone="danger" />
        <StatCard label="In queue" value={queue.length} detail="Total result sheets tracked in the verification queue." tone="neutral" />
      </section>

      <TableCard
        title="Result sheet verification queue"
        description="Student result sheets submitted for review, most recent first. Approve to advance the workflow or reject to return for correction."
        items={queue}
        emptyState="No result sheets are currently awaiting verification."
        getRowKey={(item) => item.id}
        primaryColumnKey="student"
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "lastAction",
            header: "Last action",
            render: (item) => (
              <div>
                <p className="text-[13px] text-[var(--color-text-primary)]">{item.action.replaceAll("_", " ")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.actorName}</p>
              </div>
            )
          },
          { key: "note", header: "Note", render: (item) => item.note ?? "—" },
          { key: "createdAt", header: "Date", render: (item) => formatDate(item.createdAt) },
          {
            key: "actions",
            header: "Action",
            sortable: false,
            render: (item) =>
              item.status === "SUBMITTED" || item.status === "UNDER_REVIEW" ? (
                <ActionMenu triggerLabel={`Review actions for ${item.studentName}`}>
                  <ResourceActionDialog
                    triggerLabel="Approve"
                    title="Approve result sheet"
                    description={`Approve ${item.studentName}'s result sheet and advance it in the review workflow.`}
                    endpoint="/api/v1/academics/score-sheets/approve"
                    submitLabel="Approve result sheet"
                    variant="menu"
                    confirmLabel="Confirm approval"
                    confirmMessage="This will advance the result sheet toward publication."
                    fields={[
                      { name: "resultSheetId", label: "Result sheet ID", required: true, defaultValue: item.resultSheetId },
                      { name: "note", label: "Review note", type: "textarea" }
                    ]}
                  />
                  <ResourceActionDialog
                    triggerLabel="Reject"
                    title="Reject result sheet"
                    description={`Return ${item.studentName}'s result sheet for correction.`}
                    endpoint="/api/v1/academics/score-sheets/reject"
                    submitLabel="Reject result sheet"
                    variant="menuDanger"
                    confirmLabel="Confirm rejection"
                    confirmMessage="This will return the result sheet to the submitting teacher for correction."
                    fields={[
                      { name: "resultSheetId", label: "Result sheet ID", required: true, defaultValue: item.resultSheetId },
                      { name: "note", label: "Reason for rejection", type: "textarea", required: true }
                    ]}
                  />
                </ActionMenu>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">No action needed</span>
              )
          }
        ]}
      />
    </div>
  );
}

async function ResultAnalysisTab() {
  const analytics = await apiGet<ResultAnalyticsView>("/api/v1/academics/analytics");
  const topPerformers = analytics.topPerformers ?? [];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {analytics.metrics.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} tone={metricTone(metric.tone)} />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Subject performance"
          description="Average score and pass rate by subject across compiled result sheets."
          items={analytics.subjectSummaries}
          emptyState="No subject performance data is available yet."
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "average", header: "Average", render: (item) => `${item.average}%` },
            { key: "passRate", header: "Pass rate", render: (item) => `${item.passRate}%` },
            { key: "entries", header: "Entries", render: (item) => item.entries }
          ]}
        />

        <TableCard
          title="Top performing students"
          description="Highest average scores from compiled result sheets in the current term."
          items={topPerformers}
          emptyState="No compiled result sheets with scores are available for the current term yet."
          getRowKey={(item, index) => `${item.studentName}-${index}`}
          columns={[
            {
              key: "position",
              header: "#",
              render: (item) => item.position ?? "—"
            },
            {
              key: "student",
              header: "Student",
              render: (item) => (
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatNigeriaClassName(item.className)}</p>
                </div>
              )
            },
            { key: "average", header: "Average", render: (item) => `${item.average}%` },
            { key: "grade", header: "Grade", render: (item) => item.grade ?? "—" }
          ]}
        />
      </div>

      <TableCard
        title="Class performance"
        description="Average, published count, pending count, and missing scores by class."
        items={analytics.classSummaries}
        emptyState="No class performance data is available yet."
        columns={[
          { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "average", header: "Average", render: (item) => `${item.average}%` },
          { key: "published", header: "Published", render: (item) => item.published },
          { key: "pending", header: "Pending", render: (item) => item.pending },
          { key: "missing", header: "Missing", render: (item) => item.missingScores }
        ]}
      />

      <div className="flex justify-end">
        <Link href={"/academics/results/analytics" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          View full analytics & missing-score register →
        </Link>
      </div>
    </div>
  );
}
