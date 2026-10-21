"use client";

import { AlertTriangle, Info, Megaphone, Wrench, X } from "lucide-react";
import { useState } from "react";

import { configApi } from "@/components/configuration/api";
import type { PlatformSyncView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "warning" | "critical";

const TONE: Record<Tone, string> = {
  info: "border-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)]",
  warning: "border-[#E9D49B] bg-[#FBF5E1] text-[#7A5B0E]",
  critical: "border-[#E7B7B0] bg-[#FBEDEA] text-[#8E2B20]"
};

const stamp = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));

function Notice({ tone, icon: Icon, title, children, onClose }: { tone: Tone; icon: typeof Info; title: string; children?: React.ReactNode; onClose?: () => void }) {
  return (
    <div role={tone === "critical" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-5", TONE[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {children ? <p className="mt-0.5 whitespace-pre-line opacity-90">{children}</p> : null}
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded p-0.5 opacity-70 hover:opacity-100">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * What the Back Office has decided that this school has to know: the platform being in maintenance or the trial being over (the school
 * is read-only), a maintenance window, a platform message, and announcements aimed at it. Modules switched off for the school are
 * not listed here — they are simply not in the sidebar, and opening one by address says why.
 */
export function PlatformNotices({ sync }: { sync: PlatformSyncView }) {
  const [gone, setGone] = useState<string[]>([]);
  const dismiss = (id: string) => {
    setGone((current) => [...current, id]);
    void configApi(`/api/v1/platform-sync/announcements/${id}/dismiss`, { method: "POST", body: "{}" }).catch(() => undefined);
  };

  const windows = sync.windows;
  const announcements = sync.announcements.filter((row) => !gone.includes(row.id));
  if (!sync.readOnly && !sync.platformMessage && !windows.length && !announcements.length && !sync.pendingSwitch) return null;

  return (
    <div className="grid gap-2 px-4 pt-3 md:px-6">
      {sync.readOnly ? (
        <Notice tone="warning" icon={AlertTriangle} title={sync.readOnly.kind === "maintenance" ? "FutureRealm is in maintenance — read only" : "Read-only until you choose a plan"}>
          {sync.readOnly.reason}
        </Notice>
      ) : null}
      {windows.map((window) => (
        <Notice key={window.id} tone={window.active ? "warning" : "info"} icon={Wrench} title={window.active ? `${window.title} — in progress until ${stamp(window.endsAt)}` : `${window.title} — ${stamp(window.startsAt)} to ${stamp(window.endsAt)}`}>
          {window.message}
        </Notice>
      ))}
      {sync.platformMessage ? (
        <Notice tone="info" icon={Megaphone} title="From FutureRealm">
          {sync.platformMessage}
        </Notice>
      ) : null}
      {announcements.map((row) => (
        <Notice key={row.id} tone={row.type === "CRITICAL" ? "critical" : row.type === "WARNING" ? "warning" : "info"} icon={row.type === "CRITICAL" || row.type === "WARNING" ? AlertTriangle : Megaphone} title={row.title} onClose={() => dismiss(row.id)}>
          {row.body}
        </Notice>
      ))}
      {sync.pendingSwitch ? (
        <Notice tone="info" icon={Info} title={`Moving to ${sync.pendingSwitch.to}${sync.pendingSwitch.from ? ` on ${stamp(sync.pendingSwitch.from)}` : ""}`}>
          This was scheduled in Subscription & Billing. What the school can use changes on that date.
        </Notice>
      ) : null}
    </div>
  );
}
