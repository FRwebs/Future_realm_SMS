import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalAttendanceView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ studentId: string }> };

export default async function ParentChildAttendancePage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const attendance = await apiGet<StudentPortalAttendanceView>(`/api/v1/parent-portal/children/${studentId}/attendance`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href={`/portals/parent/children/${studentId}`} className="text-sm font-semibold text-brand-700">Back to child overview</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Child attendance</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {attendance.chart.map((item) => (
            <article key={item.label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{item.label}</p>
              <p className="mt-3 text-3xl font-bold text-ink">{item.value}</p>
            </article>
          ))}
          <article className="rounded-[1.5rem] bg-ink p-5 text-white">
            <p className="text-sm text-white/65">Rate</p>
            <p className="mt-3 text-3xl font-bold">{attendance.summary.attendanceRate}%</p>
          </article>
        </div>
      </section>
      <TableCard
        title="Daily records"
        description="Absence, lateness, and present records for this child."
        items={attendance.records}
        columns={[
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "-" }
        ]}
      />
    </div>
  );
}
