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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={`/classes/${classId}`} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to class</Link>
        <p className="mt-4 section-eyebrow">Class scheme of work</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
          {classInfo.name} {classInfo.arm ?? ""}
        </h1>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
                <p className="font-semibold text-[var(--color-text-primary)]">{subject.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{subject.code ?? "No code"}{subject.teacherName ? ` · ${subject.teacherName}` : ""}</p>
              </div>
            )
          },
          {
            key: "sow",
            header: "Status",
            render: (subject) => {
              const sow = sows.find((item) => item.subjectId === subject.id);
              return sow ? <SchemeOfWorkStatusBadge status={sow.status} size="sm" /> : <span className="text-sm text-[var(--color-text-muted)]">Not initialized</span>;
            }
          },
          {
            key: "coverage",
            header: "Coverage",
            render: (subject) => {
              const sow = sows.find((item) => item.subjectId === subject.id);
              return sow ? (
                <p className="text-sm text-[var(--color-text-secondary)]">{sow.coveredWeeks}/{sow.teachingWeeks} teaching weeks · {sow.coveragePercent}%</p>
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">No coverage yet</span>
              );
            }
          },
          {
            key: "actions",
            header: "Actions",
            render: (subject) => {
              const sow = sows.find((item) => item.subjectId === subject.id);
              return sow ? (
                <Link href={`/subjects/${subject.id}/scheme-of-work/${classId}`} className="text-sm font-semibold text-[var(--color-text-accent)] hover:opacity-80">
                  Open SOW
                </Link>
              ) : canInitialize ? (
                <InitializeSchemeButton subjectId={subject.id} classId={classId} label="Initialize" />
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">No action</span>
              );
            }
          }
        ]}
      />
    </div>
  );
}
