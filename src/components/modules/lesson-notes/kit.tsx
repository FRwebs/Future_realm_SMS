"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PanelTone } from "@/lib/modules/panels";
import { GRID_SUFFIX, type Letterhead, type Section } from "@/lib/modules/lesson-notes-types";
import { sendJsonForData } from "@/lib/modules/submit";
import { CARD_BORDER, INK, MUTED, toneOf } from "@/lib/modules/tones";

export { CARD_BORDER, INK, MUTED };

export const statusTone = (status: string): PanelTone =>
  status === "Taught" ? "positive" : status === "In progress" ? "progress" : status === "Partly taught" ? "attention" : status === "Postponed" ? "negative" : status === "Revision" ? "submitted" : status === "Planned" ? "neutral" : "offline";

export function Chip({ tone = "neutral", children, onClick, title }: { tone?: PanelTone; children: React.ReactNode; onClick?: () => void; title?: string }) {
  const swatch = toneOf(tone);
  const style = { background: swatch.bg, color: swatch.fg, borderColor: swatch.bd };
  const className = "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[10.5px] font-bold";
  const dot = <span className="h-[6px] w-[6px] rounded-full" style={{ background: swatch.dot }} />;
  return onClick ? (
    <button type="button" title={title} onClick={onClick} className={`${className} hover:brightness-95`} style={style}>{dot}{children}<span aria-hidden className="text-[8px]">▾</span></button>
  ) : (
    <span title={title} className={className} style={style}>{dot}{children}</span>
  );
}

export function Card({ children, className = "", pad = true }: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return <section className={`rounded-[14px] border bg-white ${pad ? "p-4 md:p-5" : ""} ${className}`} style={{ borderColor: CARD_BORDER }}>{children}</section>;
}

type BtnProps = { children: React.ReactNode; onClick?: () => void; href?: string; kind?: "primary" | "ghost" | "danger" | "soft"; disabled?: boolean; busy?: boolean; small?: boolean; title?: string; type?: "button" | "submit" };
export function Btn({ children, onClick, kind = "ghost", disabled, busy, small, title, type = "button" }: BtnProps) {
  const look =
    kind === "primary" ? { background: INK, color: "#fff", borderColor: INK }
    : kind === "danger" ? { background: "#fff", color: "#B23B3B", borderColor: "#F0CFCF" }
    : kind === "soft" ? { background: "#F1F8F4", color: INK, borderColor: "#D4E5DB" }
    : { background: "#fff", color: "#435048", borderColor: "#CFDDD5" };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled || busy} className={`inline-flex items-center justify-center gap-[6px] whitespace-nowrap rounded-[10px] border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${small ? "px-[10px] py-[5px] text-[11px]" : "px-[13px] py-[8px] text-[11.5px]"}`} style={look}>
      {busy ? "Working…" : children}
    </button>
  );
}

export const inputClass = "w-full min-w-0 rounded-[10px] border-[1.5px] bg-white px-[11px] py-[8px] text-[12px] font-medium text-[#0D2315] outline-none focus:border-[#12796A] disabled:bg-[#F6F9F7] disabled:text-[#67766D]";

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-[5px] block text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>
      {children}
      {hint ? <span className="ml-2 font-medium normal-case tracking-normal">{hint}</span> : null}
    </span>
  );
}

/** A message that fades: what happened, in words. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: "ok" | "bad" = "ok") => {
    setToast({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), tone === "bad" ? 7000 : 3600);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = toast ? (
    <div role="status" className="fixed bottom-5 left-1/2 z-[80] max-w-[92vw] -translate-x-1/2 rounded-[12px] px-[16px] py-[10px] text-[12px] font-semibold shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)]" style={{ background: toast.tone === "ok" ? INK : "#8E2A2A", color: "#fff" }}>{toast.text}</div>
  ) : null;
  return { show, node };
}

/** One write, with its busy flag, and its failure said where it can be read. */
export function useWrite(toast: (text: string, tone?: "ok" | "bad") => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, endpoint: string, method: string, body: unknown, done?: string | ((data: T) => string), onError?: (message: string) => void): Promise<T | null> => {
      setBusy(key);
      try {
        const data = await sendJsonForData<T>(endpoint, method, body);
        if (done) toast(typeof done === "function" ? done(data) : done);
        return data;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "That did not save.";
        onError?.(message);
        toast(message, "bad");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}

export function Confirm({ title, body, confirm, danger, busy, onConfirm, onCancel, children }: { title: string; body?: string; confirm: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void; children?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(13,35,21,0.45)] p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} className="w-full max-w-[460px] rounded-[16px] bg-white p-5 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.6)]">
        <p className="text-[14px] font-extrabold" style={{ color: INK }}>{title}</p>
        {body ? <p className="mt-2 text-[12px] leading-[1.65]" style={{ color: MUTED }}>{body}</p> : null}
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={onCancel}>Not yet</Btn>
          <Btn kind={danger ? "danger" : "primary"} onClick={onConfirm} busy={busy}>{confirm}</Btn>
        </div>
      </div>
    </div>
  );
}

/** A designed empty state: what this is, why it is empty, and the one thing to do about it. */
export function Empty({ title, body, icon, children }: { title: string; body: string; icon?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed px-6 py-10 text-center" style={{ borderColor: "#CFDDD5", background: "#FBFDFC" }}>
      <span className="mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-full" style={{ background: "#EAF3EE", color: INK }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon ?? "M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM9 8.5h5M9 12h5"} /></svg>
      </span>
      <p className="text-[14px] font-extrabold" style={{ color: INK }}>{title}</p>
      <p className="mx-auto mt-1.5 max-w-[520px] text-[12px] leading-[1.7]" style={{ color: MUTED }}>{body}</p>
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });

export const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/* ───────────────────────── printing ───────────────────────── */

export const esc = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A week of an early-years plan: the days down the side, the parts of the day across. */
export const GRID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const GRID_SLOTS = ["Circle time", "Phonics", "Number", "Creative", "Outdoor"];
export type WeekGrid = Record<string, Record<string, string>>;

export function parseGrid(raw: string | undefined): WeekGrid {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as WeekGrid) : {};
  } catch {
    return {};
  }
}

/** The words a reader sees for a grid — what the review, the history and the print read. */
export function composeGrid(grid: WeekGrid): string {
  return GRID_DAYS.map((day) => {
    const cells = GRID_SLOTS.filter((slot) => (grid[day]?.[slot] ?? "").trim()).map((slot) => `  ${slot}: ${grid[day]![slot]!.trim()}`);
    return cells.length ? `${day}\n${cells.join("\n")}` : "";
  }).filter(Boolean).join("\n\n");
}

/** A note's sections as printed paper: a grid section becomes a table. */
export function notesHtml(sections: Section[], text: Record<string, string>): string {
  return sections.map((section) => {
    const grid = section.kind === "week-grid" ? parseGrid(text[`${section.key}${GRID_SUFFIX}`]) : null;
    const filled = grid && Object.keys(grid).length;
    const body = filled
      ? `<table><tr><th></th>${GRID_SLOTS.map((slot) => `<th>${esc(slot)}</th>`).join("")}</tr>${GRID_DAYS.map((day) => `<tr><th>${day}</th>${GRID_SLOTS.map((slot) => `<td>${esc(grid![day]?.[slot] ?? "")}</td>`).join("")}</tr>`).join("")}</table>`
      : `<div class="t">${esc(text[section.key] || "—")}</div>`;
    return `<h2>${esc(section.label)}</h2>${body}`;
  }).join("");
}

/** Prints on the school's own paper: its name, address and contact at the head, who printed it and when at the foot. */
export function printSheet(input: { letterhead: Letterhead; kicker: string; title: string; sub?: string; body: string; by?: string }): boolean {
  const frame = window.open("", "_blank", "width=900,height=720");
  if (!frame) return false;
  const when = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
  frame.document.write(`<!doctype html><title>${esc(input.title)}</title><style>
    @page{margin:16mm}body{font:12.5px/1.6 system-ui,-apple-system,sans-serif;color:#0D2315;margin:0}
    .lh{border-bottom:2px solid #0D2315;padding-bottom:10px;margin-bottom:16px}.lh b{display:block;font-size:18px;letter-spacing:.01em}.lh span{display:block;color:#555;font-size:11.5px}
    .k{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5F6E65}h1{font-size:19px;margin:2px 0 2px}p.sub{margin:0 0 14px;color:#555}
    h2{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#5F6E65;margin:16px 0 4px;break-after:avoid}div.t{white-space:pre-wrap}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:5px 8px;text-align:left;vertical-align:top}th{background:#F3F7F5;font-size:11px}
    tr{break-inside:avoid}.ft{margin-top:22px;border-top:1px solid #ccc;padding-top:6px;color:#777;font-size:10.5px}
  </style><div class="lh"><b>${esc(input.letterhead.name || "School")}</b>${input.letterhead.place ? `<span>${esc(input.letterhead.place)}</span>` : ""}${input.letterhead.contact ? `<span>${esc(input.letterhead.contact)}</span>` : ""}</div>
  <div class="k">${esc(input.kicker)}</div><h1>${esc(input.title)}</h1>${input.sub ? `<p class="sub">${esc(input.sub)}</p>` : ""}${input.body}
  <div class="ft">Printed${input.by ? ` by ${esc(input.by)}` : ""} on ${when}.</div>`);
  frame.document.close();
  frame.focus();
  frame.print();
  return true;
}
