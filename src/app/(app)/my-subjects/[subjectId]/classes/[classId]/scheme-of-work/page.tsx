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
      <div className="portal-page">
        <section className="surface-hero p-6 md:p-7">
          <Link href={"/my-subjects" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to my subjects</Link>
          <p className="mt-4 section-eyebrow">Scheme of Work</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{subject.name}</h1>
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            No active scheme of work has been initialized yet for {classInfo.name} {classInfo.arm ?? ""}.
          </p>
        </section>

        <section className="surface-card border-dashed p-8 text-center">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Start the scheme shell</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Initialize the subject-class scheme first so weekly topics, progress tracking, and approval can begin.
          </p>
          <div className="mt-6 flex justify-center">
            {permissions.includes("sow.create") ? (
              <InitializeSchemeButton subjectId={subjectId} classId={classId} />
            ) : (
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">You do not have permission to initialize this scheme of work.</p>
            )}
          </div>
        </section>
      </div>
    );
  }

  const detail = await apiGet<SchemeOfWorkDetailView>(`/api/v1/scheme-of-work/${activeSow.id}`);

  return (
    <div className="portal-page">
      <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-[var(--color-text-accent)]">
        <Link href={"/my-subjects" as Route}>My Subjects</Link>
        <span>/</span>
        <span>{detail.subjectName}</span>
        <span>/</span>
        <span className="text-[var(--color-text-muted)]">{detail.className}</span>
      </div>
      <SchemeOfWorkDetailClient initialSow={detail} isAssignedTeacher={detail.teacherId === session.userId} />
    </div>
  );
}
