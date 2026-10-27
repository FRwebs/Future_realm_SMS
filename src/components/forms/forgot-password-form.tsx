"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { ArrowLeft, Mail, Send, ShieldCheck } from "lucide-react";

import { AuthField } from "@/components/forms/auth-field";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { useAuthValidationMessages } from "@/hooks/use-auth-validation";
import { createForgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const messages = useAuthValidationMessages();
  const forgotPasswordSchema = useMemo(() => createForgotPasswordSchema(messages), [messages]);
  const notice = useNotice();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function send({ email }: ForgotPasswordValues) {
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
        notice.error(t("failedTitle"), body.error ?? t("failedFallback"));
        setPending(false);
        return;
      }

      setSubmitted(true);
      setResetUrl(body.data?.resetUrl ?? null);
      setMessage(body.data?.message ?? null);
    } catch {
      notice.error(t("unreachableTitle"), t("unreachableHelp"));
    } finally {
      setPending(false);
    }
  }

  const handleSubmit = form.handleSubmit(send, () => notice.clear());

  if (submitted) {
    return (
      <div>
        <div className="rounded-[14px] border border-[#cfe7d7] bg-[#f2fbf5] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#0d2315] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-(--font-heading) text-[19px] font-bold text-[#0d2315]">{t("checkEmail")}</h3>
          <p className="mt-2 text-[13.5px] leading-6 text-[#435048]" role="status">
            {message ?? t("sentFallback")} {t("expires")}
          </p>
          {resetUrl ? (
            // A reset URL is minted by the API at runtime, so it is not one of
            // the app's typed routes and gains nothing from client navigation.
            <a
              href={resetUrl}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d2315] px-4 text-[13px] font-semibold text-white transition hover:bg-[#12796a]"
            >
              {t("openDevLink")}
            </a>
          ) : null}
        </div>
        <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#12796a] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthField
        label={t("label")}
        icon={<Mail className="h-4 w-4" strokeWidth={1.8} />}
        type="email"
        autoComplete="email"
        placeholder={t("placeholder")}
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />

      <InlineNotice notice={notice.notice} onDismiss={notice.clear} className="mb-3" />

      <button
        type="submit"
        disabled={pending}
        className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Send className="h-4 w-4" />
        {pending ? t("submitting") : t("submit")}
      </button>

      <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#12796a] hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {t("backToSignIn")}
      </Link>
    </form>
  );
}
