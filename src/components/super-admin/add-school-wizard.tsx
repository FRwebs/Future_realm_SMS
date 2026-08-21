"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Check, CheckCircle2, Mail, Plus, ShieldCheck, X } from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import type { SuperAdminPlanRow } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils/formatters";

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
      <span className="mb-[7px] flex items-center justify-between text-[11.5px] font-semibold text-[#435048]">
        {label}
        {hint ? <span className="font-medium text-[#9fb8a7]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-[10px] border-[1.5px] border-[#dee8e2] px-[13px] py-[11px] text-[13.5px] text-[#0d2315] outline-none transition focus:border-[#12796a]";

function Chip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-[9px] rounded-[10px] border-[1.5px] px-[14px] py-[9px] text-[12.5px] font-medium transition"
      style={{
        borderColor: on ? "#0d2315" : "#dee8e2",
        color: on ? "#0d2315" : "#77857c",
        background: on ? "#f7faf8" : "#ffffff",
      }}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px]"
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
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; slug: string } | null>(null);

  // Step 1 — school details
  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [state, setState] = useState("Lagos");
  const [city, setCity] = useState("");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");
  const [schoolType, setSchoolType] = useState("Private");
  const [curriculum, setCurriculum] = useState("Nigerian NERDC");
  const [levels, setLevels] = useState<Record<string, boolean>>({ Nursery: true, Primary: true, JSS: true, SSS: false });
  const [studentCount, setStudentCount] = useState("");
  const [cacNumber, setCacNumber] = useState("");

  // Step 2 — primary administrator
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("Proprietor / School Owner");
  const [gender, setGender] = useState("Female");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendChannels, setSendChannels] = useState<Record<string, boolean>>({ Email: true, WhatsApp: true, SMS: false });

  // Step 3 — commercial & assignment
  const defaultPlan = plans.find((plan) => plan.name === "Standard") ?? plans[0];
  const [tier, setTier] = useState(defaultPlan?.plan ?? "BASIC");
  const [accountType, setAccountType] = useState("Trial");
  const [trialEndDate, setTrialEndDate] = useState("");
  const [billingCycle, setBillingCycle] = useState("Per term");
  const [leadSource, setLeadSource] = useState("Direct");
  const [partnerName, setPartnerName] = useState("None");
  const [accountManager, setAccountManager] = useState("");
  const [notificationCredits, setNotificationCredits] = useState("2,000 credits");
  const [internalNote, setInternalNote] = useState("");

  function openWizard() {
    setOpen(true);
    setStep(1);
  }

  function closeWizard() {
    setOpen(false);
    setStep(1);
  }

  function resetForm() {
    setSchoolName("");
    setSlug("");
    setCountry("Nigeria");
    setState("Lagos");
    setCity("");
    setLga("");
    setAddress("");
    setSchoolType("Private");
    setCurriculum("Nigerian NERDC");
    setLevels({ Nursery: true, Primary: true, JSS: true, SSS: false });
    setStudentCount("");
    setCacNumber("");
    setFirstName("");
    setLastName("");
    setPosition("Proprietor / School Owner");
    setGender("Female");
    setEmail("");
    setPhone("");
    setSendChannels({ Email: true, WhatsApp: true, SMS: false });
    setTier(defaultPlan?.plan ?? "BASIC");
    setAccountType("Trial");
    setTrialEndDate("");
    setBillingCycle("Per term");
    setLeadSource("Direct");
    setPartnerName("None");
    setAccountManager("");
    setNotificationCredits("2,000 credits");
    setInternalNote("");
  }

  async function handleCreate() {
    const adminName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (schoolName.trim().length < 2) {
      showToast({ variant: "error", title: "School name required", description: "Enter the school's full name to continue." });
      setStep(1);
      return;
    }
    if (adminName.length < 2 || !email.trim()) {
      showToast({ variant: "error", title: "Administrator details required", description: "Enter the primary administrator's name and email." });
      setStep(2);
      return;
    }

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
      showToast({
        variant: "error",
        title: "Unable to create school",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
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
      <button type="button" onClick={openWizard} className="btn-secondary px-5">
        <Plus className="h-4 w-4" />
        Add school
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-ink/55 p-6 backdrop-blur-sm">
          <div className="modal-surface my-4 w-full max-w-[820px] overflow-hidden rounded-[20px] bg-white shadow-[0_50px_100px_-40px_rgba(13,35,21,0.6)]">
            <div className="relative overflow-hidden px-[26px] py-[22px]" style={{ background: "#0d2315" }}>
              <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice">
                <circle cx="720" cy="20" r="130" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
              </svg>
              <div className="relative flex items-start justify-between gap-5">
                <div>
                  <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    MODULE 02 · SUPER ADMIN CREATES THE SCHOOL ACCOUNT
                  </p>
                  <p className="font-[var(--font-heading)] text-[21px] font-bold tracking-[-0.01em] text-white">Onboard a school</p>
                  <p className="mt-[5px] text-xs text-[rgba(255,255,255,0.6)]">
                    Used when the school has agreed to join. The risk check is skipped — the agreement is the verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeWizard}
                  aria-label="Close"
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.12)]"
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
                      className="flex items-center gap-[9px] rounded-full px-[13px] py-2"
                      style={{
                        color: current || stepDone ? "#ffffff" : "rgba(255,255,255,0.5)",
                        background: current ? "rgba(255,255,255,0.14)" : "transparent",
                        border: current ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                      }}
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
                        style={{
                          background: stepDone ? "#ffffff" : current ? "#12796a" : "rgba(255,255,255,0.12)",
                          color: stepDone ? "#0d2315" : "#ffffff",
                        }}
                      >
                        {s.n}
                      </span>
                      <span className="whitespace-nowrap text-[11.5px] font-semibold">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-[26px] py-6">
              {step === 1 ? (
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-[15px]">
                  <div className="col-span-2">
                    <Field label="School name">
                      <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Power House School" className={inputClass} />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Short name — creates the permanent web address">
                      <div className="flex items-center rounded-[10px] border-[1.5px] border-[#dee8e2] px-[13px] py-[11px] focus-within:border-[#12796a]">
                        <input
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          placeholder="powerhouse"
                          className="min-w-0 w-40 border-none bg-transparent text-[13.5px] font-semibold text-[#0d2315] outline-none"
                        />
                        <span className="text-[13.5px] text-[#8c9a92]">.futurerealm.sms</span>
                        <span
                          className="ml-auto shrink-0 rounded-full px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em]"
                          style={{ background: slColors.bg, color: slColors.fg }}
                        >
                          {sl.badge}
                        </span>
                      </div>
                    </Field>
                    <p className="mt-[6px] text-[11px] text-[#8c9a92]">{sl.note}</p>
                  </div>
                  <Field label="Country">
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
                      <option>Nigeria</option>
                      <option>Ghana</option>
                      <option>Kenya</option>
                    </select>
                  </Field>
                  <Field label="State">
                    <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                      <option>Lagos</option>
                      <option>FCT Abuja</option>
                      <option>Kano</option>
                      <option>Rivers</option>
                    </select>
                  </Field>
                  <Field label="City">
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ikeja" className={inputClass} />
                  </Field>
                  <Field label="LGA">
                    <input value={lga} onChange={(e) => setLga(e.target.value)} placeholder="Ikeja" className={inputClass} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Registered address">
                      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Aminu Kano Crescent, Wuse II" className={inputClass} />
                    </Field>
                  </div>
                  <Field label="School type">
                    <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)} className={inputClass}>
                      <option>Private</option>
                      <option>Mission / Faith-based</option>
                      <option>NGO</option>
                      <option>Public</option>
                      <option>International</option>
                    </select>
                  </Field>
                  <Field label="Curriculum">
                    <select value={curriculum} onChange={(e) => setCurriculum(e.target.value)} className={inputClass}>
                      <option>Nigerian NERDC</option>
                      <option>British</option>
                      <option>American</option>
                      <option>IB</option>
                      <option>Custom</option>
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <p className="mb-[9px] text-[11.5px] font-semibold text-[#435048]">Levels operated</p>
                    <div className="flex flex-wrap gap-[9px]">
                      {["Nursery", "Primary", "JSS", "SSS"].map((name) => (
                        <Chip key={name} label={name} on={!!levels[name]} onToggle={() => setLevels((cur) => ({ ...cur, [name]: !cur[name] }))} />
                      ))}
                    </div>
                  </div>
                  <Field label="Estimated student count">
                    <input value={studentCount} onChange={(e) => setStudentCount(e.target.value)} placeholder="480" className={inputClass} />
                  </Field>
                  <Field label="CAC number" hint="optional">
                    <input value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} placeholder="RC-1284772" className={inputClass} />
                  </Field>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-[15px]">
                  <div className="col-span-2 flex items-start gap-[11px] rounded-xl border border-[#e6eee9] bg-[#f7faf8] px-[15px] py-[13px]">
                    <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#12796a" }} />
                    <p className="text-[11.5px] leading-[1.55] text-[#435048]">
                      You do not set this person&apos;s password. They receive an invitation link — single use, tied to them, valid <b>24 hours</b> — and set it themselves.
                    </p>
                  </div>
                  <Field label="First name">
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Hauwa" className={inputClass} />
                  </Field>
                  <Field label="Last name">
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ibrahim" className={inputClass} />
                  </Field>
                  <Field label="Position">
                    <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass}>
                      <option>Proprietor / School Owner</option>
                      <option>Director</option>
                      <option>Principal</option>
                      <option>Head of School</option>
                      <option>Administrator</option>
                    </select>
                  </Field>
                  <Field label="Gender">
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </Field>
                  <div>
                    <Field label="Email address">
                      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@powerhouse.edu.ng" className={inputClass} />
                    </Field>
                    <div className="mt-[7px] flex items-center gap-[7px]">
                      <Mail className="h-3 w-3 shrink-0" style={{ color: "#12796a" }} />
                      <p className="text-[11px] font-medium" style={{ color: "#17604f" }}>Used to sign in and receive the invitation link</p>
                    </div>
                  </div>
                  <div>
                    <Field label="Phone number">
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 803 442 1180" className={inputClass} />
                    </Field>
                    <p className="mt-[7px] text-[11px] text-[#8c9a92]">WhatsApp and SMS notice sent alongside the email</p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-[9px] text-[11.5px] font-semibold text-[#435048]">Send the invitation</p>
                    <div className="flex flex-wrap gap-[9px]">
                      {["Email", "WhatsApp", "SMS"].map((name) => (
                        <Chip key={name} label={name} on={!!sendChannels[name]} onToggle={() => setSendChannels((cur) => ({ ...cur, [name]: !cur[name] }))} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-[15px]">
                  <Field label="Subscription tier" hint="Live rate card">
                    <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputClass}>
                      {plans.length === 0 ? (
                        <option value="BASIC">No active plans configured</option>
                      ) : (
                        plans.map((plan) => (
                          <option key={plan.id} value={plan.plan}>
                            {plan.name} — {formatCurrency(plan.monthlyPrice)} / term
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                  <Field label="Account type">
                    <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputClass}>
                      <option>Trial</option>
                      <option>Paid</option>
                      <option>Pilot</option>
                    </select>
                  </Field>
                  <Field label="Trial end date">
                    <input value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} type="date" className={inputClass} />
                  </Field>
                  <Field label="Billing cycle">
                    <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)} className={inputClass}>
                      <option>Per term</option>
                      <option>Annual</option>
                      <option>Monthly</option>
                    </select>
                  </Field>
                  <div>
                    <Field label="How we got this school">
                      <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} className={inputClass}>
                        <option>Direct</option>
                        <option>Partner</option>
                        <option>Website</option>
                        <option>Referral</option>
                      </select>
                    </Field>
                    <p className="mt-[7px] text-[11px] text-[#8c9a92]">Drives partner commission — recorded on the deal</p>
                  </div>
                  <Field label="Partner name">
                    <select value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className={inputClass}>
                      <option>None</option>
                      <option>GSR Education Partners</option>
                      <option>Northern Schools Alliance</option>
                    </select>
                  </Field>
                  <Field label="Assigned account manager">
                    <input value={accountManager} onChange={(e) => setAccountManager(e.target.value)} placeholder="Search team member" className={inputClass} />
                  </Field>
                  <Field label="Notification credit allowance">
                    <input value={notificationCredits} onChange={(e) => setNotificationCredits(e.target.value)} className={inputClass} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Internal note" hint="visible to the platform team only">
                      <input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Deal closed 12 Aug · 3-year agreement signed by the proprietor" className={inputClass} />
                    </Field>
                  </div>
                  <div className="col-span-2 rounded-xl border border-[#e6eee9] bg-[#f7faf8] px-[18px] py-4">
                    <p className="mb-[11px] text-[12.5px] font-semibold text-[#0d2315]">On submit, this creates automatically</p>
                    <div className="grid grid-cols-2 gap-x-[18px] gap-y-[9px]">
                      {AUTO_ITEMS.map((item) => (
                        <div key={item} className="flex items-start gap-[9px]">
                          <Check className="mt-[3px] h-[13px] w-[13px] shrink-0" style={{ color: "#12796a" }} strokeWidth={2.6} />
                          <p className="text-[11.5px] leading-[1.5] text-[#435048]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#edf3ef] bg-[#fbfdfc] px-[26px] py-4">
              <p className="text-[11.5px] text-[#8c9a92]">{footNote}</p>
              <div className="flex items-center gap-[9px]">
                <button type="button" onClick={handleBack} className="rounded-[9px] border border-[#cfddd5] bg-white px-[17px] py-[10px] text-[12.5px] font-semibold text-[#435048]">
                  {backLabel}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  className="btn-primary rounded-[9px] px-[19px] py-[11px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-ink/55 p-10 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-[20px] bg-white px-[34px] pb-[30px] pt-9 text-center shadow-[0_50px_100px_-40px_rgba(13,35,21,0.6)]">
            <div
              className="mx-auto mb-[22px] flex h-16 w-16 items-center justify-center rounded-full border"
              style={{ background: "var(--color-success-dim)", borderColor: "var(--color-success-dim)" }}
            >
              <CheckCircle2 className="h-[30px] w-[30px]" style={{ color: "var(--color-success)" }} />
            </div>
            <p className="mb-2 font-[var(--font-heading)] text-2xl font-bold tracking-[-0.015em] text-[#0d2315]">School created.</p>
            <p className="mx-auto mb-6 max-w-[400px] text-[13.5px] leading-[1.65] text-[#77857c]">
              {schoolName || "The school"} is live and the invitation has gone out. The administrator sets their own password from the link — we never send one.
            </p>

            <div className="mb-[22px] rounded-2xl border border-[#e6eee9] bg-[#f7faf8] px-[18px] py-4 text-left">
              {[
                { k: "Web address", v: `${result.slug}` },
                { k: "Invitation", v: `${Object.entries(sendChannels).filter(([, on]) => on).map(([name]) => name).join(" + ") || "Email"} · expires in 24 hours` },
                {
                  k: "Tier & type",
                  v: `${plans.find((plan) => plan.plan === tier)?.name ?? tier} · ${accountType}${accountType === "Trial" && trialEndDate ? ` to ${trialEndDate}` : ""}`
                },
                { k: "Account manager", v: accountManager || "Unassigned" },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between gap-3.5 py-[7px]">
                  <span className="whitespace-nowrap text-[11.5px] text-[#8c9a92]">{row.k}</span>
                  <span className="min-w-0 text-right text-[12.5px] font-semibold text-[#0d2315]">{row.v}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-[10px]">
              <a
                href={`/super-admin/schools/${result.id}`}
                className="btn-primary rounded-[10px] px-[22px] py-3 text-[13px]"
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
                className="rounded-[10px] border border-[#cfddd5] bg-white px-5 py-3 text-[13px] font-semibold text-[#435048]"
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
