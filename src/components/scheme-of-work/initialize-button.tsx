"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { schemeApi } from "./api";

export function InitializeSchemeButton({
  subjectId,
  classId,
  label = "Initialize Scheme of Work",
}: {
  subjectId: string;
  classId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function initialize() {
    setPending(true);
    setError(null);
    try {
      await schemeApi("/api/v1/scheme-of-work", {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          classId,
        }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initialize scheme of work.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void initialize()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {pending ? "Initializing..." : label}
      </button>
    </div>
  );
}
