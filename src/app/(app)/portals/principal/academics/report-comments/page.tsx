import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalAcademicBundle } from "@/lib/principal/portal";

export default async function PrincipalReportCommentsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/academics/report-comments"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { broadsheets } = await loadPrincipalAcademicBundle();
  const commentRows = broadsheets.flatMap((sheet) =>
    sheet.rows.map((row) => ({
      id: `${sheet.id}-${row.studentId}`,
      className: sheet.className,
      term: sheet.term,
      session: sheet.session,
      studentName: row.studentName,
      average: row.average,
      position: row.position,
      principalRemark: row.principalRemark,
    })),
  );
  const completed = commentRows.filter((item) => Boolean(item.principalRemark)).length;
  const missing = commentRows.length - completed;

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Report card remarks"
        title="Track principal comment readiness"
        description="See which report-card rows already carry a principal remark and which classes still need leadership commentary before publication."
        actions={<PrincipalQuickLink href="/academics/results/broadsheets" label="Open result workflow" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Comment rows" value={commentRows.length} helper="Student report-card rows visible from current broadsheets." />
        <PrincipalMetricCard label="Completed" value={completed} helper="Rows already carrying a principal comment." />
        <PrincipalMetricCard label="Missing" value={missing} helper="Rows that still need leadership commentary." tone="amber" />
      </section>

      <TableCard
        title="Principal comment coverage"
        description="A row-level view of where report comments are already complete and where the principal still needs to write."
        items={commentRows.slice(0, 60)}
        emptyState="No broadsheet rows are available for comment review yet."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.studentName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.className} · {item.term}{item.session ? ` · ${item.session}` : ""}</p>
              </div>
            ),
          },
          { key: "average", header: "Average", render: (item) => `${item.average}%` },
          { key: "position", header: "Position", render: (item) => item.position ?? "-" },
          { key: "remark", header: "Comment status", render: (item) => item.principalRemark ? "Added" : "Missing" },
          { key: "preview", header: "Preview", render: (item) => item.principalRemark ?? "No principal comment yet." },
        ]}
      />
    </div>
  );
}
