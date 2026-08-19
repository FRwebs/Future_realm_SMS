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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-eyebrow">Admission settings</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{settings.name}</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Configure O-Level admissions rules for session, term, open classes, required documents, screening, fees,
              approval flow, offer expiry, and communication templates.
            </p>
          </div>
          <Link href="/admissions" className="btn-primary px-4">
            Back to admissions
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Application fee</p>
            <p className="mt-3 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">
              {formatCurrency(settings.applicationFeeAmount)}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Open classes</p>
            <p className="mt-3 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{settings.openClasses.length}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Required docs</p>
            <p className="mt-3 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{settings.requiredDocuments.length}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Offer expiry</p>
            <p className="mt-3 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{settings.offerExpiryDays} days</p>
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
