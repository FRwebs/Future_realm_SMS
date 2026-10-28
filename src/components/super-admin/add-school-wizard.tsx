"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { z } from "zod";
import { Check, CheckCircle2, Mail, Plus, ShieldCheck, X } from "lucide-react";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import type { SuperAdminPlanRow } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { useFocusTrap } from "@/lib/ui/focus";

type Tone = "idle" | "good" | "warn" | "bad";

const STEPS = [
  { n: 1, label: "School details" },
  { n: 2, label: "Primary administrator" },
  { n: 3, label: "Commercial & assignment" },
];

const BLOCKED_SLUGS = ["admin", "api", "app", "www", "mail", "support", "waec", "neco", "jamb", "futurerealm"];
const TAKEN_SLUGS = ["greenfield-college", "sunrise", "crestwood"];

const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  idle: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
};

const wizardSchema = z.object({
  schoolName: z.string().trim().min(2, "Enter the school's full name."),
  slug: z.string(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  lga: z.string(),
  address: z.string(),
  schoolType: z.string(),
  curriculum: z.string(),
  levels: z.record(z.string(), z.boolean()),
  studentCount: z.string(),
  cacNumber: z.string(),
  firstName: z.string().trim().min(1, "Enter the administrator's first name."),
  lastName: z.string().trim().min(1, "Enter the administrator's last name."),
  position: z.string(),
  gender: z.string(),
  email: z.string().trim().min(1, "Enter the administrator's email.").email("That does not look like an email address."),
  phone: z.string(),
  sendChannels: z.record(z.string(), z.boolean()),
  tier: z.string(),
  accountType: z.string(),
  trialEndDate: z.string(),
  billingCycle: z.string(),
  leadSource: z.string(),
  partnerName: z.string(),
  accountManager: z.string(),
  notificationCredits: z.string(),
  internalNote: z.string(),
});
type WizardValues = z.infer<typeof wizardSchema>;

/** What each step asks for, so Continue checks only the part of the form the person is looking at. */
const STEP_FIELDS: Record<number, Array<keyof WizardValues>> = {
  1: ["schoolName"],
  2: ["firstName", "lastName", "email"],
  3: [],
};

const AUTO_ITEMS = [
  "Web address live with a security certificate",
  "Curriculum and grading templates for the country",
  "All default staff role templates installed",
  "Admin account created — permanent school code",
  "Sample demo class loaded for the trial",
  "Invitation sent — link valid 24 hours, single use",
  "Notification credits issued per the deal",
  "Audit logging on · risk check skipped (deal is the verification)",
];

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function slugState(slug: string): { tone: Tone; badge: string; note: string } {
  const v = slug.trim().toLowerCase();
  if (!v) return { tone: "idle", badge: "Type to check", note: "Lowercase letters and numbers only, 3–30 characters. Permanent from day one." };
  if (BLOCKED_SLUGS.includes(v)) return { tone: "bad", badge: "Not allowed", note: "Reserved name — choose another. Never append numbers." };
  if (v.length < 3) return { tone: "bad", badge: "Too short", note: "At least 3 characters." };
  if (TAKEN_SLUGS.includes(v)) return { tone: "warn", badge: "Already taken", note: `Suggest a city qualifier, e.g. ${v}-lagos.` };
  return { tone: "good", badge: "Available", note: `Permanent address: ${v}.futurerealm.sms — changing it later is Super Admin only.` };
}

function categoryFromLevels(levels: Record<string, boolean>): string {
  const hasJunior = levels.Nursery || levels.Primary;
  const hasSenior = levels.JSS || levels.SSS;
  if (hasJunior && hasSenior) return "MIXED";
  if (levels.JSS || levels.SSS) return "SECONDARY";
  if (levels.Primary) return "PRIMARY";
  if (levels.Nursery) return "NURSERY";
  return "MIXED";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6.5px] flex items-center justify-between text-[10.5px] font-semibold text-[#435048]">
        {label}
        {hint ? <span className="font-medium text-[#5E6D64]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-[9px] border-[1.5px] border-[#dee8e2] px-[11.5px] py-[10px] text-[12px] text-[#0d2315] outline-hidden transition focus:border-[#12796a]";

function Chip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-[8px] rounded-[9px] border-[1.5px] px-[12.5px] py-[8px] text-[11.5px] font-medium transition"
      style={{
        borderColor: on ? "#0d2315" : "#dee8e2",
        color: on ? "#0d2315" : "#77857c",
        background: on ? "#f7faf8" : "#ffffff",
      }}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4.5px] border-[1.5px]"
        style={{ background: on ? "#0d2315" : "#ffffff", borderColor: on ? "#0d2315" : "#cfddd5" }}
      >
        {on ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} /> : null}
      </span>
      {label}
    </button>
  );
}

export function AddSchoolWizard({ plans }: { plans: SuperAdminPlanRow[] }) {
  const router = useRouter();
  const notice = useNotice();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; slug: string } | null>(null);

  const defaultPlan = plans.find((plan) => plan.name === "Standard") ?? plans[0];
  const defaults = useMemo<WizardValues>(
    () => ({
      schoolName: "", slug: "", country: "Nigeria", state: "Lagos", city: "", lga: "", address: "", schoolType: "Private", curriculum: "Nigerian NERDC",
      levels: { Nursery: true, Primary: true, JSS: true, SSS: false }, studentCount: "", cacNumber: "",
      firstName: "", lastName: "", position: "Proprietor / School Owner", gender: "Female", email: "", phone: "", sendChannels: { Email: true, WhatsApp: true, SMS: false },
      tier: defaultPlan?.plan ?? "BASIC", accountType: "Trial", trialEndDate: "", billingCycle: "Per semester", leadSource: "Direct", partnerName: "None",
      accountManager: "", notificationCredits: "2,000 credits", internalNote: "",
    }),
    [defaultPlan?.plan],
  );
  const form = useForm<WizardValues>({ resolver: zodResolver(wizardSchema), defaultValues: defaults });
  const { schoolName, slug, levels, email, phone, firstName, lastName, sendChannels, tier, accountType, trialEndDate, accountManager, internalNote, address, city, state, country } = form.watch();
  const panel = useFocusTrap<HTMLDivElement>(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWizard();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  /** A field's registration, marked invalid when the form has something to say about it. */
  const field = (name: keyof WizardValues) => ({ ...form.register(name), "aria-invalid": Boolean(form.formState.errors[name]) });
  const problem = (name: keyof WizardValues) => {
    const message = form.formState.errors[name]?.message;
    return message ? <p role="alert" className="mt-[5px] text-[10.5px] text-danger">{String(message)}</p> : null;
  };

  function openWizard() {
    setOpen(true);
    setStep(1);
  }

  function closeWizard() {
    setOpen(false);
    setStep(1);
  }

  function resetForm() {
    form.reset(defaults);
  }

  async function handleCreate() {
    const adminName = `${firstName.trim()} ${lastName.trim()}`.trim();

    notice.clear();
    setSubmitting(true);
    try {
      const response = await fetch("/api/super-admin/schools", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          name: schoolName.trim(),
          ownerName: adminName,
          ownerEmail: email.trim(),
          ownerPhone: phone.trim() || undefined,
          adminName,
          adminEmail: email.trim(),
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          country: country.trim() || "Nigeria",
          category: categoryFromLevels(levels),
          plan: tier || "BASIC",
          trialEndDate: accountType === "Trial" && trialEndDate ? trialEndDate : undefined,
          notes: internalNote.trim() || undefined,
          sendWelcomeEmail: sendChannels.Email,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { id: string; slug: string };
      };

      if (!response.ok || body.ok === false || !body.data) {
        throw new Error(body.error ?? "Unable to create the school.");
      }

      setResult(body.data);
      setOpen(false);
      setDone(true);
      router.refresh();
    } catch (error) {
      notice.error("The school was not created", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    // Each step is checked as it is left, and a step that is not right is shown, with the field that needs attention.
    const ready = await form.trigger(STEP_FIELDS[step]);
    if (!ready) {
      const first = STEP_FIELDS[step]!.map((name) => form.formState.errors[name]?.message).find(Boolean);
      notice.warning(step === 1 ? "The school needs a name" : "The administrator's details are needed", String(first ?? "Check the highlighted fields."));
      return;
    }
    notice.clear();
    if (step >= 3) {
      void handleCreate();
      return;
    }
    setStep(step + 1);
  }

  function handleBack() {
    if (step <= 1) {
      closeWizard();
      return;
    }
    setStep(step - 1);
  }

  const sl = slugState(slug);
  const slColors = TONE_COLORS[sl.tone];
  const footNote = [
    "Step 1 of 3 — the address is permanent once created",
    "Step 2 of 3 — no password is ever set here",
    "Step 3 of 3 — commission and account manager are recorded on the deal",
  ][step - 1];
  const nextLabel = step === 3 ? (submitting ? "Creating…" : "Create school & send invitation") : "Continue";
  const backLabel = step === 1 ? "Cancel" : "Back";

  return (
    <>
      <button
        type="button"
        onClick={openWizard}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-3 text-[11.5px] font-semibold text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] transition hover:bg-[#eaf3ee]"
      >
        <Plus className="h-4 w-4" />
        Add school
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-(--z-modal) flex items-start justify-center overflow-y-auto bg-ink/55 p-6 backdrop-blur-xs">
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Onboard a school" tabIndex={-1} className="modal-surface my-4 w-full max-w-[820px] overflow-hidden rounded-[18px] bg-white shadow-[0_50px_100px_-40px_rgba(13,35,21,0.6)] outline-hidden">
            <div className="relative overflow-hidden px-[23.5px] py-[20px]" style={{ background: "#0d2315" }}>
              <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
                <circle cx="720" cy="20" r="130" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
              </svg>
              <div className="relative flex items-start justify-between gap-5">
                <div>
                  <p className="mb-1.5 text-[9.5px] font-bold tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    MODULE 02 · SUPER ADMIN CREATES THE SCHOOL ACCOUNT
                  </p>
                  <p className="font-(--font-heading) text-[19px] font-bold tracking-[-0.01em] text-white">Onboard a school</p>
                  <p className="mt-[4.5px] text-xs text-[rgba(255,255,255,0.6)]">
                    Used when the school has agreed to join. The risk check is skipped — the agreement is the verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeWizard}
                  aria-label="Close"
                  className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.12)]"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>

              <div className="relative mt-5 flex gap-2">
                {STEPS.map((s) => {
                  const current = s.n === step;
                  const stepDone = s.n < step;
                  return (
                    <div
                      key={s.n}
                      className="flex items-center gap-[8px] rounded-full px-[11.5px] py-2"
                      style={{
                        color: current || stepDone ? "#ffffff" : "rgba(255,255,255,0.5)",
                        background: current ? "rgba(255,255,255,0.14)" : "transparent",
                        border: current ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                      }}
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold"
                        style={{
                          background: stepDone ? "#ffffff" : current ? "#12796a" : "rgba(255,255,255,0.12)",
                          color: stepDone ? "#0d2315" : "#ffffff",
                        }}
                      >
                        {s.n}
                      </span>
                      <span className="whitespace-nowrap text-[10.5px] font-semibold">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-[23.5px] py-6">
              {step === 1 ? (
                <div className="grid grid-cols-2 gap-x-[16px] gap-y-[13.5px]">
                  <div className="col-span-2">
                    <Field label="School name">
                      <input {...field("schoolName")} placeholder="Power House School" className={inputClass} />
                    </Field>
                    {problem("schoolName")}
                  </div>
                  <div className="col-span-2">
                    <Field label="Short name — creates the permanent web address">
                      <div className="flex items-center rounded-[9px] border-[1.5px] border-[#dee8e2] px-[11.5px] py-[10px] focus-within:border-[#12796a]">
                        <input
                          {...form.register("slug", { onChange: (e) => form.setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")) })}
                          placeholder="powerhouse"
                          className="min-w-0 w-40 border-none bg-transparent text-[12px] font-semibold text-[#0d2315] outline-hidden"
                        />
                        <span className="text-[12px] text-[#5f6e65]">.futurerealm.sms</span>
                        <span
                          className="ml-auto shrink-0 rounded-full px-[8px] py-[2.5px] text-[9.5px] font-bold uppercase tracking-[0.04em]"
                          style={{ background: slColors.bg, color: slColors.fg }}
                        >
                          {sl.badge}
                        </span>
                      </div>
                    </Field>
                    <p className="mt-[5.5px] text-[10px] text-[#5f6e65]">{sl.note}</p>
                  </div>
                  <Field label="Country">
                    <select {...field("country")} className={inputClass}>
                      <option>Nigeria</option>
                      <option>Ghana</option>
                      <option>Kenya</option>
                    </select>
                  </Field>
                  <Field label="State">
                    <select {...field("state")} className={inputClass}>
                      <option>Lagos</option>
                      <option>FCT Abuja</option>
                      <option>Kano</option>
                      <option>Rivers</option>
                    </select>
                  </Field>
                  <Field label="City">
                    <input {...field("city")} placeholder="Ikeja" className={inputClass} />
                  </Field>
                  <Field label="LGA">
                    <input {...field("lga")} placeholder="Ikeja" className={inputClass} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Registered address">
                      <input {...field("address")} placeholder="14 Aminu Kano Crescent, Wuse II" className={inputClass} />
                    </Field>
                  </div>
                  <Field label="School type">
                    <select {...field("schoolType")} className={inputClass}>
                      <option>Private</option>
                      <option>Mission / Faith-based</option>
                      <option>NGO</option>
                      <option>Public</option>
                      <option>International</option>
                    </select>
                  </Field>
                  <Field label="Curriculum">
                    <select {...field("curriculum")} className={inputClass}>
                      <option>Nigerian NERDC</option>
                      <option>British</option>
                      <option>American</option>
                      <option>IB</option>
                      <option>Custom</option>
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <p className="mb-[8px] text-[10.5px] font-semibold text-[#435048]">Levels operated</p>
                    <div className="flex flex-wrap gap-[8px]">
                      {["Nursery", "Primary", "JSS", "SSS"].map((name) => (
                        <Chip key={name} label={name} on={!!levels[name]} onToggle={() => form.setValue("levels", { ...levels, [name]: !levels[name] })} />
                      ))}
                    </div>
                  </div>
                  <Field label="Estimated student count">
                    <input {...field("studentCount")} placeholder="480" className={inputClass} />
                  </Field>
                  <Field label="CAC number" hint="optional">
                    <input {...field("cacNumber")} placeholder="RC-1284772" className={inputClass} />
                  </Field>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid grid-cols-2 gap-x-[16px] gap-y-[13.5px]">
                  <div className="col-span-2 flex items-start gap-[10px] rounded-xl border border-[#e6eee9] bg-[#f7faf8] px-[13.5px] py-[11.5px]">
                    <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#12796a" }} />
                    <p className="text-[10.5px] leading-[1.55] text-[#435048]">
                      You do not set this person&apos;s password. They receive an invitation link — single use, tied to them, valid <b>24 hours</b> — and set it themselves.
                    </p>
                  </div>
                  <Field label="First name">
                    <input {...field("firstName")} placeholder="Hauwa" className={inputClass} />
                    {problem("firstName")}
                  </Field>
                  <Field label="Last name">
                    <input {...field("lastName")} placeholder="Ibrahim" className={inputClass} />
                    {problem("lastName")}
                  </Field>
                  <Field label="Position">
                    <select {...field("position")} className={inputClass}>
                      <option>Proprietor / School Owner</option>
                      <option>Director</option>
                      <option>Principal</option>
                      <option>Head of School</option>
                      <option>Administrator</option>
                    </select>
                  </Field>
                  <Field label="Gender">
                    <select {...field("gender")} className={inputClass}>
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </Field>
                  <div>
                    <Field label="Email address">
                      <input {...field("email")} type="email" placeholder="admin@powerhouse.edu.ng" className={inputClass} />
                    </Field>
                    {problem("email")}
                    <div className="mt-[6.5px] flex items-center gap-[6.5px]">
                      <Mail className="h-3 w-3 shrink-0" style={{ color: "#12796a" }} />
                      <p className="text-[10px] font-medium" style={{ color: "#17604f" }}>Used to sign in and receive the invitation link</p>
                    </div>
                  </div>
                  <div>
                    <Field label="Phone number">
                      <input {...field("phone")} placeholder="+234 803 442 1180" className={inputClass} />
                    </Field>
                    <p className="mt-[6.5px] text-[10px] text-[#5f6e65]">WhatsApp and SMS notice sent alongside the email</p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-[8px] text-[10.5px] font-semibold text-[#435048]">Send the invitation</p>
                    <div className="flex flex-wrap gap-[8px]">
                      {["Email", "WhatsApp", "SMS"].map((name) => (
                        <Chip key={name} label={name} on={!!sendChannels[name]} onToggle={() => form.setValue("sendChannels", { ...sendChannels, [name]: !sendChannels[name] })} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid grid-cols-2 gap-x-[16px] gap-y-[13.5px]">
                  <Field label="Subscription tier" hint="Live rate card">
                    <select {...field("tier")} className={inputClass}>
                      {plans.length === 0 ? (
                        <option value="BASIC">No active plans configured</option>
                      ) : (
                        plans.map((plan) => (
                          <option key={plan.id} value={plan.plan}>
                            {plan.name} — {formatCurrency(plan.monthlyPrice)} / semester
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                  <Field label="Account type">
                    <select {...field("accountType")} className={inputClass}>
                      <option>Trial</option>
                      <option>Paid</option>
                      <option>Pilot</option>
                    </select>
                  </Field>
                  <Field label="Trial end date">
                    <input {...field("trialEndDate")} type="date" className={inputClass} />
                  </Field>
                  <Field label="Billing cycle">
                    <select {...field("billingCycle")} className={inputClass}>
                      <option>Per semester</option>
                      <option>Trial term</option>
                      <option>NGO / Mission discount</option>
                    </select>
                  </Field>
                  <div>
                    <Field label="How we got this school">
                      <select {...field("leadSource")} className={inputClass}>
                        <option>Direct</option>
                        <option>Partner</option>
                        <option>Website</option>
                        <option>Referral</option>
                      </select>
                    </Field>
                    <p className="mt-[6.5px] text-[10px] text-[#5f6e65]">Drives partner commission — recorded on the deal</p>
                  </div>
                  <Field label="Partner name">
                    <select {...field("partnerName")} className={inputClass}>
                      <option>None</option>
                      <option>GSR Education Partners</option>
                      <option>Northern Schools Alliance</option>
                    </select>
                  </Field>
                  <Field label="Assigned account manager">
                    <input {...field("accountManager")} placeholder="Search team member" className={inputClass} />
                  </Field>
                  <Field label="Notification credit allowance">
                    <input {...field("notificationCredits")} className={inputClass} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Internal note" hint="visible to the platform team only">
                      <input {...field("internalNote")} placeholder="Deal closed 12 Aug · 3-year agreement signed by the proprietor" className={inputClass} />
                    </Field>
                  </div>
                  <div className="col-span-2 rounded-xl border border-[#e6eee9] bg-[#f7faf8] px-[16px] py-4">
                    <p className="mb-[10px] text-[11.5px] font-semibold text-[#0d2315]">On submit, this creates automatically</p>
                    <div className="grid grid-cols-2 gap-x-[16px] gap-y-[8px]">
                      {AUTO_ITEMS.map((item) => (
                        <div key={item} className="flex items-start gap-[8px]">
                          <Check className="mt-[2.5px] h-[11.5px] w-[11.5px] shrink-0" style={{ color: "#12796a" }} strokeWidth={2.6} />
                          <p className="text-[10.5px] leading-normal text-[#435048]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-[#edf3ef] bg-[#fbfdfc] px-[23.5px] pt-3 empty:hidden">
              <InlineNotice notice={notice.notice} onDismiss={notice.clear} />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[#edf3ef] bg-[#fbfdfc] px-[23.5px] py-4">
              <p className="text-[10.5px] text-[#5f6e65]">{footNote}</p>
              <div className="flex items-center gap-[8px]">
                <button type="button" onClick={handleBack} className="rounded-[8px] border border-[#cfddd5] bg-white px-[15.5px] py-[9px] text-[11.5px] font-semibold text-[#435048]">
                  {backLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  disabled={submitting}
                  className="btn-primary rounded-[8px] px-[17px] py-[10px] text-[11.5px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {nextLabel}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {done && result && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-ink/55 p-10 backdrop-blur-xs">
          <div className="w-full max-w-[520px] rounded-[18px] bg-white px-[30.5px] pb-[27px] pt-9 text-center shadow-[0_50px_100px_-40px_rgba(13,35,21,0.6)]">
            <div
              className="mx-auto mb-[20px] flex h-16 w-16 items-center justify-center rounded-full border"
              style={{ background: "var(--color-success-dim)", borderColor: "var(--color-success-dim)" }}
            >
              <CheckCircle2 className="h-[27px] w-[27px]" style={{ color: "var(--color-success)" }} />
            </div>
            <p className="mb-2 font-(--font-heading) text-2xl font-bold tracking-[-0.015em] text-[#0d2315]">School created.</p>
            <p className="mx-auto mb-6 max-w-[400px] text-[12px] leading-[1.65] text-[#5f6e65]">
              {schoolName || "The school"} is live and the invitation has gone out. The administrator sets their own password from the link — we never send one.
            </p>

            <div className="mb-[20px] rounded-2xl border border-[#e6eee9] bg-[#f7faf8] px-[16px] py-4 text-left">
              {[
                { k: "Web address", v: `${result.slug}` },
                { k: "Invitation", v: `${Object.entries(sendChannels).filter(([, on]) => on).map(([name]) => name).join(" + ") || "Email"} · expires in 24 hours` },
                {
                  k: "Tier & type",
                  v: `${plans.find((plan) => plan.plan === tier)?.name ?? tier} · ${accountType}${accountType === "Trial" && trialEndDate ? ` to ${trialEndDate}` : ""}`
                },
                { k: "Account manager", v: accountManager || "Unassigned" },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between gap-3.5 py-[6.5px]">
                  <span className="whitespace-nowrap text-[10.5px] text-[#5f6e65]">{row.k}</span>
                  <span className="min-w-0 text-right text-[11.5px] font-semibold text-[#0d2315]">{row.v}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-[9px]">
              <a
                href={`/super-admin/schools/${result.id}`}
                className="btn-primary rounded-[9px] px-[20px] py-3 text-[11.5px]"
              >
                Open school profile
              </a>
              <button
                type="button"
                onClick={() => {
                  setDone(false);
                  setResult(null);
                  resetForm();
                }}
                className="rounded-[9px] border border-[#cfddd5] bg-white px-5 py-3 text-[11.5px] font-semibold text-[#435048]"
              >
                Onboard another
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
