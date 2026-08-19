"use client";

import { useEffect, useState } from "react";

export function OfflineSyncStatus({ variant }: { variant: "pulse" | "card" }) {
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("attendance-drafts");
      setDraftCount(stored ? (JSON.parse(stored) as unknown[]).length : 0);
    } catch {
      setDraftCount(0);
    }
  }, []);

  const synced = draftCount === 0;

  if (variant === "pulse") {
    const value = draftCount === null ? "…" : synced ? "Synced" : "Pending";
    const sub = draftCount === null ? "Checking device" : `${draftCount} pending record${draftCount === 1 ? "" : "s"}`;
    return (
      <div className="px-4 py-4 xl:border-r xl:border-white/10 xl:last:border-r-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/50">Sync status</p>
        <p className="mt-2 font-[var(--font-heading)] text-[19px] font-bold text-white">{value}</p>
        <p className="mt-1.5 text-[10.5px] font-medium text-white/60">{sub}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-[18px]">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: draftCount === null ? "var(--color-text-muted)" : synced ? "var(--color-success)" : "var(--color-warning)" }}
        />
        <p className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">
          {draftCount === null ? "Checking sync status…" : synced ? "All records synced" : "Records waiting to sync"}
        </p>
      </div>
      <p className="text-[11.5px] leading-[1.5] text-[var(--color-text-muted)]">
        {draftCount === null
          ? "Reading this device's offline queue."
          : `${draftCount} attendance record${draftCount === 1 ? "" : "s"} pending on this device · offline drafts persist in this browser.`}
      </p>
    </div>
  );
}
