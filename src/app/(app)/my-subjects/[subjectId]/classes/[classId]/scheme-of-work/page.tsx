import Link from "next/link";
import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { InitializeSchemeButton } from "@/components/scheme-of-work/initialize-button";
import { SchemeOfWorkDetailClient } from "@/components/scheme-of-work/scheme-of-work-detail-client";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkDetailView, SchemeOfWorkSummaryView, SubjectView } from "@/lib/domain/types";

type PageProps = {
  params: Promise<{ subjectId: string; classId: string }>;
};

type ClassDetail = {
  id: string;
  name: string;
  arm?: string | null;
};

export default async function TeacherSchemeOfWorkPage({ params }: PageProps) {
  const { subjectId, classId } = await params;
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/my-subjects"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [subject, permissions, summaries, classInfo] = await Promise.all([
    apiGet<SubjectView>(`/api/v1/academics/subjects/${subjectId}`),
    getServerPermissions(session),
    apiGet<SchemeOfWorkSummaryView[]>(`/api/v1/scheme-of-work?subjectId=${subjectId}&classId=${classId}`).catch(() => []),
    apiGet<ClassDetail>(`/api/v1/classes/${classId}`).catch(() => ({ id: classId, name: "Class", arm: null })),
  ]);

  const activeSow = summaries[0];
  if (!activeSow) {
    return (
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
          <Link href={"/my-subjects" as Route} className="text-sm font-semibold text-brand-700">Back to my subjects</Link>
          <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Scheme of Work</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">{subject.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
            No active scheme of work has been initialized yet for {classInfo.name} {classInfo.arm ?? ""}.
          </p>
        </section>

        <section className="rounded-[2rem] border border-dashed border-ink/15 bg-white/85 p-8 text-center shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Start the scheme shell</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink/62">
            Initialize the subject-class scheme first so weekly topics, progress tracking, and approval can begin.
          </p>
          <div className="mt-6 flex justify-center">
            {permissions.includes("sow.create") ? (
              <InitializeSchemeButton subjectId={subjectId} classId={classId} />
            ) : (
              <p className="text-sm font-semibold text-ink/55">You do not have permission to initialize this scheme of work.</p>
            )}
          </div>
        </section>
      </div>
    );
  }

  const detail = await apiGet<SchemeOfWorkDetailView>(`/api/v1/scheme-of-work/${activeSow.id}`);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-brand-700">
        <Link href={"/my-subjects" as Route}>My Subjects</Link>
        <span>/</span>
        <span>{detail.subjectName}</span>
        <span>/</span>
        <span className="text-ink/55">{detail.className}</span>
      </div>
      <SchemeOfWorkDetailClient initialSow={detail} isAssignedTeacher={detail.teacherId === session.userId} />
    </div>
  );
}
