"use client";

import { AlertTriangle, Info, Megaphone, Wrench, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { configApi } from "@/components/configuration/api";
import type { PlatformSyncView } from "@/lib/domain/types";
import { usePhoneKind } from "@/components/layout/phone-shell";
import { cn } from "@/lib/utils/cn";
import { formatDay } from "@/lib/date-format";

type Tone = "info" | "warning" | "critical";

const TONE: Record<Tone, string> = {
  info: "border-(--color-border-subtle) bg-(--color-surface-soft) text-(--color-text-secondary)",
  warning: "border-[#E9D49B] bg-[#FBF5E1] text-[#7A5B0E]",
  critical: "border-[#E7B7B0] bg-[#FBEDEA] text-[#8E2B20]"
};

const stamp = (value: string) =>
  formatDay(new Date(value), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }, "en-NG");

function Notice({ tone, icon: Icon, title, children, onClose }: { tone: Tone; icon: typeof Info; title: string; children?: React.ReactNode; onClose?: () => void }) {
  // On a teacher's phone a notice is one of the page's own soft cards, not a ruled box laid over it.
  const soft = usePhoneKind() !== null;
  // The teacher mobile mockup keeps every screen but the first clear of announcements. What is only information waits on Today; what
  // changes what the teacher can do — maintenance, read-only, a warning — is never hidden.
  const here = usePathname().replace(/\/$/, "");
  const home = here === "/command-center/today" || here === "/portals/parent/overview" || here === "/portals/parent";
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      data-notice=""
      data-quiet={soft && tone === "info" && !home ? "" : undefined}
      className={cn("flex items-start gap-3 border px-3.5 py-2.5 text-[12.5px] leading-5 rounded-[10px]", TONE[tone], soft && tone === "info" && !home && "max-md:hidden", soft && "max-md:rounded-[18px] max-md:border-transparent max-md:px-4 max-md:py-3 max-md:font-medium", soft && tone === "info" && "max-md:bg-[#E9F3EE] max-md:text-[#2F5A49]")}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {children ? <p className="mt-0.5 whitespace-pre-line opacity-90">{children}</p> : null}
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-sm p-0.5 opacity-70 hover:opacity-100">
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
 *
 * Most of this is addressed to whoever runs the school: a plan that has not
 * been chosen, a tier changing next term, "review pending approvals before
 * publishing reports". None of it is a student's to act on, and a child or their parent should
 * not be handed an operator's notice above their homework. So a student is
 * shown only what actually reaches them — when the system will be down, and
 * that it is down now.
 */
export function PlatformNotices({ sync, operational = true, inline = false }: { sync: PlatformSyncView; operational?: boolean; /** Drawn inside the scrolling page, which already has its own gutters. */ inline?: boolean }) {
  const [gone, setGone] = useState<string[]>([]);
  const dismiss = (id: string) => {
    setGone((current) => [...current, id]);
    void configApi(`/api/v1/platform-sync/announcements/${id}/dismiss`, { method: "POST", body: "{}" }).catch(() => undefined);
  };

  const windows = sync.windows;
  const announcements = operational ? sync.announcements.filter((row) => !gone.includes(row.id)) : [];
  const readOnly = sync.readOnly && (operational || sync.readOnly.kind === "maintenance") ? sync.readOnly : null;
  const platformMessage = operational ? sync.platformMessage : null;
  const pendingSwitch = operational ? sync.pendingSwitch : null;
  if (!readOnly && !platformMessage && !windows.length && !announcements.length && !pendingSwitch) return null;

  return (
    // When a teacher's phone is hiding every notice here, the strip's own padding goes with them.
    <div className={cn("grid gap-2 max-md:[&:not(:has([data-notice]:not([data-quiet])))]:hidden", inline ? "mb-3" : "px-4 pt-3 md:px-6")}>
      {readOnly ? (
        <Notice tone="warning" icon={AlertTriangle} title={readOnly.kind === "maintenance" ? "FutureRealm is in maintenance — read only" : "Read-only until you choose a plan"}>
          {readOnly.reason}
        </Notice>
      ) : null}
      {windows.map((window) => (
        <Notice key={window.id} tone={window.active ? "warning" : "info"} icon={Wrench} title={window.active ? `${window.title} — in progress until ${stamp(window.endsAt)}` : `${window.title} — ${stamp(window.startsAt)} to ${stamp(window.endsAt)}`}>
          {window.message}
        </Notice>
      ))}
      {platformMessage ? (
        <Notice tone="info" icon={Megaphone} title="From FutureRealm">
          {platformMessage}
        </Notice>
      ) : null}
      {announcements.map((row) => (
        <Notice key={row.id} tone={row.type === "CRITICAL" ? "critical" : row.type === "WARNING" ? "warning" : "info"} icon={row.type === "CRITICAL" || row.type === "WARNING" ? AlertTriangle : Megaphone} title={row.title} onClose={() => dismiss(row.id)}>
          {row.body}
        </Notice>
      ))}
      {pendingSwitch ? (
        <Notice tone="info" icon={Info} title={`Moving to ${pendingSwitch.to}${pendingSwitch.from ? ` on ${stamp(pendingSwitch.from)}` : ""}`}>
          This was scheduled in Subscription & Billing. What the school can use changes on that date.
        </Notice>
      ) : null}
    </div>
  );
}
