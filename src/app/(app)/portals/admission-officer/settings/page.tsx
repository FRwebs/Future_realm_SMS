import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import {
  AdmissionInfoCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
} from "@/components/portals/admission-officer-ui";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { AdmissionConfigView } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";

export default async function AdmissionOfficerSettingsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer/settings"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const settings = await apiGet<AdmissionConfigView>("/api/v1/admissions/settings");

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Admissions configuration"
        title="Intake and rules settings"
        description="Control application fee posture, screening requirements, open classes, and offer-expiry rules for the active admissions cycle."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer/analytics"
              label="Analytics"
            />
            <AdmissionQuickLink
              href="/portals/admission-officer/applications"
              label="Applications"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <AdmissionInfoCard
          title="Application fee"
          description="Current fee requirement for a new applicant."
        >
          <p className="font-[var(--font-display)] text-[28px] font-black text-[var(--color-text-primary)]">
            {formatCurrency(settings.applicationFeeAmount)}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Open classes"
          description="Classes currently available in the active intake."
        >
          <p className="font-[var(--font-display)] text-[28px] font-black text-[var(--color-text-primary)]">
            {settings.openClasses.length}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Required documents"
          description="Documents currently enforced in the admissions cycle."
        >
          <p className="font-[var(--font-display)] text-[28px] font-black text-[var(--color-text-primary)]">
            {settings.requiredDocuments.length}
          </p>
        </AdmissionInfoCard>
        <AdmissionInfoCard
          title="Offer expiry"
          description="Default number of days a guardian has to respond to an offer."
        >
          <p className="font-[var(--font-display)] text-[28px] font-black text-[var(--color-text-primary)]">
            {settings.offerExpiryDays} days
          </p>
        </AdmissionInfoCard>
      </section>

      <section className="surface-card p-6">
        <ResourceForm
          title="Update admissions settings"
          description="Keep the current intake rules aligned with the reality on ground before officers keep processing new applications."
          endpoint="/api/v1/admissions/settings"
          method="PUT"
          submitLabel="Save admissions settings"
          chrome="plain"
          fields={[
            { name: "name", label: "Cycle name", defaultValue: settings.name },
            {
              name: "openClasses",
              label: "Classes open for admission",
              defaultValue: settings.openClasses.join(", "),
            },
            {
              name: "requiredDocuments",
              label: "Required documents",
              defaultValue: settings.requiredDocuments.join(", "),
            },
            {
              name: "applicationFeeAmount",
              label: "Application fee amount",
              type: "number",
              defaultValue: settings.applicationFeeAmount,
            },
            {
              name: "applicationFeeRequired",
              label: "Application fee required",
              type: "select",
              defaultValue: String(settings.applicationFeeRequired),
              options: [
                { label: "Required", value: "true" },
                { label: "Not required", value: "false" },
              ],
            },
            {
              name: "screeningRequired",
              label: "Screening required",
              type: "select",
              defaultValue: String(settings.screeningRequired),
              options: [
                { label: "Required", value: "true" },
                { label: "Not required", value: "false" },
              ],
            },
            {
              name: "principalApprovalRequired",
              label: "Principal approval required",
              type: "select",
              defaultValue: String(settings.principalApprovalRequired),
              options: [
                { label: "Required", value: "true" },
                { label: "Not required", value: "false" },
              ],
            },
            {
              name: "bursarClearanceRequired",
              label: "Financial clearance required",
              type: "select",
              defaultValue: String(settings.bursarClearanceRequired),
              options: [
                { label: "Required", value: "true" },
                { label: "Not required", value: "false" },
              ],
            },
            {
              name: "offerExpiryDays",
              label: "Offer expiry days",
              type: "number",
              defaultValue: settings.offerExpiryDays,
            },
          ]}
        />
      </section>
    </div>
  );
}
