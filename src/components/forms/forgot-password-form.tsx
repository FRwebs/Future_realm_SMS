"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send, ShieldCheck } from "lucide-react";

import { FieldMessage, InlineNotice, useNotice } from "@/components/ui/inline-notice";

export function ForgotPasswordForm() {
  const notice = useNotice();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [missing, setMissing] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    // What is needed is said under the field itself, not in the browser's own bubble.
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setMissing(email ? "That does not look like an email address." : "Enter the email address of your account.");
      notice.clear();
      return;
    }
    setMissing(undefined);
    setPending(true);
    notice.clear();
    setResetUrl(null);

    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { message?: string; resetUrl?: string | null };
      };

      if (!response.ok || body.ok === false) {
        notice.error("We could not start the recovery", body.error ?? "Try again in a moment.");
        setPending(false);
        return;
      }

      setSubmitted(true);
      setResetUrl(body.data?.resetUrl ?? null);
      setMessage(body.data?.message ?? null);
    } catch {
      notice.error("The server could not be reached", "Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <div className="rounded-[14px] border border-[#cfe7d7] bg-[#f2fbf5] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#0d2315] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-[var(--font-heading)] text-[19px] font-bold text-[#0d2315]">Check your email</h3>
          <p className="mt-2 text-[13.5px] leading-6 text-[#435048]" role="status">
            {message ?? "If that email belongs to an active account, we'll send instructions to reset the password."} The link expires in 30 minutes.
          </p>
          {resetUrl ? (
            // A reset URL is minted by the API at runtime, so it is not one of
            // the app's typed routes and gains nothing from client navigation.
            <a
              href={resetUrl}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]"
            >
              Open dev reset link
            </a>
          ) : null}
        </div>
        <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#12796a] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label className="mb-[7px] block text-[11.5px] font-semibold text-[#435048]">Work email</label>
      <div className={`${missing ? "mb-0" : "mb-5"} flex items-center gap-[10px] rounded-[11px] border-[1.5px] px-[14px] py-[12px] transition focus-within:border-[#12796a] ${missing ? "border-[#a13d3d]" : "border-[#dee8e2]"}`}>
        <Mail className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type="email"
          name="email"
          aria-invalid={Boolean(missing)}
          aria-describedby={missing ? "forgot-email-missing" : undefined}
          onChange={() => missing && setMissing(undefined)}
          className="w-full bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder="principal@greenfieldcollege.ng"
        />
      </div>
      <FieldMessage id="forgot-email-missing">{missing}</FieldMessage>

      <InlineNotice notice={notice.notice} onDismiss={notice.clear} className={`mb-3 ${missing ? "mt-4" : ""}`} />

      <button
        type="submit"
        disabled={pending}
        className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Send className="h-4 w-4" />
        {pending ? "Preparing link..." : "Send reset link"}
      </button>

      <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#12796a] hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </form>
  );
}
