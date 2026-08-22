import Link from "next/link";
import { BookOpenCheck, ClipboardCheck, GraduationCap, UsersRound, type LucideIcon } from "lucide-react";

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
  icon: Icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-accent)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{note}</p>
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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/subjects" className="text-[13px] font-semibold text-[var(--color-text-accent)]">
          Back to subjects
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">
              {subject.departmentName ?? "General subjects"}
            </p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{subject.name}</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {subject.code} · {subject.section?.replaceAll("_", " ") ?? "All sections"} ·{" "}
              {subject.description ?? "No subject description yet."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {subject.classCount ?? subject.classAssignments.length} class assignments
              </span>
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {coverageAverage}% average SOW coverage
              </span>
              {subject.isCore ? (
                <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
                  Core subject
                </span>
              ) : null}
              {subject.requiresLab ? (
                <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-info-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-info)]">
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
              <Link href={`/subjects/${id}/edit`} className="btn-secondary px-5">
                Edit subject
              </Link>
            ) : null}
            <Link href={`/subjects/${id}/scheme-of-work`} className="btn-primary px-5">
              View scheme of work
            </Link>
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
        <StatCard label="Classes offering" value={subject.classAssignments.length} note="How many class streams currently take this subject." icon={GraduationCap} />
        <StatCard label="Teaching owners" value={assignedTeachers} note="Assignments with a named subject teacher already attached." icon={UsersRound} />
        <StatCard label="SOWs initialized" value={initializedSows} note="Class-specific schemes of work already created for this term." icon={BookOpenCheck} />
        <StatCard label="Approved SOWs" value={approvedSows} note="Approved planning sheets already cleared for classroom use." icon={ClipboardCheck} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card p-6">
          <p className="section-eyebrow">Teaching footprint</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Operate from one subject cockpit</h2>
          <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Jump directly into a class-specific scheme of work or teacher assignment without leaving the subject detail context.
          </p>
          <div className="mt-5 grid gap-3">
            {subject.classAssignments.slice(0, 4).map((item) => {
              const sow = sows.find((row) => row.classId === item.classId);
              return (
                <article key={item.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
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
        </section>

        <section className="surface-card p-6">
          <p className="section-eyebrow">Readiness snapshot</p>
          <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">What needs attention next</h2>
          <div className="mt-5 grid gap-3">
            {readinessItems.length === 0 ? (
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] p-4 text-sm font-semibold text-[var(--color-success)]">
                This subject is in a healthy state across classes right now.
              </div>
            ) : (
              readinessItems.map((item) => (
                <article key={`${item.id}-attention`} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.needsTeacher ? (
                      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-warning)]">
                        Teacher still needed
                      </span>
                    ) : null}
                    {item.needsSow ? (
                      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-danger-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-danger)]">
                        SOW not initialized
                      </span>
                    ) : null}
                    {!item.needsSow && item.lowCoverage ? (
                      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                        {item.sow?.coveragePercent ?? 0}% coverage
                      </span>
                    ) : null}
                  </div>
                </article>
              ))
            )}
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
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.className}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.isActive ? "Active assignment" : "Inactive assignment"}</p>
                </div>
              ),
            },
            {
              key: "teacher",
              header: "Teacher",
              render: (item) => (
                <div>
                  <p>{item.teacherName ?? "Teacher not assigned"}</p>
                  {item.teacherEmail ? <p className="text-xs text-[var(--color-text-muted)]">{item.teacherEmail}</p> : null}
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
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {sow.coveredWeeks}/{sow.teachingWeeks} teaching weeks · {sow.coveragePercent}%
                    </p>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--color-text-muted)]">Not initialized</span>
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
                  <p className="font-semibold text-[var(--color-text-primary)]">{classNameById.get(item.classId) ?? item.classId}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.classId}</p>
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
