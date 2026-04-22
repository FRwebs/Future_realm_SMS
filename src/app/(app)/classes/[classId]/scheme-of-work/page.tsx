import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TableCard } from "@/components/data-display/table-card";
import { InitializeSchemeButton } from "@/components/scheme-of-work/initialize-button";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkSummaryView } from "@/lib/domain/types";

type ClassDetail = {
  id: string;
  name: string;
  arm?: string | null;
  classLevelName?: string | null;
};

type ClassSubjectRow = {
  id: string;
  subjectId: string;
  name: string;
  code?: string;
  teacherName?: string | null;
};

export default async function ClassSchemeOverviewPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/classes"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [classInfo, permissions, sows, subjects] = await Promise.all([
    apiGet<ClassDetail>(`/api/v1/classes/${classId}`),
    getServerPermissions(session),
    apiGet<SchemeOfWorkSummaryView[]>(`/api/v1/scheme-of-work?classId=${classId}`).catch(() => []),
    apiGet<ClassSubjectRow[]>(`/api/v1/timetable/${classId}/subjects`).catch(() => []),
  ]);
  const canInitialize = permissions.includes("sow.create");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={`/classes/${classId}`} className="text-sm font-semibold text-brand-700">Back to class</Link>
        <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Class scheme of work</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">
          {classInfo.name} {classInfo.arm ?? ""}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
          Review every subject scheme mapped to this class and jump straight into the week-by-week plan.
        </p>
      </section>

      <TableCard
        title="Subject schemes"
        description="Each class subject can have one active scheme of work per term."
        items={subjects}
        emptyState="No subject list is available for this class yet."
        columns={[
          {
            key: "subject",
            header: "Subject",
            render: (subject) => (
              <div>
                <p className="font-semibold text-ink">{subject.name}</p>
                <p className="text-xs text-ink/52">{subject.code ?? "No code"}{subject.teacherName ? ` · ${subject.teacherName}` : ""}</p>
              </div>
            )
          },
          {
            key: "sow",
            header: "Status",
            render: (subject) => {
              const sow = sows.find((item) => item.subjectId === subject.id);
              return sow ? <SchemeOfWorkStatusBadge status={sow.status} size="sm" /> : <span className="text-sm text-ink/45">Not initialized</span>;
            }
          },
          {
            key: "coverage",
            header: "Coverage",
            render: (subject) => {
              const sow = sows.find((item) => item.subjectId === subject.id);
              return sow ? (
                <p className="text-sm text-ink/65">{sow.coveredWeeks}/{sow.teachingWeeks} teaching weeks · {sow.coveragePercent}%</p>
              ) : (
                <span className="text-sm text-ink/45">No coverage yet</span>
              );
            }
          },
          {
            key: "actions",
            header: "Actions",
            render: (subject) => {
              const sow = sows.find((item) => item.subjectId === subject.id);
              return sow ? (
                <Link href={`/subjects/${subject.id}/scheme-of-work/${classId}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                  Open SOW
                </Link>
              ) : canInitialize ? (
                <InitializeSchemeButton subjectId={subject.id} classId={classId} label="Initialize" />
              ) : (
                <span className="text-sm text-ink/45">No action</span>
              );
            }
          }
        ]}
      />
    </div>
  );
}
