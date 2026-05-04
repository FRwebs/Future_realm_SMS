import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import {
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
  AdmissionStatusPill,
} from "@/components/portals/admission-officer-ui";
import { apiGet } from "@/lib/api/server";
import {
  getAdmissionPipeline,
  getAdmissionAgeInDays,
  hasAdmissionDocumentAttention,
} from "@/lib/admissions/portal";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AdmissionApplicationView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdmissionOfficerPipelinePage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer/pipeline"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const applications = await apiGet<AdmissionApplicationView[]>("/api/v1/admissions");
  const columns = getAdmissionPipeline(applications);

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Pipeline board"
        title="Admissions pipeline"
        description="Track each applicant by workflow stage, quickly spot bottlenecks, and move into the right action workspace when a column starts to clog."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Applications list"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/offers"
              label="Offer desk"
            />
          </>
        }
      />

      <section className="surface-card p-5">
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
          This board reflects the live admissions state machine already enforced by the backend. Stages that need notes,
          dates, or approvals stay action-driven so the portal remains accurate instead of allowing unsafe drag-and-drop shortcuts.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {columns.map((column) => (
          <section
            key={column.id}
            className="surface-card flex min-h-[420px] flex-col p-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] pb-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {column.label}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {column.applications.length} application{column.applications.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 font-[var(--font-mono)] text-xs font-semibold text-[var(--color-text-accent)]">
                {column.applications.length}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {column.applications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                  No applications in this stage right now.
                </div>
              ) : (
                column.applications.slice(0, 12).map((application) => (
                  <Link
                    key={application.id}
                    href={`/portals/admission-officer/applications?applicationId=${application.id}`}
                    className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {application.studentName}
                        </p>
                        <p className="mt-1 font-[var(--font-mono)] text-xs text-[var(--color-text-secondary)]">
                          {application.applicationNo}
                        </p>
                      </div>
                      <AdmissionStatusPill status={application.status} />
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-[var(--color-text-secondary)]">
                      <p>{formatNigeriaClassName(application.desiredClass)}</p>
                      <p>Submitted {formatDate(application.submittedAt)}</p>
                      <p>{getAdmissionAgeInDays(application)} days in queue</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {hasAdmissionDocumentAttention(application) ? (
                        <span className="rounded-full bg-[var(--color-warning-dim)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-warning)]">
                          Documents pending
                        </span>
                      ) : null}
                      {application.latestScreening ? (
                        <span className="rounded-full bg-[var(--color-info-dim)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-info)]">
                          Screening {application.latestScreening.completedAt ? "completed" : "scheduled"}
                        </span>
                      ) : null}
                      {application.offerStatus ? (
                        <span className="rounded-full bg-[var(--color-success-dim)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-success)]">
                          Offer {application.offerStatus.toLowerCase()}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
