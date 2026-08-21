"use client";

import { AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SessionUser } from "@/lib/domain/types";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short"
  }).format(date);
}

export function ImpersonationBanner({ session }: { session: SessionUser }) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const impersonation = session.impersonation;

  if (!impersonation) return null;

  async function endImpersonation() {
    setEnding(true);
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      router.replace("/login");
      router.refresh();
    } finally {
      setEnding(false);
    }
  }

  const expiresAt = formatTime(impersonation.expiresAt);

  return (
    <div className="border-b border-amber-300/70 bg-amber-50 px-4 py-2 text-amber-950 shadow-[0_1px_0_rgba(146,64,14,0.08)] md:px-6">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-amber-200 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-black">
              Impersonation active: viewing {session.name} ({session.email})
            </p>
            <p className="mt-0.5 text-[11.5px] font-medium text-amber-900/80">
              Started by {impersonation.impersonatorName}
              {expiresAt ? ` · Expires ${expiresAt}` : ""}. Actions are performed inside this user account.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={endImpersonation}
          disabled={ending}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-amber-300 bg-white px-3 text-[12px] font-bold text-amber-950 shadow-sm transition hover:border-amber-500 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          {ending ? "Ending..." : "End session"}
        </button>
      </div>
    </div>
  );
}
