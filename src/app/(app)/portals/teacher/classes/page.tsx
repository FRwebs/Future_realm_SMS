import Link from "next/link";
import { ArrowLeft, BookOpen, ClipboardCheck, FileText, GraduationCap, Users } from "lucide-react";

import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { TeacherClassPortalView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

type PortalPayload = {
  assignedClasses: TeacherClassPortalView[];
};

export default async function TeacherClassesPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/classes")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const portal = await apiGet<PortalPayload>("/api/v1/teacher-portal/dashboard");

  const classes = Array.from(
    new Map(
      portal.assignedClasses
        .filter((item) => item.classId && !item.subjectId)
        .map((item) => {
          const subjectItems = portal.assignedClasses.filter(
            (entry) => entry.classId === item.classId && entry.subjectId,
          );
          const subjectCount = new Set(subjectItems.filter((entry) => entry.subjectId).map((entry) => entry.subjectId)).size;
          const pendingScores = subjectItems.reduce((sum, entry) => sum + entry.pendingScores, 0);
          const nextAction =
            subjectItems.find((entry) => entry.nextAction)?.nextAction ??
            "Take daily class attendance";

          return [
            item.classId as string,
            {
              classId: item.classId as string,
              className: formatNigeriaClassName(item.className),
              totalLearners: item.learners,
              subjectCount,
              pendingScores,
              nextAction,
              subjects: subjectItems.map((entry) => entry.subject),
            },
          ];
        }),
    ).values(),
  );

  const uniqueSubjectCount = new Set(
    portal.assignedClasses.filter((item) => item.subjectId).map((item) => item.subjectId),
  ).size;
  const totalPendingScores = portal.assignedClasses
    .filter((item) => item.subjectId)
    .reduce((sum, item) => sum + item.pendingScores, 0);
  const totalLearners = classes.reduce((sum, item) => sum + item.totalLearners, 0);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/teacher" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)]">
          <ArrowLeft className="h-4 w-4" />
          Back to teacher portal
        </Link>
        <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Teaching load</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My classes</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              This page is for form or class leadership. Track your assigned class arms, take the daily register, and stay close to the subjects and follow-up work linked to each class.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Classes</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{classes.length}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-success-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">Subjects</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{uniqueSubjectCount}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Learners</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{totalLearners}</p>
            </article>
            <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">Pending scores</p>
              <p className="mt-2 text-[22px] font-black text-[var(--color-text-primary)]">{totalPendingScores}</p>
            </article>
          </div>
        </div>
      </section>

      {classes.length === 0 ? (
        <section className="surface-card border-dashed p-10 text-center">
          <Users className="mx-auto h-12 w-12 text-[var(--color-text-accent)]" />
          <h2 className="mt-4 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">
            No form class assigned yet
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            This page only shows classes where you are the form or class teacher. If you mainly
            teach subjects, use Lesson Notes and Scheme of Work to manage your planning lanes and
            curriculum flow.
          </p>
          <div className="mt-5">
            <Link href="/portals/teacher/content/lesson-notes/planning" className="btn-secondary px-5">
              <BookOpen className="h-4 w-4" />
              Open lesson notes
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {classes.map((classItem) => (
          <article
            key={classItem.classId}
            className="surface-card flex h-full flex-col p-5 transition hover:border-[var(--color-border-strong)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Assigned class</p>
                <h2 className="mt-2 text-[18px] font-bold text-[var(--color-text-primary)]">{classItem.className}</h2>
                <p className="mt-2 text-[12.5px] text-[var(--color-text-secondary)]">{classItem.subjectCount} subject{classItem.subjectCount === 1 ? "" : "s"} linked to this class.</p>
              </div>

              <ActionMenu triggerLabel={`Quick actions for ${classItem.className}`}>
                <ActionMenuLink href={`/portals/teacher/attendance?classId=${classItem.classId}`}>
                  <span className="inline-flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Mark attendance
                  </span>
                </ActionMenuLink>
                <ActionMenuLink href={`/portals/teacher/gradebook?classId=${classItem.classId}`}>
                  <span className="inline-flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Open gradebook
                  </span>
                </ActionMenuLink>
                <ActionMenuLink href={`/portals/teacher/assignments?classId=${classItem.classId}`}>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Class assignments
                  </span>
                </ActionMenuLink>
              </ActionMenu>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Learners</p>
                <p className="mt-2 text-[18px] font-black text-[var(--color-text-primary)]">{classItem.totalLearners}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Subjects</p>
                <p className="mt-2 text-[18px] font-black text-[var(--color-text-primary)]">{classItem.subjectCount}</p>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-dim)] px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-warning)]">Pending</p>
                <p className="mt-2 text-[18px] font-black text-[var(--color-text-primary)]">{classItem.pendingScores}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--color-text-muted)]" />
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Teaching subjects in this class</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {classItem.subjects.length ? (
                  classItem.subjects.map((subject) => (
                    <span key={`${classItem.classId}-${subject}`} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)]">
                      {subject}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">Class register only</span>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-accent)]">Next action</p>
              <p className="mt-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{classItem.nextAction}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
