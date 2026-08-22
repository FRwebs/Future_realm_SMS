import Link from "next/link";
import type { Route } from "next";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { BroadsheetView, ReportCardView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type ReportCardsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

type ClassesPayload = {
  data: Array<{ id: string; name: string; arm?: string; category?: string }>;
};

type SessionTermPayload = {
  records: Array<{
    id: string;
    name: string;
    terms?: Array<{ id: string; name: string }>;
  }>;
};

const ACTIVE_STATUSES = new Set<ReportCardView["status"]>(["DRAFT", "GENERATED"]);
const ARCHIVE_STATUSES = new Set<ReportCardView["status"]>(["PUBLISHED", "LOCKED"]);
const REMARK_APPROVAL_STAGES = new Set(["CLASS_TEACHER", "PRINCIPAL"]);

function tabHref(tab: string) {
  return tab === "generate" ? "/academics/results/report-cards" : `/academics/results/report-cards?tab=${tab}`;
}

function SummaryCard({ label, value, tone = "ink" }: { label: string; value: string | number; tone?: "ink" | "brand" | "emerald" | "amber" }) {
  const toneClasses = {
    ink: "text-[var(--color-text-primary)]",
    brand: "text-[var(--color-text-accent)]",
    emerald: "text-[var(--color-success)]",
    amber: "text-[var(--color-warning)]"
  };

  return (
    <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-2 text-[22px] font-bold ${toneClasses[tone]}`}>{value}</p>
    </article>
  );
}

function RemarkPill({ present }: { present: boolean }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={
        present
          ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
          : { background: "var(--color-warning-dim)", color: "var(--color-warning)" }
      }
    >
      {present ? "Recorded" : "Outstanding"}
    </span>
  );
}

export default async function ReportCardsPage({ searchParams }: ReportCardsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/report-cards"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "generate";

  const [reportCards, permissions] = await Promise.all([
    apiGet<ReportCardView[]>("/api/v1/academics/report-cards"),
    getServerPermissions(session)
  ]);

  const canCompile = permissions.includes("results.compile");
  const activeCards = reportCards.filter((card) => ACTIVE_STATUSES.has(card.status));
  const archivedCards = reportCards.filter((card) => ARCHIVE_STATUSES.has(card.status));
  const remarksOutstanding = activeCards.filter((card) => !card.classTeacherRemark || !card.principalRemark);

  const tabs = [
    { label: "Generate", href: tabHref("generate"), active: tab === "generate", badge: activeCards.length || undefined },
    { label: "Archive", href: tabHref("archive"), active: tab === "archive", badge: archivedCards.length || undefined },
    { label: "Remarks & Broadsheet", href: tabHref("remarks"), active: tab === "remarks", badge: remarksOutstanding.length || undefined }
  ];

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/academics/results" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to results</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Report card generation &amp; publishing</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Report cards</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Generate report cards from compiled broadsheets, review the published archive, and track outstanding class-teacher
              and principal remarks before publication — all backed by the live school database.
            </p>
          </div>
          {canCompile ? <GenerateAction /> : null}
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "generate" ? <GenerateTab items={activeCards} /> : null}
      {tab === "archive" ? <ArchiveTab items={archivedCards} /> : null}
      {tab === "remarks" ? <RemarksTab items={activeCards} /> : null}
    </div>
  );
}

async function GenerateAction() {
  const [classesPayload, sessionTerms] = await Promise.all([
    apiGet<ClassesPayload>("/api/v1/classes").catch(() => ({ data: [] })),
    apiGet<SessionTermPayload>("/api/v1/configuration/sessions-terms").catch(() => ({ records: [] }))
  ]);

  const classOptions = (classesPayload.data ?? []).map((item) => ({ label: item.arm ? `${item.name} - ${item.arm}` : item.name, value: item.id }));
  const termOptions = (sessionTerms.records ?? []).flatMap((item) => (item.terms ?? []).map((term) => ({ label: `${item.name} · ${term.name}`, value: term.id })));

  return (
    <ResourceActionDialog
      triggerLabel="Generate report cards"
      title="Compile broadsheet & generate report cards"
      description="Compiling a class broadsheet refreshes every student's report-card snapshot for the selected term and routes the broadsheet into review."
      endpoint="/api/v1/academics/broadsheets/compile"
      submitLabel="Generate"
      confirmLabel="Generate now"
      confirmMessage="This will refresh the class broadsheet and regenerate report cards for every student in the class."
      fields={[
        { name: "classId", label: "Class", type: "select", required: true, options: [{ label: "Select class", value: "" }, ...classOptions] },
        { name: "termId", label: "Term", type: "select", options: [{ label: "Use current term", value: "" }, ...termOptions] },
        {
          name: "rankingEnabled",
          label: "Ranking",
          type: "select",
          defaultValue: "true",
          options: [
            { label: "Enable class ranking", value: "true" },
            { label: "Disable class ranking", value: "false" }
          ]
        }
      ]}
    />
  );
}

function GenerateTab({ items }: { items: ReportCardView[] }) {
  const averagePct = items.length ? Math.round(items.reduce((sum, item) => sum + item.average, 0) / items.length) : 0;
  const missingRemarks = items.filter((item) => !item.classTeacherRemark || !item.principalRemark).length;
  const preview = items[0];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Generated, awaiting publish" value={items.length} />
        <SummaryCard label="Class average" value={`${averagePct}%`} tone="brand" />
        <SummaryCard label="Missing a remark" value={missingRemarks} tone={missingRemarks ? "amber" : "emerald"} />
      </section>

      {preview ? (
        <section className="surface-card overflow-hidden p-0">
          <div className="bg-[var(--color-text-primary)] p-6 text-[var(--color-bg-surface)] md:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-bg-surface)]/65">Latest generated preview</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold">{preview.term}{preview.session ? ` · ${preview.session}` : ""} report card</h2>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
            <article className="md:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Student</p>
              <p className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">{preview.studentName}</p>
              <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{formatNigeriaClassName(preview.className)}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Average</p>
              <p className="mt-2 text-[22px] font-bold text-[var(--color-text-accent)]">{preview.average}%</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Status</p>
              <div className="mt-2"><StatusBadge status={preview.status} /></div>
            </article>
          </div>
        </section>
      ) : null}

      <TableCard
        title="Report cards in progress"
        description="Report cards generated from a compiled broadsheet that are not yet published to parents and students."
        items={items}
        emptyState="No report cards have been generated yet. Compile a class broadsheet to generate report cards."
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
          { key: "term", header: "Term", render: (item) => item.session ? `${item.term} · ${item.session}` : item.term },
          { key: "average", header: "Average", render: (item) => `${item.average}%` },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "remarks",
            header: "Remarks",
            render: (item) => (
              <div className="flex flex-wrap gap-1.5">
                <RemarkPill present={Boolean(item.classTeacherRemark)} />
                <RemarkPill present={Boolean(item.principalRemark)} />
              </div>
            )
          },
          {
            key: "workspace",
            header: "Workspace",
            render: (item) =>
              item.broadsheetId ? (
                <Link className="font-semibold text-[var(--color-text-accent)]" href={`/academics/results/broadsheets/${item.broadsheetId}` as Route}>
                  Open broadsheet
                </Link>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">No broadsheet</span>
              )
          }
        ]}
      />
    </div>
  );
}

function ArchiveTab({ items }: { items: ReportCardView[] }) {
  const publishedCount = items.filter((item) => item.status === "PUBLISHED").length;
  const lockedCount = items.filter((item) => item.status === "LOCKED").length;
  const latestPublishedAt = items
    .map((item) => item.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Published" value={publishedCount} tone="emerald" />
        <SummaryCard label="Locked" value={lockedCount} tone="brand" />
        <SummaryCard label="Most recent publish" value={latestPublishedAt ? formatDate(latestPublishedAt) : "None yet"} />
      </section>

      <TableCard
        title="Published report card archive"
        description="Report cards visible to parents and students, published from an approved and locked class broadsheet."
        items={items}
        emptyState="No report cards have been published yet. Publish an approved broadsheet to build the archive."
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
          { key: "term", header: "Term", render: (item) => item.session ? `${item.term} · ${item.session}` : item.term },
          { key: "average", header: "Average", render: (item) => `${item.average}%` },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "publishedAt", header: "Published", render: (item) => item.publishedAt ? formatDate(item.publishedAt) : "Not recorded" },
          {
            key: "workspace",
            header: "Broadsheet",
            render: (item) =>
              item.broadsheetId ? (
                <Link className="font-semibold text-[var(--color-text-accent)]" href={`/academics/results/broadsheets/${item.broadsheetId}` as Route}>
                  Open broadsheet
                </Link>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">No broadsheet</span>
              )
          },
          {
            key: "download",
            header: "PDF",
            render: (item) => (
              <a className="font-semibold text-[var(--color-text-accent)]" href={item.reportCardUrl ?? `/api/v1/reports/report-card/${item.studentId}`}>
                Download
              </a>
            )
          }
        ]}
      />
    </div>
  );
}

async function RemarksTab({ items }: { items: ReportCardView[] }) {
  const broadsheets = await apiGet<BroadsheetView[]>("/api/v1/academics/broadsheets").catch(() => [] as BroadsheetView[]);
  const missingTeacherRemark = items.filter((item) => !item.classTeacherRemark).length;
  const missingPrincipalRemark = items.filter((item) => !item.principalRemark).length;
  const outstanding = items.filter((item) => !item.classTeacherRemark || !item.principalRemark);
  const remarkStageBroadsheets = broadsheets.filter(
    (item) => item.status !== "PUBLISHED" && REMARK_APPROVAL_STAGES.has(item.approvalStage)
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Missing class-teacher remark" value={missingTeacherRemark} tone={missingTeacherRemark ? "amber" : "emerald"} />
        <SummaryCard label="Missing principal remark" value={missingPrincipalRemark} tone={missingPrincipalRemark ? "amber" : "emerald"} />
        <SummaryCard label="Broadsheets at remark stage" value={remarkStageBroadsheets.length} tone="brand" />
      </section>

      <TableCard
        title="Remarks outstanding before publishing"
        description="Report cards still awaiting a class-teacher or principal remark. A report card cannot be published until both remarks are recorded on the class broadsheet."
        items={outstanding}
        emptyState="No outstanding remarks. Every generated report card has both a class-teacher and principal remark recorded."
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
          { key: "term", header: "Term", render: (item) => item.session ? `${item.term} · ${item.session}` : item.term },
          { key: "classTeacherRemark", header: "Class-teacher remark", render: (item) => <RemarkPill present={Boolean(item.classTeacherRemark)} /> },
          { key: "principalRemark", header: "Principal remark", render: (item) => <RemarkPill present={Boolean(item.principalRemark)} /> },
          {
            key: "workspace",
            header: "Complete on broadsheet",
            render: (item) =>
              item.broadsheetId ? (
                <Link className="font-semibold text-[var(--color-text-accent)]" href={`/academics/results/broadsheets/${item.broadsheetId}` as Route}>
                  Open broadsheet
                </Link>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">No broadsheet</span>
              )
          }
        ]}
      />

      <TableCard
        title="Broadsheets at class-teacher or principal review"
        description="Broadsheets currently sitting at the approval stage where class-teacher or principal remarks are recorded."
        items={remarkStageBroadsheets}
        emptyState="No broadsheets are currently at the class-teacher or principal review stage."
        columns={[
          {
            key: "class",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.term}{item.session ? ` · ${item.session}` : ""}</p>
              </div>
            )
          },
          { key: "stage", header: "Approval stage", render: (item) => <StatusBadge status={item.approvalStage} tone="brand" /> },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "workspace",
            header: "Workspace",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-text-accent)]" href={`/academics/results/broadsheets/${item.id}` as Route}>
                Open broadsheet
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
