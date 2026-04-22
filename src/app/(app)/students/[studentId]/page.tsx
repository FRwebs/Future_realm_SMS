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
    <div className="grid gap-6">
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
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Attendance</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{formatPercentage(profile.attendanceRate)}</p>
        </article>
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Average score</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{profile.averageScore.toFixed(1)}%</p>
        </article>
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Outstanding balance</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{formatCurrency(profile.outstandingBalance)}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Biodata and guardian</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Guardian:</span> {profile.guardianName}</p>
            <p><span className="font-semibold text-ink">Phone:</span> {profile.guardianPhone}</p>
            <p><span className="font-semibold text-ink">Email:</span> {profile.guardianEmail ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Gender:</span> {profile.gender}</p>
            <p><span className="font-semibold text-ink">Date of birth:</span> {formatDate(profile.dateOfBirth)}</p>
            <p><span className="font-semibold text-ink">Admission date:</span> {formatDate(profile.admissionDate)}</p>
            <p><span className="font-semibold text-ink">State of origin:</span> {profile.stateOfOrigin ?? "Not recorded"}</p>
          </div>
        </article>
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Medical readiness</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Blood group:</span> {profile.medical.bloodGroup ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Genotype:</span> {profile.medical.genotype ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Allergies:</span> {profile.medical.allergies ?? "None recorded"}</p>
            <p><span className="font-semibold text-ink">Conditions:</span> {profile.medical.conditions ?? "None recorded"}</p>
            <p><span className="font-semibold text-ink">Notes:</span> {profile.medical.notes ?? "No special note"}</p>
          </div>
        </article>
      </section>

      <section id="welfare" className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Behavior timeline"
          description="Operational notes for discipline, merit, welfare, and intervention follow-up."
          items={profile.behaviorLogs}
          emptyState="No welfare or behavior notes have been recorded."
          columns={[
            { key: "category", header: "Category", render: (item) => item.category },
            { key: "description", header: "Description", render: (item) => <div><p className="font-semibold text-ink">{item.description}</p><p className="text-xs text-ink/55">{formatDate(item.loggedAt)}</p></div> },
            { key: "severity", header: "Severity", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.severity}</span> }
          ]}
        />
        <TableCard
          title="Promotion history"
          description="Class movement, graduation checks, and academic transition decisions."
          items={profile.promotions}
          emptyState="No promotion records have been captured."
          columns={[
            { key: "decision", header: "Decision", render: (item) => <div><p className="font-semibold text-ink">{item.decision}</p><p className="text-xs text-ink/55">{formatDate(item.promotedAt)}</p></div> },
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
