"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Info, Lock, ShieldCheck, UserRound } from "lucide-react";

import { AuthField } from "@/components/forms/auth-field";
import { LoginQuote } from "@/components/forms/login-quote";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { wakeApi, useApiState } from "@/lib/api/wake";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";
import { forgetKnownDevice, initialsOf, readKnownDevice, rememberKnownDevice, type KnownDevice } from "@/lib/auth/known-device";
import { focusOnMount } from "@/lib/ui/focus";
import { useOnline } from "@/lib/ui/use-online";
import { useAuthValidationMessages } from "@/hooks/use-auth-validation";
import { createSignInCodeSchema, createSignInSchema, type SignInCodeValues, type SignInValues } from "@/lib/validation/auth";

/** The phone sign-in's button: taller and rounder than the wide screen's, with an arrow. */
const PRIMARY = "flex h-[46px] w-full items-center justify-center gap-[9px] rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70 max-md:h-[54px] max-md:rounded-[16px] max-md:text-[15.5px] max-md:font-extrabold max-md:shadow-[0_14px_26px_-14px_rgba(13,35,21,0.8)] max-md:active:scale-[0.98]";

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
  const online = useOnline();
  const [pending, setPending] = useState(false);
  /** Who last signed in here and chose to trust this phone — read after mount, and only on a phone, so the wide screen is unchanged. */
  const [known, setKnown] = useState<KnownDevice | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  /** Where the one-time code went, when it was emailed; null means the authenticator app. */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  // What is needed is said beside the field it is about — the rules live in `lib/validation/auth`, the form only shows them.
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { identifier: "", password: "", trustDevice: true } });
  const codeForm = useForm<SignInCodeValues>({ resolver: zodResolver(signInCodeSchema), defaultValues: { code: "" } });

  useEffect(() => {
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 767.98px)").matches) return;
    const device = readKnownDevice();
    if (!device) return;
    setKnown(device);
    form.setValue("identifier", device.identifier);
    // The person is already named on the card; the cursor goes straight to the password.
    window.setTimeout(() => form.setFocus("password"), 0);
  }, [form]);

  function notYou() {
    forgetKnownDevice();
    setKnown(null);
    form.reset({ identifier: "", password: "", trustDevice: true });
    notice.clear();
  }

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
        data?: { user: { role: string; name?: string }; landingPath?: string | null };
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

      // On a phone the person chose to trust, the next sign-in greets them by name and asks only for the password.
      if (trustDevice && body.data.user.name) rememberKnownDevice({ identifier: known?.identifier ?? identifier, name: body.data.user.name });
      else forgetKnownDevice();
      // The button stays disabled and the message stays put until the next page has replaced this one.
      notice.success(t("signIn.signedInTitle"), t("signIn.signedInHelp"));
      // The page this person asked to open on (Preferences), when their role may see it; otherwise the usual place for their role.
      const nextPath = body.data.landingPath ?? resolveLandingPath(body.data.user.role);

      window.setTimeout(() => {
        router.push(nextPath as never);
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
          phoneSkin
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder={t("code.placeholder")}
          className="tracking-widest"
          error={codeForm.formState.errors.code?.message}
          {...codeForm.register("code")}
          ref={(node) => { codeForm.register("code").ref(node); focusOnMount(node); }}
        />

        <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mb-3 mt-4" />

        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? t("code.submitting") : t("code.submit")}
          <ArrowRight aria-hidden className="h-[18px] w-[18px] text-[#5FD6B4] md:hidden" strokeWidth={2.4} />
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
      {known || !online ? (
        <div className="mb-[18px] flex items-start gap-[11px] rounded-[16px] bg-[#e3f1ea] px-[14px] py-3 md:hidden" role="status">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white text-[#17714f]"><Info className="h-[15px] w-[15px]" strokeWidth={2.2} aria-hidden="true" /></span>
          <p className="min-w-0 flex-1 pt-1 text-[13px] font-semibold leading-normal text-[#17604f] text-pretty">
            {!online ? t("signIn.offlineNotice") : t("signIn.signedOutNotice")}
          </p>
        </div>
      ) : null}

      {known ? (
        <div className="mb-4 flex items-center gap-3 rounded-[18px] bg-white py-3 pl-3 pr-2 md:hidden" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.22)" }}>
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#e3f1ea] text-[14.5px] font-extrabold text-[#0d2315]" aria-hidden="true">{initialsOf(known.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold text-[#0d2315]">{known.name}</span>
            <span className="mt-px block truncate text-[12.5px] text-[#5c6a62]">{known.identifier}</span>
          </span>
          <button type="button" onClick={notYou} className="flex-none whitespace-nowrap px-2 py-[14px] text-[13px] font-extrabold text-[#12796a]">{t("signIn.notYou")}</button>
        </div>
      ) : null}

      <div className={known ? "max-md:hidden" : undefined}>
      <AuthField
        phoneSkin
        label={t("signIn.identifierLabel")}
        icon={<UserRound className="h-4 w-4" strokeWidth={1.8} />}
        autoComplete="username"
        placeholder={t("signIn.identifierPlaceholder")}
        error={form.formState.errors.identifier?.message}
        {...form.register("identifier")}
      />
      </div>

      <AuthField
        phoneSkin
        label={t("signIn.passwordLabel")}
        icon={<Lock className="h-4 w-4" strokeWidth={1.8} />}
        aside={
          <Link href="/forgot-password" className="text-[11.5px] font-semibold text-[#12796a] hover:underline max-md:-my-3 max-md:py-3 max-md:text-[13px] max-md:font-extrabold">
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
            className="flex shrink-0 items-center justify-center text-[#5c6a62] transition hover:text-[#0d2315] max-md:h-11 max-md:w-11 max-md:rounded-full"
            aria-label={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...form.register("password")}
      />

      <label className="mb-[22px] flex cursor-pointer items-center gap-2 max-md:mb-3 max-md:mt-2 max-md:min-h-12 max-md:gap-[11px]">
        <input type="checkbox" {...form.register("trustDevice")} className="peer sr-only" />
        <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border border-[#b9c9c0] max-md:h-[22px] max-md:w-[22px] max-md:rounded-[7px] max-md:border-[1.5px] max-md:border-[#c2d2c8] bg-white transition peer-checked:border-[#0d2315] peer-checked:bg-[#0d2315] peer-checked:*:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-[#12796a]/40">
          <svg className="opacity-0 transition" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        <span className="text-[12.5px] text-[#435048] max-md:text-[14px] max-md:font-semibold">{t("signIn.trustDevice")}</span>
      </label>

      {apiState === "waking" || apiState === "unreachable" ? (
        <p className="mb-3 rounded-[10px] px-[13px] py-[10px] text-[11.5px] leading-normal" role="status" style={{ background: "var(--color-gold-dim)", color: "#6f510c" }}>
          {apiState === "waking" ? t("signIn.serverWaking") : t("signIn.serverUnreachable")}
        </p>
      ) : null}

      <InlineNotice notice={notice.notice} onDismiss={notice.notice?.variant === "success" ? undefined : notice.clear} className="mb-3" />

      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? (apiState === "waking" ? t("signIn.waitingForServer") : t("signIn.submitting")) : t("signIn.submit")}
        {pending ? null : <ArrowRight className="h-[18px] w-[18px] text-[#5fd6b4] md:hidden" strokeWidth={2.4} aria-hidden="true" />}
      </button>

      <div className="my-[22px] flex items-center gap-[10px] max-md:hidden">
        <div className="h-px flex-1 bg-[#edf3ef]" />
        <span className="text-[11px] font-semibold text-[#5c6a62]">{t("signIn.secureAccess")}</span>
        <div className="h-px flex-1 bg-[#edf3ef]" />
      </div>

      <div
        className="flex items-start gap-[10px] rounded-[11px] border px-[14px] py-[13px] max-md:hidden"
        style={{ borderColor: "var(--color-gold-dim)", background: "var(--color-gold-dim)" }}
      >
        <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#8a6410" }} strokeWidth={1.8} />
        <p className="text-[11.5px] leading-normal text-[#435048]">
          {t("signIn.mfaNotice")}
        </p>
      </div>

      <p className="mt-[22px] text-center text-[12.5px] text-[#435048] max-md:text-[13.5px]">
        {t("signIn.newHere")}{" "}
        <Link href="/onboarding" className="font-semibold text-[#12796a] hover:underline max-md:px-0.5 max-md:py-[10px] max-md:font-extrabold">
          {t("signIn.createAccount")}
        </Link>
      </p>
      <p className="mt-[10px] text-center text-xs text-[#5c6a62] max-md:mt-1 max-md:text-[12.5px] max-md:leading-normal max-md:text-[#5c6a62] max-md:text-pretty">
        {t("signIn.accountsFromSchool")}
      </p>
      <LoginQuote />
      <p className="mt-[18px] text-center max-md:mt-3">
        <Link href="/" className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#12796a] hover:underline max-md:min-h-[46px] max-md:text-[13.5px] max-md:font-extrabold">
          <ChevronLeft className="hidden h-[15px] w-[15px] max-md:block" strokeWidth={2.4} aria-hidden="true" />
          <span className="max-md:hidden">{t("signIn.backToWebsite")}</span>
          <span className="md:hidden">{t("signIn.backToWebsite").replace(/^←\s*/, "")}</span>
        </Link>
      </p>
    </form>
  );
}
