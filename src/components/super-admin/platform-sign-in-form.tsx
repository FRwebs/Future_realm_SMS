"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AccessControl = {
  idleMinutes: number;
  trustDays: number;
  ipAllowListEnforced: boolean;
  levels: Array<{ level: string; role: string; scope: string }>;
};

/**
 * The internal sign-in form.
 *
 * It posts to the same `/v1/auth/login` the school uses, because there is one
 * password check and one session in this product and a second copy of either is
 * how the weaker one gets found. What differs is what the API does afterwards
 * for a platform role, and what this form asks for: a second factor every time,
 * and the option to trust the browser for thirty days.
 */
export function PlatformSignInForm({ access }: { access: AccessControl }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [stage, setStage] = useState<"credentials" | "verify">("credentials");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: email,
          password,
          ...(stage === "verify" ? { mfaCode: code, trustDevice: remember } : {}),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        data?: { mfaRequired?: boolean };
      };

      // The API asks for the second factor by refusing the first leg; that is
      // the signal to show the code box rather than an error.
      const needsCode =
        result.data?.mfaRequired ||
        /multi-factor|mfa|verification code|six-digit/i.test(result.error ?? result.message ?? "");

      if (!response.ok || result.ok === false) {
        if (needsCode && stage === "credentials") {
          setStage("verify");
          setError(null);
          return;
        }
        throw new Error(result.error ?? result.message ?? "That did not sign you in.");
      }

      router.push("/super-admin");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not sign you in.");
    } finally {
      setPending(false);
    }
  }

  const label = "mb-[6.5px] text-[10.5px] font-semibold text-[#435048]";
  const box =
    "mb-[14.5px] flex items-center gap-[9px] rounded-[11px] border-[1.5px] border-[#DEE8E2] px-[12.5px] py-[11px] focus-within:border-[#0D2315]";
  const input = "min-w-0 flex-1 bg-transparent text-[12px] text-[#0D2315] outline-none placeholder:text-[#9FB8A7]";

  return (
    <div className="w-full max-w-[345.5px]">
      <div
        className="mb-[23.5px] flex w-fit items-center gap-[7px] rounded-full px-[11px] py-[4.5px]"
        style={{ background: "#F2F7F4", border: "1px solid #E1EBE5" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#12796A" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
        <span className="text-[10.5px] font-semibold text-[#17604F]">
          Platform admin · restricted
        </span>
      </div>

      <h2 className="mb-[5.5px] font-[family-name:var(--font-heading)] text-[23.5px] font-bold tracking-[-0.015em] text-[#0D2315]">
        {stage === "credentials" ? "Internal sign-in" : "Verification"}
      </h2>
      <p className="mb-[27px] text-[12px] text-[#77857C]">
        {stage === "credentials"
          ? "Nooria team accounts only. Schools sign in at their own workspace."
          : "Enter the six-digit code from your authenticator."}
      </p>

      <form onSubmit={submit} noValidate>
        {stage === "credentials" ? (
          <>
            <label className={`block ${label}`} htmlFor="admin-email">
              Work email
            </label>
            <div className={box}>
              <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="#9FB8A7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.4" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                className={input}
                placeholder="name@nooria.ng"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="mb-[6.5px] flex items-center justify-between">
              <label className="text-[10.5px] font-semibold text-[#435048]" htmlFor="admin-password">
                Password
              </label>
              <span className="text-[10.5px] font-semibold text-[#12796A]">Reset via Super Admin</span>
            </div>
            <div className={box}>
              <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="#9FB8A7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
                <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className={input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                className="flex-none"
              >
                <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="#B4C4BB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <label className={`block ${label}`} htmlFor="admin-code">
              Six-digit code
            </label>
            <div className={box}>
              <input
                id="admin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className={`${input} tracking-[4px]`}
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          </>
        )}

        <label className="mb-5 flex cursor-pointer items-center gap-[7px]">
          <input
            type="checkbox"
            className="sr-only"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span
            className="flex h-[15.5px] w-[15.5px] flex-none items-center justify-center rounded-[5px]"
            style={{ background: remember ? "#0D2315" : "transparent", border: remember ? "none" : "1.5px solid #DEE8E2" }}
            aria-hidden
          >
            {remember ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5 9-10" />
              </svg>
            ) : null}
          </span>
          <span className="text-[11.5px] text-[#435048]">
            Remember this device for MFA ({access.trustDays} days)
          </span>
        </label>

        {error ? (
          <p
            className="mb-3 rounded-[11px] px-[12.5px] py-[10px] text-[11px] leading-[1.5]"
            style={{ background: "#FDF2F2", border: "1px solid #F3D7D7", color: "#B23B3B" }}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[11px] px-4 py-[11.5px] text-[12.5px] font-semibold text-white disabled:opacity-60"
          style={{ background: "#0D2315", boxShadow: "0 9px 20px -9px rgba(13,35,21,0.55)" }}
        >
          {pending
            ? "Checking…"
            : stage === "credentials"
              ? "Continue to verification"
              : "Sign in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-[9px]">
        <span className="text-[10px] font-bold tracking-[0.06em] text-[#B4C4BB]">ACCESS CONTROL</span>
        <span className="h-px flex-1" style={{ background: "#E6EEE9" }} />
      </div>

      <ul className="grid gap-[7px]">
        {access.levels.map((entry) => (
          <li key={entry.level} className="flex items-start gap-[9px]">
            <span className="w-[12.5px] flex-none font-[family-name:var(--font-heading)] text-[9.5px] font-bold text-[#9FB8A7]">
              {entry.level}
            </span>
            <span className="w-[106px] flex-none text-[11px] font-semibold text-[#0D2315]">{entry.role}</span>
            <span className="flex-1 text-[10.5px] leading-[1.4] text-[#8C9A92]">{entry.scope}</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-[11px] flex items-start gap-[9px] rounded-[11px] px-[12.5px] py-[11.5px]"
        style={{ background: "#F7FAF8", border: "1px solid #E6EEE9" }}
      >
        <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="#12796A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.6v5.2l3 1.8" />
        </svg>
        <p className="text-[10.5px] leading-[1.5] text-[#435048]">
          Multi-factor authentication is required for every admin login. Sessions expire after{" "}
          {access.idleMinutes} minutes of inactivity, and an IP allow list{" "}
          {access.ipAllowListEnforced ? "is enforced" : "can be enforced"} by Super Admin.
        </p>
      </div>

      <p className="mt-[21.5px] text-center text-[11px] text-[#9FB8A7]">
        Locked out? <span className="font-semibold">Contact a Super Admin</span>
      </p>
    </div>
  );
}
