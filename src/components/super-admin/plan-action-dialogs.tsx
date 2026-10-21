"use client";

import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { ResourceField } from "@/components/forms/resource-form";
import type { SuperAdminPlanRow } from "@/lib/domain/types";

type PlanVariant = "primary" | "secondary" | "menu" | "cardPrimary" | "cardCompact";
export type Entitlements = { modules: string[]; features: string[] };
/** What one naira is worth in each currency, as fixed for the term. A rate of 0 means none has been set yet. */
export type PlanRates = { usd: number; ghs: number; kes: number; gbp: number; shockPercent: number };

const planTierOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Trial", value: "PROFESSIONAL" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];
const supportTierOptions = [
  { label: "Community", value: "COMMUNITY" },
  { label: "Email", value: "EMAIL" },
  { label: "Priority", value: "PRIORITY" },
  { label: "Dedicated", value: "DEDICATED" }
];
const STEPS = [
  { name: "Identity", sub: "What the plan is called, which tier it prices, and who it is for." },
  { name: "Price", sub: "Set the price. Every local figure below is worked out from it at the rate fixed for the term." },
  { name: "Features", sub: "What a school on this plan can reach. Each switch is a module or capability the plan includes." },
  { name: "Rollout", sub: "Decided now, so that nothing is improvised on the day it takes effect." }
];
const moduleCatalog: Array<{ name: string; note: string }> = [
  { name: "Core modules", note: "Students, attendance, results and report cards" },
  { name: "Students", note: "Student registration and records" },
  { name: "Attendance", note: "Registers and absence follow-up" },
  { name: "Results", note: "Score entry, computation and report cards" },
  { name: "Fees", note: "Fee management and receipts" },
  { name: "Admissions", note: "Applications through to enrolment" },
  { name: "Email notifications", note: "Included on every plan that sends mail" },
  { name: "SMS notifications", note: "Drawn from the school’s credit wallet" },
  { name: "WhatsApp notifications", note: "Approved templates, to people who opted in" },
  { name: "Payment integration", note: "Card payment from the fees screens" },
  { name: "Analytics", note: "Dashboards and reports" },
  { name: "Predictive analytics", note: "At-risk alerts" },
  { name: "Custom branding", note: "Reviewed by us before it is applied" },
  { name: "Account manager", note: "A named person at the platform" },
  { name: "Library", note: "Catalogue and loans" },
  { name: "Transport", note: "Routes and riders" },
  { name: "Hostel", note: "Boarding and rooms" },
  { name: "Health", note: "Sick bay and medical records" },
  { name: "Discipline", note: "Incidents and sanctions" },
  { name: "Annual verification", note: "Re-confirmed each year — NGO and mission plans" }
];

function extractEntitlements(value: unknown): Entitlements {
  if (Array.isArray(value)) return { modules: value.map(String), features: [] };
  if (typeof value === "string") return { modules: value.split(",").map((item) => item.trim()).filter(Boolean), features: [] };
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      modules: Array.isArray(record.modules) ? record.modules.map(String) : [],
      features: Array.isArray(record.features) ? record.features.map(String) : []
    };
  }
  return { modules: [], features: [] };
}

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-US")}`;

/** One currency's line in the preview: what the naira price comes to at the term's rate. */
function localLine(label: string, symbol: string, rate: number): { label: string; compute: (values: Record<string, string>) => string } {
  return {
    label,
    compute: (values) => {
      if (!rate) return "Needs the term’s rates first";
      const value = Number(values.monthlyPrice || 0) / rate;
      return `${symbol}${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} · at ${naira(rate)} to the unit`;
    }
  };
}

type Mode = "create" | "edit" | "duplicate";

function planFields(mode: Mode, plan: SuperAdminPlanRow | undefined, rates: PlanRates | undefined): ResourceField[] {
  const entitlements = extractEntitlements(plan?.includedModules);
  const knownModules = new Set(moduleCatalog.map((item) => item.name));
  const customModules = entitlements.modules.filter((item) => !knownModules.has(item));
  const subscribers = mode === "edit" ? (plan?.subscriberCount ?? 0) : 0;
  const lockedPrice = mode === "edit" && subscribers > 0;
  const r = rates ?? { usd: 0, ghs: 0, kes: 0, gbp: 0, shockPercent: 15 };
  const base = (field: ResourceField, wizardStep: string): ResourceField => ({ ...field, wizardStep });
  const toggles: ResourceField[] = [
    ...moduleCatalog.map((item) => base({ name: `mod:${item.name}`, label: item.name, type: "switch", on: entitlements.modules.includes(item.name), note: item.note, section: "Modules" }, "Features")),
    ...customModules.map((name) => base({ name: `mod:${name}`, label: name, type: "switch", on: true, note: "Added to this plan by hand", section: "Modules" }, "Features"))
  ];
  return [
    base({ name: "name", label: "Plan name", required: true, defaultValue: mode === "duplicate" ? `Copy of ${plan?.name ?? ""}` : (plan?.name ?? ""), placeholder: "e.g. Group / Multi-branch", section: "Plan identity" }, "Identity"),
    base({ name: "slug", label: "Plan code", required: true, defaultValue: mode === "duplicate" ? `${plan?.slug ?? "plan"}-copy` : (plan?.slug ?? ""), placeholder: "e.g. group-multi-branch", note: "Used in billing exports and in the API — lowercase, no spaces", section: "Plan identity" }, "Identity"),
    base({ name: "plan", label: "Billing tier", type: "select", defaultValue: plan?.plan ?? "BASIC", options: planTierOptions, note: "Which of the platform’s tiers this plan prices", section: "Plan identity" }, "Identity"),
    base({ name: "status", label: "Status on save", type: "static", placeholder: mode === "edit" ? `${(plan?.lifecycle ?? "ACTIVE").charAt(0) + (plan?.lifecycle ?? "ACTIVE").slice(1).toLowerCase()} · v${plan?.version ?? 1} becomes v${(plan?.version ?? 1) + 1}` : "Draft · invisible to sales and to every school", section: "Plan identity" }, "Identity"),
    base({ name: "studentLimit", label: "Maximum students", type: "number", min: 0, defaultValue: plan?.studentLimit ?? 0, note: "0 means unlimited", section: "Eligibility" }, "Identity"),
    base({ name: "staffLimit", label: "Maximum staff", type: "number", min: 0, defaultValue: plan?.staffLimit ?? 0, note: "0 means unlimited", section: "Eligibility" }, "Identity"),
    base({ name: "storageLimitGb", label: "Storage (GB)", type: "number", min: 0, defaultValue: plan?.storageLimitGb ?? 0, section: "Eligibility" }, "Identity"),
    base({ name: "supportTier", label: "Support", type: "select", defaultValue: plan?.supportTier ?? "EMAIL", options: supportTierOptions, section: "Eligibility" }, "Identity"),

    base({ name: "monthlyPrice", label: "Price per semester (₦)", type: "number", min: 0, required: true, defaultValue: plan?.monthlyPrice ?? 1500, disabled: lockedPrice, note: lockedPrice ? `${subscribers} school${subscribers === 1 ? " is" : "s are"} on this plan, so its price cannot be edited in place — use Price on the plan card, which gives them 30 days’ notice` : "The one figure that is authored; everything below follows from it", section: "The price you set" }, "Price"),
    base({ name: "usd", type: "static", ...localLine("United States · USD", "$", r.usd), section: "Local prices · preview" }, "Price"),
    base({ name: "ghs", type: "static", ...localLine("Ghana · GHS", "GH₵ ", r.ghs), section: "Local prices · preview" }, "Price"),
    base({ name: "kes", type: "static", ...localLine("Kenya · KES", "KSh ", r.kes), section: "Local prices · preview" }, "Price"),
    base({ name: "gbp", type: "static", ...localLine("United Kingdom · GBP", "£", r.gbp), section: "Local prices · preview" }, "Price"),
    base({ name: "lock1", label: "The rate is fixed for the whole term", type: "locked", note: "A school is invoiced at the rate in force when the term opened", section: "How the rate is handled" }, "Price"),
    base({ name: "lock2", label: `A move of more than ${r.shockPercent}% is held for Finance`, type: "locked", note: "A currency shock is not a price rise; Finance decides it deliberately", section: "How the rate is handled" }, "Price"),
    base({ name: "lock3", label: "A school is invoiced in its own currency", type: "locked", note: "The naira figure is the platform’s internal anchor, not what a bursar reads", section: "How the rate is handled" }, "Price"),
    base({ name: "smsUnitsPerMonth", label: "SMS credits included", type: "number", min: 0, defaultValue: plan?.smsUnitsPerMonth ?? 0, section: "Notification credits" }, "Price"),
    base({ name: "emailSendsPerMonth", label: "Email sends included", type: "number", min: 0, defaultValue: plan?.emailSendsPerMonth ?? 0, section: "Notification credits" }, "Price"),

    ...toggles,
    base({ name: "apiAccess", label: "API access", type: "switch", on: Boolean(plan?.apiAccess), note: "Platform · rate limited", section: "Capabilities" }, "Features"),
    base({ name: "customBranding", label: "Custom report-card branding", type: "switch", on: Boolean(plan?.customBranding), note: "Reviewed by us before it is applied", section: "Capabilities" }, "Features"),
    base({ name: "featureLines", label: "Feature lines shown on the plan card", type: "textarea", defaultValue: entitlements.features.join("\n"), placeholder: "One per line — e.g. 251–700 students", note: "Plain sentences a salesperson would say; they appear on the card as bullets", section: "What the card says" }, "Features"),

    base({ name: "effective", label: "Takes effect", type: "static", placeholder: mode === "edit" ? "On saving" : "When it is published — a draft does nothing", section: "Timing and existing schools" }, "Rollout"),
    base({ name: "existing", label: "Existing schools", type: "static", placeholder: mode === "edit" ? (subscribers > 0 ? `${subscribers} school${subscribers === 1 ? "" : "s"} on this plan — entitlement changes reach them the next time the product checks` : "None on this plan") : "None — nobody is on a new plan", section: "Timing and existing schools" }, "Rollout"),
    base({ name: "priceNotice", label: "Price changes", type: "static", placeholder: "Reach schools only through Price on the plan card — announced, then applied after 30 days’ notice", section: "Timing and existing schools" }, "Rollout"),
    base({ name: "route1", label: mode === "edit" ? "Saved as a new version" : "Saved as a draft", type: "locked", note: mode === "edit" ? "The version before it stays readable in the plan’s history" : "A draft is not offered to sales or to any school until it is published", section: "Approval route" }, "Rollout"),
    base({ name: "route2", label: "Publish · Super Admin only", type: "locked", note: "From Lifecycle on the plan card", section: "Approval route" }, "Rollout"),
    base({ name: "route3", label: "Logged", type: "locked", note: "Actor, time and what changed, kept for the life of the platform", section: "Approval route" }, "Rollout")
  ];
}

/** The endpoint wants a flat plan body with the modules as an array, not one flag per switch. */
function buildBody(mode: Mode) {
  return (values: Record<string, unknown>) => {
    const modules = Object.entries(values).filter(([key, value]) => key.startsWith("mod:") && value === "true").map(([key]) => key.slice(4));
    const features = String(values.featureLines ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    const price = Number(values.monthlyPrice ?? 0);
    const body: Record<string, unknown> = {
      name: values.name,
      slug: values.slug,
      plan: values.plan,
      studentLimit: Number(values.studentLimit || 0),
      staffLimit: Number(values.staffLimit || 0),
      storageLimitGb: Number(values.storageLimitGb || 0),
      smsUnitsPerMonth: Number(values.smsUnitsPerMonth || 0),
      emailSendsPerMonth: Number(values.emailSendsPerMonth || 0),
      supportTier: values.supportTier,
      apiAccess: values.apiAccess === "true",
      customBranding: values.customBranding === "true",
      includedModules: { modules, features }
    };
    // A disabled price field is not sent; the backend keeps the price a plan with schools on it already has.
    if (values.monthlyPrice !== undefined) {
      body.monthlyPrice = price;
      body.annualPrice = price * 2;
    }
    if (mode !== "edit") body.lifecycle = "DRAFT";
    return body;
  };
}

function PlanDialog({ mode, plan, variant, rates, triggerLabel }: { mode: Mode; plan?: SuperAdminPlanRow; variant: PlanVariant; rates?: PlanRates; triggerLabel: string }) {
  const create = mode !== "edit";
  return (
    <ResourceActionDialog
      triggerLabel={triggerLabel}
      title={create ? "Create a new tier" : `Edit plan · ${plan?.name ?? ""}`}
      description={create ? "A plan is a promise about price and capability. It stays in draft until a Super Admin publishes it." : "Changing a plan saves a new version. The one before it stays readable, and what a school was promised is not rewritten."}
      endpoint={create ? "/api/super-admin/plans" : `/api/super-admin/plans/${plan?.id}`}
      method={create ? "POST" : "PATCH"}
      variant={variant}
      submitLabel={create ? "Save as draft" : "Save new version"}
      steps={STEPS}
      transform={buildBody(mode)}
      note={create ? "Prices are shown in naira with their local equivalents, fixed for the term, so no country is limited by what one figure is worth this month." : "A price already agreed with schools on the plan is changed only through Price on the plan card."}
      impact={
        create
          ? { label: "On saving", rows: [["Saved as a draft", "Invisible to sales, unassignable to any school"], ["Nothing reaches a school", "Publishing is a separate act, from Lifecycle on the plan card"], ["Version 1 is recorded", "With who made it and when"]] }
          : { label: "On saving", rows: [[`Becomes version ${(plan?.version ?? 1) + 1}`, "The version before it stays readable in the plan’s history"], ["Schools on the plan", "Entitlement changes apply the next time the product checks; price is untouched"], ["Logged", "Who changed what, and when"]] }
      }
      fields={planFields(mode, plan, rates)}
    />
  );
}

export function PlanCreateDialog({ rates }: { rates?: PlanRates }) {
  return <PlanDialog mode="create" variant="primary" triggerLabel="Open plan builder" rates={rates} />;
}

export function PlanEditDialog({ plan, variant = "secondary", rates }: { plan: SuperAdminPlanRow; variant?: PlanVariant; rates?: PlanRates }) {
  return <PlanDialog mode="edit" plan={plan} variant={variant} rates={rates} triggerLabel="Edit plan" />;
}

export function PlanDuplicateDialog({ plan, variant = "cardCompact", rates }: { plan: SuperAdminPlanRow; variant?: PlanVariant; rates?: PlanRates }) {
  return <PlanDialog mode="duplicate" plan={plan} variant={variant} rates={rates} triggerLabel="Duplicate" />;
}
