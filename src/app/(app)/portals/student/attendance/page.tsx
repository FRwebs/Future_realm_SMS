import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalAttendanceView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function StudentAttendancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const attendance = await apiGet<StudentPortalAttendanceView>("/api/v1/student-portal/attendance");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My attendance</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">Daily attendance history and term summary.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {attendance.chart.map((item) => (
            <article key={item.label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{item.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{item.value}</p>
            </article>
          ))}
          <article className="rounded-[1.5rem] bg-ink p-5 text-white">
            <p className="text-sm text-white/65">Attendance rate</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold">{attendance.summary.attendanceRate}%</p>
          </article>
        </div>
        {attendance.summary.lowAttendanceWarning ? (
          <p className="mt-5 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-800">
            {attendance.summary.lowAttendanceWarning}
          </p>
        ) : null}
      </section>

      <TableCard
        title="Attendance records"
        description="Most recent marked records for your account."
        items={attendance.records}
        columns={[
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "subject", header: "Subject", render: (item) => item.subject ?? "Daily attendance" },
          { key: "reason", header: "Reason", render: (item) => item.reason ?? "-" }
        ]}
      />
    </div>
  );
}
