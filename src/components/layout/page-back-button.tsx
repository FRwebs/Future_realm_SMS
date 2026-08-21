"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { getDefaultPathForRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/domain/types";

export function PageBackButton({ session }: { session: SessionUser }) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(getDefaultPathForRole(session.role));
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-3 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-[12px] font-bold text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </button>
  );
}
