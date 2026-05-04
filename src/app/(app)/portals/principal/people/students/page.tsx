import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalDataList, PrincipalInfoCard, PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalPeopleBundle } from "@/lib/principal/portal";
import { formatCurrency } from "@/lib/utils/formatters";

export default async function PrincipalStudentsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/people/students"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { students } = await loadPrincipalPeopleBundle();
  const lowAttendance = students.filter((student) => student.attendanceRate < 75).length;
  const lowAverage = students.filter((student) => student.averageScore > 0 && student.averageScore < 50).length;
  const outstanding = students.reduce((sum, student) => sum + student.outstandingBalance, 0);
  const interventionList = students
    .slice()
    .sort((left, right) => {
      const leftRisk = left.attendanceRate + left.averageScore;
      const rightRisk = right.attendanceRate + right.averageScore;
      return leftRisk - rightRisk;
    })
    .slice(0, 5);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Student oversight"
        title="Student risk, balance, and performance scan"
        description="A principal-level read of the school’s student body, focusing on academic risk, low attendance, and fee exposure that may affect classroom outcomes."
        actions={<PrincipalQuickLink href="/students" label="Open student directory" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Students" value={students.length} helper="Student records currently visible to leadership." />
        <PrincipalMetricCard label="Low Attendance" value={lowAttendance} helper="Students below 75% attendance who may need intervention." tone="amber" />
        <PrincipalMetricCard label="Outstanding Fees" value={formatCurrency(outstanding)} helper={`Low-average learners: ${lowAverage}.`} tone="rose" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PrincipalInfoCard
          title="Intervention watchlist"
          description="Students most likely to require leadership support based on attendance and performance signals."
        >
          <div className="grid gap-3">
            {interventionList.map((student) => (
              <div
                key={student.id}
                className="rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{student.fullName}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {student.className} · {student.attendanceRate}% attendance · {student.averageScore}% average
                </p>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Student body pulse"
          description="A leadership summary of attendance, academic risk, and financial exposure."
        >
          <PrincipalDataList
            items={[
              {
                label: "Low-attendance students",
                value: lowAttendance,
                detail: "Below the 75% attendance line.",
              },
              {
                label: "Low-average students",
                value: lowAverage,
                detail: "Scoring below 50% among available averages.",
              },
              {
                label: "Outstanding balance",
                value: formatCurrency(outstanding),
                detail: "Combined unpaid balance across visible student records.",
              },
            ]}
          />
        </PrincipalInfoCard>
      </section>

      <TableCard
        title="Student overview table"
        description="Academic, attendance, and finance visibility across the current student register."
        items={students}
        emptyState="No student records are available yet."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <Link href={`/students/${item.id}`} className="font-semibold text-[var(--color-text-primary)] underline decoration-[var(--color-accent-primary)] underline-offset-4">
                  {item.fullName}
                </Link>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.admissionNumber} · {item.className}</p>
              </div>
            ),
          },
          { key: "guardian", header: "Guardian", render: (item) => item.guardianName },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "attendance", header: "Attendance", render: (item) => `${item.attendanceRate}%` },
          { key: "average", header: "Average", render: (item) => `${item.averageScore}%` },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.outstandingBalance) },
        ]}
      />
    </div>
  );
}
