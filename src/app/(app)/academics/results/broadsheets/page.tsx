import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { BroadsheetView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type BroadsheetsPageProps = {
  searchParams?: Promise<{
    search?: string;
    sessionId?: string;
    termId?: string;
    classId?: string;
    status?: string;
    approvalStage?: string;
    published?: string;
  }>;
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

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
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

export default async function BroadsheetsPage({ searchParams }: BroadsheetsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/broadsheets"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const [broadsheets, permissions, classesPayload, sessionTerms] = await Promise.all([
    apiGet<BroadsheetView[]>(`/api/v1/academics/broadsheets${queryString(params)}`),
    getServerPermissions(session),
    apiGet<ClassesPayload>("/api/v1/classes").catch(() => ({ data: [] })),
    apiGet<SessionTermPayload>("/api/v1/configuration/sessions-terms").catch(() => ({ records: [] }))
  ]);

  const canCompile = permissions.includes("results.compile");
  const classes = classesPayload.data ?? [];
  const sessionOptions = sessionTerms.records.map((item) => ({ label: item.name, value: item.id }));
  const termOptions = sessionTerms.records.flatMap((item) => (item.terms ?? []).map((term) => ({ label: `${item.name} · ${term.name}`, value: term.id })));
  const classOptions = classes.map((item) => ({ label: item.arm ? `${item.name} - ${item.arm}` : item.name, value: item.id }));

  const totals = {
    count: broadsheets.length,
    published: broadsheets.filter((item) => item.status === "PUBLISHED").length,
    flagged: broadsheets.filter((item) => item.missingScoreWarnings.length > 0).length,
    classAverage:
      broadsheets.length === 0
        ? 0
        : Math.round(
            broadsheets.reduce((sum, item) => sum + (item.metrics?.classAverage ?? 0), 0) / broadsheets.length
          )
  };

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/academics/results" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to results</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-eyebrow">Canonical class result workspace</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Broadsheets</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Review class result completeness, workflow state, publication readiness, and exportable term summaries from one consolidated broadsheet module.
            </p>
          </div>
          {canCompile ? (
            <ResourceActionDialog
              triggerLabel="Compile broadsheet"
              title="Compile broadsheet"
              description="Compile a full class broadsheet for the selected term. The system will flag missing subject scores, update report-card snapshots, and route the broadsheet into review."
              endpoint="/api/v1/academics/broadsheets/compile"
              submitLabel="Compile broadsheet"
              confirmLabel="Compile now"
              confirmMessage="This will refresh the canonical broadsheet and replace any earlier draft snapshot for the same class and term."
              fields={[
                {
                  name: "classId",
                  label: "Class",
                  type: "select",
                  required: true,
                  options: [{ label: "Select class", value: "" }, ...classOptions]
                },
                {
                  name: "termId",
                  label: "Term",
                  type: "select",
                  options: [{ label: "Use current term", value: "" }, ...termOptions]
                },
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
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Broadsheets" value={totals.count} />
        <SummaryCard label="Published" value={totals.published} tone="emerald" />
        <SummaryCard label="Flagged" value={totals.flagged} tone="amber" />
        <SummaryCard label="Average Class Mean" value={`${totals.classAverage}%`} tone="brand" />
      </div>

      <FilterToolbar
        action={"/academics/results/broadsheets" as Route}
        title="Filter broadsheets"
        description="Query the broadsheet register by session, term, class, workflow status, approval stage, publication state, or class search."
        resultCount={broadsheets.length}
        activeSummary={[
          params.search ? `Search: ${params.search}` : "",
          params.sessionId ? `Session selected` : "",
          params.termId ? `Term selected` : "",
          params.classId ? `Class selected` : "",
          params.status ? `Status: ${params.status}` : "",
          params.approvalStage ? `Stage: ${params.approvalStage.replaceAll("_", " ")}` : "",
          params.published ? `Published: ${params.published}` : ""
        ].filter(Boolean)}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Class name, arm, level", defaultValue: params.search ?? "" },
          { name: "sessionId", label: "Session", type: "select", defaultValue: params.sessionId ?? "", options: [{ label: "All sessions", value: "" }, ...sessionOptions] },
          { name: "termId", label: "Term", type: "select", defaultValue: params.termId ?? "", options: [{ label: "All terms", value: "" }, ...termOptions] },
          { name: "classId", label: "Class", type: "select", defaultValue: params.classId ?? "", options: [{ label: "All classes", value: "" }, ...classOptions] },
          {
            name: "status",
            label: "Status",
            type: "select",
            defaultValue: params.status ?? "",
            options: [
              { label: "All statuses", value: "" },
              { label: "Draft", value: "DRAFT" },
              { label: "In review", value: "IN_REVIEW" },
              { label: "Correction requested", value: "CORRECTION_REQUESTED" },
              { label: "Approved", value: "APPROVED" },
              { label: "Published", value: "PUBLISHED" }
            ]
          },
          {
            name: "approvalStage",
            label: "Approval stage",
            type: "select",
            defaultValue: params.approvalStage ?? "",
            options: [
              { label: "All stages", value: "" },
              { label: "Class Teacher", value: "CLASS_TEACHER" },
              { label: "Exam Officer", value: "EXAM_OFFICER" },
              { label: "VP Academics", value: "VICE_PRINCIPAL_ACADEMICS" },
              { label: "Principal", value: "PRINCIPAL" },
              { label: "Published", value: "PUBLISHED" }
            ]
          },
          {
            name: "published",
            label: "Publication",
            type: "select",
            defaultValue: params.published ?? "",
            options: [
              { label: "All broadsheets", value: "" },
              { label: "Published only", value: "yes" },
              { label: "Not published", value: "no" }
            ]
          }
        ]}
      />

      <TableCard
        title="Class broadsheet register"
        description="One canonical record per class and term, with completeness, approval workflow, and publication readiness visible at a glance."
        items={broadsheets}
        emptyState="No broadsheets match the selected filters yet."
        columns={[
          {
            key: "class",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {item.term}
                  {item.session ? ` · ${item.session}` : ""}
                  {item.classTeacherName ? ` · ${item.classTeacherName}` : ""}
                </p>
              </div>
            )
          },
          {
            key: "workflow",
            header: "Workflow",
            render: (item) => (
              <div className="flex min-w-[180px] flex-wrap gap-2">
                <StatusBadge status={item.status} />
                <StatusBadge status={item.approvalStage} tone="brand" />
              </div>
            )
          },
          {
            key: "completeness",
            header: "Completeness",
            render: (item) => (
              <div className="text-[13px] text-[var(--color-text-secondary)]">
                <p>{item.metrics?.completeStudents ?? 0}/{item.metrics?.studentCount ?? item.rows.length} students complete</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.missingScoreWarnings.length} flagged issues</p>
              </div>
            )
          },
          {
            key: "performance",
            header: "Performance",
            render: (item) => (
              <div className="text-[13px] text-[var(--color-text-secondary)]">
                <p className="font-semibold text-[var(--color-text-primary)]">{item.metrics?.classAverage ?? 0}% mean</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.metrics?.subjectCount ?? 0} subjects</p>
              </div>
            )
          },
          {
            key: "publication",
            header: "Publication",
            render: (item) => item.publishedAt ? formatDate(item.publishedAt) : "Not published"
          },
          {
            key: "open",
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
