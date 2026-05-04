import { TableCard } from "@/components/data-display/table-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalDataList, PrincipalInfoCard, PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalPeopleBundle, personName, principalLabel } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

export default async function PrincipalDisciplinePage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/people/discipline"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { discipline } = await loadPrincipalPeopleBundle();
  const critical = discipline.filter((item) => item.severity === "HIGH").length;
  const open = discipline.filter((item) => item.status !== "RESOLVED").length;
  const parentNotified = discipline.filter((item) => Boolean(item.parentNotifiedAt)).length;
  const typeMix = Object.entries(
    discipline.reduce<Record<string, number>>((accumulator, item) => {
      const key = principalLabel(item.category);
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Discipline management"
        title="School discipline and incident oversight"
        description="Track open cases, severe incidents, and parent-notification posture from one disciplined leadership workspace."
        actions={<PrincipalQuickLink href="/operations/welfare" label="Open welfare operations" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Open Cases" value={open} helper="Records not yet resolved or fully closed." tone="amber" />
        <PrincipalMetricCard label="High Severity" value={critical} helper="Cases flagged at the highest severity level." tone="rose" />
        <PrincipalMetricCard label="Parent Notified" value={parentNotified} helper="Incidents already carrying a parent-notified timestamp." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PrincipalInfoCard
          title="Incident mix"
          description="The leading categories surfacing in discipline records."
        >
          <PrincipalDataList
            items={typeMix.map(([label, value]) => ({
              label,
              value,
              detail: "Incident records in the current leadership view.",
            }))}
          />
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Latest escalations"
          description="Recent incidents that deserve close leadership attention."
        >
          <div className="grid gap-3">
            {discipline.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {personName(item.student)} · {principalLabel(item.category)}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>
      </section>

      <TableCard
        title="Discipline register"
        description="Executive view of current incidents, ownership, and follow-up posture."
        items={discipline}
        emptyState="No discipline records are available yet."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{personName(item.student)}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.classRoom?.name ?? "Class pending"}{item.classRoom?.arm ? ` - ${item.classRoom.arm}` : ""}</p>
              </div>
            ),
          },
          { key: "type", header: "Type", render: (item) => principalLabel(item.category) },
          { key: "severity", header: "Severity", render: (item) => <StatusBadge status={item.severity} tone={item.severity === "HIGH" ? "danger" : "warning"} /> },
          { key: "status", header: "Status", render: (item) => principalLabel(item.status) },
          { key: "reporter", header: "Reporter", render: (item) => personName(item.reporter) },
          { key: "date", header: "Date", render: (item) => formatDate(item.occurredAt) },
        ]}
      />
    </div>
  );
}
