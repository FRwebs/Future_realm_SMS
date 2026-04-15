import { DetailPageHeader } from "@/components/data-display/detail-page-header";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
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
  if (!canAccessPath(session.role, "/teachers")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { teacherId } = await params;
  const teacher = await apiGet<TeacherProfileView>(`/api/v1/teachers/${teacherId}`);

  return (
    <div className="grid gap-6">
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
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Subjects</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{teacher.subjects.length}</p>
        </article>
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Class load</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{teacher.classAssignments.length}</p>
        </article>
        <article className="rounded-[1.75rem] bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Attendance today</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{teacher.attendanceStatusToday}</p>
        </article>
      </section>

      <section id="coverage" className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Profile</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Email:</span> {teacher.email}</p>
            <p><span className="font-semibold text-ink">Phone:</span> {teacher.phone ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Campus:</span> {teacher.campusName ?? "Not assigned"}</p>
            <p><span className="font-semibold text-ink">Employment date:</span> {formatDate(teacher.employmentDate)}</p>
            <p><span className="font-semibold text-ink">Emergency contact:</span> {teacher.emergencyContactName ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Contact phone:</span> {teacher.emergencyContactPhone ?? "Not recorded"}</p>
          </div>
        </article>
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Subject and class ownership</h2>
          <div className="mt-4 grid gap-4">
            <div className="rounded-[1.5rem] bg-sand/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">Subjects</p>
              <p className="mt-2 text-sm leading-6 text-ink/72">{teacher.subjects.join(", ") || "No subjects assigned"}</p>
            </div>
            <div className="rounded-[1.5rem] bg-sand/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">Classes</p>
              <p className="mt-2 text-sm leading-6 text-ink/72">{teacher.classAssignments.join(", ") || "No class assignments"}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Attendance history"
          description="Punctuality, coverage tracking, and escalation follow-up."
          items={teacher.attendanceHistory}
          emptyState="No staff attendance record has been captured for this teacher."
          columns={[
            { key: "date", header: "Date", render: (item) => formatDate(item.date) },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
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
            { key: "period", header: "Period", render: (item) => <div><p>{formatDate(item.startDate)}</p><p className="text-xs text-ink/55">to {formatDate(item.endDate)}</p></div> },
            { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
            { key: "reason", header: "Reason", render: (item) => item.reason }
          ]}
        />
      </section>

      <section id="activity" className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Operational watchpoints</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {teacher.operationalNotes.map((note) => (
            <article key={note} className="rounded-[1.5rem] bg-sand/60 p-5 text-sm leading-6 text-ink/72">{note}</article>
          ))}
        </div>
        <div className="mt-6 grid gap-3">
          {teacher.recentActivities.map((activity) => (
            <article key={activity.id} className="rounded-[1.5rem] border border-ink/8 bg-white p-5 text-sm leading-6 text-ink/72">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-ink">{activity.title}</p>
                  <p className="mt-1">{activity.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
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
