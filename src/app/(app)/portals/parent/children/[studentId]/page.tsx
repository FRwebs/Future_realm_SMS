import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ParentChildPortalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ studentId: string }> };

export default async function ParentChildOverviewPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const child = await apiGet<ParentChildPortalView>(`/api/v1/parent-portal/children/${studentId}`);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent/children" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to children</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{child.studentName}</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {formatNigeriaClassName(child.className)} · {child.admissionNumber ?? "No admission number"}
        </p>
        {child.departmentTrack ? (
          <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-accent)]">Senior secondary track: {child.departmentTrack}</p>
        ) : null}
        <div className="mt-5">
          <ActionMenu triggerLabel={`Actions for ${child.studentName}`}>
            <ActionMenuLink href={`/portals/parent/children/${child.studentId}/attendance`}>Attendance</ActionMenuLink>
            <ActionMenuLink href={`/portals/parent/children/${child.studentId}/results`}>Results</ActionMenuLink>
            <ActionMenuLink href={`/portals/parent/children/${child.studentId}/fees`}>Fees</ActionMenuLink>
            <ActionMenuLink href={`/portals/parent/children/${child.studentId}/timetable`}>Timetable</ActionMenuLink>
            <ActionMenuLink href={`/my-children/${child.studentId}/subjects`}>Subjects & SOW</ActionMenuLink>
          </ActionMenu>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="surface-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attendance</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{formatPercentage(child.attendanceRate)}</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Average</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{child.averageScore.toFixed(1)}%</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Outstanding</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(child.outstandingBalance)}</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Next class</p>
          <p className="mt-2 text-[14px] font-semibold text-[var(--color-text-primary)]">{child.nextClass ? formatNigeriaClassName(child.nextClass) : "Not set"}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Subjects offered"
          description="Subjects currently assigned to this child's class."
          items={child.subjects ?? []}
          emptyState="No subject assignment is visible for this class yet."
          columns={[
            { key: "name", header: "Subject", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
            { key: "teacher", header: "Teacher", render: (item) => item.teacherName ?? "Not assigned" },
            { key: "track", header: "Track", render: (item) => item.track ?? item.departmentName ?? "General" }
          ]}
        />
        <TableCard
          title="Recent timetable"
          description="Class periods visible for this child."
          items={child.weeklyTimetable.slice(0, 5)}
          columns={[
            { key: "day", header: "Day", render: (item) => item.day },
            { key: "time", header: "Time", render: (item) => item.time },
            { key: "subject", header: "Subject", render: (item) => item.subject },
            { key: "venue", header: "Venue", render: (item) => item.venue }
          ]}
        />
        <TableCard
          title="Recent invoices"
          description="Balances and due dates for this child."
          items={child.finance.slice(0, 5)}
          columns={[
            { key: "title", header: "Invoice", render: (item) => item.title },
            { key: "balance", header: "Balance", render: (item) => formatCurrency(item.balance) },
            { key: "dueOn", header: "Due", render: (item) => formatDate(item.dueOn) },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
      </section>
    </div>
  );
}
