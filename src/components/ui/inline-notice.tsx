"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * What a form, a button or a panel says back about what it just did — success, a failure, a warning, a requirement.
 *
 * It is never a toast. A message that floats in a corner of the screen is read after the eye has already moved on, and is gone before it
 * can be acted on. This one sits where the thing happened, in the page's own flow, stays until the next attempt, and is announced to a
 * screen reader. Put it directly above the button that caused it, or beside the field it is about.
 */

export type NoticeVariant = "success" | "error" | "warning" | "info";
export type Notice = { variant: NoticeVariant; title: string; description?: string };

const TONE: Record<NoticeVariant, { icon: typeof Info; shell: string; icon_: string; text: string }> = {
  success: { icon: CheckCircle2, shell: "border-[#cfe7d7] bg-[#f1faf4]", icon_: "text-[#12796a]", text: "text-[#17604f]" },
  info: { icon: Info, shell: "border-[#d7e5f4] bg-[#f3f8fd]", icon_: "text-[#256f9c]", text: "text-[#244b6b]" },
  warning: { icon: AlertTriangle, shell: "border-[#eadab8] bg-[#fff8ea]", icon_: "text-[#8a6410]", text: "text-[#6f510c]" },
  error: { icon: AlertCircle, shell: "border-[#efcdcd] bg-[#fff4f4]", icon_: "text-[#a13d3d]", text: "text-[#7f2d2d]" },
};

export function InlineNotice({ notice, onDismiss, className, compact = false, bringIntoView = false }: { notice: Notice | null; onDismiss?: () => void; className?: string; compact?: boolean; /** Scroll even a success into view — for a workspace whose one message slot may be far above the button that was pressed. */ bringIntoView?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // A message that appears below the fold is no message at all: bring it into view, without jumping the page when it is already there.
  useEffect(() => {
    if (notice && (bringIntoView || notice.variant === "error" || notice.variant === "warning")) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [notice]);
  if (!notice) return null;
  const tone = TONE[notice.variant];
  const Icon = tone.icon;
  const urgent = notice.variant === "error" || notice.variant === "warning";
  return (
    <div ref={ref} role={urgent ? "alert" : "status"} aria-live={urgent ? "assertive" : "polite"} className={cn("flex items-start gap-[10px] rounded-[11px] border px-[13px] py-[10px]", tone.shell, compact && "py-[7px]", className)}>
      <Icon className={cn("mt-px h-[15px] w-[15px] shrink-0", tone.icon_)} strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[12px] font-bold leading-[1.4]", tone.text)}>{notice.title}</p>
        {notice.description ? <p className={cn("mt-[2px] text-pretty text-[11.5px] leading-[1.5]", tone.text)}>{notice.description}</p> : null}
      </div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss this message" className={cn("-mr-[3px] -mt-[2px] shrink-0 rounded-[6px] p-[3px] opacity-60 transition hover:opacity-100", tone.text)}>
          <X className="h-[13px] w-[13px]" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** What a field says when what was typed (or not typed) cannot be used. Sits under the field, tied to it for assistive technology. */
export function FieldMessage({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p id={id} role="alert" className="mt-[5px] flex items-center gap-[5px] text-[11.5px] font-medium text-[#a13d3d]"><AlertCircle className="h-[12px] w-[12px] shrink-0" aria-hidden="true" />{children}</p>;
}

/** The state behind one notice. `show` replaces whatever was said before, so the message always matches the last thing that happened. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const show = useCallback((next: Notice) => setNotice(next), []);
  const clear = useCallback(() => setNotice(null), []);
  const success = useCallback((title: string, description?: string) => setNotice({ variant: "success", title, description }), []);
  const error = useCallback((title: string, description?: string) => setNotice({ variant: "error", title, description }), []);
  const warning = useCallback((title: string, description?: string) => setNotice({ variant: "warning", title, description }), []);
  const info = useCallback((title: string, description?: string) => setNotice({ variant: "info", title, description }), []);
  return { notice, show, clear, success, error, warning, info };
}
