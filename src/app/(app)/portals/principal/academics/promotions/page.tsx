import { TableCard } from "@/components/data-display/table-card";
import { StatusBadge } from "@/components/data-display/status-badge";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalMetricCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { principalRecommendationForStudent, safeApiGet } from "@/lib/principal/portal";
import type { StudentRecordView } from "@/lib/domain/types";

export default async function PrincipalPromotionsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/academics/promotions"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const students = await safeApiGet<StudentRecordView[]>("/api/v1/students", []);
  const recommendations = students.map((student) => ({
    ...student,
    recommendation: principalRecommendationForStudent(student),
  }));
  const promote = recommendations.filter((item) => item.recommendation.decision === "PROMOTE").length;
  const review = recommendations.filter((item) => item.recommendation.decision === "REVIEW").length;
  const support = recommendations.filter((item) => item.recommendation.decision === "SUPPORT").length;

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Promotion review"
        title="Promotion readiness and intervention watchlist"
        description="A principal-first summary of who is clearly promotable, who needs review, and who needs intervention before any end-of-session execution."
        actions={<PrincipalQuickLink href="/students" label="Open students module" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <PrincipalMetricCard label="Promote" value={promote} helper="Students currently showing strong progression readiness." />
        <PrincipalMetricCard label="Review" value={review} helper="Borderline cases that should be discussed with teachers or class heads." tone="amber" />
        <PrincipalMetricCard label="Support" value={support} helper="Students needing intervention before a final promotion decision." tone="rose" />
      </section>

      <TableCard
        title="Promotion recommendation matrix"
        description="Derived from current score, attendance, and risk posture to support principal review."
        items={recommendations}
        emptyState="No student records are available yet."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.fullName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.admissionNumber} · {item.className}</p>
              </div>
            ),
          },
          { key: "attendance", header: "Attendance", render: (item) => `${item.attendanceRate}%` },
          { key: "average", header: "Average", render: (item) => `${item.averageScore}%` },
          { key: "balance", header: "Balance", render: (item) => item.outstandingBalance.toLocaleString() },
          { key: "decision", header: "Decision", render: (item) => <StatusBadge status={item.recommendation.decision} tone={item.recommendation.tone} /> },
          { key: "detail", header: "Leadership note", render: (item) => item.recommendation.detail },
        ]}
      />
    </div>
  );
}
