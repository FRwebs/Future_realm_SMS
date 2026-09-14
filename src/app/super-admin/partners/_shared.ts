import type { ResourceField } from "@/components/forms/resource-form";

export const expectedTierOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];

export const dealStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  REGISTERED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Registered" },
  CONVERTED: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Converted — commission pending" },
  EXPIRED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Expired" },
  COMMISSION_PAID: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Commission paid" }
};

export const tierLabels: Record<string, string> = {
  BASIC: "Starter",
  STANDARD: "Standard",
  ENTERPRISE: "Elite",
  CUSTOM: "NGO / Mission"
};

export const flowToneStyle: Record<"good" | "warn" | "bad" | "ink" | "plain", { bg: string; fg: string; bd: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)", bd: "#CFE4DB" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", bd: "#F2E4C6" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", bd: "#F3E0E0" },
  ink: { bg: "#0D2315", fg: "#fff", bd: "#0D2315" },
  plain: { bg: "#fff", fg: "var(--color-text-primary)", bd: "var(--color-border-default)" }
};

export function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Number(value).toLocaleString("en-NG", { maximumFractionDigits: 1 })}%`;
}

export function partnerReference(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9000;
  }
  return `FR-${String(hash + 1000).padStart(4, "0")}`;
}

export function agreementSummary(agreementReference: string | null, agreementValidTo: string | null) {
  const reference = agreementReference ?? "No agreement on file";
  if (!agreementValidTo) return reference;
  const validTo = new Date(agreementValidTo).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  return `${reference} · to ${validTo}`;
}

export function dealFormFields(
  partnerOptions: Array<{ label: string; value: string }>,
  defaultPartnerId?: string
): ResourceField[] {
  return [
    { name: "partnerId", label: "Partner", type: "select", required: true, options: partnerOptions, defaultValue: defaultPartnerId, section: "Partner and prospect" },
    { name: "prospectSchoolName", label: "Prospect school name", required: true, section: "Partner and prospect" },
    { name: "prospectLocation", label: "Location", section: "Partner and prospect" },
    { name: "_contact", label: "Contact at the school", type: "static", disabled: true, placeholder: "Not captured", note: "Not built — a deal registration doesn't record a contact person at the prospect school yet.", section: "Partner and prospect" },
    { name: "expectedTier", label: "Expected tier", type: "select", options: expectedTierOptions, section: "Partner and prospect" },
    { name: "_expectedSize", label: "Expected size", type: "static", disabled: true, placeholder: "Not captured", note: "Not built — expected student headcount isn't recorded at registration.", section: "Partner and prospect" },
    { name: "stream", label: "Stream / referral channel", section: "Evidence of introduction" },
    {
      name: "introductionEvidence",
      label: "How the introduction was made",
      type: "textarea",
      placeholder: "Meeting, referral note, or correspondence proving the introduction",
      section: "Evidence of introduction"
    },
    { name: "_validUntil", label: "Registration valid until", type: "static", disabled: true, placeholder: "90 days from today, set automatically", note: "Not editable — every registration is valid for a fixed 90 days from the moment it's logged.", section: "Evidence of introduction" },
    {
      name: "commissionRatePercent",
      label: "Commission rate override (%)",
      type: "number",
      min: 0,
      max: 100,
      step: 0.5,
      placeholder: "Use partner default",
      section: "Evidence of introduction"
    },
    { name: "_confirmPartner", label: "Confirm the registration to the partner", type: "toggle", disabled: true, note: "Not built — no confirmation email is sent when a deal is registered.", section: "Alongside" },
    { name: "_alertExpiry", label: "Alert the partner 14 days before expiry", type: "toggle", disabled: true, note: "Not built — nothing currently warns a partner before a registration expires.", section: "Alongside" }
  ];
}
