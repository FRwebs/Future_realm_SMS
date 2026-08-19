import Link from "next/link";
import type { Route } from "next";

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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={`/portals/parent/children/${studentId}` as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to child overview</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Child attendance</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {attendance.chart.map((item) => (
            <article key={item.label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
              <p className="mt-2 text-[19px] font-bold text-[var(--color-text-primary)]">{item.value}</p>
            </article>
          ))}
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">Rate</p>
            <p className="mt-2 text-[19px] font-bold text-[var(--color-text-accent)]">{attendance.summary.attendanceRate}%</p>
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
