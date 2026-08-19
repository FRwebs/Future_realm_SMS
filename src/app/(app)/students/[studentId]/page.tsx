import { DetailPageHeader } from "@/components/data-display/detail-page-header";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole, hasRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { StudentProfileView } from "@/lib/domain/types";
import { formatNigeriaClassName, nigerianClassFieldOptions } from "@/lib/school-options";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ studentId: string }> };

export default async function StudentDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/students"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { studentId } = await params;
  const profile = await apiGet<StudentProfileView>(`/api/v1/students/${studentId}`);
  const canManageStudents = canManagePath(session.role, "/students");
  const canLogBehavior = hasRole(session.role, ["SUPER_ADMIN", "SCHOOL_OWNER", "PRINCIPAL", "ADMIN_OFFICER", "TEACHER"]);

  return (
    <div className="portal-page">
      <DetailPageHeader
        eyebrow="Student profile"
        title={profile.fullName}
        backHref="/students"
        backLabel="Back to students"
        description={`${profile.admissionNumber} · ${formatNigeriaClassName(profile.className)} · ${profile.status}`}
        badges={profile.riskFlags.length ? profile.riskFlags : ["Stable profile"]}
        actions={
          <>
            {canLogBehavior ? (
              <ResourceActionDialog
                triggerLabel="Add welfare note"
                title="Behavior and welfare log"
                description="Document discipline, merit, pastoral care, or intervention notes for this learner."
                endpoint={`/api/v1/students/${profile.id}/behavior-logs`}
                submitLabel="Save note"
                confirmLabel="Confirm Note"
                confirmMessage="Confirm that this note should be added to the student history."
                variant="secondary"
                fields={[
                  { name: "category", label: "Category", required: true, placeholder: "Attendance follow-up" },
                  {
                    name: "severity",
                    label: "Severity",
                    type: "select",
                    options: [
                      { label: "Low", value: "LOW" },
                      { label: "Medium", value: "MEDIUM" },
                      { label: "High", value: "HIGH" }
                    ]
                  },
                  { name: "description", label: "Description", type: "textarea", required: true }
                ]}
              />
            ) : null}
            {canManageStudents ? (
              <ResourceActionDialog
                triggerLabel="Record promotion"
                title="Promotion and transition"
                description="Record class movement, progression decisions, and session roll-over outcomes."
                endpoint={`/api/v1/students/${profile.id}/promotions`}
                submitLabel="Save promotion"
                confirmLabel="Confirm Promotion"
                confirmMessage="Confirm the target class and promotion decision before saving."
                fields={[
                  { name: "toClassName", label: "To class", type: "select", required: true, options: nigerianClassFieldOptions },
                  { name: "toSessionName", label: "Target session", placeholder: "2026/2027" },
                  { name: "decision", label: "Decision note", type: "textarea", required: true }
                ]}
              />
            ) : null}
          </>
        }
      />

      <DetailTabs
        tabs={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Welfare", href: "#welfare" },
          { label: "Promotion", href: "#promotion" },
          { label: "Documents", href: "#documents" }
        ]}
      />

      <section id="overview" className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attendance</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{formatPercentage(profile.attendanceRate)}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Average score</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{profile.averageScore.toFixed(1)}%</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Outstanding balance</p>
          <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(profile.outstandingBalance)}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Biodata and guardian</h2>
          <div className="mt-4 grid gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Guardian:</span> {profile.guardianName}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Phone:</span> {profile.guardianPhone}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Email:</span> {profile.guardianEmail ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Gender:</span> {profile.gender}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Date of birth:</span> {formatDate(profile.dateOfBirth)}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Admission date:</span> {formatDate(profile.admissionDate)}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">State of origin:</span> {profile.stateOfOrigin ?? "Not recorded"}</p>
          </div>
        </article>
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Medical readiness</h2>
          <div className="mt-4 grid gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Blood group:</span> {profile.medical.bloodGroup ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Genotype:</span> {profile.medical.genotype ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Allergies:</span> {profile.medical.allergies ?? "None recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Conditions:</span> {profile.medical.conditions ?? "None recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Notes:</span> {profile.medical.notes ?? "No special note"}</p>
          </div>
        </article>
      </section>

      <section id="welfare" className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Behavior timeline"
          description="Operational notes for discipline, merit, welfare, and intervention follow-up."
          items={profile.behaviorLogs}
          emptyState="No welfare or behavior notes have been recorded."
          columns={[
            { key: "category", header: "Category", render: (item) => item.category },
            { key: "description", header: "Description", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.description}</p><p className="text-xs text-[var(--color-text-muted)]">{formatDate(item.loggedAt)}</p></div> },
            { key: "severity", header: "Severity", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.severity}</span> }
          ]}
        />
        <TableCard
          title="Promotion history"
          description="Class movement, graduation checks, and academic transition decisions."
          items={profile.promotions}
          emptyState="No promotion records have been captured."
          columns={[
            { key: "decision", header: "Decision", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.decision}</p><p className="text-xs text-[var(--color-text-muted)]">{formatDate(item.promotedAt)}</p></div> },
            { key: "fromClassName", header: "From", render: (item) => item.fromClassName ? formatNigeriaClassName(item.fromClassName) : "N/A" },
            { key: "toClassName", header: "To", render: (item) => item.toClassName ? formatNigeriaClassName(item.toClassName) : "N/A" }
          ]}
        />
      </section>

      <section id="documents">
        <TableCard
          title="Document vault"
          description="Key student records required for admissions conversion, compliance, and school operations."
          items={profile.documents}
          emptyState="No student documents have been uploaded yet."
          columns={[
            { key: "label", header: "Document", render: (item) => item.label },
            { key: "fileName", header: "File", render: (item) => item.fileName },
            { key: "createdAt", header: "Uploaded", render: (item) => formatDate(item.createdAt) }
          ]}
        />
      </section>
    </div>
  );
}
