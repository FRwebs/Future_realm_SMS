"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultPathForRole, normalizeRole } from "@/lib/auth/roles";

function resolveLandingPath(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? getDefaultPathForRole(normalizedRole) : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

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
        setError(body.error ?? "Unable to sign in");
        setPending(false);
        return;
      }

      router.push(resolveLandingPath(body.data.user.role));
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please make sure the app is running and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} method="post" className="grid gap-4">
      <label>
        <span className="text-sm font-semibold text-ink/70">Email</span>
        <input
          type="email"
          name="email"
          required
          className="mt-2 w-full rounded-2xl border border-ink/10 bg-sand/55 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:bg-white"
          placeholder="principal@greenfieldcollege.ng"
        />
      </label>
      <label>
        <span className="text-sm font-semibold text-ink/70">Password</span>
        <input
          type="password"
          name="password"
          required
          className="mt-2 w-full rounded-2xl border border-ink/10 bg-sand/55 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:bg-white"
          placeholder="FutureRealm123!"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink/40"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
