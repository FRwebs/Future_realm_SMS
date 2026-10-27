"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

import type { DayStripPanel } from "@/lib/modules/panels";
import { INK, MUTED } from "@/lib/modules/tones";

/**
 * The mockup's strip: a window onto a list — a term's days, or the children in an arm —
 * walked sideways without leaving the page.
 *
 * It lays out the way the mockup does, which is two ways depending on how much there is.
 * A short list wraps and fits the panel, so nothing asks to be scrolled: walking a class
 * of ten is a row or two of names, and a sideways slider over them is friction for no
 * reason. A long list — every school day in a term — cannot wrap without becoming a wall,
 * so it keeps one line and is driven by arrows, with the scrollbar itself hidden. Either
 * way the panel fits its width; what changes is how you move along it.
 */
const WRAP_UP_TO = 12;

export function DayStrip({ panel }: { panel: DayStripPanel }) {
  const current = useRef<HTMLAnchorElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const wraps = panel.days.length <= WRAP_UP_TO;
  const [at, setAt] = useState({ start: true, end: true });

  // Centre the one being shown — sideways only, never moving the page. A wrapped strip
  // has nothing to scroll, so this is only for the long form.
  useEffect(() => {
    if (wraps) return;
    const strip = track.current;
    const chip = current.current;
    if (strip && chip) strip.scrollLeft = chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2;
  }, [panel.days, wraps]);

  // Which arrows are worth offering: an arrow that cannot move is shown spent, not hidden,
  // so the controls do not jump about as you travel along the strip.
  useEffect(() => {
    if (wraps) return;
    const strip = track.current;
    if (!strip) return;
    const read = () => setAt({ start: strip.scrollLeft <= 1, end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1 });
    read();
    strip.addEventListener("scroll", read, { passive: true });
    return () => strip.removeEventListener("scroll", read);
  }, [panel.days, wraps]);

  const nudge = (by: 1 | -1) => {
    const strip = track.current;
    if (strip) strip.scrollBy({ left: by * Math.max(160, strip.clientWidth * 0.75), behavior: "smooth" });
  };

  const swatch = (state: DayStripPanel["days"][number]["state"]) =>
    state === "now" ? { bg: INK, fg: "#fff", sub: "rgba(255,255,255,0.7)", bd: INK } : state === "missing" ? { bg: "#FDF3F3", fg: "#B23B3B", sub: "#B23B3B", bd: "#F3E0E0" } : state === "done" ? { bg: "#fff", fg: "#0D2315", sub: "#17714F", bd: "#DEE8E2" } : { bg: "#fff", fg: "#0D2315", sub: MUTED, bd: "#DEE8E2" };

  const arrow = (spent: boolean) =>
    `flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[9px] border transition ${spent ? "cursor-default border-[#EDF3EF] text-[#C2D2C8]" : "border-[#DEE8E2] text-[#435048] hover:bg-[#F1F8F4]"}`;

  const chips = panel.days.map((day) => {
    const colours = swatch(day.state);
    return (
      <Link
        key={day.href}
        href={day.href as Route}
        ref={day.state === "now" ? current : undefined}
        aria-current={day.state === "now" ? "date" : undefined}
        className={`flex min-w-0 flex-col rounded-[10px] border px-[10px] py-[7px] ${wraps ? "flex-1 basis-[86px]" : "min-w-[78px] flex-none"}`}
        style={{ background: colours.bg, color: colours.fg, borderColor: colours.bd }}
      >
        <span className={`text-[11px] font-semibold ${wraps ? "truncate" : "whitespace-nowrap"}`}>{day.label}</span>
        {day.sub ? <span className={`mt-[2px] text-[9.5px] font-semibold ${wraps ? "truncate" : "whitespace-nowrap"}`} style={{ color: colours.sub }}>{day.sub}</span> : null}
      </Link>
    );
  });

  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] border bg-(--color-bg-surface) px-[18px] py-[12px]" style={{ borderColor: "#DEE8E2" }} aria-label={panel.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>{panel.title}</h3>
        {panel.sub ? <p className="text-[10.5px]" style={{ color: MUTED }}>{panel.sub}</p> : null}
      </div>

      {wraps ? (
        <div className="mt-[10px] flex flex-wrap gap-[7px]">{chips}</div>
      ) : (
        <div className="mt-[10px] flex items-center gap-[8px]">
          <button type="button" onClick={() => nudge(-1)} disabled={at.start} className={arrow(at.start)} aria-label="Earlier">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
          </button>
          <div ref={track} className="flex min-w-0 flex-1 gap-[7px] overflow-x-auto pb-[2px] [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
            {chips}
          </div>
          <button type="button" onClick={() => nudge(1)} disabled={at.end} className={arrow(at.end)} aria-label="Later">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
          </button>
        </div>
      )}
    </section>
  );
}
