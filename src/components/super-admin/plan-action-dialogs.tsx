"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import type { SuperAdminPlanRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

type PlanVariant = "secondary" | "menu";
type Entitlements = { modules: string[]; features: string[] };

const planTierOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Trial", value: "PROFESSIONAL" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];
const supportTierOptions = ["COMMUNITY", "EMAIL", "PRIORITY", "DEDICATED"].map((value) => ({ label: value, value }));
const planSteps = [
  { n: 1, label: "Pricing" },
  { n: 2, label: "Modules" },
  { n: 3, label: "Features" }
];
const moduleCatalog = [
  "Core modules",
  "Students",
  "Attendance",
  "Results",
  "Fees",
  "Admissions",
  "Email notifications",
  "SMS notifications",
  "WhatsApp notifications",
  "Payment integration",
  "Analytics",
  "Predictive analytics",
  "Custom branding",
  "Account manager",
  "Library",
  "Transport",
  "Hostel",
  "Health",
  "Discipline",
  "Annual verification"
];

const pricingTemplates = {
  starter: {
    label: "Starter",
    name: "Starter",
    slug: "starter",
    plan: "BASIC",
    semesterPrice: 1500,
    studentLimit: 250,
    staffLimit: 0,
    supportTier: "EMAIL",
    apiAccess: false,
    customBranding: false,
    modules: ["Core modules", "Email notifications"],
    features: ["1-250 students", "Email notifications", "All core modules"]
  },
  standard: {
    label: "Standard",
    name: "Standard",
    slug: "standard",
    plan: "STANDARD",
    semesterPrice: 3500,
    studentLimit: 700,
    staffLimit: 0,
    supportTier: "PRIORITY",
    apiAccess: false,
    customBranding: false,
    modules: ["Core modules", "SMS notifications", "WhatsApp notifications", "Payment integration"],
    features: ["251-700 students", "SMS and WhatsApp notifications", "Payment integration"]
  },
  elite: {
    label: "Elite",
    name: "Elite",
    slug: "elite",
    plan: "ENTERPRISE",
    semesterPrice: 5500,
    studentLimit: 0,
    staffLimit: 0,
    supportTier: "DEDICATED",
    apiAccess: true,
    customBranding: true,
    modules: ["All core modules", "Predictive analytics", "Custom branding", "Account manager"],
    features: ["701+ students", "Predictive analytics", "Custom branding", "Dedicated account manager"]
  },
  ngo: {
    label: "NGO / Mission",
    name: "NGO / Mission",
    slug: "ngo-mission",
    plan: "CUSTOM",
    semesterPrice: 150,
    studentLimit: 0,
    staffLimit: 0,
    supportTier: "EMAIL",
    apiAccess: false,
    customBranding: false,
    modules: ["Core modules", "Annual verification"],
    features: ["Any size", "90% off selected tier", "CAC or charity certificate required", "Verified annually"]
  },
  trial: {
    label: "Trial",
    name: "Trial",
    slug: "trial",
    plan: "PROFESSIONAL",
    semesterPrice: 0,
    studentLimit: 0,
    staffLimit: 0,
    supportTier: "EMAIL",
    apiAccess: false,
    customBranding: false,
    modules: ["Starter features"],
    features: ["Any size", "One full term", "All Starter features", "Free"]
  }
} as const;

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

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

function initialForm(plan?: SuperAdminPlanRow) {
  const entitlements = extractEntitlements(plan?.includedModules);
  return {
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    plan: plan?.plan ?? "BASIC",
    semesterPrice: plan?.monthlyPrice ?? 1500,
    studentLimit: plan?.studentLimit ?? 0,
    staffLimit: plan?.staffLimit ?? 0,
    storageLimitGb: plan?.storageLimitGb ?? 0,
    smsUnitsPerMonth: plan?.smsUnitsPerMonth ?? 0,
    emailSendsPerMonth: plan?.emailSendsPerMonth ?? 0,
    supportTier: plan?.supportTier ?? "EMAIL",
    apiAccess: plan?.apiAccess ?? false,
    customBranding: plan?.customBranding ?? false,
    modules: entitlements.modules,
    features: entitlements.features
  };
}

function TagEditor({
  label,
  placeholder,
  values,
  onChange
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <div className="md:col-span-2">
      <span className="field-label">{label}</span>
      <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
            >
              {value}
              <X className="h-3 w-3" />
            </button>
          ))}
          {values.length === 0 ? <span className="text-[12px] text-[var(--color-text-muted)]">No items added yet.</span> : null}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addValue();
              }
            }}
            placeholder={placeholder}
            className="field-control h-10"
          />
          <button type="button" onClick={addValue} className="btn-secondary h-10 px-3 text-[12px]">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleToggleGrid({
  values,
  onChange
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [customModule, setCustomModule] = useState("");

  function toggle(module: string) {
    onChange(values.includes(module) ? values.filter((item) => item !== module) : [...values, module]);
  }

  function addCustomModule() {
    const value = customModule.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setCustomModule("");
  }

  const customValues = values.filter((value) => !moduleCatalog.includes(value));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {moduleCatalog.map((module) => {
          const on = values.includes(module);
          return (
            <button
              key={module}
              type="button"
              onClick={() => toggle(module)}
              className={cn(
                "flex min-h-[46px] items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left text-[13px] font-semibold transition",
                on
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
              )}
            >
              <span>{module}</span>
              <span
                className={cn(
                  "flex h-5 w-9 items-center rounded-full p-0.5 transition",
                  on ? "justify-end bg-[var(--color-accent-primary)]" : "justify-start bg-[var(--color-border-default)]"
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white">
                  {on ? <Check className="h-3 w-3 text-[var(--color-accent-primary)]" /> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
        <span className="field-label">Custom modules</span>
        <div className="flex gap-2">
          <input
            value={customModule}
            onChange={(event) => setCustomModule(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomModule();
              }
            }}
            placeholder="e.g. CBT engine"
            className="field-control h-10"
          />
          <button type="button" onClick={addCustomModule} className="btn-secondary h-10 px-3 text-[12px]">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {customValues.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {customValues.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-white px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                {value}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PlanDialog({
  plan,
  variant = "secondary",
  mode
}: {
  plan?: SuperAdminPlanRow;
  variant?: PlanVariant;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState(initialForm(plan));
  const [step, setStep] = useState(1);
  const twoSemesterEstimate = useMemo(() => Number(form.semesterPrice || 0) * 2, [form.semesterPrice]);
  const TriggerIcon = variant === "menu" ? Pencil : mode === "create" ? Plus : Pencil;
  const triggerLabel = mode === "create" ? "New Plan" : "Edit plan";

  function update<Value>(key: keyof typeof form, value: Value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyTemplate(key: keyof typeof pricingTemplates) {
    const template = pricingTemplates[key];
    setForm((current) => ({
      ...current,
      name: template.name,
      slug: template.slug,
      plan: template.plan,
      semesterPrice: template.semesterPrice,
      studentLimit: template.studentLimit,
      staffLimit: template.staffLimit,
      supportTier: template.supportTier,
      apiAccess: template.apiAccess,
      customBranding: template.customBranding,
      modules: [...template.modules],
      features: [...template.features]
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const endpoint = mode === "create" ? "/api/super-admin/plans" : `/api/super-admin/plans/${plan?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? ""
        },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          plan: form.plan,
          monthlyPrice: Number(form.semesterPrice || 0),
          annualPrice: twoSemesterEstimate,
          studentLimit: Number(form.studentLimit || 0),
          staffLimit: Number(form.staffLimit || 0),
          storageLimitGb: Number(form.storageLimitGb || 0),
          smsUnitsPerMonth: Number(form.smsUnitsPerMonth || 0),
          emailSendsPerMonth: Number(form.emailSendsPerMonth || 0),
          supportTier: form.supportTier,
          apiAccess: form.apiAccess,
          customBranding: form.customBranding,
          includedModules: { modules: form.modules, features: form.features }
        })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "Unable to save plan");
      showToast({ variant: "success", title: "Plan saved", description: form.name });
      setOpen(false);
      setStep(1);
      router.refresh();
    } catch (error) {
      showToast({ variant: "error", title: "Unable to save plan", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-popover-close={variant === "menu" ? "true" : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.99]",
          variant === "menu"
            ? "flex w-full items-center justify-start rounded-[10px] px-3 py-2.5 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
            : mode === "create"
              ? "btn-primary px-5"
              : "btn-secondary px-5"
        )}
      >
        <TriggerIcon className="h-4 w-4" />
        <span>{triggerLabel}</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Build a subscription plan" : `Edit ${plan?.name}`}
        subtitle="Pricing is semester-based. Add or remove modules and feature bullets with the controls below."
        size="lg"
      >
        <form onSubmit={submit} className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            {planSteps.map((item) => {
              const current = item.n === step;
              const done = item.n < step;
              return (
                <button
                  key={item.n}
                  type="button"
                  onClick={() => setStep(item.n)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition",
                    current || done
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
                      : "border-[var(--color-border-default)] text-[var(--color-text-muted)]"
                  )}
                >
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", current || done ? "bg-[var(--color-accent-primary)] text-white" : "bg-[var(--color-bg-subtle)]")}>
                    {done ? <Check className="h-3 w-3" /> : item.n}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>

          {step === 1 ? (
            <>
              <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Pricing templates</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(pricingTemplates) as Array<keyof typeof pricingTemplates>).map((key) => (
                    <button key={key} type="button" onClick={() => applyTemplate(key)} className="btn-secondary h-9 px-3 text-[12px]">
                      {pricingTemplates[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="field-label">Plan name *</span>
                  <input required value={form.name} onChange={(event) => update("name", event.target.value)} className="field-control h-10" placeholder="Starter" />
                </label>
                <label>
                  <span className="field-label">Slug *</span>
                  <input required value={form.slug} onChange={(event) => update("slug", event.target.value)} className="field-control h-10" placeholder="starter" />
                </label>
                <label>
                  <span className="field-label">Tier *</span>
                  <select value={form.plan} onChange={(event) => update("plan", event.target.value)} className="field-select h-10">
                    {planTierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="field-label">Semester price per student (NGN) *</span>
                  <input required type="number" min={0} value={form.semesterPrice} onChange={(event) => update("semesterPrice", Number(event.target.value))} className="field-control h-10" />
                </label>
                <label>
                  <span className="field-label">Student limit (0 = unlimited)</span>
                  <input type="number" min={0} value={form.studentLimit} onChange={(event) => update("studentLimit", Number(event.target.value))} className="field-control h-10" />
                </label>
                <label>
                  <span className="field-label">Staff limit (0 = unlimited)</span>
                  <input type="number" min={0} value={form.staffLimit} onChange={(event) => update("staffLimit", Number(event.target.value))} className="field-control h-10" />
                </label>
                <label>
                  <span className="field-label">Storage limit (GB)</span>
                  <input type="number" min={0} value={form.storageLimitGb} onChange={(event) => update("storageLimitGb", Number(event.target.value))} className="field-control h-10" />
                </label>
                <label>
                  <span className="field-label">Support tier</span>
                  <select value={form.supportTier} onChange={(event) => update("supportTier", event.target.value)} className="field-select h-10">
                    {supportTierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="field-label">SMS units / semester</span>
                  <input type="number" min={0} value={form.smsUnitsPerMonth} onChange={(event) => update("smsUnitsPerMonth", Number(event.target.value))} className="field-control h-10" />
                </label>
                <label>
                  <span className="field-label">Email sends / semester</span>
                  <input type="number" min={0} value={form.emailSendsPerMonth} onChange={(event) => update("emailSendsPerMonth", Number(event.target.value))} className="field-control h-10" />
                </label>
                <label className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border-default)] px-3 py-2">
                  <input type="checkbox" checked={form.apiAccess} onChange={(event) => update("apiAccess", event.target.checked)} />
                  <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">API access</span>
                </label>
                <label className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border-default)] px-3 py-2">
                  <input type="checkbox" checked={form.customBranding} onChange={(event) => update("customBranding", event.target.checked)} />
                  <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Custom branding</span>
                </label>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div>
              <p className="section-eyebrow">Included modules</p>
              <h3 className="mt-1 text-[17px] font-bold text-[var(--color-text-primary)]">Turn plan modules on or off</h3>
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--color-text-secondary)]">These toggles control the modules shown on billing, onboarding, and plan comparison surfaces.</p>
              <div className="mt-4">
                <ModuleToggleGrid values={form.modules} onChange={(modules) => update("modules", modules)} />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
            <TagEditor label="Feature bullets" placeholder="e.g. 251-700 students" values={form.features} onChange={(features) => update("features", features)} />
              <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Review</p>
                <p className="mt-3 text-[14px] font-bold text-[var(--color-text-primary)]">{form.name || "Untitled plan"}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Semester price: NGN {Number(form.semesterPrice || 0).toLocaleString("en-NG")}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Modules enabled: {form.modules.length}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Feature bullets: {form.features.length}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-4">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Two-semester estimate stored for reports: NGN {twoSemesterEstimate.toLocaleString("en-NG")}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => (step === 1 ? setOpen(false) : setStep(step - 1))} className="btn-secondary px-4">
                {step === 1 ? "Cancel" : "Back"}
              </button>
              {step < 3 ? (
                <button type="button" onClick={() => setStep(step + 1)} className="btn-primary px-5">Continue</button>
              ) : (
                <button type="submit" disabled={pending} className="btn-primary px-6">
                  {pending ? "Saving..." : "Save plan"}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function PlanCreateDialog() {
  return <PlanDialog mode="create" />;
}

export function PlanEditDialog({ plan, variant = "secondary" }: { plan: SuperAdminPlanRow; variant?: PlanVariant }) {
  return <PlanDialog mode="edit" plan={plan} variant={variant} />;
}
