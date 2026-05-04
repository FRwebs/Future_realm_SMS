import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import {
  AdmissionInfoCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
  AdmissionStatusPill,
} from "@/components/portals/admission-officer-ui";
import { apiGet } from "@/lib/api/server";
import {
  getAdmissionAgeInDays,
  hasAdmissionDocumentAttention,
} from "@/lib/admissions/portal";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AdmissionApplicationView } from "@/lib/domain/types";
import {
  formatNigeriaClassName,
  getNigeriaClassLabel,
  nigerianClassOptions,
  normalizeNigeriaClassValue,
} from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type ApplicationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    className?: string;
    applicationId?: string;
  }>;
};

export default async function AdmissionOfficerApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const session = await getServerSession();
  if (!session) return null;

  if (
    !(await canAccessServerPath(
      session,
      "/portals/admission-officer/applications",
    ))
  ) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const applications = await apiGet<AdmissionApplicationView[]>(
    "/api/v1/admissions",
  );
  const params = searchParams ? await searchParams : undefined;
  const q = params?.q?.trim().toLowerCase() ?? "";
  const selectedClass = normalizeNigeriaClassValue(params?.className) ?? "";
  const filtered = applications.filter((application) => {
    const matchesStatus = !params?.status || application.status === params.status;
    const matchesClass =
      !selectedClass ||
      normalizeNigeriaClassValue(application.desiredClass) === selectedClass;
    const matchesSearch =
      !q ||
      [
        application.applicationNo,
        application.studentName,
        application.guardianName,
        application.guardianPhone,
        application.guardianEmail,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));

    return matchesStatus && matchesClass && matchesSearch;
  });
  const selectedApplication =
    filtered.find((application) => application.id === params?.applicationId) ??
    filtered[0] ??
    null;

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Applications workspace"
        title="All applications"
        description="Triage submitted applications, focus on document and screening blockers, and move each applicant through review with less back-and-forth."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/pipeline"
              label="Open pipeline"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/screenings"
              label="Screening desk"
            />
          </>
        }
      />

      <FilterToolbar
        action="/portals/admission-officer/applications"
        title="Filter applications"
        description="Search by applicant, application number, guardian, stage, or applied class."
        activeSummary={[
          params?.status ? `Status: ${params.status}` : "",
          selectedClass ? `Class: ${getNigeriaClassLabel(selectedClass)}` : "",
          params?.q ? `Search: ${params.q}` : "",
        ].filter(Boolean)}
        controls={[
          {
            name: "q",
            label: "Search",
            type: "search",
            placeholder: "Applicant, app number, guardian",
            defaultValue: params?.q,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            defaultValue: params?.status ?? "",
            options: [
              { label: "All statuses", value: "" },
              ...Array.from(new Set(applications.map((item) => item.status))).map(
                (status) => ({ label: status.replaceAll("_", " "), value: status }),
              ),
            ],
          },
          {
            name: "className",
            label: "Class",
            type: "select",
            defaultValue: selectedClass,
            options: nigerianClassOptions,
          },
        ]}
      />

      <TableCard
        title="Admissions queue"
        description="Open an application to review biodata, supporting records, and next workflow actions."
        items={filtered}
        primaryColumnKey="applicant"
        featuredColumnKeys={["status"]}
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "applicant",
            header: "Applicant",
            render: (item) => (
              <div>
                <Link
                  href={{
                    pathname: "/portals/admission-officer/applications",
                    query: { ...params, applicationId: item.id },
                  }}
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
            key: "className",
            header: "Class",
            render: (item) => formatNigeriaClassName(item.desiredClass),
          },
          {
            key: "guardian",
            header: "Guardian",
            render: (item) => (
              <div>
                <p>{item.guardianName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {item.guardianPhone}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <AdmissionStatusPill status={item.status} />,
          },
          {
            key: "attention",
            header: "Attention",
            render: (item) =>
              hasAdmissionDocumentAttention(item)
                ? "Docs pending"
                : item.latestScreening
                  ? "Screening active"
                  : "On track",
          },
          {
            key: "age",
            header: "Days in queue",
            render: (item) => `${getAdmissionAgeInDays(item)}d`,
          },
        ]}
      />

      {selectedApplication ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <AdmissionInfoCard
            title="Selected application"
            description="Applicant record, guardian context, and workflow status at a glance."
          >
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-[var(--font-display)] text-[28px] font-black tracking-tight text-[var(--color-text-primary)]">
                    {selectedApplication.studentName}
                  </p>
                  <p className="mt-1 font-[var(--font-mono)] text-sm text-[var(--color-text-secondary)]">
                    {selectedApplication.applicationNo}
                  </p>
                </div>
                <AdmissionStatusPill status={selectedApplication.status} />
              </div>

              <dl className="grid gap-3 md:grid-cols-2">
                {[
                  ["Class applied", formatNigeriaClassName(selectedApplication.desiredClass)],
                  ["Submitted", formatDate(selectedApplication.submittedAt)],
                  ["Guardian", selectedApplication.guardianName],
                  ["Guardian phone", selectedApplication.guardianPhone],
                  ["Guardian email", selectedApplication.guardianEmail ?? "Not recorded"],
                  ["Previous school", selectedApplication.previousSchool ?? "Not recorded"],
                  ["Payment", selectedApplication.applicationFeeStatus ?? "PENDING"],
                  [
                    "Registration",
                    selectedApplication.registeredAdmissionNumber ?? "Not enrolled",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-[var(--color-bg-subtle)] px-4 py-3"
                  >
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Workflow notes
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {selectedApplication.decisionNotes ??
                    selectedApplication.reviewNotes ??
                    "No workflow note recorded yet."}
                </p>
              </div>

              {selectedApplication.offerStatus ? (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/api/v1/admissions/${selectedApplication.id}/offer-letter`}
                    className="btn-secondary min-h-[44px] px-4"
                  >
                    Preview offer letter
                  </Link>
                  <Link
                    href="/portals/admission-officer/offers"
                    className="btn-ghost min-h-[44px] px-4"
                  >
                    Open offers desk
                  </Link>
                </div>
              ) : null}
            </div>
          </AdmissionInfoCard>

          <AdmissionInfoCard
            title="Workflow actions"
            description="Move the applicant through the current admissions workflow without leaving the portal."
          >
            <div className="grid gap-3">
              {["SUBMITTED", "INCOMPLETE", "AWAITING_DOCUMENTS"].includes(
                selectedApplication.status,
              ) ? (
                <ResourceActionDialog
                  triggerLabel="Review application"
                  title="Review application"
                  description="Confirm biodata, class fit, and readiness for the next admissions step."
                  endpoint={`/api/v1/admissions/${selectedApplication.id}/review`}
                  submitLabel="Save review"
                  presentation="drawer"
                  fields={[
                    {
                      name: "notes",
                      label: "Review notes",
                      type: "textarea",
                      required: true,
                    },
                    {
                      name: "recommendedClass",
                      label: "Recommended class",
                      type: "select",
                      options: nigerianClassOptions.slice(1),
                    },
                  ]}
                />
              ) : null}

              {["SUBMITTED", "REVIEWING", "INCOMPLETE"].includes(
                selectedApplication.status,
              ) ? (
                <ResourceActionDialog
                  triggerLabel="Request documents"
                  title="Request documents"
                  description="Flag missing or unacceptable submission items and notify the guardian."
                  endpoint={`/api/v1/admissions/${selectedApplication.id}/request-documents`}
                  submitLabel="Send request"
                  presentation="drawer"
                  variant="secondary"
                  fields={[
                    {
                      name: "missingDocuments",
                      label: "Missing documents",
                      required: true,
                    },
                    {
                      name: "note",
                      label: "Request note",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                />
              ) : null}

              {["REVIEWING", "PAYMENT_PENDING"].includes(
                selectedApplication.status,
              ) ? (
                <ResourceActionDialog
                  triggerLabel="Schedule screening"
                  title="Schedule screening"
                  description="Capture screening date, venue, and interviewer details for this applicant."
                  endpoint={`/api/v1/admissions/${selectedApplication.id}/schedule-screening`}
                  submitLabel="Schedule screening"
                  presentation="drawer"
                  fields={[
                    {
                      name: "scheduledAt",
                      label: "Screening date/time",
                      required: true,
                      placeholder: "2026-05-12T09:00",
                    },
                    { name: "venue", label: "Venue" },
                    { name: "interviewerId", label: "Interviewer user ID" },
                    { name: "note", label: "Officer note", type: "textarea" },
                  ]}
                />
              ) : null}

              {selectedApplication.status === "SCREENING_SCHEDULED" ? (
                <ResourceActionDialog
                  triggerLabel="Record screening result"
                  title="Record screening result"
                  description="Save score, remarks, and recommendation after the screening sits."
                  endpoint={`/api/v1/admissions/${selectedApplication.id}/screening-result`}
                  submitLabel="Save result"
                  presentation="drawer"
                  fields={[
                    { name: "score", label: "Score", type: "number", required: true },
                    { name: "maxScore", label: "Max score", type: "number", defaultValue: 100 },
                    {
                      name: "result",
                      label: "Result",
                      type: "select",
                      defaultValue: "PASS",
                      options: [
                        { label: "Pass", value: "PASS" },
                        { label: "Fail", value: "FAIL" },
                        { label: "Borderline", value: "BORDERLINE" },
                      ],
                    },
                    { name: "recommendation", label: "Recommendation", required: true },
                    {
                      name: "remarks",
                      label: "Remarks",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                />
              ) : null}

              {["SCREENING_COMPLETED", "REVIEWING"].includes(
                selectedApplication.status,
              ) ? (
                <ResourceActionDialog
                  triggerLabel="Recommend for decision"
                  title="Recommend application"
                  description="Move the applicant into the final decision queue."
                  endpoint={`/api/v1/admissions/${selectedApplication.id}/recommend`}
                  submitLabel="Recommend applicant"
                  variant="secondary"
                  fields={[
                    { name: "notes", label: "Recommendation note", type: "textarea", required: true },
                  ]}
                />
              ) : null}

              {["APPROVED", "CONDITIONALLY_APPROVED"].includes(
                selectedApplication.status,
              ) ? (
                <ResourceActionDialog
                  triggerLabel="Issue offer"
                  title="Issue offer"
                  description="Generate an offer with conditions and guardian checklist."
                  endpoint={`/api/v1/admissions/${selectedApplication.id}/issue-offer`}
                  submitLabel="Issue offer"
                  presentation="drawer"
                  fields={[
                    { name: "conditions", label: "Conditions", type: "textarea" },
                    { name: "checklist", label: "Checklist items" },
                    { name: "expiryDays", label: "Expiry in days", type: "number", defaultValue: 14 },
                  ]}
                />
              ) : null}

              {selectedApplication.status === "ACCEPTED" ? (
                <Link
                  href="/portals/admission-officer/ready-to-enroll"
                  className="btn-primary min-h-[44px] px-4"
                >
                  Continue to enrollment queue
                </Link>
              ) : null}

              {selectedApplication.timeline?.length ? (
                <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Recent timeline
                  </p>
                  <div className="mt-3 grid gap-3">
                    {selectedApplication.timeline.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-[var(--color-bg-surface)] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {item.toStatus.replaceAll("_", " ")}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {item.note ?? "Status updated."}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </AdmissionInfoCard>
        </section>
      ) : null}
    </div>
  );
}
