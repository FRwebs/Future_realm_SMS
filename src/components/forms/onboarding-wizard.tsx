"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Mail,
  School as SchoolIcon
} from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";

type SignupRole = "admin" | "teacher";
type View = "fork" | "wiz" | "done" | "verify";
type SlugTone = "idle" | "good" | "warn" | "bad";

interface SlugState {
  tone: SlugTone;
  badge: string;
  note: string;
}

const ADMIN_STEPS = [
  { label: "About you", sub: "Your name, role and email" },
  { label: "About your school", sub: "Details and your web address" },
  { label: "Create password", sub: "Minimum 8 characters" },
  { label: "Free trial", sub: "30 days, every feature" }
];

const TEACHER_STEPS = [
  { label: "About you", sub: "Your name, email and country" },
  { label: "What you teach", sub: "School, subjects and level" },
  { label: "Create password", sub: "Minimum 8 characters" }
];

const LEVEL_OPTIONS = ["Nursery", "Primary", "JSS", "SSS"] as const;
const SUBJECT_OPTIONS = [
  "Mathematics",
  "Further Maths",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Basic Science",
  "Economics",
  "Civic Education"
];
const AUTO_SETUP_ADMIN = [
  "School record created and your web address goes live",
  "Curriculum and grading templates loaded for your country",
  "Default staff role templates installed",
  "Admin account created — permanent login issued",
  "Trial record created, every feature unlocked for 30 days"
];

function resolveLandingPath(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? getDefaultPathForRole(normalizedRole) : "/dashboard";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function fieldWrap(children: React.ReactNode) {
  return <div className="relative">{children}</div>;
}

function inputClass(extra = "") {
  return `w-full rounded-[10px] border-[1.5px] border-[#dee8e2] px-[13px] py-[11px] text-[13.5px] text-[#0d2315] outline-none transition placeholder:text-[#b4c4bb] focus:border-[#12796a] ${extra}`;
}

function fieldLabel(text: string, optional?: boolean) {
  return (
    <div className="mb-[7px] text-[11.5px] font-semibold text-[#435048]">
      {text}
      {optional ? <span className="ml-1 font-medium text-[#9fb8a7]">optional</span> : null}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const { showToast } = useToast();

  const [view, setView] = useState<View>("fork");
  const [role, setRole] = useState<SignupRole>("admin");
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [country, setCountry] = useState("Nigeria");

  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState<SlugState>({
    tone: "idle",
    badge: "Type to check",
    note: "Lowercase letters and numbers only, 3–30 characters."
  });
  const [state, setState] = useState("Lagos");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [schoolType, setSchoolType] = useState("Private");
  const [curriculum, setCurriculum] = useState("Nigerian NERDC");
  const [cacNumber, setCacNumber] = useState("");
  const [ministryApprovalNumber, setMinistryApprovalNumber] = useState("");
  const [levels, setLevels] = useState<Record<string, boolean>>({
    Nursery: true,
    Primary: true,
    JSS: true,
    SSS: false
  });

  const [teacherSchoolName, setTeacherSchoolName] = useState("");
  const [subjects, setSubjects] = useState<Record<string, boolean>>({ Mathematics: true });
  const [level, setLevel] = useState("Primary");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otp, setOtp] = useState("");
  const otpInputRef = useRef<HTMLInputElement>(null);
  const [verifyPending, setVerifyPending] = useState(false);
  const [expiresInSeconds, setExpiresInSeconds] = useState(15 * 60);
  const [doneRole, setDoneRole] = useState<SignupRole>("admin");
  const [doneSchoolSlug, setDoneSchoolSlug] = useState("");

  const admin = role === "admin";
  const lastStep = admin ? 4 : 3;
  const steps = admin ? ADMIN_STEPS : TEACHER_STEPS;

  useEffect(() => {
    if (!admin || step !== 2) return;
    const value = slug.toLowerCase().trim();
    if (!value) {
      setSlugState({ tone: "idle", badge: "Type to check", note: "Lowercase letters and numbers only, 3–30 characters." });
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/onboarding/slug-check?slug=${encodeURIComponent(value)}`);
        const body = (await response.json()) as { data?: SlugState };
        if (body.data) setSlugState(body.data);
      } catch {
        // Availability check is advisory only; the create call re-validates server-side.
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [slug, step, admin]);

  useEffect(() => {
    if (view !== "verify") return;
    setExpiresInSeconds(15 * 60);
    const interval = window.setInterval(() => {
      setExpiresInSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [view]);

  const pwScore = useMemo(() => {
    let n = 0;
    if (password.length >= 8) n++;
    if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) n++;
    if (password.length >= 12) n++;
    return n;
  }, [password]);
  const pwLabel = ["Too short", "Weak", "Good", "Strong"][pwScore];
  const pwColor = pwScore >= 2 ? "#12796a" : pwScore === 1 ? "#8a5a17" : "#9b2f2f";

  function pick(nextRole: SignupRole) {
    setRole(nextRole);
    setStep(1);
    setView("wiz");
    window.scrollTo(0, 0);
  }

  function goBack() {
    if (step <= 1) {
      setView("fork");
      return;
    }
    setStep((current) => current - 1);
    window.scrollTo(0, 0);
  }

  function toggleLevel(name: string) {
    setLevels((current) => ({ ...current, [name]: !current[name] }));
  }

  function toggleSubject(name: string) {
    setSubjects((current) => ({ ...current, [name]: !current[name] }));
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!firstName.trim() || !lastName.trim()) return "Enter your first and last name.";
      if (!email.trim()) return "Enter your email address.";
      if (admin && !position) return "Select your position.";
      if (!admin && !position) return "Select what you teach as.";
    }
    if (step === 2 && admin) {
      if (!schoolName.trim()) return "Enter your school's name.";
      if (!slug.trim() || slugState.tone === "bad" || slugState.tone === "warn") {
        return "Choose an available web address for your school.";
      }
    }
    if (step === 3) {
      if (password.length < 8) return "Password must be at least 8 characters.";
      if (password !== confirmPassword) return "Passwords do not match.";
    }
    return null;
  }

  async function handleNext() {
    const validationError = validateStep();
    if (validationError) {
      showToast({ variant: "error", title: "Check that step", description: validationError });
      return;
    }
    if (step < lastStep) {
      setStep((current) => current + 1);
      window.scrollTo(0, 0);
      return;
    }
    await submit();
  }

  async function submit() {
    setPending(true);
    try {
      const endpoint = admin ? "/api/v1/onboarding/schools" : "/api/v1/onboarding/teachers";
      const body = admin
        ? {
            schoolName,
            slug,
            category:
              Object.entries(levels)
                .filter(([, on]) => on)
                .map(([name]) => name).length > 1
                ? "MIXED"
                : (Object.entries(levels).find(([, on]) => on)?.[0]?.toUpperCase() ?? "MIXED"),
            ownerName: `${firstName} ${lastName}`,
            ownerEmail: email,
            ownerPhone: phone,
            password,
            address,
            city,
            state,
            cacNumber: cacNumber || undefined,
            ministryApprovalNumber: ministryApprovalNumber || undefined
          }
        : {
            firstName,
            lastName,
            gender: gender || undefined,
            phone,
            email,
            position,
            country,
            schoolName: teacherSchoolName || undefined,
            subjects: Object.entries(subjects)
              .filter(([, on]) => on)
              .map(([name]) => name),
            level,
            password
          };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const responseBody = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { user: { role: string }; school: { slug: string } };
      };

      if (!response.ok || responseBody.ok === false || !responseBody.data) {
        const nextError = responseBody.error ?? "Unable to create your account";
        showToast({ variant: "error", title: "Something went wrong", description: nextError });
        setPending(false);
        return;
      }

      setDoneRole(role);
      setDoneSchoolSlug(responseBody.data.school?.slug ?? "");
      setView("done");
      window.scrollTo(0, 0);
    } catch {
      showToast({
        variant: "error",
        title: "Server unavailable",
        description: "Unable to reach the server. Please make sure the app is running and try again."
      });
    } finally {
      setPending(false);
    }
  }

  const goToDashboard = useCallback(() => {
    const nextPath = resolveLandingPath(admin ? position || "SCHOOL_OWNER" : (position as string));
    router.push(nextPath);
    router.refresh();
  }, [admin, position, router]);

  async function handleVerify() {
    if (otp.length !== 6) return;
    setVerifyPending(true);
    try {
      const response = await fetch("/api/v1/onboarding/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) {
        showToast({ variant: "error", title: "Verification failed", description: body.error ?? "Incorrect code" });
        setVerifyPending(false);
        return;
      }
      showToast({ variant: "success", title: "Email verified", description: "Taking you to your workspace now." });
      window.setTimeout(goToDashboard, 250);
    } catch {
      showToast({
        variant: "error",
        title: "Server unavailable",
        description: "Unable to reach the server. Please try again."
      });
      setVerifyPending(false);
    }
  }

  async function handleResend() {
    try {
      const response = await fetch("/api/v1/onboarding/resend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) {
        showToast({ variant: "error", title: "Unable to resend", description: body.error ?? "Please try again shortly." });
        return;
      }
      setExpiresInSeconds(15 * 60);
      showToast({ variant: "success", title: "Code sent", description: "Check your inbox for the new code." });
    } catch {
      showToast({ variant: "error", title: "Server unavailable", description: "Please try again shortly." });
    }
  }

  const otpBoxes = [0, 1, 2, 3, 4, 5].map((i) => otp[i] || "");
  const otpExpiryLabel = `${Math.floor(expiresInSeconds / 60)}:${String(expiresInSeconds % 60).padStart(2, "0")}`;

  const slugToneColors: Record<SlugTone, [string, string]> = {
    good: ["#edf7f1", "#17604f"],
    warn: ["#fdf3e6", "#8a5a17"],
    bad: ["#fceeee", "#9b2f2f"],
    idle: ["#f2f6f4", "#8c9a92"]
  };

  if (view === "fork") {
    return (
      <div className="flex min-h-screen flex-col text-[#0d2315]" style={{ background: "#f4f8f6" }}>
        <div className="flex items-center justify-between px-6 py-[22px] sm:px-12">
          <span className="font-[var(--font-heading)] text-lg font-extrabold text-[#0d2315]">FutureRealm SMS</span>
          <div className="text-[12.5px] text-[#435048]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#12796a] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[820px]">
            <div className="mb-8 text-center">
              <div className="mb-[18px] inline-flex items-center gap-2 rounded-full border border-[#d3dfd7] bg-[#eaf0ec] px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#12796a" }} />
                <span className="text-[11.5px] font-semibold tracking-[0.02em] text-[#17604f]">
                  INSTANT SETUP · NO APPROVAL NEEDED
                </span>
              </div>
              <h1 className="mb-[10px] font-[var(--font-heading)] text-[34px] font-bold tracking-[-0.02em] text-[#0d2315]">
                Who are you signing up as?
              </h1>
              <p className="mx-auto max-w-[460px] text-[14.5px] leading-[1.6] text-[#77857c]">
                This decides what we build for you in the next minute — a full school workspace, or a personal
                teaching workspace.
              </p>
            </div>

            <div className="grid gap-[18px] sm:grid-cols-2">
              <button
                type="button"
                onClick={() => pick("admin")}
                className="group rounded-[18px] border-[1.5px] border-[#dee8e2] bg-white p-[26px] text-left shadow-[0_14px_30px_-22px_rgba(13,35,21,0.35)] transition hover:-translate-y-0.5 hover:border-[#0d2315]"
              >
                <div className="mb-[18px] flex h-11 w-11 items-center justify-center rounded-[13px]" style={{ background: "#0d2315" }}>
                  <SchoolIcon className="h-[21px] w-[21px] text-white" strokeWidth={1.9} />
                </div>
                <div className="mb-1.5 font-[var(--font-heading)] text-xl font-bold text-[#0d2315]">School Administrator</div>
                <p className="mb-[18px] text-[12.5px] leading-[1.6] text-[#77857c]">
                  Proprietor, Director, Principal, Head of School or Administrator setting up their school.
                </p>
                <div className="flex flex-col gap-[9px]">
                  {[
                    "Your school's own web address, instantly",
                    "Full admin dashboard, ready to configure",
                    "30-day free trial · no card required",
                    "Permanent login, issued immediately"
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-[9px] text-[12.5px] text-[#435048]">
                      <Check className="h-[13px] w-[13px] shrink-0" style={{ color: "#12796a" }} strokeWidth={2.6} />
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-[22px] flex items-center gap-2 text-[13px] font-semibold text-[#0d2315]">
                  Continue as school administrator
                  <ArrowRight className="h-[15px] w-[15px] transition group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => pick("teacher")}
                className="group rounded-[18px] border-[1.5px] border-[#dee8e2] bg-white p-[26px] text-left shadow-[0_14px_30px_-22px_rgba(13,35,21,0.35)] transition hover:-translate-y-0.5 hover:border-[#0d2315]"
              >
                <div className="mb-[18px] flex h-11 w-11 items-center justify-center rounded-[13px]" style={{ background: "#12796a" }}>
                  <GraduationCap className="h-[21px] w-[21px] text-white" strokeWidth={1.9} />
                </div>
                <div className="mb-1.5 font-[var(--font-heading)] text-xl font-bold text-[#0d2315]">Teacher</div>
                <p className="mb-[18px] text-[12.5px] leading-[1.6] text-[#77857c]">
                  Signing up on your own, whether or not your school is on FutureRealm yet.
                </p>
                <div className="flex flex-col gap-[9px]">
                  {[
                    "Personal gradebook and score calculator",
                    "Attendance, lesson notes and timetable",
                    "Free, indefinitely · no school required",
                    "Link to your school any time later"
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-[9px] text-[12.5px] text-[#435048]">
                      <Check className="h-[13px] w-[13px] shrink-0" style={{ color: "#12796a" }} strokeWidth={2.6} />
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-[22px] flex items-center gap-2 text-[13px] font-semibold text-[#0d2315]">
                  Continue as teacher
                  <ArrowRight className="h-[15px] w-[15px] transition group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>

            <p className="mt-[26px] text-center text-[12.5px] text-[#8c9a92]">
              Parents and students receive their accounts from their school — they cannot sign up here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === "wiz") {
    return (
      <div className="flex min-h-screen text-[#0d2315]" style={{ background: "#f4f8f6" }}>
        <div className="relative hidden w-[340px] shrink-0 flex-col justify-between overflow-hidden px-[34px] py-10 md:flex" style={{ background: "#0d2315" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-55" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
            <circle cx="360" cy="120" r="180" stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />
            <path d="M-40 800 Q 140 700 300 780 T 600 720" stroke="rgba(255,255,255,0.06)" strokeWidth="1.4" fill="none" />
          </svg>
          <div className="relative z-[1]">
            <span className="mb-10 block font-[var(--font-heading)] text-base font-extrabold text-white">FutureRealm SMS</span>
            <div className="mb-2 text-[10.5px] font-bold tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {admin ? "SCHOOL ADMINISTRATOR SIGNUP" : "TEACHER SIGNUP"}
            </div>
            <div className="mb-8 font-[var(--font-heading)] text-[23px] font-bold leading-[1.25] text-white">
              {admin ? "Your school, live in under a minute." : "Your own teaching workspace, free forever."}
            </div>
            <div className="flex flex-col gap-0.5">
              {steps.map((s, i) => {
                const n = i + 1;
                const done = n < step;
                const current = n === step;
                return (
                  <div key={s.label} className="flex items-start gap-[13px]">
                    <div className="flex shrink-0 flex-col items-center">
                      <div
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11.5px] font-bold"
                        style={{
                          background: done ? "#fff" : current ? "#12796a" : "rgba(255,255,255,0.1)",
                          color: done ? "#0d2315" : current ? "#fff" : "rgba(255,255,255,0.5)",
                          boxShadow: current ? "0 0 0 4px rgba(18,121,106,0.22)" : "none"
                        }}
                      >
                        {done ? <Check className="h-[11px] w-[11px]" strokeWidth={3.4} /> : n}
                      </div>
                      {i < steps.length - 1 ? (
                        <div
                          className="w-[1.5px] flex-1"
                          style={{ minHeight: 22, background: done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)" }}
                        />
                      ) : null}
                    </div>
                    <div className="pb-5">
                      <div className="text-[13px] font-semibold" style={{ color: current || done ? "#fff" : "rgba(255,255,255,0.55)" }}>
                        {s.label}
                      </div>
                      <div className="mt-[3px] text-[11.5px] leading-[1.5] text-[rgba(255,255,255,0.42)]">{s.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative z-[1] rounded-[13px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-4 py-[15px]">
            <p className="text-[11.5px] leading-[1.55] text-[rgba(255,255,255,0.8)]">
              {admin
                ? "Nothing here waits for approval. When you finish, your school exists, your address is live, and you are signed in."
                : "No school required, no review, no waiting. If your school joins FutureRealm later, you keep this account."}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-6 pt-[22px] sm:px-11">
            <div className="text-xs text-[#8c9a92]">
              Step {step} of {lastStep}
            </div>
            <div className="text-[12.5px] text-[#435048]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#12796a] hover:underline">
                Sign in
              </Link>
            </div>
          </div>

          <div className="max-w-[820px] flex-1 px-6 py-[26px] sm:px-11">
            {step === 1 ? (
              <div>
                <div className="mb-1.5 font-[var(--font-heading)] text-[27px] font-bold tracking-[-0.015em] text-[#0d2315]">About you</div>
                <p className="mb-7 text-[13.5px] text-[#77857c]">
                  {admin
                    ? "Instant — no human approval stands between you and a working school."
                    : "Instant. No review, no school required, no waiting."}
                </p>
                <div className="rounded-2xl border border-[#dee8e2] bg-white p-[26px]">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      {fieldLabel("First name")}
                      {fieldWrap(
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass()} placeholder="Nkechi" />
                      )}
                    </label>
                    <label>
                      {fieldLabel("Last name")}
                      {fieldWrap(
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass()} placeholder="Obiora" />
                      )}
                    </label>
                    <label>
                      {fieldLabel("Gender")}
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass("bg-white")}>
                        <option value="">Select</option>
                        <option value="FEMALE">Female</option>
                        <option value="MALE">Male</option>
                      </select>
                    </label>
                    <label>
                      {fieldLabel("Phone number")}
                      {fieldWrap(
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass()} placeholder="+234 803 220 1190" />
                      )}
                    </label>
                    <label className="sm:col-span-2">
                      {fieldLabel("Email address")}
                      {fieldWrap(
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={inputClass()}
                          placeholder="you@yourschool.edu.ng"
                        />
                      )}
                      <div className="mt-1.5 text-[11px] text-[#8c9a92]">
                        One email address is one account across the whole platform. We&apos;ll send a 6-digit
                        verification code here.
                      </div>
                    </label>
                    <label className={admin ? "sm:col-span-2" : ""}>
                      {fieldLabel(admin ? "Your position" : "What you teach as")}
                      <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass("bg-white")}>
                        <option value="">{admin ? "Select your position" : "Select"}</option>
                        {admin ? (
                          <>
                            <option value="PROPRIETOR">Proprietor / School Owner</option>
                            <option value="ADMINISTRATOR">Director</option>
                            <option value="PRINCIPAL">Principal</option>
                            <option value="HEAD_TEACHER">Head of School</option>
                            <option value="ADMIN_OFFICER">Administrator</option>
                          </>
                        ) : (
                          <>
                            <option value="SUBJECT_TEACHER">Subject Teacher</option>
                            <option value="CLASS_TEACHER">Form Teacher / Class Teacher</option>
                            <option value="HEAD_OF_DEPARTMENT">Head of Department</option>
                          </>
                        )}
                      </select>
                    </label>
                    {!admin ? (
                      <label>
                        {fieldLabel("Country")}
                        <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass("bg-white")}>
                          <option>Nigeria</option>
                          <option>Ghana</option>
                          <option>Kenya</option>
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 && admin ? (
              <div>
                <div className="mb-1.5 font-[var(--font-heading)] text-[27px] font-bold tracking-[-0.015em] text-[#0d2315]">About your school</div>
                <p className="mb-7 text-[13.5px] text-[#77857c]">
                  Your short name becomes your permanent web address — the one every invitation email will carry.
                </p>
                <div className="mb-4 rounded-2xl border border-[#dee8e2] bg-white p-[26px]">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      {fieldLabel("School name")}
                      {fieldWrap(
                        <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={inputClass()} placeholder="Power House School" />
                      )}
                    </label>
                    <label className="sm:col-span-2">
                      <div className="mb-[7px] flex items-center justify-between">
                        <span className="text-[11.5px] font-semibold text-[#435048]">Short name — creates your web address</span>
                        <span
                          className="rounded-full px-[9px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em]"
                          style={{ background: slugToneColors[slugState.tone][0], color: slugToneColors[slugState.tone][1] }}
                        >
                          {slugState.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 rounded-[10px] border-[1.5px] border-[#dee8e2] px-[13px] py-[11px] focus-within:border-[#12796a]">
                        <input
                          value={slug}
                          onChange={(e) => setSlug(slugify(e.target.value))}
                          className="w-[150px] min-w-0 border-none bg-transparent text-[13.5px] font-semibold text-[#0d2315] outline-none"
                          placeholder="powerhouse"
                        />
                        <span className="text-[13.5px] text-[#8c9a92]">.futurerealm.school</span>
                      </div>
                      <div className="mt-1.5 text-[11px] leading-[1.5] text-[#8c9a92]">{slugState.note}</div>
                    </label>
                    <label>
                      {fieldLabel("State")}
                      <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass("bg-white")}>
                        <option>Lagos</option>
                        <option>FCT Abuja</option>
                        <option>Kano</option>
                        <option>Rivers</option>
                      </select>
                    </label>
                    <label>
                      {fieldLabel("City")}
                      {fieldWrap(<input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass()} placeholder="Ikeja" />)}
                    </label>
                    <label className="sm:col-span-2">
                      {fieldLabel("Full address")}
                      {fieldWrap(
                        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass()} placeholder="14 Aminu Kano Crescent, Wuse II" />
                      )}
                    </label>
                    <label>
                      {fieldLabel("School type")}
                      <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)} className={inputClass("bg-white")}>
                        <option>Private</option>
                        <option>Mission / Faith-based</option>
                        <option>NGO</option>
                        <option>Public</option>
                        <option>International</option>
                      </select>
                    </label>
                    <label>
                      {fieldLabel("Curriculum")}
                      <select value={curriculum} onChange={(e) => setCurriculum(e.target.value)} className={inputClass("bg-white")}>
                        <option>Nigerian NERDC</option>
                        <option>British</option>
                        <option>American</option>
                        <option>IB</option>
                        <option>Custom</option>
                      </select>
                    </label>
                    <label className="sm:col-span-2">
                      <div className="mb-[9px] text-[11.5px] font-semibold text-[#435048]">Levels operated</div>
                      <div className="flex flex-wrap gap-[9px]">
                        {LEVEL_OPTIONS.map((lv) => {
                          const on = !!levels[lv];
                          return (
                            <button
                              type="button"
                              key={lv}
                              onClick={() => toggleLevel(lv)}
                              className="flex items-center gap-[9px] rounded-[10px] border-[1.5px] px-[14px] py-[9px] text-[12.5px] font-medium transition"
                              style={{
                                borderColor: on ? "#0d2315" : "#dee8e2",
                                color: on ? "#0d2315" : "#77857c",
                                background: on ? "#f7faf8" : "#fff"
                              }}
                            >
                              <span
                                className="flex h-4 w-4 items-center justify-center rounded-[5px]"
                                style={{ background: on ? "#0d2315" : "#fff", border: `1.5px solid ${on ? "#0d2315" : "#cfddd5"}` }}
                              >
                                {on ? <Check className="h-[9px] w-[9px] text-white" strokeWidth={4} /> : null}
                              </span>
                              {lv}
                            </button>
                          );
                        })}
                      </div>
                    </label>
                    <label>
                      {fieldLabel("CAC registration number", true)}
                      {fieldWrap(
                        <input value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} className={inputClass()} placeholder="RC-1284772" />
                      )}
                    </label>
                    <label>
                      {fieldLabel("Ministry approval number", true)}
                      {fieldWrap(
                        <input
                          value={ministryApprovalNumber}
                          onChange={(e) => setMinistryApprovalNumber(e.target.value)}
                          className={inputClass()}
                          placeholder="LSG/EDU/2019/0442"
                        />
                      )}
                    </label>
                  </div>
                </div>
                <div className="flex items-start gap-[11px] rounded-[13px] border border-[#e6eee9] bg-[#f7faf8] px-4 py-[14px]">
                  <p className="text-[11.5px] leading-[1.55] text-[#435048]">
                    Your address is permanent from day one — never changed once teachers and parents have been
                    invited. Blocked names such as <b>admin</b>, <b>app</b>, <b>waec</b> or <b>neco</b> cannot be
                    used.
                  </p>
                </div>
              </div>
            ) : null}

            {step === 2 && !admin ? (
              <div>
                <div className="mb-1.5 font-[var(--font-heading)] text-[27px] font-bold tracking-[-0.015em] text-[#0d2315]">What you teach</div>
                <p className="mb-7 text-[13.5px] text-[#77857c]">
                  All of this is optional except your level — you can start with an empty workspace and fill it in
                  later.
                </p>
                <div className="mb-4 rounded-2xl border border-[#dee8e2] bg-white p-[26px]">
                  <label>
                    {fieldLabel("School you teach at", true)}
                    {fieldWrap(
                      <input
                        value={teacherSchoolName}
                        onChange={(e) => setTeacherSchoolName(e.target.value)}
                        className={inputClass()}
                        placeholder="Start typing your school's name"
                      />
                    )}
                  </label>
                  <div className="my-[22px] h-px bg-[#edf3ef]" />
                  <div className="mb-[9px] text-[11.5px] font-semibold text-[#435048]">Subjects you teach</div>
                  <div className="mb-[22px] flex flex-wrap gap-[9px]">
                    {SUBJECT_OPTIONS.map((sb) => {
                      const on = !!subjects[sb];
                      return (
                        <button
                          type="button"
                          key={sb}
                          onClick={() => toggleSubject(sb)}
                          className="rounded-full border-[1.5px] px-[14px] py-2 text-[12.5px] font-medium transition"
                          style={{
                            borderColor: on ? "#0d2315" : "#dee8e2",
                            color: on ? "#fff" : "#77857c",
                            background: on ? "#0d2315" : "#fff"
                          }}
                        >
                          {sb}
                        </button>
                      );
                    })}
                  </div>
                  <label>
                    {fieldLabel("Level")}
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass("w-[260px] bg-white")}>
                      <option>Primary</option>
                      <option>JSS</option>
                      <option>SSS</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-start gap-[11px] rounded-[13px] border border-[#e6eee9] bg-[#f7faf8] px-4 py-[14px]">
                  <p className="text-[11.5px] leading-[1.55] text-[#435048]">
                    Your workspace is personal — no school data, and nothing shared with anyone. If you are later
                    linked to a school, you keep this account.
                  </p>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <div className="mb-1.5 font-[var(--font-heading)] text-[27px] font-bold tracking-[-0.015em] text-[#0d2315]">Create your password</div>
                <p className="mb-7 text-[13.5px] text-[#77857c]">
                  Minimum 8 characters with letters and numbers. No forced special characters.
                </p>
                <div className="max-w-[520px] rounded-2xl border border-[#dee8e2] bg-white p-[26px]">
                  <label>
                    {fieldLabel("Password")}
                    <div className="mb-3 flex items-center gap-[10px] rounded-[10px] border-[1.5px] border-[#dee8e2] px-[13px] py-[11px] focus-within:border-[#12796a]">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[#0d2315] outline-none"
                        placeholder="Choose a password"
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-[#b4c4bb] hover:text-[#435048]">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <div className="mb-2 flex gap-[5px]">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full" style={{ background: pwScore >= i ? pwColor : "#edf3ef" }} />
                    ))}
                  </div>
                  <div className="mb-5 text-[11.5px] text-[#8c9a92]">
                    Strength: <span style={{ fontWeight: 600, color: pwColor }}>{pwLabel}</span>
                  </div>
                  <label>
                    {fieldLabel("Confirm password")}
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass("mb-5")}
                      placeholder="Repeat your password"
                    />
                  </label>
                  <div className="flex flex-col gap-2">
                    {["We never send passwords by email", "5 failed sign-in attempts locks the account for 15 minutes"].map((line) => (
                      <div key={line} className="flex items-center gap-[9px] text-xs text-[#435048]">
                        <Check className="h-[13px] w-[13px] shrink-0" style={{ color: "#12796a" }} strokeWidth={2.6} />
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
                {!admin ? (
                  <div className="mt-4 flex max-w-[520px] items-start gap-[11px] rounded-[13px] border border-[#e6eee9] bg-[#f7faf8] px-4 py-[14px]">
                    <p className="text-[11.5px] leading-[1.55] text-[#435048]">
                      Signup and first login need internet. After your first successful login, offline features work
                      as usual.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 4 && admin ? (
              <div>
                <div className="mb-1.5 font-[var(--font-heading)] text-[27px] font-bold tracking-[-0.015em] text-[#0d2315]">Start your 30-day free trial</div>
                <p className="mb-7 text-[13.5px] text-[#77857c]">Every feature unlocked. No card required. No charge at the end.</p>
                <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="relative overflow-hidden rounded-[18px] p-7" style={{ background: "#0d2315" }}>
                    <div className="relative">
                      <div className="mb-[18px] inline-flex items-center gap-[7px] rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.1)] px-3 py-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3ee08a" }} />
                        <span className="text-[10.5px] font-bold tracking-[0.06em] text-white">14 DAYS · EVERY FEATURE</span>
                      </div>
                      <div className="mb-3.5 font-[var(--font-heading)] text-[22px] font-bold leading-[1.3] text-white">
                        Results, report cards, fees, attendance and parent notifications.
                      </div>
                      <div className="mb-6 text-[12.5px] leading-[1.6] text-[rgba(255,255,255,0.6)]">
                        Your school starts with a clean workspace ready for your first academic session — classes,
                        subjects, staff and students, all set up your way.
                      </div>
                      <div className="text-[11px] leading-[1.5] text-[rgba(255,255,255,0.45)]">
                        Your trial starts the moment you finish this step.
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-[#dee8e2] bg-white p-6">
                    <div className="mb-1 text-[13px] font-semibold text-[#0d2315]">Set up automatically</div>
                    <div className="mb-4 text-[11.5px] text-[#8c9a92]">In under 60 seconds, with no human involved</div>
                    <div className="flex flex-col gap-[11px]">
                      {AUTO_SETUP_ADMIN.map((line) => (
                        <div key={line} className="flex items-start gap-[9px]">
                          <Check className="mt-[3px] h-[13px] w-[13px] shrink-0" style={{ color: "#12796a" }} strokeWidth={2.6} />
                          <div className="text-xs leading-[1.5] text-[#435048]">{line}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-[26px] flex items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                className="rounded-[11px] border border-[#cfddd5] bg-white px-5 py-3 text-[13.5px] font-semibold text-[#435048] hover:bg-[#f7faf8]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleNext}
                className="flex items-center gap-[9px] rounded-[11px] px-[22px] py-3 text-[13.5px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(13,35,21,0.6)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: "#0d2315" }}
              >
                {pending ? "Creating..." : step === lastStep ? (admin ? "Create my school" : "Create my account") : "Continue"}
                <ArrowRight className="h-[15px] w-[15px]" />
              </button>
              <span className="hidden text-[11.5px] text-[#9fb8a7] sm:inline">
                Progress is saved at every step — you can leave and come back.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "done") {
    const doneRows = doneRole === "admin"
      ? [
          { k: "Your web address", v: `${doneSchoolSlug}.futurerealm.school` },
          { k: "Trial", v: "30 days · every feature unlocked" }
        ]
      : [
          { k: "Where you work", v: "app.futurerealm.school" },
          { k: "Cost", v: "Free, indefinitely" }
        ];

    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-[#0d2315]" style={{ background: "#f4f8f6" }}>
        <div className="w-full max-w-[560px] rounded-[20px] border border-[#dee8e2] bg-white p-9 text-center shadow-[0_30px_70px_-50px_rgba(13,35,21,0.5)]">
          <div className="mx-auto mb-[22px] flex h-16 w-16 items-center justify-center rounded-full border border-[#bfe3cd]" style={{ background: "#edf7f1" }}>
            <Check className="h-[30px] w-[30px]" style={{ color: "#12796a" }} strokeWidth={2.4} />
          </div>
          <div className="mb-2 font-[var(--font-heading)] text-[25px] font-bold tracking-[-0.015em] text-[#0d2315]">
            {doneRole === "admin" ? `${schoolName || "Your school"} is live.` : "Your workspace is ready."}
          </div>
          <p className="mx-auto mb-[26px] max-w-[420px] text-[13.5px] leading-[1.65] text-[#77857c]">
            {doneRole === "admin"
              ? "Your school exists and your web address is live. One step left — verify your email address, then head to your new dashboard."
              : "Your personal teaching workspace is created and free for as long as you use it. One step left — verify your email address."}
          </p>

          <div className="mb-6 rounded-[14px] border border-[#e6eee9] bg-[#f7faf8] px-5 py-[18px] text-left">
            {doneRows.map((row) => (
              <div key={row.k} className="flex items-center justify-between gap-3.5 py-2">
                <div className="whitespace-nowrap text-[11.5px] text-[#8c9a92]">{row.k}</div>
                <div className="min-w-0 text-right text-[12.5px] font-semibold text-[#0d2315]">{row.v}</div>
              </div>
            ))}
          </div>

          <div className="mb-6 flex items-start gap-[11px] rounded-[13px] border border-[#dee8e2] bg-white px-4 py-[14px] text-left">
            <Mail className="mt-px h-[17px] w-[17px] shrink-0" style={{ color: "#12796a" }} strokeWidth={1.9} />
            <div className="text-[11.5px] leading-[1.55] text-[#435048]">
              Check your inbox for a <b>6-digit verification code</b>. It is valid for 15 minutes, allows 3 attempts,
              and you can request a new one at any time.
            </div>
          </div>

          <div className="flex justify-center gap-[11px]">
            <button
              type="button"
              onClick={() => {
                setView("verify");
                window.scrollTo(0, 0);
              }}
              className="rounded-[11px] px-6 py-[13px] text-[13.5px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(13,35,21,0.6)]"
              style={{ background: "#0d2315" }}
            >
              Verify my email
            </button>
            <button
              type="button"
              onClick={goToDashboard}
              className="rounded-[11px] border border-[#cfddd5] bg-white px-6 py-[13px] text-[13.5px] font-semibold text-[#435048] hover:bg-[#f7faf8]"
            >
              I&apos;ll do it later
            </button>
          </div>
        </div>
      </div>
    );
  }

  const otpComplete = otp.length === 6;

  return (
    <div className="flex min-h-screen flex-col text-[#0d2315]" style={{ background: "#f4f8f6" }}>
      <div className="px-6 py-[22px] sm:px-12">
        <span className="font-[var(--font-heading)] text-lg font-extrabold text-[#0d2315]">FutureRealm SMS</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[460px] rounded-[20px] border border-[#dee8e2] bg-white p-8 shadow-[0_30px_70px_-50px_rgba(13,35,21,0.5)]">
          <div className="mb-5 flex h-[46px] w-[46px] items-center justify-center rounded-[13px]" style={{ background: "#eaf0ec" }}>
            <Mail className="h-[21px] w-[21px] text-[#0d2315]" strokeWidth={1.9} />
          </div>
          <div className="mb-1.5 font-[var(--font-heading)] text-[23px] font-bold tracking-[-0.015em] text-[#0d2315]">Verify your email</div>
          <p className="mb-[26px] text-[13px] leading-[1.6] text-[#77857c]">
            Enter the 6-digit code we sent to <b className="text-[#0d2315]">{email}</b>. Valid for 15 minutes · 3
            attempts.
          </p>

          <div className="relative mb-[18px]">
            <div className="flex gap-[9px]">
              {otpBoxes.map((ch, i) => {
                const active = otp.length === i;
                return (
                  <div
                    key={i}
                    className="flex h-14 flex-1 items-center justify-center rounded-xl font-[var(--font-heading)] text-[22px] font-bold"
                    style={{
                      color: ch ? "#0d2315" : "#cfddd5",
                      background: "#fff",
                      border: `1.5px solid ${active ? "#12796a" : ch ? "#b9cfc3" : "#dee8e2"}`,
                      boxShadow: active ? "0 0 0 3px rgba(18,121,106,0.16)" : "none"
                    }}
                  >
                    {ch || "·"}
                  </div>
                );
              })}
            </div>
            <input
              ref={otpInputRef}
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              className="absolute inset-0 h-full w-full cursor-pointer border-none bg-transparent opacity-0"
            />
          </div>

          <button
            type="button"
            disabled={!otpComplete || verifyPending}
            onClick={handleVerify}
            className="w-full rounded-[11px] py-[13px] text-center text-sm font-semibold transition"
            style={
              otpComplete
                ? { background: "#0d2315", color: "#fff", boxShadow: "0 10px 22px -10px rgba(13,35,21,0.55)" }
                : { background: "#edf3ef", color: "#9fb8a7", cursor: "not-allowed" }
            }
          >
            {verifyPending ? "Verifying..." : "Verify and continue"}
          </button>

          <div className="mt-[18px] flex items-center justify-between">
            <button type="button" onClick={handleResend} className="text-xs text-[#8c9a92]">
              Didn&apos;t get it? <span className="font-semibold text-[#12796a] hover:underline">Send me a new code</span>
            </button>
            <div className="text-[11.5px] text-[#b4c4bb]">Expires in {otpExpiryLabel}</div>
          </div>

          <div className="my-[22px] h-px bg-[#edf3ef]" />
          <p className="text-[11.5px] leading-[1.55] text-[#8c9a92]">
            Codes go to email only. We never send passwords by email.
          </p>
          <p className="mt-4 text-xs text-[#9fb8a7]">
            Wrong address?{" "}
            <button type="button" onClick={() => setView("done")} className="font-semibold text-[#12796a] hover:underline">
              Go back
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
