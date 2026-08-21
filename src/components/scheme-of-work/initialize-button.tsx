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
      {error ? (
        <p
          className="rounded-[10px] px-4 py-3 text-[13px] font-semibold"
          style={{ background: "var(--color-danger-dim)", color: "var(--color-danger)" }}
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void initialize()}
        className="btn-primary px-5"
      >
        <Plus className="h-4 w-4" />
        {pending ? "Initializing..." : label}
      </button>
    </div>
  );
}
