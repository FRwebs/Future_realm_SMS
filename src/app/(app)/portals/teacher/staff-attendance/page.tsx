import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { StaffClockView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export default async function TeacherStaffAttendancePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/staff-attendance")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const records = await apiGet<StaffClockView[]>("/api/v1/nigeria-operations/staff-attendance");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/teacher" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to teacher portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My Clock-In / Clock-Out</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Self-service teacher attendance for Nigerian school resumption and closing-time records.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <ResourceForm
          title="Clock in"
          description="Capture today's teacher resumption record. Lateness is calculated from the school policy."
          endpoint="/api/v1/nigeria-operations/staff-attendance/clock-in"
          submitLabel="Clock in"
          fields={[]}
        />
        <ResourceForm
          title="Clock out"
          description="Capture today's closing record after your teaching day."
          endpoint="/api/v1/nigeria-operations/staff-attendance/clock-out"
          submitLabel="Clock out"
          fields={[]}
        />
      </section>

      <TableCard
        title="My attendance history"
        description="Your recent staff attendance records."
        items={records}
        columns={[
          { key: "date", header: "Date", render: (item) => formatDate(item.date) },
          { key: "status", header: "Status", render: (item) => item.status.replaceAll("_", " ") },
          { key: "in", header: "Clock in", render: (item) => (item.checkInAt ? formatDate(item.checkInAt) : "-") },
          { key: "out", header: "Clock out", render: (item) => (item.checkOutAt ? formatDate(item.checkOutAt) : "-") },
          { key: "hours", header: "Hours", render: (item) => (item.totalMinutes ? (item.totalMinutes / 60).toFixed(1) : "-") }
        ]}
        emptyState="No teacher attendance record has been captured yet."
      />
    </div>
  );
}
