import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendCard } from "@/components/dashboard/trend-card";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { DashboardSummary, StudentRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

export default async function AnalyticsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/analytics"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [overview, students] = await Promise.all([
    apiGet<DashboardSummary>("/api/v1/dashboard/overview"),
    apiGet<StudentRecordView[]>("/api/v1/students")
  ]);

  const riskStudents = students
    .filter((student) => student.attendanceRate < 90 || student.outstandingBalance > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <TrendCard
          title="Admissions funnel"
          description="Pipeline view from submission through approval and waitlisting."
          items={overview.admissionsByStage.map((item) => ({
            label: item.stage,
            value: item.count
          }))}
        />
        <TrendCard
          title="Student risk flags"
          description="High-priority students based on attendance and outstanding finance exposure."
          items={riskStudents.slice(0, 5).map((student) => ({
            label: student.fullName,
            value: Math.max(student.outstandingBalance / 1000, 1),
            suffix: "k"
          }))}
        />
      </section>
      <TableCard
        title="Risk register"
        description="Students needing follow-up due to low attendance or unpaid balances."
        items={riskStudents}
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.fullName}</p>
                <p className="text-xs text-ink/55">{formatNigeriaClassName(item.className)}</p>
              </div>
            )
          },
          { key: "attendance", header: "Attendance", render: (item) => formatPercentage(item.attendanceRate) },
          { key: "average", header: "Average", render: (item) => `${item.averageScore.toFixed(1)}%` },
          { key: "balance", header: "Outstanding", render: (item) => formatCurrency(item.outstandingBalance) }
        ]}
      />
    </div>
  );
}
