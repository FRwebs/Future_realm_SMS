import Link from "next/link";

import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { AssignSubjectTeacherDialog } from "@/components/subjects/assign-subject-teacher-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkSummaryView, SubjectView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type SubjectDetail = SubjectView & {
  classAssignments: Array<{
    id: string;
    classId: string;
    className: string;
    teacherId?: string | null;
    teacherName?: string | null;
    teacherEmail?: string | null;
    isActive: boolean;
    assignedAt: string;
  }>;
  teacherHistory: Array<{
    id: string;
    teacherId: string;
    classId: string;
    assignedAt: string;
    unassignedAt?: string | null;
    reason?: string | null;
  }>;
};

type TeacherOption = {
  id: string;
  name: string;
  email?: string | null;
  role?: string;
};

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-panel">
      <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
      <div className="p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ink/45">{label}</p>
        <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-ink">{value}</p>
        <p className="mt-2 text-sm leading-6 text-ink/60">{note}</p>
      </div>
    </article>
  );
}

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/subjects"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [subject, permissions, sows] = await Promise.all([
    apiGet<SubjectDetail>(`/api/v1/academics/subjects/${id}`),
    getServerPermissions(session),
    apiGet<SchemeOfWorkSummaryView[]>(`/api/v1/scheme-of-work?subjectId=${id}`).catch(() => []),
  ]);
  const canEdit = permissions.includes("subjects.edit");
  const canAssign = permissions.includes("subjects.assign");
  const teacherOptions = canAssign
    ? await apiGet<TeacherOption[]>("/api/v1/academics/subjects/teacher-options").catch(() => [])
    : [];
  const coverageAverage =
    sows.length === 0 ? 0 : Math.round(sows.reduce((sum, item) => sum + item.coveragePercent, 0) / sows.length);
  const assignedTeachers = subject.classAssignments.filter((item) => item.teacherId).length;
  const initializedSows = sows.length;
  const approvedSows = sows.filter((item) => item.status === "APPROVED").length;
  const classNameById = new Map(subject.classAssignments.map((item) => [item.classId, item.className]));
  const teacherNameById = new Map(
    subject.classAssignments
      .filter((item) => item.teacherId && item.teacherName)
      .map((item) => [item.teacherId as string, item.teacherName as string]),
  );

  const readinessItems = subject.classAssignments
    .map((item) => {
      const sow = sows.find((row) => row.classId === item.classId);
      const needsTeacher = !item.teacherId;
      const needsSow = !sow;
      const lowCoverage = (sow?.coveragePercent ?? 100) < 75;

      return {
        ...item,
        sow,
        needsTeacher,
        needsSow,
        lowCoverage,
      };
    })
    .filter((item) => item.needsTeacher || item.needsSow || item.lowCoverage);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="h-2 bg-gradient-to-r from-brand-800 via-emerald-500 to-ink" />
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(238,247,241,0.96),rgba(250,245,235,0.95))] p-6 md:p-8">
          <Link href="/subjects" className="text-sm font-semibold text-brand-700">
            Back to subjects
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
                {subject.departmentName ?? "General subjects"}
              </p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">{subject.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
                {subject.code} · {subject.section?.replaceAll("_", " ") ?? "All sections"} ·{" "}
                {subject.description ?? "No subject description yet."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/68">
                  {subject.classCount ?? subject.classAssignments.length} class assignments
                </span>
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/68">
                  {coverageAverage}% average SOW coverage
                </span>
                {subject.isCore ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Core subject
                  </span>
                ) : null}
                {subject.requiresLab ? (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                    Lab required
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {canAssign && subject.classAssignments.length > 0 ? (
                <AssignSubjectTeacherDialog
                  subjectId={id}
                  subjectName={subject.name}
                  assignments={subject.classAssignments}
                  teachers={teacherOptions}
                  triggerLabel="Assign teacher"
                  triggerVariant="secondary"
                />
              ) : null}
              {canEdit ? (
                <Link
                  href={`/subjects/${id}/edit`}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 bg-white px-5 text-sm font-semibold text-ink transition hover:bg-sand/70"
                >
                  Edit subject
                </Link>
              ) : null}
              <Link
                href={`/subjects/${id}/scheme-of-work`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                View scheme of work
              </Link>
            </div>
          </div>
        </div>
      </section>

      <DetailTabs
        tabs={[
          { label: "Summary", href: "#summary", active: true },
          { label: "Class coverage", href: "#class-coverage" },
          { label: "Teacher history", href: "#teacher-history" },
        ]}
      />

      <section id="summary" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes offering" value={subject.classAssignments.length} note="How many class streams currently take this subject." />
        <StatCard label="Teaching owners" value={assignedTeachers} note="Assignments with a named subject teacher already attached." />
        <StatCard label="SOWs initialized" value={initializedSows} note="Class-specific schemes of work already created for this term." />
        <StatCard label="Approved SOWs" value={approvedSows} note="Approved planning sheets already cleared for classroom use." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Teaching footprint</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">Operate from one subject cockpit</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              Jump directly into a class-specific scheme of work or teacher assignment without leaving the subject detail context.
            </p>
            <div className="mt-5 grid gap-3">
              {subject.classAssignments.slice(0, 4).map((item) => {
                const sow = sows.find((row) => row.classId === item.classId);
                return (
                  <article key={item.id} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{item.className}</p>
                        <p className="mt-1 text-xs text-ink/55">
                          {item.teacherName ?? "Teacher pending"} · {item.isActive ? "Active assignment" : "Inactive assignment"}
                        </p>
                      </div>
                      {sow ? <SchemeOfWorkStatusBadge status={sow.status} size="sm" /> : null}
                    </div>
                    <div className="mt-4">
                      <ActionMenu triggerLabel={`Actions for ${item.className}`}>
                        <ActionMenuLink href={`/subjects/${id}/scheme-of-work/${item.classId}`}>
                          Open class SOW
                        </ActionMenuLink>
                        {canAssign ? (
                          <AssignSubjectTeacherDialog
                            subjectId={id}
                            subjectName={subject.name}
                            assignments={subject.classAssignments}
                            teachers={teacherOptions}
                            initialClassId={item.classId}
                            triggerLabel={item.teacherId ? "Reassign teacher" : "Assign teacher"}
                            triggerVariant="menu"
                          />
                        ) : null}
                      </ActionMenu>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-amber via-brand-700 to-emerald-500" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Readiness snapshot</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">What needs attention next</h2>
            <div className="mt-5 grid gap-3">
              {readinessItems.length === 0 ? (
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  This subject is in a healthy state across classes right now.
                </div>
              ) : (
                readinessItems.map((item) => (
                  <article key={`${item.id}-attention`} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                    <p className="font-semibold text-ink">{item.className}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.needsTeacher ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          Teacher still needed
                        </span>
                      ) : null}
                      {item.needsSow ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          SOW not initialized
                        </span>
                      ) : null}
                      {!item.needsSow && item.lowCoverage ? (
                        <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                          {item.sow?.coveragePercent ?? 0}% coverage
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      <div id="class-coverage">
        <TableCard
          title="Class assignments"
          description="Active class mappings, teaching owners, and class-level scheme-of-work status for this subject."
          items={subject.classAssignments}
          emptyState="This subject has not been assigned to any class yet."
          columns={[
            {
              key: "class",
              header: "Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{item.className}</p>
                  <p className="text-xs text-ink/52">{item.isActive ? "Active assignment" : "Inactive assignment"}</p>
                </div>
              ),
            },
            {
              key: "teacher",
              header: "Teacher",
              render: (item) => (
                <div>
                  <p>{item.teacherName ?? "Teacher not assigned"}</p>
                  {item.teacherEmail ? <p className="text-xs text-ink/52">{item.teacherEmail}</p> : null}
                </div>
              ),
            },
            {
              key: "sow",
              header: "SOW",
              render: (item) => {
                const sow = sows.find((row) => row.classId === item.classId);
                return sow ? (
                  <div className="grid gap-2">
                    <SchemeOfWorkStatusBadge status={sow.status} size="sm" />
                    <p className="text-xs text-ink/52">
                      {sow.coveredWeeks}/{sow.teachingWeeks} teaching weeks · {sow.coveragePercent}%
                    </p>
                  </div>
                ) : (
                  <span className="text-sm text-ink/45">Not initialized</span>
                );
              },
            },
            {
              key: "actions",
              header: "Actions",
              render: (item) => (
                <ActionMenu triggerLabel={`Actions for ${item.className}`}>
                  <ActionMenuLink href={`/subjects/${id}/scheme-of-work/${item.classId}`}>
                    Open class SOW
                  </ActionMenuLink>
                  {canAssign ? (
                    <AssignSubjectTeacherDialog
                      subjectId={id}
                      subjectName={subject.name}
                      assignments={subject.classAssignments}
                      teachers={teacherOptions}
                      initialClassId={item.classId}
                      triggerLabel={item.teacherId ? "Reassign teacher" : "Assign teacher"}
                      triggerVariant="menu"
                    />
                  ) : null}
                </ActionMenu>
              ),
            },
          ]}
        />
      </div>

      <div id="teacher-history">
        <TableCard
          title="Teacher assignment history"
          description="A quick audit trail of who held the subject in each class and when the assignment changed."
          items={subject.teacherHistory}
          emptyState="No teacher history has been recorded for this subject yet."
          columns={[
            {
              key: "class",
              header: "Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{classNameById.get(item.classId) ?? item.classId}</p>
                  <p className="text-xs text-ink/52">{item.classId}</p>
                </div>
              ),
            },
            {
              key: "teacher",
              header: "Teacher",
              render: (item) => teacherNameById.get(item.teacherId) ?? item.teacherId,
            },
            {
              key: "assigned",
              header: "Assigned",
              render: (item) => formatDate(item.assignedAt),
            },
            {
              key: "unassigned",
              header: "Released",
              render: (item) => (item.unassignedAt ? formatDate(item.unassignedAt) : "Current owner"),
            },
            {
              key: "reason",
              header: "Reason",
              render: (item) => item.reason ?? "No reason recorded",
            },
          ]}
        />
      </div>
    </div>
  );
}
