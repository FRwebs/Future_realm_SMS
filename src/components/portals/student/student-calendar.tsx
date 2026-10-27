"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";

import { toneOf } from "@/lib/modules/tones";
import type { PanelTone } from "@/lib/modules/panels";

export type CalendarItem = { id: string; date: string; end: string; title: string; cat: string; time: string; where: string; note: string; href?: string };
export type StudentCalendarProps = { items: CalendarItem[]; today: string; months: Array<{ ym: string; label: string }>; legend: Array<{ label: string; cat: string }> };

const CAT_TONE: Record<string, PanelTone> = { Assessment: "attention", Due: "negative", Event: "progress", Results: "positive", Holiday: "neutral" };
const MON = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const longDay = (value: string) => { const at = new Date(`${value}T00:00:00Z`); return `${WEEKDAY[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`; };

/** A month at a time, with what is on each day, and the chosen day read out beside it. */
export function StudentCalendar({ items, today, months, legend }: StudentCalendarProps) {
  const startIndex = Math.max(0, months.findIndex((month) => month.ym === today.slice(0, 7)));
  const [index, setIndex] = useState(startIndex);
  const [selected, setSelected] = useState(today);
  const month = months[index]!;
  const [year, mo] = [Number(month.ym.slice(0, 4)), Number(month.ym.slice(5)) - 1];
  const lead = (new Date(Date.UTC(year, mo, 1)).getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, mo + 1, 0)).getUTCDate();
  const on = useMemo(() => (value: string) => items.filter((item) => value >= item.date && value <= item.end), [items]);
  const chosen = on(selected);

  const cells: Array<{ day: number; value: string } | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: last }, (_, i) => ({ day: i + 1, value: iso(year, mo, i + 1) }))];
  const go = (next: number) => { setIndex(next); const target = months[next]!; setSelected(target.ym === today.slice(0, 7) ? today : `${target.ym}-01`); };

  return (
    <div className="grid min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] p-[14px]" style={{ borderColor: "#DEE8E2" }}>
        <div className="mb-[10px] flex flex-wrap items-center justify-between gap-[8px]">
          <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{month.label}</h3>
          <div className="flex items-center gap-[4px]">
            <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="rounded-[8px] border px-[10px] py-[4px] text-[11px] font-semibold disabled:opacity-40" style={{ borderColor: "#DEE8E2", color: "#435048" }} aria-label="Earlier month">‹</button>
            <button type="button" onClick={() => { setIndex(startIndex); setSelected(today); }} className="rounded-[8px] border px-[10px] py-[4px] text-[11px] font-semibold" style={{ borderColor: "#DEE8E2", color: "#435048" }}>Today</button>
            <button type="button" disabled={index === months.length - 1} onClick={() => go(index + 1)} className="rounded-[8px] border px-[10px] py-[4px] text-[11px] font-semibold disabled:opacity-40" style={{ borderColor: "#DEE8E2", color: "#435048" }} aria-label="Later month">›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-[5px]">
          {MON.map((name) => <span key={name} className="px-[4px] pb-[2px] text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "#67766D" }}>{name.slice(0, 3)}</span>)}
          {cells.map((cell, position) => {
            if (!cell) return <span key={`gap-${position}`} className="min-h-[74px]" />;
            const list = on(cell.value);
            const weekend = position % 7 >= 5;
            const isToday = cell.value === today;
            return (
              <button
                key={cell.value}
                type="button"
                onClick={() => setSelected(cell.value)}
                className="flex min-h-[74px] min-w-0 flex-col gap-[3px] rounded-[10px] border p-[6px] text-left"
                style={{ background: cell.value === selected ? "#F1F7F4" : weekend ? "#FBFDFC" : "#fff", borderColor: cell.value === selected ? "#0D2315" : "#E6EEE9", borderWidth: cell.value === selected ? 1.5 : 1 }}
              >
                <span className="mb-[1px] flex h-[20px] w-[20px] items-center justify-center rounded-full text-[11px] font-bold" style={isToday ? { background: "#12796A", color: "#fff" } : { color: weekend ? "#9AA8A0" : "#0D2315" }}>{cell.day}</span>
                {list.slice(0, 2).map((item) => {
                  const swatch = toneOf(CAT_TONE[item.cat] ?? "neutral");
                  return <span key={item.id} className="truncate rounded-[5px] px-[5px] py-[2px] text-[9.5px] font-semibold leading-[1.25]" style={{ background: swatch.bg, color: swatch.fg }}>{item.cat === "Due" ? item.title.split(" · ")[0] : item.title}</span>;
                })}
                {list.length > 2 ? <span className="px-[5px] text-[9.5px]" style={{ color: "#67766D" }}>+{list.length - 2} more</span> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-[10px] flex flex-wrap gap-x-[14px] gap-y-[4px]">
          {legend.map((entry) => { const swatch = toneOf(CAT_TONE[entry.cat] ?? "neutral"); return <span key={entry.label} className="flex items-center gap-[6px] text-[10.5px]" style={{ color: "#67766D" }}><span className="h-[10px] w-[10px] rounded-[3px] border" style={{ background: swatch.bg, borderColor: swatch.bd }} />{entry.label}</span>; })}
        </div>
      </section>

      <section className="min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] px-[16px] pb-[8px] pt-[14px]" style={{ borderColor: "#DEE8E2" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{longDay(selected)}</h3>
        <p className="mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>{chosen.length ? `${chosen.length} on this day.` : "Nothing on this day."}</p>
        <ul className="mt-[8px]">
          {chosen.map((item) => {
            const swatch = toneOf(CAT_TONE[item.cat] ?? "neutral");
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-pretty text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>{item.title}</span>
                  <span className="mt-[2px] block text-[10.5px]" style={{ color: "#67766D" }}>{[item.time, item.where, item.note].filter(Boolean).join(" · ") || item.cat}</span>
                </span>
                <span className="flex-none rounded-full border px-[8px] py-[2.5px] text-[10px] font-semibold" style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}>{item.cat}</span>
              </>
            );
            return item.href ? (
              <li key={item.id} className="border-b last:border-b-0" style={{ borderColor: "#F2F7F4" }}><Link href={item.href as Route} className="flex items-start gap-[10px] py-[10px]">{body}</Link></li>
            ) : (
              <li key={item.id} className="flex items-start gap-[10px] border-b py-[10px] last:border-b-0" style={{ borderColor: "#F2F7F4" }}>{body}</li>
            );
          })}
        </ul>
        {!chosen.length ? <p className="pb-[10px] pt-[4px] text-[11px]" style={{ color: "#5f6e65" }}>Choose another day, or switch to the list.</p> : null}
      </section>
    </div>
  );
}
