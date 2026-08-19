"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";

function resolveLandingPath(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? getDefaultPathForRole(normalizedRole) : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });

      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { user: { role: string } };
      };

      if (!response.ok || body.ok === false || !body.data) {
        const nextError = body.error ?? "Unable to sign in";
        setError(nextError);
        showToast({
          variant: "error",
          title: "Sign-in failed",
          description: nextError,
        });
        setPending(false);
        return;
      }

      setSuccess(true);
      showToast({
        variant: "success",
        title: "Sign-in successful",
        description: "Opening your workspace now.",
      });
      const nextPath = resolveLandingPath(body.data.user.role);

      window.setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 250);
    } catch {
      const nextError =
        "Unable to reach the server. Please make sure the app is running and try again.";
      setError(nextError);
      showToast({
        variant: "error",
        title: "Server unavailable",
        description: nextError,
      });
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      method="post"
      className={success ? "ring-2 ring-[var(--color-success)]/40 transition-all" : ""}
    >
      <label className="mb-[7px] block text-[11.5px] font-semibold text-[#435048]">Work email</label>
      <div className="mb-4 flex items-center gap-[10px] rounded-[11px] border-[1.5px] border-[#dee8e2] px-[14px] py-[12px] transition focus-within:border-[#12796a]">
        <Mail className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type="email"
          name="email"
          required
          className="w-full bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder="principal@greenfieldcollege.ng"
        />
      </div>

      <div className="mb-[7px] flex items-center justify-between">
        <label className="text-[11.5px] font-semibold text-[#435048]">Password</label>
        <button type="button" className="text-[11.5px] font-semibold text-[#12796a] hover:underline">
          Forgot password?
        </button>
      </div>
      <div className="mb-4 flex items-center gap-[10px] rounded-[11px] border-[1.5px] border-[#dee8e2] px-[14px] py-[12px] transition focus-within:border-[#12796a]">
        <Lock className="h-4 w-4 shrink-0 text-[#9fb8a7]" strokeWidth={1.8} />
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          required
          className="w-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0d2315] outline-none placeholder:text-[#9fb8a7]"
          placeholder="FutureRealm123!"
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

      <label className="mb-[22px] flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(event) => setTrustDevice(event.target.checked)}
          className="peer sr-only"
        />
        <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] bg-[#0d2315] peer-focus-visible:ring-2 peer-focus-visible:ring-[#12796a]/40">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
        <span className="text-[12.5px] text-[#435048]">Trust this device for 30 days</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="flex h-[46px] w-full items-center justify-center rounded-[11px] bg-[#0d2315] text-[14px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(13,35,21,0.55)] transition hover:bg-[#12796a] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <div className="my-[22px] flex items-center gap-[10px]">
        <div className="h-px flex-1 bg-[#edf3ef]" />
        <span className="text-[11px] font-semibold text-[#b4c4bb]">SECURE ACCESS</span>
        <div className="h-px flex-1 bg-[#edf3ef]" />
      </div>

      <div
        className="flex items-start gap-[10px] rounded-[11px] border px-[14px] py-[13px]"
        style={{ borderColor: "var(--color-gold-dim)", background: "var(--color-gold-dim)" }}
      >
        <ShieldCheck className="mt-px h-4 w-4 shrink-0" style={{ color: "#8a6410" }} strokeWidth={1.8} />
        <p className="text-[11.5px] leading-[1.5] text-[#435048]">
          Multi-factor authentication is required for Principal, Proprietor and Bursar accounts.
          You&apos;ll be asked for a one-time code after this step.
        </p>
      </div>

      {error ? <p className="mt-4 text-[13px] text-[var(--color-danger)]">{error}</p> : null}

      <p className="mt-[26px] text-center text-xs text-[#9fb8a7]">
        Not your school?{" "}
        <button type="button" className="font-semibold text-[#435048] hover:underline">
          Switch workspace
        </button>{" "}
        · <button type="button" className="font-semibold text-[#435048] hover:underline">Get help</button>
      </p>
    </form>
  );
}
