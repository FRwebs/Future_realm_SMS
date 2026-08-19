import { DetailPageHeader } from "@/components/data-display/detail-page-header";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { TeacherProfileView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type PageProps = { params: Promise<{ teacherId: string }> };

function formatTime(value?: string) {
  if (!value) return "Not marked";
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function TeacherDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/teachers"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { teacherId } = await params;
  const teacher = await apiGet<TeacherProfileView>(`/api/v1/teachers/${teacherId}`);

  return (
    <div className="portal-page">
      <DetailPageHeader
        eyebrow="Teacher profile"
        title={teacher.fullName}
        backHref="/teachers"
        backLabel="Back to teachers"
        description={`${teacher.designation} · ${teacher.employeeNo} · ${teacher.departmentName ?? "No department"}`}
        badges={[teacher.attendanceStatusToday, teacher.leaveStatus, `${teacher.pendingResults} pending result item(s)`]}
      />

      <DetailTabs
        tabs={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Coverage", href: "#coverage" },
          { label: "Attendance", href: "#attendance" },
          { label: "Leave", href: "#leave" },
          { label: "Activity", href: "#activity" }
        ]}
      />

      <section id="overview" className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Subjects</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{teacher.subjects.length}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Class load</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{teacher.classAssignments.length}</p>
        </article>
        <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Attendance today</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{teacher.attendanceStatusToday}</p>
        </article>
      </section>

      <section id="coverage" className="grid gap-5 xl:grid-cols-2">
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Profile</h2>
          <div className="mt-4 grid gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Email:</span> {teacher.email}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Phone:</span> {teacher.phone ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Campus:</span> {teacher.campusName ?? "Not assigned"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Employment date:</span> {formatDate(teacher.employmentDate)}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Emergency contact:</span> {teacher.emergencyContactName ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Contact phone:</span> {teacher.emergencyContactPhone ?? "Not recorded"}</p>
          </div>
        </article>
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Subject and class ownership</h2>
          <div className="mt-4 grid gap-4">
            <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Subjects</p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{teacher.subjects.join(", ") || "No subjects assigned"}</p>
            </div>
            <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Classes</p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{teacher.classAssignments.join(", ") || "No class assignments"}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <TableCard
          title="Attendance history"
          description="Punctuality, coverage tracking, and escalation follow-up."
          items={teacher.attendanceHistory}
          emptyState="No staff attendance record has been captured for this teacher."
          columns={[
            { key: "date", header: "Date", render: (item) => formatDate(item.date) },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
            { key: "checkInAt", header: "Check in", render: (item) => formatTime(item.checkInAt) },
            { key: "notes", header: "Notes", render: (item) => item.notes ?? "No note" }
          ]}
        />
        <TableCard
          title="Leave requests"
          description="Substitution planning and approval follow-through."
          items={teacher.leaveRequests}
          emptyState="No leave request is linked to this teacher."
          columns={[
            { key: "type", header: "Type", render: (item) => item.type },
            { key: "period", header: "Period", render: (item) => <div><p>{formatDate(item.startDate)}</p><p className="text-xs text-[var(--color-text-muted)]">to {formatDate(item.endDate)}</p></div> },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
            { key: "reason", header: "Reason", render: (item) => item.reason }
          ]}
        />
      </section>

      <section id="activity" className="surface-card p-6">
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Operational watchpoints</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {teacher.operationalNotes.map((note) => (
            <article key={note} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">{note}</article>
          ))}
        </div>
        <div className="mt-6 grid gap-3">
          {teacher.recentActivities.map((activity) => (
            <article key={activity.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{activity.title}</p>
                  <p className="mt-1">{activity.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">
                  {activity.type.replace("_", " ")}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
