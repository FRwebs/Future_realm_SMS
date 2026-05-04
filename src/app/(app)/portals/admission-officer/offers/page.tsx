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
import { getAdmissionOffers } from "@/lib/admissions/portal";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AdmissionApplicationView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdmissionOfficerOffersPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer/offers"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const applications = await apiGet<AdmissionApplicationView[]>("/api/v1/admissions");
  const offers = getAdmissionOffers(applications);
  const pendingOfferGeneration = applications.filter((application) =>
    ["APPROVED", "CONDITIONALLY_APPROVED"].includes(application.status),
  );

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Offer desk"
        title="Offer letters and responses"
        description="Watch which applications are ready for offers, which offers are awaiting guardian action, and which accepted candidates are ready for the enrollment handoff."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Open applications"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/ready-to-enroll"
              label="Enrollment queue"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AdmissionInfoCard
          title="Ready to issue"
          description="Approved applications that can move into offer generation."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {pendingOfferGeneration.length}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Awaiting guardian response"
          description="Offers that have gone out but still need acceptance or decline."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {offers.filter((application) => application.offerStatus === "SENT").length}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Accepted"
          description="Offers already accepted and ready for the next operational handoff."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {offers.filter((application) => application.status === "ACCEPTED").length}
          </p>
        </AdmissionInfoCard>
      </section>

      <TableCard
        title="Offer tracker"
        description="Offer visibility across draft-ready, sent, accepted, declined, and expired states."
        items={offers}
        primaryColumnKey="applicant"
        featuredColumnKeys={["offerStatus"]}
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "applicant",
            header: "Applicant",
            render: (item) => (
              <div>
                <Link
                  href={`/portals/admission-officer/applications?applicationId=${item.id}`}
                  className="font-semibold text-[var(--color-text-primary)] underline decoration-[var(--color-accent-primary-dim)] underline-offset-4"
                >
                  {item.studentName}
                </Link>
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
            key: "workflowStatus",
            header: "Workflow",
            render: (item) => <AdmissionStatusPill status={item.status} />,
          },
          {
            key: "offerStatus",
            header: "Offer status",
            render: (item) =>
              item.offerStatus ? (
                <AdmissionStatusPill status={item.offerStatus} />
              ) : (
                "Ready to generate"
              ),
          },
          {
            key: "deadline",
            header: "Deadline",
            render: (item) =>
              item.offerExpiresAt ? formatDate(item.offerExpiresAt) : "Not issued",
          },
        ]}
      />

      {pendingOfferGeneration.length > 0 ? (
        <AdmissionInfoCard
          title="Offer candidates"
          description="These approved applications are the cleanest next set for offer generation."
        >
          <div className="grid gap-3">
            {pendingOfferGeneration.slice(0, 8).map((application) => (
              <Link
                key={application.id}
                href={`/portals/admission-officer/applications?applicationId=${application.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {application.studentName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {formatNigeriaClassName(application.desiredClass)} · {application.guardianName}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-accent)]">
                  Open
                </span>
              </Link>
            ))}
          </div>
        </AdmissionInfoCard>
      ) : null}
    </div>
  );
}
