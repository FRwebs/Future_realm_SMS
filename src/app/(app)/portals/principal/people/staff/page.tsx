import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalDataList, PrincipalInfoCard, PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalPeopleBundle } from "@/lib/principal/portal";
import { formatDate } from "@/lib/utils/formatters";

export default async function PrincipalStaffPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/people/staff"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { teachers, teacherActivities } = await loadPrincipalPeopleBundle();
  const onLeave = teachers.filter((teacher) => teacher.leaveStatus.toLowerCase().includes("approved")).length;
  const pendingResults = teachers.reduce((sum, teacher) => sum + teacher.pendingResults, 0);
  const departmentCoverage = Object.entries(
    teachers.reduce<Record<string, number>>((accumulator, teacher) => {
      const key = teacher.departmentName ?? "Unassigned";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Staff management"
        title="Leadership view of teachers and staff readiness"
        description="Review teacher load, pending result obligations, attendance posture, and recent staff activity without switching to the underlying staff module."
        actions={<PrincipalQuickLink href="/school/staff" label="Open full staff directory" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Teachers" value={teachers.length} helper="Staff currently visible from the teacher directory feed." />
        <PrincipalMetricCard label="On Leave" value={onLeave} helper="Staff records currently showing approved leave workflows." tone="amber" />
        <PrincipalMetricCard label="Pending Results" value={pendingResults} helper="Accumulated pending result obligations across teachers." tone="rose" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PrincipalInfoCard
          title="Department coverage"
          description="A quick read of where staff concentration currently sits."
        >
          <PrincipalDataList
            items={departmentCoverage.map(([label, value]) => ({
              label,
              value,
              detail: "Visible in the current teacher directory feed.",
            }))}
          />
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Leadership watchlist"
          description="Recent staff signals that may need follow-up."
        >
          <div className="grid gap-3">
            {teacherActivities.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>
      </section>

      <TableCard
        title="Teacher directory snapshot"
        description="Key teaching, attendance, and workload details visible to the principal."
        items={teachers}
        emptyState="No teacher records are available yet."
        columns={[
          {
            key: "teacher",
            header: "Teacher",
            render: (item) => (
              <div>
                <Link href={`/teachers/${item.id}`} className="font-semibold text-[var(--color-text-primary)] underline decoration-[var(--color-accent-primary)] underline-offset-4">
                  {item.fullName}
                </Link>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.employeeNo} · {item.designation}</p>
              </div>
            ),
          },
          { key: "department", header: "Department", render: (item) => item.departmentName ?? "Unassigned" },
          { key: "attendance", header: "Today", render: (item) => item.attendanceStatusToday },
          { key: "leave", header: "Leave", render: (item) => item.leaveStatus },
          { key: "pending", header: "Pending results", render: (item) => item.pendingResults },
        ]}
      />

      <TableCard
        title="Recent staff activity"
        description="Events and exceptions that help the principal understand staff rhythm this week."
        items={teacherActivities.slice(0, 12)}
        emptyState="No recent staff activity is available."
        columns={[
          { key: "teacher", header: "Teacher", render: (item) => item.teacherName },
          { key: "type", header: "Type", render: (item) => item.type },
          { key: "title", header: "Activity", render: (item) => item.title },
          { key: "detail", header: "Detail", render: (item) => item.detail },
          { key: "date", header: "When", render: (item) => formatDate(item.occurredAt) },
        ]}
      />
    </div>
  );
}
