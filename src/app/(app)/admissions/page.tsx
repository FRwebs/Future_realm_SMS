import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AdmissionApplicationView, AdmissionMetricsView, AdmissionStatus, Role } from "@/lib/domain/types";
import {
  formatNigeriaClassName,
  getNigeriaClassLabel,
  nigerianClassFieldOptions,
  nigerianClassOptions,
  normalizeNigeriaClassValue
} from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type AdmissionsPageProps = {
  searchParams?: Promise<{
    applicationId?: string;
    status?: string;
    className?: string;
    payment?: string;
    q?: string;
  }>;
};

function canRunAdmissionStep(role: Role, allowed: Role[]) {
  return role === "SUPER_ADMIN" || role === "SCHOOL_OWNER" || allowed.includes(role);
}

function hasFeeClearance(application: AdmissionApplicationView) {
  return (
    application.feeWaived ||
    application.applicationFeeStatus === "VERIFIED" ||
    application.applicationFeeStatus === "WAIVED" ||
    application.applicationFeeStatus === "NOT_REQUIRED"
  );
}

function statusPill(status: AdmissionStatus) {
  const tone =
    status === "REJECTED" || status === "DECLINED"
      ? "bg-rose-100 text-rose-800"
      : status === "AWAITING_DOCUMENTS" || status === "INCOMPLETE" || status === "PAYMENT_PENDING"
        ? "bg-amber-100 text-amber-800"
        : status === "ENROLLED" || status === "ACTIVE" || status === "FINANCIALLY_CLEARED"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-brand-100 text-brand-800";

  return `rounded-full px-3 py-1 text-xs font-semibold ${tone}`;
}

export default async function AdmissionsPage({ searchParams }: AdmissionsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/admissions")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [admissions, metrics] = await Promise.all([
    apiGet<AdmissionApplicationView[]>("/api/v1/admissions"),
    apiGet<AdmissionMetricsView>("/api/v1/admissions/metrics")
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedApplication =
    admissions.find((item) => item.id === resolvedSearchParams?.applicationId) ?? null;
  const q = resolvedSearchParams?.q?.toLowerCase().trim();
  const selectedClass = normalizeNigeriaClassValue(resolvedSearchParams?.className) ?? "";
  const selectedClassLabel = selectedClass ? getNigeriaClassLabel(selectedClass) : "";
  const filteredAdmissions = admissions.filter((item) => {
    const matchesStatus = !resolvedSearchParams?.status || item.status === resolvedSearchParams.status;
    const matchesClass = !selectedClass || normalizeNigeriaClassValue(item.desiredClass) === selectedClass;
    const matchesPayment = !resolvedSearchParams?.payment || item.applicationFeeStatus === resolvedSearchParams.payment;
    const matchesSearch =
      !q ||
      [item.applicationNo, item.studentName, item.guardianName, item.guardianPhone, item.guardianEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    return matchesStatus && matchesClass && matchesPayment && matchesSearch;
  });

  const canHandleIntake = canRunAdmissionStep(session.role, ["ADMISSIONS_OFFICER", "PARENT"]);
  const canReview = canRunAdmissionStep(session.role, ["ADMISSIONS_OFFICER"]);
  const canApprove = canRunAdmissionStep(session.role, ["PRINCIPAL", "ADMIN_OFFICER"]);
  const canRegister = canRunAdmissionStep(session.role, ["ADMIN_OFFICER"]);
  const canVerifyFinance = canRunAdmissionStep(session.role, ["ACCOUNTANT", "ADMIN_OFFICER"]);
  const canScreen = canRunAdmissionStep(session.role, ["TEACHER", "ADMISSIONS_OFFICER"]);
  const canIssueOffer = canRunAdmissionStep(session.role, ["ADMIN_OFFICER", "ADMISSIONS_OFFICER"]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Admissions management</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">
              O-Level admissions workflow
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-ink/68">
              Intake, document checks, screening, principal decision, offer issuance, acceptance, bursary clearance,
              and enrollment conversion are now handled as explicit role-gated steps.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admissions/settings" className="rounded-full bg-sand px-4 py-2 text-sm font-semibold text-ink">
              Settings
            </Link>
            <Link href="/admissions/reports" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Reports
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Applications</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.totalApplications}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Pending approval</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.pendingApprovals}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Conversion</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.conversionRate}%</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Avg screening</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{metrics.screeningAverage}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          {canHandleIntake ? (
            <ResourceActionDialog
              triggerLabel="New application"
              title="New application"
              description="Admissions Officer or parent/applicant can save a draft or submit a manual/walk-in application."
              endpoint="/api/v1/admissions"
              submitLabel="Save application"
              confirmLabel="Confirm Application"
              confirmMessage="Confirm the applicant biodata, desired class, and guardian information before saving."
              fields={[
                { name: "firstName", label: "First name", required: true, placeholder: "Samuel" },
                { name: "lastName", label: "Last name", required: true, placeholder: "Balogun" },
                { name: "middleName", label: "Middle name", placeholder: "Adebayo" },
                {
                  name: "gender",
                  label: "Gender",
                  type: "select",
                  options: [
                    { label: "Male", value: "MALE" },
                    { label: "Female", value: "FEMALE" },
                    { label: "Other", value: "OTHER" }
                  ]
                },
                { name: "dateOfBirth", label: "Date of birth", type: "date" },
                { name: "desiredClass", label: "Class applying for", type: "select", required: true, options: nigerianClassFieldOptions },
                { name: "guardianName", label: "Guardian name", required: true, placeholder: "Kemi Balogun" },
                { name: "guardianPhone", label: "Guardian phone", required: true, placeholder: "08034567890" },
                { name: "guardianEmail", label: "Guardian email", type: "email", placeholder: "parent@example.com" },
                { name: "emergencyContactName", label: "Emergency contact", placeholder: "Aunty Funmi" },
                { name: "emergencyContactPhone", label: "Emergency phone", placeholder: "08030000000" },
                { name: "previousSchool", label: "Previous school", placeholder: "Cedar Basic School" },
                { name: "address", label: "Address", type: "textarea", placeholder: "Residential address" },
                { name: "medicalNotes", label: "Medical notes", type: "textarea", placeholder: "Allergies, medication, or Nil" },
                {
                  name: "draft",
                  label: "Save mode",
                  type: "select",
                  options: [
                    { label: "Submit for review", value: "false" },
                    { label: "Save as draft", value: "true" }
                  ]
                }
              ]}
            />
          ) : null}
        </div>
        <FilterToolbar
          action="/admissions"
          title="Filter admissions pipeline"
          description="Filter by stage, class, payment status, or applicant/guardian search."
          activeSummary={[
            resolvedSearchParams?.status ? `Status: ${resolvedSearchParams.status}` : "",
            selectedClassLabel ? `Class: ${selectedClassLabel}` : "",
            resolvedSearchParams?.payment ? `Payment: ${resolvedSearchParams.payment}` : "",
            resolvedSearchParams?.q ? `Search: ${resolvedSearchParams.q}` : ""
          ].filter(Boolean)}
          controls={[
            { name: "q", label: "Search", type: "search", placeholder: "Name, application no, guardian phone", defaultValue: resolvedSearchParams?.q },
            { name: "status", label: "Status", type: "select", defaultValue: resolvedSearchParams?.status ?? "", options: [{ label: "All statuses", value: "" }, ...metrics.byStatus.map((item) => ({ label: item.status, value: item.status }))] },
            { name: "className", label: "Class", type: "select", defaultValue: selectedClass, options: nigerianClassOptions },
            {
              name: "payment",
              label: "Payment",
              type: "select",
              defaultValue: resolvedSearchParams?.payment ?? "",
              options: [
                { label: "All payment states", value: "" },
                { label: "Pending", value: "PENDING" },
                { label: "Verified", value: "VERIFIED" },
                { label: "Waived", value: "WAIVED" },
                { label: "Not required", value: "NOT_REQUIRED" }
              ]
            }
          ]}
        />
      </section>

      <TableCard
        title="Applications list"
        description="Select an applicant before taking action. Workflow panels below are shown according to role and stage."
        items={filteredAdmissions}
        columns={[
          {
            key: "application",
            header: "Application",
            render: (item) => (
              <div>
                <Link
                  href={{ pathname: "/admissions", query: { ...resolvedSearchParams, applicationId: item.id } }}
                  className="font-semibold text-ink underline decoration-brand-300 underline-offset-4"
                >
                  {item.applicationNo}
                </Link>
                {item.duplicateFlag ? <p className="text-xs text-amber-700">Possible duplicate</p> : null}
              </div>
            )
          },
          {
            key: "applicant",
            header: "Applicant",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.studentName}</p>
                <p className="text-xs text-ink/55">{formatNigeriaClassName(item.desiredClass)}</p>
              </div>
            )
          },
          {
            key: "guardian",
            header: "Guardian",
            render: (item) => (
              <div>
                <p>{item.guardianName}</p>
                <p className="text-xs text-ink/55">{item.guardianPhone}</p>
              </div>
            )
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <span className={statusPill(item.status)}>{item.status}</span>
          },
          {
            key: "payment",
            header: "Payment",
            render: (item) => item.feeWaived ? "WAIVED" : item.applicationFeeStatus ?? "PENDING"
          }
        ]}
      />

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Application detail</p>
        {selectedApplication ? (
          <div className="mt-4 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[1.5rem] bg-sand/60 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
                    {selectedApplication.studentName}
                  </h2>
                  <p className="mt-2 text-sm text-ink/68">{selectedApplication.applicationNo} · {formatNigeriaClassName(selectedApplication.desiredClass)}</p>
                </div>
                <span className={statusPill(selectedApplication.status)}>{selectedApplication.status}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-ink/72">
                <p><span className="font-semibold text-ink">Guardian:</span> {selectedApplication.guardianName}</p>
                <p><span className="font-semibold text-ink">Phone:</span> {selectedApplication.guardianPhone}</p>
                <p><span className="font-semibold text-ink">Email:</span> {selectedApplication.guardianEmail ?? "Not recorded"}</p>
                <p><span className="font-semibold text-ink">Previous school:</span> {selectedApplication.previousSchool ?? "Not recorded"}</p>
                <p><span className="font-semibold text-ink">Medical:</span> {selectedApplication.medicalNotes ?? "No note"}</p>
                <p><span className="font-semibold text-ink">Payment:</span> {selectedApplication.applicationFeeStatus ?? "PENDING"}</p>
                <p><span className="font-semibold text-ink">Registration:</span> {selectedApplication.registeredAdmissionNumber ?? "Not enrolled"}</p>
              </div>
              {selectedApplication.offerStatus ? (
                <Link
                  href={`/api/v1/admissions/${selectedApplication.id}/offer-letter`}
                  className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  Preview offer letter
                </Link>
              ) : null}
            </article>
            <article className="rounded-[1.5rem] bg-sand/60 p-5">
              <h3 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Timeline and notes</h3>
              <div className="mt-4 grid gap-3">
                {(selectedApplication.timeline ?? []).slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white p-4 text-sm text-ink/72">
                    <p className="font-semibold text-ink">{item.toStatus}</p>
                    <p className="mt-1">{item.note ?? "Status changed"}</p>
                    <p className="mt-1 text-xs text-ink/50">{formatDate(item.createdAt)}</p>
                  </div>
                ))}
                {(selectedApplication.timeline ?? []).length === 0 ? (
                  <p className="rounded-2xl bg-white p-4 text-sm text-ink/65">No timeline entries yet.</p>
                ) : null}
              </div>
            </article>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.5rem] bg-sand/70 p-5 text-sm leading-6 text-ink/68">
            Select an application from the list before review, screening, decision, offer, clearance, or enrollment.
          </div>
        )}
      </section>

      {selectedApplication ? (
        <section className="grid gap-6 xl:grid-cols-3">
          {canReview && ["SUBMITTED", "INCOMPLETE", "AWAITING_DOCUMENTS"].includes(selectedApplication.status) ? (
            <ResourceForm
              title="Review application"
              description="Admissions Officer checks biodata, guardian data, class fit, documents, and screening readiness."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/review`}
              submitLabel="Mark under review"
              fields={[
                { name: "recommendedClass", label: "Recommended class", type: "select", defaultValue: normalizeNigeriaClassValue(selectedApplication.desiredClass), options: nigerianClassFieldOptions },
                { name: "documentStatus", label: "Document status", placeholder: "Documents complete" },
                { name: "screeningOutcome", label: "Screening readiness", placeholder: "Ready for screening" },
                { name: "notes", label: "Review notes", type: "textarea", required: true }
              ]}
            />
          ) : null}

          {canReview && ["SUBMITTED", "REVIEWING", "INCOMPLETE"].includes(selectedApplication.status) ? (
            <ResourceForm
              title="Request documents"
              description="Move the application to awaiting documents and notify the guardian."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/request-documents`}
              submitLabel="Request documents"
              fields={[
                { name: "missingDocuments", label: "Missing documents", required: true, placeholder: "Birth certificate, passport photograph" },
                { name: "note", label: "Guardian note", type: "textarea", required: true }
              ]}
            />
          ) : null}

          {canVerifyFinance && ["SUBMITTED", "REVIEWING", "PAYMENT_PENDING"].includes(selectedApplication.status) ? (
            <ResourceForm
              title="Verify application fee"
              description="Bursar/Admin confirms application fee payment or records an approved waiver."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/verify-fee`}
              submitLabel="Save fee status"
              fields={[
                { name: "amount", label: "Amount", type: "number", defaultValue: 10000 },
                { name: "reference", label: "Receipt/reference", placeholder: "RCPT-001" },
                {
                  name: "waived",
                  label: "Waiver",
                  type: "select",
                  options: [
                    { label: "No waiver", value: "false" },
                    { label: "Approved waiver", value: "true" }
                  ]
                },
                { name: "note", label: "Finance note", type: "textarea" }
              ]}
            />
          ) : null}

          {canReview && ["REVIEWING", "PAYMENT_PENDING"].includes(selectedApplication.status) && hasFeeClearance(selectedApplication) ? (
            <ResourceForm
              title="Schedule screening"
              description="Admissions Officer schedules the screening/interview after fee verification or waiver."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/schedule-screening`}
              submitLabel="Schedule screening"
              fields={[
                { name: "scheduledAt", label: "Screening date/time", type: "date", required: true },
                { name: "venue", label: "Venue", placeholder: "ICT Lab" },
                { name: "interviewerId", label: "Interviewer user ID", placeholder: "Optional user ID" },
                { name: "note", label: "Schedule note", type: "textarea" }
              ]}
            />
          ) : null}

          {canScreen && selectedApplication.status === "SCREENING_SCHEDULED" ? (
            <ResourceForm
              title="Record screening result"
              description="Teacher/interviewer records score, remarks, and recommendation."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/screening-result`}
              submitLabel="Save screening result"
              fields={[
                { name: "score", label: "Score", type: "number", required: true, max: 100 },
                { name: "maxScore", label: "Max score", type: "number", defaultValue: 100 },
                {
                  name: "result",
                  label: "Result",
                  type: "select",
                  options: [
                    { label: "Pass", value: "PASS" },
                    { label: "Borderline", value: "BORDERLINE" },
                    { label: "Fail", value: "FAIL" }
                  ]
                },
                { name: "recommendation", label: "Recommendation", required: true, placeholder: "Recommend for admission" },
                { name: "remarks", label: "Interview remarks", type: "textarea", required: true }
              ]}
            />
          ) : null}

          {canReview && ["SCREENING_COMPLETED", "REVIEWING"].includes(selectedApplication.status) ? (
            <ResourceForm
              title="Recommend"
              description="Admissions Officer recommends the application for final principal decision."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/recommend`}
              submitLabel="Recommend application"
              fields={[{ name: "notes", label: "Recommendation note", type: "textarea", required: true }]}
            />
          ) : null}

          {canApprove && selectedApplication.status === "RECOMMENDED" ? (
            <ResourceForm
              title="Final decision"
              description="Principal/Head Teacher makes the final academic decision."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/decision`}
              submitLabel="Save decision"
              fields={[
                {
                  name: "decision",
                  label: "Decision",
                  type: "select",
                  options: [
                    { label: "Approve", value: "APPROVED" },
                    { label: "Conditionally approve", value: "CONDITIONALLY_APPROVED" },
                    { label: "Waitlist", value: "WAITLISTED" },
                    { label: "Reject", value: "REJECTED" }
                  ]
                },
                { name: "conditions", label: "Conditions", placeholder: "Outstanding documents or interview condition" },
                { name: "notes", label: "Decision notes", type: "textarea", required: true }
              ]}
            />
          ) : null}

          {canIssueOffer && ["APPROVED", "CONDITIONALLY_APPROVED"].includes(selectedApplication.status) ? (
            <ResourceForm
              title="Issue offer"
              description="Generate and send admission offer with expiry and requirements checklist."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/issue-offer`}
              submitLabel="Issue offer"
              fields={[
                { name: "conditions", label: "Offer conditions", type: "textarea" },
                { name: "checklist", label: "Checklist", placeholder: "Acceptance fee, medical form, passport photo" },
                { name: "expiryDays", label: "Expiry days", type: "number", defaultValue: 14 }
              ]}
            />
          ) : null}

          {canHandleIntake && selectedApplication.status === "OFFER_SENT" ? (
            <ResourceForm
              title="Offer response"
              description="Parent/applicant or admissions desk can record acceptance."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/accept-offer`}
              submitLabel="Accept offer"
              fields={[{ name: "note", label: "Acceptance note", type: "textarea" }]}
            />
          ) : null}

          {canHandleIntake && selectedApplication.status === "OFFER_SENT" ? (
            <ResourceForm
              title="Decline offer"
              description="Record a guardian/applicant decision to decline the offer."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/decline-offer`}
              submitLabel="Decline offer"
              fields={[{ name: "note", label: "Decline note", type: "textarea" }]}
            />
          ) : null}

          {canVerifyFinance && selectedApplication.status === "ACCEPTED" ? (
            <ResourceForm
              title="Financial clearance"
              description="Bursar/Admin verifies acceptance deposit or records approved waiver before enrollment."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/financial-clearance`}
              submitLabel="Mark cleared"
              fields={[
                { name: "amount", label: "Amount", type: "number", defaultValue: 0 },
                { name: "reference", label: "Payment reference", placeholder: "PAY-123" },
                {
                  name: "waived",
                  label: "Waiver",
                  type: "select",
                  options: [
                    { label: "No waiver", value: "false" },
                    { label: "Approved waiver", value: "true" }
                  ]
                },
                { name: "note", label: "Clearance note", type: "textarea" }
              ]}
            />
          ) : null}

          {canRegister && selectedApplication.status === "FINANCIALLY_CLEARED" ? (
            <ResourceForm
              title="Enroll applicant"
              description="Admin Officer converts the accepted, financially cleared applicant into a live student record."
              endpoint={`/api/v1/admissions/${selectedApplication.id}/enroll`}
              submitLabel="Enroll student"
              fields={[
                { name: "admissionNumber", label: "Admission number", placeholder: "Leave blank to auto-generate" },
                { name: "className", label: "Class allocation", type: "select", required: true, defaultValue: normalizeNigeriaClassValue(selectedApplication.desiredClass), options: nigerianClassFieldOptions },
                { name: "guardianRelationship", label: "Guardian relationship", defaultValue: "Parent" },
                { name: "bloodGroup", label: "Blood group", placeholder: "O+" },
                { name: "genotype", label: "Genotype", placeholder: "AA" },
                { name: "conditions", label: "Medical conditions", type: "textarea" },
                {
                  name: "portalAccountsCreated",
                  label: "Portal accounts",
                  type: "select",
                  options: [
                    { label: "Create later", value: "false" },
                    { label: "Created by ICT/Admin", value: "true" }
                  ]
                }
              ]}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
