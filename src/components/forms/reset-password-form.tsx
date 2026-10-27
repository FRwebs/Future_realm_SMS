"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

import { AuthField } from "@/components/forms/auth-field";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { useAuthValidationMessages } from "@/hooks/use-auth-validation";
import { createResetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const messages = useAuthValidationMessages();
  const resetPasswordSchema = useMemo(() => createResetPasswordSchema(messages), [messages]);
  const notice = useNotice();
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function change({ password }: ResetPasswordValues) {
    notice.clear();
    setPending(true);

    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; data?: { message?: string } };

      if (!response.ok || body.ok === false) {
        notice.error(t("failedTitle"), body.error ?? t("failedFallback"));
        setPending(false);
        return;
      }

      setComplete(true);
    } catch {
      notice.error(t("unreachableTitle"), t("unreachableHelp"));
    } finally {
      setPending(false);
    }
  }

  const handleSubmit = form.handleSubmit(change);

  if (!token) {
    return (
      <div className="rounded-[14px] border border-[#f2d3d3] bg-[#fff7f7] p-5">
        <ShieldCheck className="h-5 w-5 text-danger" />
        <h3 className="mt-4 font-(--font-heading) text-[19px] font-bold text-[#0d2315]">{t("linkMissing")}</h3>
        <p className="mt-2 text-[13.5px] leading-6 text-[#435048]">{t("linkMissingHelp")}</p>
        <Link href="/forgot-password" className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]">
          {t("requestNew")}
        </Link>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="rounded-[14px] border border-[#cfe7d7] bg-[#f2fbf5] p-5">
        <CheckCircle2 className="h-6 w-6 text-[#12796a]" />
        <h3 className="mt-4 font-(--font-heading) text-[19px] font-bold text-[#0d2315]">{t("changed")}</h3>
        <p className="mt-2 text-[13.5px] leading-6 text-[#435048]">{t("changedHelp")}</p>
        <Link href="/login" className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]">
          {t("goToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthField
        label={t("newPassword")}
        icon={<Lock className="h-4 w-4" strokeWidth={1.8} />}
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder={t("newPasswordPlaceholder")}
        error={form.formState.errors.password?.message}
        trailing={<VisibilityToggle visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />}
        {...form.register("password")}
      />
      <AuthField
        label={t("confirmPassword")}
        icon={<Lock className="h-4 w-4" strokeWidth={1.8} />}
        type={showConfirm ? "text" : "password"}
        autoComplete="new-password"
        placeholder={t("confirmPlaceholder")}
        error={form.formState.errors.confirmPassword?.message}
        trailing={<VisibilityToggle visible={showConfirm} onToggle={() => setShowConfirm((current) => !current)} />}
        {...form.register("confirmPassword")}
      />

      <InlineNotice notice={notice.notice} onDismiss={notice.clear} className="mb-3" />

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? t("submitting") : t("submit")}
      </button>

    </form>
  );
}

function VisibilityToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const t = useTranslations("auth.signIn");
  return (
    <button type="button" onClick={onToggle} className="shrink-0 text-[#5c6a62] transition hover:text-[#0d2315]" aria-label={visible ? t("hidePassword") : t("showPassword")}>
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
