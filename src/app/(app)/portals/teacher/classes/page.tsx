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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/teacher" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
          <ArrowLeft className="h-4 w-4" />
          Back to teacher portal
        </Link>
        <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Teaching load</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black text-ink">My classes</h1>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              This page is for form or class leadership. Track your assigned class arms, take the daily register, and stay close to the subjects and follow-up work linked to each class.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <article className="rounded-[1.5rem] border border-primary-100 bg-primary-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">Classes</p>
              <p className="mt-2 text-3xl font-black text-ink">{classes.length}</p>
            </article>
            <article className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Subjects</p>
              <p className="mt-2 text-3xl font-black text-ink">{uniqueSubjectCount}</p>
            </article>
            <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Learners</p>
              <p className="mt-2 text-3xl font-black text-ink">{totalLearners}</p>
            </article>
            <article className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Pending scores</p>
              <p className="mt-2 text-3xl font-black text-ink">{totalPendingScores}</p>
            </article>
          </div>
        </div>
      </section>

      {classes.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-slate-200 bg-white/92 p-10 text-center shadow-panel">
          <Users className="mx-auto h-12 w-12 text-brand-500" />
          <h2 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-ink">
            No form class assigned yet
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink/62">
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
            className="flex h-full flex-col rounded-[1.85rem] border border-white/65 bg-white/95 p-5 shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_20px_44px_rgba(18,33,23,0.10)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">Assigned class</p>
                <h2 className="mt-2 text-xl font-bold text-ink">{classItem.className}</h2>
                <p className="mt-2 text-sm text-ink/58">{classItem.subjectCount} subject{classItem.subjectCount === 1 ? "" : "s"} linked to this class.</p>
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
              <div className="rounded-[1.2rem] border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Learners</p>
                <p className="mt-2 text-2xl font-black text-ink">{classItem.totalLearners}</p>
              </div>
              <div className="rounded-[1.2rem] border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Subjects</p>
                <p className="mt-2 text-2xl font-black text-ink">{classItem.subjectCount}</p>
              </div>
              <div className="rounded-[1.2rem] border border-amber-100 bg-amber-50/70 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Pending</p>
                <p className="mt-2 text-2xl font-black text-ink">{classItem.pendingScores}</p>
              </div>
            </div>

              <div className="mt-5 rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-semibold text-ink">Teaching subjects in this class</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {classItem.subjects.length ? (
                  classItem.subjects.map((subject) => (
                    <span key={`${classItem.classId}-${subject}`} className="rounded-full border border-white bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                      {subject}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Class register only</span>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-primary-100 bg-primary-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">Next action</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{classItem.nextAction}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
