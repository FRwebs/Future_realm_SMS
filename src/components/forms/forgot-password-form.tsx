"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send, ShieldCheck } from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";

export function ForgotPasswordForm() {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResetUrl(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") })
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { message?: string; resetUrl?: string | null };
      };

      if (!response.ok || body.ok === false) {
        const nextError = body.error ?? "Unable to start password recovery.";
        setError(nextError);
        showToast({ variant: "error", title: "Recovery failed", description: nextError });
        setPending(false);
        return;
      }

      setSubmitted(true);
      setResetUrl(body.data?.resetUrl ?? null);
      showToast({
        variant: "success",
        title: "Check your email",
        description: body.data?.message ?? "If the email exists, a reset link will be sent."
      });
    } catch {
      const nextError = "Unable to reach the server. Please try again.";
      setError(nextError);
      showToast({ variant: "error", title: "Server unavailable", description: nextError });
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
          <h3 className="mt-4 font-[var(--font-heading)] text-[19px] font-bold text-[#0d2315]">Recovery link prepared</h3>
          <p className="mt-2 text-[13.5px] leading-6 text-[#435048]">
            If that email belongs to an active account, we&apos;ll send instructions to reset the password. The link expires in 30 minutes.
          </p>
          {resetUrl ? (
            <Link
              href={resetUrl}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]"
            >
              Open dev reset link
            </Link>
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
    <form onSubmit={handleSubmit}>
      <label className="mb-[7px] block text-[11.5px] font-semibold text-[#435048]">Work email</label>
      <div className="mb-5 flex items-center gap-[10px] rounded-[11px] border-[1.5px] border-[#dee8e2] px-[14px] py-[12px] transition focus-within:border-[#12796a]">
        <Mail className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type="email"
          name="email"
          required
          className="w-full bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder="principal@greenfieldcollege.ng"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Send className="h-4 w-4" />
        {pending ? "Preparing link..." : "Send reset link"}
      </button>

      {error ? <p className="mt-4 text-[13px] text-[var(--color-danger)]">{error}</p> : null}

      <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#12796a] hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </form>
  );
}
