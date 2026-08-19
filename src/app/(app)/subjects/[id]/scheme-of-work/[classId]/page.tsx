import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { InitializeSchemeButton } from "@/components/scheme-of-work/initialize-button";
import { SchemeOfWorkDetailClient } from "@/components/scheme-of-work/scheme-of-work-detail-client";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkDetailView, SchemeOfWorkSummaryView, SubjectView } from "@/lib/domain/types";

type ClassDetail = {
  id: string;
  name: string;
  arm?: string | null;
  classLevelName?: string | null;
};

export default async function ClassSchemeOfWorkPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const { id, classId } = await params;
  const session = await getServerSession();
  if (!session) return null;

  const allowed =
    (await canAccessServerPath(session, "/subjects")) ||
    (await canAccessServerPath(session, "/classes")) ||
    (await canAccessServerPath(session, "/my-subjects"));
  if (!allowed) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [subject, permissions, sowSummaries, classInfo] = await Promise.all([
    apiGet<SubjectView>(`/api/v1/academics/subjects/${id}`),
    getServerPermissions(session),
    apiGet<SchemeOfWorkSummaryView[]>(`/api/v1/scheme-of-work?subjectId=${id}&classId=${classId}`).catch(() => []),
    apiGet<ClassDetail>(`/api/v1/classes/${classId}`).catch(() => ({ id: classId, name: "Class", arm: null })),
  ]);

  const activeSow = sowSummaries[0];
  const canInitialize = permissions.includes("sow.create");

  if (!activeSow) {
    return (
      <div className="portal-page">
        <section className="surface-hero p-6 md:p-7">
          <Link href={`/subjects/${id}/scheme-of-work`} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to subject schemes</Link>
          <p className="mt-4 section-eyebrow">Scheme of work</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{subject.name}</h1>
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            No scheme of work has been initialized for {classInfo.name} {classInfo.arm ?? ""} yet.
          </p>
        </section>

        <section className="surface-card border-dashed p-8 text-center">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Nothing here yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Start by creating the subject-class scheme shell, then your teachers can fill weekly topics, mark coverage, and submit it for review.
          </p>
          <div className="mt-6 flex justify-center">
            {canInitialize ? (
              <InitializeSchemeButton subjectId={id} classId={classId} />
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
        <Link href="/subjects">Subjects</Link>
        <span>/</span>
        <Link href={`/subjects/${id}`}>{subject.name}</Link>
        <span>/</span>
        <Link href={`/subjects/${id}/scheme-of-work`}>Scheme of Work</Link>
        <span>/</span>
        <span className="text-[var(--color-text-muted)]">{detail.className}</span>
      </div>
      <SchemeOfWorkDetailClient initialSow={detail} isAssignedTeacher={detail.teacherId === session.userId} />
    </div>
  );
}
