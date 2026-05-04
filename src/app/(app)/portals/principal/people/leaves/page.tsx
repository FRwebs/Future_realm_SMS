import { TableCard } from "@/components/data-display/table-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalDataList, PrincipalInfoCard, PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalPeopleBundle, personName, principalLabel } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

export default async function PrincipalLeavesPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/people/leaves"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { leaveRequests } = await loadPrincipalPeopleBundle();
  const pending = leaveRequests.filter((item) => item.status === "PENDING").length;
  const approved = leaveRequests.filter((item) => item.status === "APPROVED").length;
  const rejected = leaveRequests.filter((item) => item.status === "REJECTED").length;
  const leaveTypeMix = Object.entries(
    leaveRequests.reduce<Record<string, number>>((accumulator, item) => {
      const key = principalLabel(item.type);
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Leave approvals"
        title="Staff leave pressure and approval posture"
        description="Leadership visibility into pending requests, approved absences, and the reasons driving leave demand this term."
        actions={<PrincipalQuickLink href="/operations/welfare" label="Open operations leave desk" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Pending" value={pending} helper="Leave requests still waiting for leadership decision." tone="amber" />
        <PrincipalMetricCard label="Approved" value={approved} helper="Requests already greenlit in the operations workflow." />
        <PrincipalMetricCard label="Rejected" value={rejected} helper="Requests declined and waiting on staff follow-up where needed." tone="rose" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PrincipalInfoCard
          title="Leave demand mix"
          description="The most common leave categories currently surfacing."
        >
          <PrincipalDataList
            items={leaveTypeMix.map(([label, value]) => ({
              label,
              value,
              detail: "Requests in the active leadership view.",
            }))}
          />
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Pending reviews"
          description="Requests that may need quick action from leadership."
        >
          <div className="grid gap-3">
            {leaveRequests
              .filter((item) => item.status === "PENDING")
              .slice(0, 4)
              .map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
                >
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{personName(item.staff?.user)}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                    {principalLabel(item.type)} · {formatDate(item.startDate)} to {formatDate(item.endDate)}
                  </p>
                </div>
              ))}
          </div>
        </PrincipalInfoCard>
      </section>

      <TableCard
        title="Staff leave register"
        description="All current leave requests pulled into one principal review table."
        items={leaveRequests}
        emptyState="No leave requests are available yet."
        columns={[
          {
            key: "staff",
            header: "Staff",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{personName(item.staff?.user)}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.staff?.employeeNo ?? "No employee no."} · {item.staff?.department?.name ?? "Department pending"}</p>
              </div>
            ),
          },
          { key: "type", header: "Type", render: (item) => principalLabel(item.type) },
          { key: "reason", header: "Reason", render: (item) => item.reason },
          { key: "window", header: "Duration", render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}` },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
        ]}
      />
    </div>
  );
}
