import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import {
  AdmissionInfoCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
  AdmissionStatusPill,
} from "@/components/portals/admission-officer-ui";
import { apiGet } from "@/lib/api/server";
import { getReadyToEnrollAdmissions } from "@/lib/admissions/portal";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AdmissionApplicationView } from "@/lib/domain/types";
import { nigerianClassFieldOptions, formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function AdmissionOfficerReadyToEnrollPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (
    !(await canAccessServerPath(
      session,
      "/portals/admission-officer/ready-to-enroll",
    ))
  ) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const applications = await apiGet<AdmissionApplicationView[]>(
    "/api/v1/admissions",
  );
  const ready = getReadyToEnrollAdmissions(applications);

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Enrollment handoff"
        title="Ready to enroll"
        description="Accepted and financially cleared applicants waiting to become live student records."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/offers"
              label="Back to offers"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Applications desk"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AdmissionInfoCard
          title="Ready now"
          description="Applicants sitting in the accepted or cleared state."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {ready.length}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Accepted"
          description="Offers accepted but still awaiting final school-side conversion."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {ready.filter((application) => application.status === "ACCEPTED").length}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Cleared"
          description="Applicants whose financial clearance is already complete."
        >
          <p className="font-[var(--font-display)] text-[32px] font-black text-[var(--color-text-primary)]">
            {
              ready.filter(
                (application) => application.status === "FINANCIALLY_CLEARED",
              ).length
            }
          </p>
        </AdmissionInfoCard>
      </section>

      <TableCard
        title="Enrollment queue"
        description="Convert applicants into student records when all admissions steps are complete."
        items={ready}
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
            key: "guardian",
            header: "Guardian",
            render: (item) => item.guardianName,
          },
          {
            key: "acceptedAt",
            header: "Accepted",
            render: (item) => formatDate(item.acceptedAt ?? item.submittedAt),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <AdmissionStatusPill status={item.status} />,
          },
          {
            key: "action",
            header: "Convert",
            render: (item) => (
              <ResourceActionDialog
                triggerLabel="Convert to student"
                title="Enroll applicant"
                description="Create the student record and complete the admissions conversion."
                endpoint={`/api/v1/admissions/${item.id}/enroll`}
                submitLabel="Confirm enrollment"
                presentation="drawer"
                fields={[
                  {
                    name: "admissionNumber",
                    label: "Admission number",
                    placeholder: "Leave blank to auto-generate",
                  },
                  {
                    name: "className",
                    label: "Class assignment",
                    type: "select",
                    required: true,
                    defaultValue: item.desiredClass,
                    options: nigerianClassFieldOptions,
                  },
                  {
                    name: "guardianRelationship",
                    label: "Guardian relationship",
                    defaultValue: "Parent",
                  },
                  { name: "bloodGroup", label: "Blood group" },
                  { name: "genotype", label: "Genotype" },
                  { name: "allergies", label: "Allergies" },
                  { name: "conditions", label: "Conditions" },
                  {
                    name: "portalAccountsCreated",
                    label: "Portal account state",
                    type: "select",
                    defaultValue: "false",
                    options: [
                      { label: "Create later", value: "false" },
                      { label: "Already created", value: "true" },
                    ],
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
