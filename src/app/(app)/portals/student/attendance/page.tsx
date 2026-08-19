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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/student" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My attendance</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">Daily attendance history and term summary.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {attendance.chart.map((item) => (
            <article key={item.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
              <p className="mt-2 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
            </article>
          ))}
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">Attendance rate</p>
            <p className="mt-2 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-accent)]">{attendance.summary.attendanceRate}%</p>
          </article>
        </div>
        {attendance.summary.lowAttendanceWarning ? (
          <p className="mt-5 rounded-[10px] px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}>
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
