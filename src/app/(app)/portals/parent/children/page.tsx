import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ParentChildPortalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

export default async function ParentChildrenPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const children = await apiGet<ParentChildPortalView[]>("/api/v1/parent-portal/children");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to parent portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My children</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">All students linked to your guardian account.</p>
      </section>

      <TableCard
        title="Linked children"
        description="Open a child profile before viewing child-specific records."
        items={children}
        columns={[
          {
            key: "studentName",
            header: "Student",
            render: (item) => (
              <div>
                <Link href={`/portals/parent/children/${item.studentId}` as Route} className="font-semibold text-[var(--color-text-accent)] underline decoration-[var(--color-border-strong)] underline-offset-4">
                  {item.studentName}
                </Link>
                <p className="text-xs text-[var(--color-text-muted)]">{item.admissionNumber ?? item.studentId}</p>
              </div>
            )
          },
          { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "attendanceRate", header: "Attendance", render: (item) => formatPercentage(item.attendanceRate) },
          { key: "averageScore", header: "Average", render: (item) => `${item.averageScore.toFixed(1)}%` },
          { key: "balance", header: "Balance", render: (item) => formatCurrency(item.outstandingBalance) }
        ]}
      />
    </div>
  );
}
