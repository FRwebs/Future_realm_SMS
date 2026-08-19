"use client";

import { useEffect, useState } from "react";

import { useOfflineDraftQueue } from "@/hooks/use-offline-draft-queue";

export function SyncStatusPanel({ variant }: { variant: "status" | "offline" }) {
  const [isOnline, setIsOnline] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { drafts, draftCount, syncing, syncDrafts, clearDrafts } = useOfflineDraftQueue<Record<string, unknown>>({
    storageKey: "attendance-drafts",
    endpoint: "/api/v1/attendance"
  });

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!mounted) return null;

  if (variant === "status") {
    return (
      <section className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Connection</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: isOnline ? "var(--color-success)" : "var(--color-danger)" }}>
            {isOnline ? "Online" : "Offline"}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Live browser connectivity for this device.</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Queued attendance drafts</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: draftCount > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
            {draftCount}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Marked while offline on this device, waiting to sync.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Only attendance supports offline drafts today</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">Attendance offline queue for this device</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Marking attendance while offline saves a draft in this browser and syncs automatically once you&apos;re back
          online. Other forms in the app currently require a live connection to submit.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)]">
            {draftCount} draft{draftCount === 1 ? "" : "s"} queued on this device
          </span>
          {draftCount > 0 ? (
            <>
              <button
                type="button"
                onClick={() => syncDrafts()}
                disabled={syncing || !isOnline}
                className="btn-primary px-4 py-2 text-[12.5px] disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button type="button" onClick={() => clearDrafts()} className="btn-secondary px-4 py-2 text-[12.5px]">
                Clear queue
              </button>
            </>
          ) : null}
        </div>
      </section>

      {draftCount > 0 ? (
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--color-border-default)] px-6 py-4">
            <p className="text-[14px] font-bold text-[var(--color-text-primary)]">Queued drafts (raw)</p>
          </div>
          <div className="grid gap-2 p-4">
            {drafts.map((draft, index) => (
              <pre key={index} className="overflow-x-auto rounded-[10px] bg-[var(--color-bg-subtle)] p-3 text-[11px] text-[var(--color-text-secondary)]">
                {JSON.stringify(draft, null, 2)}
              </pre>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
