import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import {
  AdmissionInfoCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
  AdmissionStatusPill,
} from "@/components/portals/admission-officer-ui";
import { apiGet } from "@/lib/api/server";
import {
  getAdmissionScreeningDesk,
  getAdmissionScreeningStatus,
} from "@/lib/admissions/portal";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AdmissionApplicationView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdmissionOfficerScreeningsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer/screenings"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const applications = await apiGet<AdmissionApplicationView[]>("/api/v1/admissions");
  const queue = getAdmissionScreeningDesk(applications);
  const scheduledToday = queue.filter(
    (application) =>
      application.latestScreening &&
      new Date(application.latestScreening.scheduledAt).toDateString() ===
        new Date().toDateString(),
  ).length;

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Screening desk"
        title="Screening and interview queue"
        description="Work the current screening schedule, record outcomes, and keep shortlisted applicants from stalling between review and offer."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Review applicants"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/offers"
              label="Offer desk"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AdmissionInfoCard
          title="Scheduled today"
          description="Applications with a screening slot landing today."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {scheduledToday}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Awaiting score entry"
          description="Scheduled screenings not yet marked complete."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {
              queue.filter(
                (application) =>
                  application.latestScreening &&
                  !application.latestScreening.completedAt,
              ).length
            }
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Ready for recommendation"
          description="Completed screenings that should move into the final decision flow."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {
              queue.filter((application) => application.status === "SCREENING_COMPLETED")
                .length
            }
          </p>
        </AdmissionInfoCard>
      </section>

      <TableCard
        title="Active screening queue"
        description="Every application with screening activity, ordered by the nearest scheduled slot."
        items={queue}
        primaryColumnKey="applicant"
        featuredColumnKeys={["status"]}
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "applicant",
            header: "Applicant",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {item.studentName}
                </p>
                <p className="font-[var(--font-mono)] text-xs text-[var(--color-text-secondary)]">
                  {item.applicationNo}
                </p>
              </div>
            ),
          },
          {
            key: "class",
            header: "Class",
            render: (item) => formatNigeriaClassName(item.desiredClass),
          },
          {
            key: "schedule",
            header: "Schedule",
            render: (item) =>
              item.latestScreening
                ? `${formatDate(item.latestScreening.scheduledAt)}${item.latestScreening.venue ? ` · ${item.latestScreening.venue}` : ""}`
                : "Not scheduled",
          },
          {
            key: "screeningStatus",
            header: "Screening",
            render: (item) => getAdmissionScreeningStatus(item),
          },
          {
            key: "status",
            header: "Workflow",
            render: (item) => <AdmissionStatusPill status={item.status} />,
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/portals/admission-officer/applications"
              className="btn-secondary min-h-[44px] px-4"
            >
              Schedule from applications
            </Link>
          </div>
        }
      />
    </div>
  );
}
