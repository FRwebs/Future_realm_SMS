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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/parent" className="text-sm font-semibold text-brand-700">Back to parent portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My children</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">All students linked to your guardian account.</p>
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
                <a href={`/portals/parent/children/${item.studentId}`} className="font-semibold text-ink underline decoration-ink/20 underline-offset-4">
                  {item.studentName}
                </a>
                <p className="text-xs text-ink/55">{item.admissionNumber ?? item.studentId}</p>
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
