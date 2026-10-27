"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface DetailSheetChip {
  label: string;
  tone?: "good" | "warn" | "bad" | "mute" | "teal";
}

const chipToneStyle: Record<NonNullable<DetailSheetChip["tone"]>, { bg: string; fg: string }> = {
  good: { bg: "#EAF6F0", fg: "#17714F" },
  warn: { bg: "#FDF6E7", fg: "#8A6410" },
  bad: { bg: "#FDF3F3", fg: "#B23B3B" },
  mute: { bg: "#F1F4F2", fg: "#5C6A62" },
  teal: { bg: "#E4F1EC", fg: "#17604F" }
};

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  subtitle?: string;
  avatarLabel?: string;
  chips?: DetailSheetChip[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

/** A right-anchored sliding detail panel — matches the mockup's row-click "review" sheet (as
 * distinct from the centered Modal used for actual create/edit forms). */
export function DetailSheet({ open, onClose, eyebrow, title, subtitle, avatarLabel, chips, children, footer, width = "504px" }: DetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-(--z-modal)">
      <button type="button" aria-label="Close panel backdrop" onClick={onClose} className="overlay-enter fixed inset-0 bg-[rgba(13,35,21,0.5)]" />
      <div className="pointer-events-none fixed inset-y-0 right-0 flex w-full justify-end">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="panel-enter-right pointer-events-auto relative h-full w-full max-w-[92vw] overflow-y-auto bg-[#F8FAF9] shadow-[-36px_0_81px_-27px_rgba(13,35,21,0.55)]"
          style={{ width }}
        >
          <div className="sticky top-0 z-2 bg-[#0D2315] px-[21.5px] py-[18px]">
            <div className="flex items-start justify-between gap-[14.5px]">
              <div className="flex min-w-0 items-start gap-[11.5px]">
                {avatarLabel ? (
                  <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px] bg-white/10 font-(--font-heading) text-[12.5px] font-extrabold text-white">{avatarLabel}</div>
                ) : null}
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/50">{eyebrow}</p>
                  <h2 className="mt-[4.5px] text-pretty font-(--font-heading) text-[17px] font-extrabold tracking-[-0.017em] text-white">{title}</h2>
                  {subtitle ? <p className="mt-[4.5px] text-pretty text-[11px] leading-normal text-white/60">{subtitle}</p> : null}
                </div>
              </div>
              <button type="button" onClick={onClose} className="flex h-[25px] w-[25px] flex-none items-center justify-center rounded-[9px] bg-white/12 transition hover:bg-white/20" aria-label="Close panel">
                <X className="h-[12.5px] w-[12.5px] text-white" strokeWidth={2.2} />
              </button>
            </div>
            {chips && chips.length > 0 ? (
              <div className="mt-[12.5px] flex flex-wrap items-center gap-[6.5px]">
                {chips.map((chip) => {
                  const tone = chipToneStyle[chip.tone ?? "mute"];
                  return (
                    <span key={chip.label} className="inline-block whitespace-nowrap rounded-full px-[9px] py-[3.5px] text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                      {chip.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-[12.5px] px-[21.5px] pb-[27px] pt-4">
            {children}
            {footer ? <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#DEE8E2] bg-white px-[14.5px] py-[11.5px] *:min-w-0 [&_button]:flex-1 [&_button]:justify-center [&_button]:whitespace-nowrap">{footer}</div> : null}
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

/** One white card in the sheet, with the mockup's title strip when it has a title. */
export function SheetCard({ title, sub, children }: { title?: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
      {title ? (
        <div className="border-b border-[#EDF3EF] px-[14.5px] pb-[10px] pt-[12.5px]">
          <p className="text-[11.5px] font-semibold text-[#0D2315]">{title}</p>
          {sub ? <p className="mt-[2.5px] text-pretty text-[10.5px] leading-normal text-[#5f6e65]">{sub}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DetailFacts({ title, rows }: { title: string; rows: Array<{ label: string; value: string; bold?: boolean }> }) {
  return (
    <SheetCard title={title || undefined}>
      <div className="px-[14.5px] pb-[9px] pt-[3.5px]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-[14.5px] border-b border-[#F4F8F6] py-2 last:border-b-0">
            <span className="max-w-[180px] flex-none text-[11px] text-[#5f6e65]">{row.label}</span>
            <span className={`text-pretty text-right text-[11.5px] text-[#0D2315] ${row.bold ? "font-semibold" : "font-medium"}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </SheetCard>
  );
}

const noteToneStyle: Record<"good" | "warn" | "bad" | "mute", { bg: string; fg: string }> = {
  good: { bg: "#EAF6F0", fg: "#17714F" },
  warn: { bg: "#FDF6E7", fg: "#8A6410" },
  bad: { bg: "#FDF3F3", fg: "#B23B3B" },
  mute: { bg: "#F1F4F2", fg: "#5C6A62" }
};

export function DetailNote({ tone, title, text }: { tone: "good" | "warn" | "bad" | "mute"; title?: string; text: string }) {
  const style = noteToneStyle[tone];
  return (
    <SheetCard title={title}>
      <div className="px-[14.5px] py-[11px]">
        <div className="text-pretty rounded-[11px] px-[12.5px] py-[11px] text-[11px] leading-[1.55]" style={{ background: style.bg, color: style.fg }}>{text}</div>
      </div>
    </SheetCard>
  );
}
