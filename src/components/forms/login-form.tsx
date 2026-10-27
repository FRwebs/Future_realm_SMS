"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck, UserRound } from "lucide-react";

import { AuthField } from "@/components/forms/auth-field";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { wakeApi, useApiState } from "@/lib/api/wake";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";
import { focusOnMount } from "@/lib/ui/focus";
import { useAuthValidationMessages } from "@/hooks/use-auth-validation";
import { createSignInCodeSchema, createSignInSchema, type SignInCodeValues, type SignInValues } from "@/lib/validation/auth";

function resolveLandingPath(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? getDefaultPathForRole(normalizedRole) : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const messages = useAuthValidationMessages();
  const signInSchema = useMemo(() => createSignInSchema(messages), [messages]);
  const signInCodeSchema = useMemo(() => createSignInCodeSchema(messages), [messages]);
  const notice = useNotice();
  const apiState = useApiState();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  /** Where the one-time code went, when it was emailed; null means the authenticator app. */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  // What is needed is said beside the field it is about — the rules live in `lib/validation/auth`, the form only shows them.
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { identifier: "", password: "", trustDevice: true } });
  const codeForm = useForm<SignInCodeValues>({ resolver: zodResolver(signInCodeSchema), defaultValues: { code: "" } });

  async function attemptLogin(code?: string, retried = false) {
    setPending(true);
    notice.clear();
    const { identifier, password, trustDevice } = form.getValues();

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
          identifier,
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
          setCodeSentTo(body.channel === "EMAIL" ? (body.sentTo ?? t("code.yourEmail")) : null);
          if (code) notice.error(t("code.wrongTitle"), body.error ?? t("code.wrongFallback"));
          setPending(false);
          return;
        }
        notice.error(t("signIn.failedTitle"), body.error ?? t("signIn.failedFallback"));
        setPending(false);
        return;
      }

      // The button stays disabled and the message stays put until the next page has replaced this one.
      notice.success(t("signIn.signedInTitle"), t("signIn.signedInHelp"));
      const nextPath = resolveLandingPath(body.data.user.role);

      window.setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 250);
    } catch {
      // The connection dropped while the server was waking: ask it to wake once more and send the same sign-in again, once.
      if (!retried && (await wakeApi()) === "ready") return attemptLogin(code, true);
      notice.error(t("signIn.unreachableTitle"), t("signIn.unreachableHelp"));
      setPending(false);
    }
  }

  function onInvalid(errors: FieldErrors<SignInValues>) {
    notice.warning(t("signIn.gaps", { count: Object.keys(errors).length }), t("signIn.gapsHelp"));
  }

  const handleSubmit = form.handleSubmit(() => attemptLogin(), onInvalid);
  const handleMfaSubmit = codeForm.handleSubmit(({ code }) => attemptLogin(code));

  if (mfaRequired) {
    return (
      <form onSubmit={handleMfaSubmit} noValidate>
        <div className="mb-5 flex items-start gap-[10px] rounded-[11px] border px-[14px] py-[13px]" style={{ borderColor: "var(--color-gold-dim)", background: "var(--color-gold-dim)" }}>
          <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#8a6410" }} strokeWidth={1.8} />
          <p className="text-[11.5px] leading-normal text-[#435048]">
            {codeSentTo
              ? t("code.sentTo", { address: codeSentTo })
              : t("code.fromApp")}
          </p>
        </div>

        <AuthField
          label={codeSentTo ? t("code.emailLabel") : t("code.appLabel")}
          icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.8} />}
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder={t("code.placeholder")}
          className="tracking-widest"
          error={codeForm.formState.errors.code?.message}
          {...codeForm.register("code")}
          ref={(node) => { codeForm.register("code").ref(node); focusOnMount(node); }}
        />

        <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mb-3 mt-4" />

        <button
          type="submit"
          disabled={pending}
          className="flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? t("code.submitting") : t("code.submit")}
        </button>

        {codeSentTo ? (
          <p className="mt-4 text-center text-[12px] text-[#435048]">
            {t("code.notReceived")}{" "}
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                codeForm.reset();
                await attemptLogin();
                // attemptLogin asks for the code again and says nothing of its own when it works, so this is the only word on it.
                notice.success(t("code.newCodeTitle"), t("code.newCodeHelp"));
              }}
              className="font-semibold text-[#12796a] hover:underline"
            >
              {t("code.sendNew")}
            </button>
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMfaRequired(false);
            codeForm.reset();
            setCodeSentTo(null);
            notice.clear();
          }}
          className="mt-4 w-full text-center text-[12.5px] font-semibold text-[#435048] hover:underline"
        >
          {t("code.back")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} method="post" noValidate>
      <AuthField
        label={t("signIn.identifierLabel")}
        icon={<UserRound className="h-4 w-4" strokeWidth={1.8} />}
        autoComplete="username"
        placeholder={t("signIn.identifierPlaceholder")}
        error={form.formState.errors.identifier?.message}
        {...form.register("identifier")}
      />

      <AuthField
        label={t("signIn.passwordLabel")}
        icon={<Lock className="h-4 w-4" strokeWidth={1.8} />}
        aside={
          <Link href="/forgot-password" className="text-[11.5px] font-semibold text-[#12796a] hover:underline">
            {t("signIn.forgotPassword")}
          </Link>
        }
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        placeholder={t("signIn.passwordPlaceholder")}
        error={form.formState.errors.password?.message}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="shrink-0 text-[#5c6a62] transition hover:text-[#0d2315]"
            aria-label={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...form.register("password")}
      />

      <label className="mb-[22px] flex cursor-pointer items-center gap-2">
        <input type="checkbox" {...form.register("trustDevice")} className="peer sr-only" />
        <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border border-[#b9c9c0] bg-white transition peer-checked:border-[#0d2315] peer-checked:bg-[#0d2315] [&>svg]:peer-checked:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-[#12796a]/40">
          <svg className="opacity-0 transition" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        <span className="text-[12.5px] text-[#435048]">{t("signIn.trustDevice")}</span>
      </label>

      {apiState === "waking" || apiState === "unreachable" ? (
        <p className="mb-3 rounded-[10px] px-[13px] py-[10px] text-[11.5px] leading-normal" role="status" style={{ background: "var(--color-gold-dim)", color: "#6f510c" }}>
          {apiState === "waking" ? t("signIn.serverWaking") : t("signIn.serverUnreachable")}
        </p>
      ) : null}

      <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mb-3" />

      <button
        type="submit"
        disabled={pending}
        className="flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (apiState === "waking" ? t("signIn.waitingForServer") : t("signIn.submitting")) : t("signIn.submit")}
      </button>

      <div className="my-[22px] flex items-center gap-[10px]">
        <div className="h-px flex-1 bg-[#edf3ef]" />
        <span className="text-[11px] font-semibold text-[#5c6a62]">{t("signIn.secureAccess")}</span>
        <div className="h-px flex-1 bg-[#edf3ef]" />
      </div>

      <div
        className="flex items-start gap-[10px] rounded-[11px] border px-[14px] py-[13px]"
        style={{ borderColor: "var(--color-gold-dim)", background: "var(--color-gold-dim)" }}
      >
        <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#8a6410" }} strokeWidth={1.8} />
        <p className="text-[11.5px] leading-normal text-[#435048]">
          {t("signIn.mfaNotice")}
        </p>
      </div>

      <p className="mt-[22px] text-center text-[12.5px] text-[#435048]">
        {t("signIn.newHere")}{" "}
        <Link href="/onboarding" className="font-semibold text-[#12796a] hover:underline">
          {t("signIn.createAccount")}
        </Link>
      </p>
      <p className="mt-[10px] text-center text-xs text-[#5c6a62]">
        {t("signIn.accountsFromSchool")}
      </p>
      <p className="mt-[18px] text-center">
        <Link href="/" className="text-[11px] font-semibold text-[#12796a] hover:underline">
          {t("signIn.backToWebsite")}
        </Link>
      </p>
    </form>
  );
}
