"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Sign in, or choose a password from an invitation link. Both talk to the partner portal only. */
export function PartnerAuthForm({ mode, token }: { mode: "login" | "accept"; token?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/partner-portal/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email: form.get("email"), password: form.get("password") } : { token, password: form.get("password") })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error ?? "That did not work.");
      router.push("/partner");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work.");
    } finally {
      setPending(false);
    }
  }

  const field = "w-full rounded-[10px] border border-[#DEE8E2] bg-white px-[13px] py-[11px] text-[13px] text-[#0D2315] outline-hidden focus:border-[#12796A]";
  return (
    <form onSubmit={submit} className="grid gap-4">
      {mode === "login" ? (
        <label className="grid gap-1.5">
          <span className="text-[12px] font-semibold text-[#435048]">Work email</span>
          <input name="email" type="email" required autoComplete="username" className={field} />
        </label>
      ) : null}
      <label className="grid gap-1.5">
        <span className="text-[12px] font-semibold text-[#435048]">{mode === "login" ? "Password" : "Choose a password"}</span>
        <input name="password" type="password" required minLength={mode === "accept" ? 12 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className={field} />
        {mode === "accept" ? <span className="text-[11px] text-[#5f6e65]">At least 12 characters. You set it yourself — nobody at the platform ever sees it.</span> : null}
      </label>
      {error ? <p className="rounded-[10px] bg-[#FDF3F3] px-3 py-2 text-[12px] font-medium text-[#B23B3B]">{error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-[10px] bg-[#0D2315] px-4 py-[12px] text-[13px] font-semibold text-white hover:bg-[#17402A] disabled:opacity-60">
        {pending ? "One moment…" : mode === "login" ? "Sign in" : "Set password and continue"}
      </button>
    </form>
  );
}
