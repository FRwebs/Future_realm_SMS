"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck, UserRound } from "lucide-react";

import { FieldMessage, InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { wakeApi, useApiState } from "@/lib/api/wake";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";

function resolveLandingPath(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? getDefaultPathForRole(normalizedRole) : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const notice = useNotice();
  const apiState = useApiState();
  const [pending, setPending] = useState(false);
  /** What is missing, said under the field it is about. */
  const [missing, setMissing] = useState<{ identifier?: string; password?: string; code?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  /** Where the one-time code went, when it was emailed; null means the authenticator app. */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  async function attemptLogin(code?: string, retried = false) {
    setPending(true);
    notice.clear();

    try {
      // A sign-in sent while the API is still starting would look like a failure. Wait for it to answer (the page has been asking since it
      // opened), then send it.
      if (apiState !== "ready") await wakeApi();
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier: email,
          password,
          trustDevice,
          ...(code ? { mfaCode: code } : {})
        })
      });

      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        channel?: "EMAIL" | "APP";
        sentTo?: string;
        data?: { user: { role: string } };
      };

      if (!response.ok || body.ok === false || !body.data) {
        if (body.code === "MFA_REQUIRED") {
          setMfaRequired(true);
          setCodeSentTo(body.channel === "EMAIL" ? (body.sentTo ?? "your email") : null);
          if (code) notice.error("That code did not work", body.error ?? "Check it and try again.");
          setPending(false);
          return;
        }
        notice.error("Sign-in failed", body.error ?? "We could not sign you in. Check your details and try again.");
        setPending(false);
        return;
      }

      // The button stays disabled and the message stays put until the next page has replaced this one.
      notice.success("Signed in", "Opening your workspace now.");
      const nextPath = resolveLandingPath(body.data.user.role);

      window.setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 250);
    } catch {
      // The connection dropped while the server was waking: ask it to wake once more and send the same sign-in again, once.
      if (!retried && (await wakeApi()) === "ready") return attemptLogin(code, true);
      notice.error("The server could not be reached", "Check your connection and try again. If it keeps happening, wait a moment — the server may still be starting.");
      setPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // What is needed is said beside the field, not in the browser's own bubble, and both gaps are named at once.
    const gaps = { identifier: email.trim() ? undefined : "Enter your email address or User ID.", password: password ? undefined : "Enter your password." };
    setMissing(gaps);
    if (gaps.identifier || gaps.password) {
      notice.warning("Two things are needed to sign in", "Fill in the highlighted fields, then sign in.");
      return;
    }
    await attemptLogin();
  }

  async function handleMfaSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaCode.trim()) {
      setMissing({ code: "Enter the 6-digit code." });
      return;
    }
    setMissing({});
    await attemptLogin(mfaCode);
  }

  if (mfaRequired) {
    return (
      <form onSubmit={handleMfaSubmit} noValidate>
        <div className="mb-5 flex items-start gap-[10px] rounded-[11px] border px-[14px] py-[13px]" style={{ borderColor: "var(--color-gold-dim)", background: "var(--color-gold-dim)" }}>
          <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#8a6410" }} strokeWidth={1.8} />
          <p className="text-[11.5px] leading-[1.5] text-[#435048]">
            {codeSentTo
              ? `We sent a 6-digit code to ${codeSentTo}. It is valid for 10 minutes and allows 3 attempts.`
              : "This account has two-factor authentication turned on. Enter the 6-digit code from your authenticator app, or one of your backup codes."}
          </p>
        </div>

        <label className="mb-[7px] block text-[11.5px] font-semibold text-[#435048]">{codeSentTo ? "Code from your email" : "Authentication code"}</label>
        <div className="mb-4 flex items-center gap-[10px] rounded-[11px] border-[1.5px] border-[#dee8e2] px-[14px] py-[12px] transition focus-within:border-[#12796a]">
          <input
            type="text"
            name="mfaCode"
            autoFocus
            aria-invalid={Boolean(missing.code)}
            aria-describedby={missing.code ? "login-code-missing" : undefined}
            value={mfaCode}
            onChange={(event) => { setMfaCode(event.target.value); if (missing.code) setMissing({}); }}
            className="w-full bg-transparent text-[13.5px] tracking-widest text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
            placeholder="123456"
          />
        </div>
        <FieldMessage id="login-code-missing">{missing.code}</FieldMessage>

        <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mb-3 mt-4" />

        <button
          type="submit"
          disabled={pending}
          className="flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Verifying..." : "Verify and sign in"}
        </button>

        {codeSentTo ? (
          <p className="mt-4 text-center text-[12px] text-[#435048]">
            Didn&apos;t get it?{" "}
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setMfaCode("");
                await attemptLogin();
                // attemptLogin asks for the code again and says nothing of its own when it works, so this is the only word on it.
                notice.success("A new code is on its way", "Check your inbox. The earlier code no longer works.");
              }}
              className="font-semibold text-[#12796a] hover:underline"
            >
              Send me a new code
            </button>
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMfaRequired(false);
            setMfaCode("");
            setCodeSentTo(null);
            setMissing({});
            notice.clear();
          }}
          className="mt-4 w-full text-center text-[12.5px] font-semibold text-[#435048] hover:underline"
        >
          Back to email and password
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} method="post" noValidate>
      <label className="mb-[7px] block text-[11.5px] font-semibold text-[#435048]">Email address or User ID</label>
      <div className={`${missing.identifier ? "mb-0" : "mb-4"} flex items-center gap-[10px] rounded-[11px] border-[1.5px] px-[14px] py-[12px] transition focus-within:border-[#12796a] ${missing.identifier ? "border-[#a13d3d]" : "border-[#dee8e2]"}`}>
        <UserRound className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type="text"
          name="identifier"
          autoComplete="username"
          aria-invalid={Boolean(missing.identifier)}
          aria-describedby={missing.identifier ? "login-identifier-missing" : undefined}
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (missing.identifier) setMissing((current) => ({ ...current, identifier: undefined })); }}
          className="w-full bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder="you@school.com or 482173"
        />
      </div>
      <FieldMessage id="login-identifier-missing">{missing.identifier}</FieldMessage>

      <div className={`mb-[7px] flex items-center justify-between ${missing.identifier ? "mt-4" : ""}`}>
        <label className="text-[11.5px] font-semibold text-[#435048]">Password</label>
        <Link href="/forgot-password" className="text-[11.5px] font-semibold text-[#12796a] hover:underline">
          Forgot password?
        </Link>
      </div>
      <div className={`${missing.password ? "mb-0" : "mb-4"} flex items-center gap-[10px] rounded-[11px] border-[1.5px] px-[14px] py-[12px] transition focus-within:border-[#12796a] ${missing.password ? "border-[#a13d3d]" : "border-[#dee8e2]"}`}>
        <Lock className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          aria-invalid={Boolean(missing.password)}
          aria-describedby={missing.password ? "login-password-missing" : undefined}
          value={password}
          onChange={(event) => { setPassword(event.target.value); if (missing.password) setMissing((current) => ({ ...current, password: undefined })); }}
          className="w-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder="Your password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="shrink-0 text-[#b4c4bb] transition hover:text-[#435048]"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <FieldMessage id="login-password-missing">{missing.password}</FieldMessage>

      <label className={`mb-[22px] flex cursor-pointer items-center gap-2 ${missing.password ? "mt-4" : ""}`}>
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(event) => setTrustDevice(event.target.checked)}
          className="peer sr-only"
        />
        <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border border-[#b9c9c0] bg-white transition peer-checked:border-[#0d2315] peer-checked:bg-[#0d2315] peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-[#12796a]/40">
          <svg className="opacity-0 transition" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        <span className="text-[12.5px] text-[#435048]">Trust this device for 30 days</span>
      </label>

      {apiState === "waking" || apiState === "unreachable" ? (
        <p className="mb-3 rounded-[10px] px-[13px] py-[10px] text-[11.5px] leading-[1.5]" role="status" style={{ background: "var(--color-gold-dim)", color: "#6f510c" }}>
          {apiState === "waking"
            ? "The server is starting up after a quiet spell — this can take up to a minute. You can sign in now; it will go through as soon as the server is ready."
            : "The server has not answered yet. You can still try to sign in; if it fails, wait a moment and try again."}
        </p>
      ) : null}

      <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mb-3" />

      <button
        type="submit"
        disabled={pending}
        className="flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (apiState === "waking" ? "Waiting for the server..." : "Signing in...") : "Sign in"}
      </button>

      <div className="my-[22px] flex items-center gap-[10px]">
        <div className="h-px flex-1 bg-[#edf3ef]" />
        <span className="text-[11px] font-semibold text-[#5c6a62]">SECURE ACCESS</span>
        <div className="h-px flex-1 bg-[#edf3ef]" />
      </div>

      <div
        className="flex items-start gap-[10px] rounded-[11px] border px-[14px] py-[13px]"
        style={{ borderColor: "var(--color-gold-dim)", background: "var(--color-gold-dim)" }}
      >
        <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#8a6410" }} strokeWidth={1.8} />
        <p className="text-[11.5px] leading-[1.5] text-[#435048]">
          Multi-factor authentication is required for Principal, Proprietor and Bursar accounts. You&apos;ll be
          asked for a one-time code sent to your email after this step.
        </p>
      </div>

      <p className="mt-[22px] text-center text-[12.5px] text-[#435048]">
        New to FutureRealm?{" "}
        <Link href="/onboarding" className="font-semibold text-[#12796a] hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-[10px] text-center text-xs text-[#5c6a62]">
        Parents and students receive their accounts from their school.
      </p>
      <p className="mt-[18px] text-center">
        <Link href="/" className="text-[11px] font-semibold text-[#12796a] hover:underline">
          ← Back to website
        </Link>
      </p>
    </form>
  );
}
