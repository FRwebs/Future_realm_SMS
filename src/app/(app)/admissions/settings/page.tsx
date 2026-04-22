import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { AdmissionConfigView } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";

export default async function AdmissionSettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/admissions/settings"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const settings = await apiGet<AdmissionConfigView>("/api/v1/admissions/settings");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Admission settings</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{settings.name}</h1>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Configure O-Level admissions rules for session, term, open classes, required documents, screening, fees,
              approval flow, offer expiry, and communication templates.
            </p>
          </div>
          <Link href="/admissions" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            Back to admissions
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Application fee</p>
            <p className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-ink">
              {formatCurrency(settings.applicationFeeAmount)}
            </p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Open classes</p>
            <p className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-ink">{settings.openClasses.length}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Required docs</p>
            <p className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-ink">{settings.requiredDocuments.length}</p>
          </article>
          <article className="rounded-[1.5rem] bg-sand/65 p-5">
            <p className="text-sm text-ink/55">Offer expiry</p>
            <p className="mt-3 font-[var(--font-heading)] text-2xl font-bold text-ink">{settings.offerExpiryDays} days</p>
          </article>
        </div>
      </section>

      <ResourceForm
        title="Update admission configuration"
        description="Comma-separated fields keep this low-bandwidth friendly while the backend stores structured JSON."
        endpoint="/api/v1/admissions/settings"
        method="PUT"
        submitLabel="Save settings"
        fields={[
          { name: "name", label: "Cycle name", defaultValue: settings.name },
          { name: "openClasses", label: "Classes open for admission", defaultValue: settings.openClasses.join(", ") },
          { name: "minAge", label: "Minimum age", type: "number", defaultValue: settings.minAge ?? 9 },
          { name: "maxAge", label: "Maximum age", type: "number", defaultValue: settings.maxAge ?? 18 },
          {
            name: "requiredDocuments",
            label: "Required documents",
            defaultValue: settings.requiredDocuments.join(", ")
          },
          { name: "applicationFeeAmount", label: "Application fee", type: "number", defaultValue: settings.applicationFeeAmount },
          {
            name: "applicationFeeRequired",
            label: "Application fee required",
            type: "select",
            defaultValue: String(settings.applicationFeeRequired),
            options: [
              { label: "Required", value: "true" },
              { label: "Not required", value: "false" }
            ]
          },
          {
            name: "screeningRequired",
            label: "Screening required",
            type: "select",
            defaultValue: String(settings.screeningRequired),
            options: [
              { label: "Required", value: "true" },
              { label: "Not required", value: "false" }
            ]
          },
          {
            name: "principalApprovalRequired",
            label: "Principal approval",
            type: "select",
            defaultValue: String(settings.principalApprovalRequired),
            options: [
              { label: "Required", value: "true" },
              { label: "Not required", value: "false" }
            ]
          },
          {
            name: "bursarClearanceRequired",
            label: "Bursar clearance",
            type: "select",
            defaultValue: String(settings.bursarClearanceRequired),
            options: [
              { label: "Required", value: "true" },
              { label: "Not required", value: "false" }
            ]
          },
          { name: "offerExpiryDays", label: "Offer expiry days", type: "number", defaultValue: settings.offerExpiryDays }
        ]}
      />
    </div>
  );
}
