"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

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
      className={success ? "grid gap-4 rounded-[20px] ring-2 ring-emerald-200 transition-all" : "grid gap-4"}
    >
      <label>
        <span className="field-label">Email</span>
        <div className="relative mt-2">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            name="email"
            required
            className="field-control h-12 rounded-2xl bg-white/90 pl-11"
            placeholder="principal@greenfieldcollege.ng"
          />
        </div>
      </label>
      <label>
        <span className="field-label">Password</span>
        <div className="relative mt-2">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            className="field-control h-12 rounded-2xl bg-white/90 pl-11 pr-11"
            placeholder="FutureRealm123!"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      <div className="flex justify-end">
        <button type="button" className="text-[12px] font-semibold text-primary-600 transition hover:text-primary-700 hover:underline">
          Forgot password?
        </button>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary h-12 rounded-2xl text-[14px]"
      >
        <span>{pending ? "Signing in..." : "Sign in"}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
      {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
    </form>
  );
}
