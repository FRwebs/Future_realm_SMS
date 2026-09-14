"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface DetailSheetChip {
  label: string;
  tone?: "good" | "warn" | "bad" | "mute" | "teal";
}

const chipToneStyle: Record<NonNullable<DetailSheetChip["tone"]>, { bg: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  mute: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" },
  teal: { bg: "#E4F1EC", fg: "#12796A" }
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
export function DetailSheet({ open, onClose, eyebrow, title, subtitle, avatarLabel, chips, children, footer, width = "460px" }: DetailSheetProps) {
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
    <div className="fixed inset-0 z-[var(--z-modal)]">
      <button type="button" aria-label="Close panel backdrop" onClick={onClose} className="overlay-enter fixed inset-0 bg-ink/45" />
      <div className="fixed inset-y-0 right-0 flex w-full justify-end">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="panel-enter-right relative flex h-full w-full max-w-full flex-col bg-white shadow-[0_50px_100px_-40px_rgba(13,35,21,0.6)]"
          style={{ width, maxWidth: "100vw" }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-default)] px-6 py-5">
            <div className="flex min-w-0 items-start gap-3">
              {avatarLabel ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0D2315] text-[12px] font-bold text-white">
                  {avatarLabel}
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{eyebrow}</p>
                <h2 className="mt-1 font-[var(--font-heading)] text-[19px] font-bold text-[var(--color-text-primary)]">{title}</h2>
                {subtitle ? <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{subtitle}</p> : null}
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-bg-subtle)] transition hover:bg-[var(--color-border-default)]" aria-label="Close panel">
              <X className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {chips && chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border-default)] px-6 py-3.5">
              {chips.map((chip) => {
                const tone = chipToneStyle[chip.tone ?? "mute"];
                return (
                  <span key={chip.label} className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                    {chip.label}
                  </span>
                );
              })}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {footer ? <div className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-4">{footer}</div> : null}
        </section>
      </div>
    </div>,
    document.body
  );
}

export function DetailFacts({ title, rows }: { title: string; rows: Array<{ label: string; value: string; bold?: boolean }> }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[var(--color-border-default)]">
      <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
        <p className="text-[12.5px] font-bold text-[var(--color-text-primary)]">{title}</p>
      </div>
      <div className="divide-y divide-[var(--color-border-muted)]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-[12.5px] text-[var(--color-text-muted)]">{row.label}</span>
            <span className={row.bold ? "text-[12.5px] font-bold text-[var(--color-text-primary)]" : "text-[12.5px] text-[var(--color-text-secondary)]"}>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const noteToneStyle: Record<"good" | "warn" | "bad" | "mute", { bg: string; bd: string; fg: string }> = {
  good: { bg: "var(--color-success-dim)", bd: "#CFE4DB", fg: "var(--color-success)" },
  warn: { bg: "var(--color-warning-dim)", bd: "#F2E4C6", fg: "var(--color-warning)" },
  bad: { bg: "var(--color-danger-dim)", bd: "#F3E0E0", fg: "var(--color-danger)" },
  mute: { bg: "var(--color-bg-subtle)", bd: "var(--color-border-default)", fg: "var(--color-text-secondary)" }
};

export function DetailNote({ tone, title, text }: { tone: "good" | "warn" | "bad" | "mute"; title?: string; text: string }) {
  const style = noteToneStyle[tone];
  return (
    <div className="rounded-[12px] border p-4" style={{ background: style.bg, borderColor: style.bd }}>
      {title ? <p className="mb-1.5 text-[12.5px] font-bold" style={{ color: style.fg }}>{title}</p> : null}
      <p className="text-[12px] leading-relaxed" style={{ color: style.fg }}>{text}</p>
    </div>
  );
}
