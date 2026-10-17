"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef } from "react";

import type { DayStripPanel } from "@/lib/modules/panels";
import { INK, MUTED } from "@/lib/modules/tones";

/** The mockup's strip of days: a window onto the term, walked sideways without leaving the page. */
export function DayStrip({ panel }: { panel: DayStripPanel }) {
  const current = useRef<HTMLAnchorElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  // Centre the day being shown inside the strip — sideways only, never moving the page.
  useEffect(() => {
    const strip = track.current;
    const chip = current.current;
    if (strip && chip) strip.scrollLeft = chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2;
  }, [panel.days]);
  const swatch = (state: DayStripPanel["days"][number]["state"]) =>
    state === "now" ? { bg: INK, fg: "#fff", sub: "rgba(255,255,255,0.7)", bd: INK } : state === "missing" ? { bg: "#FDF3F3", fg: "#B23B3B", sub: "#B23B3B", bd: "#F3E0E0" } : state === "done" ? { bg: "#fff", fg: "#0D2315", sub: "#17714F", bd: "#DEE8E2" } : { bg: "#fff", fg: "#0D2315", sub: MUTED, bd: "#DEE8E2" };
  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] border bg-[var(--color-bg-surface)] px-[18px] py-[12px]" style={{ borderColor: "#DEE8E2" }} aria-label={panel.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>{panel.title}</h3>
        {panel.sub ? <p className="text-[10.5px]" style={{ color: MUTED }}>{panel.sub}</p> : null}
      </div>
      <div ref={track} className="relative -mx-1 mt-[10px] flex gap-[7px] overflow-x-auto px-1 pb-[4px]">
        {panel.days.map((day) => {
          const colours = swatch(day.state);
          return (
            <Link
              key={day.href}
              href={day.href as Route}
              ref={day.state === "now" ? current : undefined}
              aria-current={day.state === "now" ? "date" : undefined}
              className="flex min-w-[78px] flex-none flex-col rounded-[10px] border px-[10px] py-[7px]"
              style={{ background: colours.bg, color: colours.fg, borderColor: colours.bd }}
            >
              <span className="whitespace-nowrap text-[11px] font-semibold">{day.label}</span>
              {day.sub ? <span className="mt-[2px] whitespace-nowrap text-[9.5px] font-semibold" style={{ color: colours.sub }}>{day.sub}</span> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
