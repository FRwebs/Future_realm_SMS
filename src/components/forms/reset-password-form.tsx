"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

import { FieldMessage, InlineNotice, useNotice } from "@/components/ui/inline-notice";

export function ResetPasswordForm({ token }: { token: string }) {
  const notice = useNotice();
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [missing, setMissing] = useState<{ password?: string; confirmPassword?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notice.clear();

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    // Every requirement is said beside the field it is about, together, so nobody fixes one and meets the next.
    const gaps = {
      password: !password ? "Choose a new password." : password.length < 8 ? "Use at least 8 characters." : undefined,
      confirmPassword: !confirmPassword ? "Type it again to be sure." : password !== confirmPassword ? "The two passwords are not the same." : undefined
    };
    setMissing(gaps);
    if (gaps.password || gaps.confirmPassword) return;
    setPending(true);

    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; data?: { message?: string } };

      if (!response.ok || body.ok === false) {
        notice.error("The password was not changed", body.error ?? "The link may have expired. Request a new one and try again.");
        setPending(false);
        return;
      }

      setComplete(true);
    } catch {
      notice.error("The server could not be reached", "Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-[14px] border border-[#f2d3d3] bg-[#fff7f7] p-5">
        <ShieldCheck className="h-5 w-5 text-[var(--color-danger)]" />
        <h3 className="mt-4 font-[var(--font-heading)] text-[19px] font-bold text-[#0d2315]">Reset link missing</h3>
        <p className="mt-2 text-[13.5px] leading-6 text-[#435048]">Request a new link to continue.</p>
        <Link href="/forgot-password" className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]">
          Request new link
        </Link>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="rounded-[14px] border border-[#cfe7d7] bg-[#f2fbf5] p-5">
        <CheckCircle2 className="h-6 w-6 text-[#12796a]" />
        <h3 className="mt-4 font-[var(--font-heading)] text-[19px] font-bold text-[#0d2315]">Password changed</h3>
        <p className="mt-2 text-[13.5px] leading-6 text-[#435048]">Your old sessions have been signed out. Continue with the new password.</p>
        <Link href="/login" className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PasswordField
        label="New password"
        name="password"
        placeholder="At least 8 characters"
        visible={showPassword}
        onToggle={() => setShowPassword((current) => !current)}
        message={missing.password}
        onType={() => missing.password && setMissing((current) => ({ ...current, password: undefined }))}
      />
      <PasswordField
        label="Confirm password"
        name="confirmPassword"
        placeholder="Re-enter new password"
        visible={showConfirm}
        onToggle={() => setShowConfirm((current) => !current)}
        message={missing.confirmPassword}
        onType={() => missing.confirmPassword && setMissing((current) => ({ ...current, confirmPassword: undefined }))}
      />

      <InlineNotice notice={notice.notice} onDismiss={notice.clear} className="mb-3" />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Changing password..." : "Change password"}
      </button>

    </form>
  );
}

function PasswordField({
  label,
  name,
  placeholder,
  visible,
  onToggle,
  message,
  onType
}: {
  label: string;
  name: string;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  message?: string;
  onType: () => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-[7px] block text-[11.5px] font-semibold text-[#435048]">{label}</label>
      <div className={`flex items-center gap-[10px] rounded-[11px] border-[1.5px] px-[14px] py-[12px] transition focus-within:border-[#12796a] ${message ? "border-[#a13d3d]" : "border-[#dee8e2]"}`}>
        <Lock className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type={visible ? "text" : "password"}
          name={name}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? `${name}-missing` : undefined}
          onChange={onType}
          className="w-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[#b4c4bb] transition hover:text-[#435048]"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldMessage id={`${name}-missing`}>{message}</FieldMessage>
    </div>
  );
}
