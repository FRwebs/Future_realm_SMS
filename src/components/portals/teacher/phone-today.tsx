"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PhoneSyncChip } from "@/components/layout/phone-teacher-bar";
import { BlockHead, DARK, Pill, RAISED, RowsCard, type Row } from "@/components/modules/phone-teacher-panels";
import type { PanelTone } from "@/lib/modules/panels";
import { toneOf } from "@/lib/modules/tones";
import { readOutbox } from "@/lib/offline/outbox";
import { cn } from "@/lib/utils/cn";

export type TodayProps = {
  greeting: string;
  dateline: string;
  deck: Array<{ eyebrow: string; icon: string; title: string; sub: string; cta: { label: string; href: string } | null }>;
  nextLine: string | null;
  tiles: Array<{ label: string; sub: string; icon: string; href: string; tone?: PanelTone }>;
  returned: Array<{ title: string; by: string; when: string; note: string; fix: string; href: string }>;
  queue: Array<{ title: string; sub: string; state: string; tone: PanelTone; due: string; urgent: boolean; href: string }>;
  periods: Array<{ from: string; to: string; title: string; sub: string; state: "done" | "now" | "next" | "later" }>;
  periodsTag: string | null;
  lastSync: string | null;
};

const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const BACK = "M19 12H5M11 6l-6 6 6 6";
const CLOCK = "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 7.5V12l3 2";

function Icon({ path, size = 19, stroke = 1.9 }: { path: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none">
      <path d={path} />
    </svg>
  );
}

/**
 * The teacher's Today screen on a phone, drawn from the teacher mobile mockup.
 *
 * The greeting and the date line, then a deck — what to do first, one card at a time, with the next period beneath it — then the four
 * things a teacher usually opens, what has been returned to them, the queue in deadline order, the day's periods as a timeline, and what
 * this phone is holding. It is built from the same day the desktop's My Day reads, so it can never say something the registers and score
 * sheets behind it do not.
 */
export function PhoneToday({ greeting, dateline, deck, nextLine, tiles, returned, queue, periods, periodsTag, lastSync }: TodayProps) {
  const router = useRouter();
  const [card, setCard] = useState(0);
  const touch = useRef<number | null>(null);
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    const read = () => setQueued(readOutbox().length);
    read();
    window.addEventListener("fr:outbox-flush", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("fr:outbox-flush", read); window.removeEventListener("storage", read); };
  }, []);

  const current = deck[Math.min(card, Math.max(0, deck.length - 1))];
  const step = (by: number) => setCard((index) => (deck.length ? (index + by + deck.length) % deck.length : 0));
  const rows: Row[] = queue.map((item, index) => ({
    key: `${index}-${item.title}`, title: item.title, sub: item.sub, pill: { label: item.state, tone: item.tone }, side: item.due,
    open: () => router.push(item.href as Route),
  }));

  return (
    <div className="grid min-w-0 gap-[22px]">
      <div className="-mt-[4px] px-[2px]">
        <h1 className="text-pretty text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0D2315]">{greeting}</h1>
        <div className="mt-[9px] flex flex-wrap items-center justify-between gap-x-[10px] gap-y-[8px]">
          <span className="text-[13px] font-semibold text-[#6E7C74]">{dateline}</span>
          <PhoneSyncChip />
        </div>
      </div>

      {current ? (
        <section aria-label="What to do first" className="min-w-0">
          <div className="relative pt-[10px]">
            <span aria-hidden className="absolute left-[22px] right-[22px] top-0 h-[44px] rounded-[18px]" style={{ background: "#CFE5DA" }} />
            <div
              className="relative flex min-h-[214px] flex-col overflow-hidden rounded-[22px] px-[18px] pb-[16px] pt-[14px]"
              style={{ background: DARK, boxShadow: "0 18px 30px -22px rgba(13,35,21,0.95)" }}
              onTouchStart={(event) => { touch.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={(event) => {
                const from = touch.current;
                touch.current = null;
                if (from === null) return;
                const delta = (event.changedTouches[0]?.clientX ?? from) - from;
                if (Math.abs(delta) > 40) step(delta < 0 ? 1 : -1);
              }}
            >
              <span aria-hidden className="pointer-events-none absolute -bottom-[96px] -right-[70px] h-[230px] w-[230px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.14)" }} />
              <span aria-hidden className="pointer-events-none absolute -bottom-[54px] -right-[28px] h-[146px] w-[146px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.12)" }} />
              <div className="relative flex min-h-[44px] items-center gap-[8px]">
                <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "rgba(95,214,180,0.16)", color: "#5FD6B4" }}><Icon path={current.icon} /></span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.74)" }}>{current.eyebrow}</span>
                {deck.length > 1 ? (
                  <>
                    <button type="button" onClick={() => step(-1)} aria-label="Previous card" className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.12)" }}><Icon path={BACK} size={18} stroke={2.1} /></button>
                    <button type="button" onClick={() => step(1)} aria-label="Next card" className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.12)" }}><Icon path={ARROW} size={18} stroke={2.1} /></button>
                  </>
                ) : null}
              </div>
              <h2 className="relative mt-[8px] text-pretty text-[22px] font-extrabold leading-[1.2] tracking-[-0.015em] text-white">{current.title}</h2>
              {current.sub ? <p className="relative mt-[6px] text-pretty text-[13px] font-medium leading-[1.5]" style={{ color: "rgba(255,255,255,0.76)" }}>{current.sub}</p> : null}
              <span className="min-h-[14px] flex-1" />
              <div className="relative flex items-center gap-[12px]">
                {current.cta ? (
                  <Link href={current.cta.href as Route} className="inline-flex h-[46px] min-w-0 items-center gap-[8px] rounded-[14px] bg-white px-[18px] text-[14px] font-extrabold text-[#0D2315] active:scale-[0.97]">
                    <span className="truncate">{current.cta.label}</span>
                    <Icon path={ARROW} size={16} stroke={2.4} />
                  </Link>
                ) : null}
                <span className="flex-1" />
                {deck.length > 1 ? <span className="text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.66)" }}>{card + 1} of {deck.length}</span> : null}
              </div>
              {nextLine ? (
                <div className="relative mt-[14px] flex items-start gap-[10px] border-t pt-[12px]" style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>
                  <span style={{ color: "#5FD6B4" }}><Icon path={CLOCK} size={17} /></span>
                  <span className="text-[13px] font-semibold leading-[1.4]">{nextLine}</span>
                </div>
              ) : null}
            </div>
          </div>
          {deck.length > 1 ? (
            <div className="mt-[10px] flex justify-center gap-[6px]" aria-hidden>
              {deck.map((entry, index) => (
                <span key={entry.title + index} className="h-[6px] rounded-full transition-all" style={{ width: index === card ? 26 : 16, background: index === card ? "#0D2315" : "#BFDCCD" }} />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <div className="rounded-[22px] bg-white px-[18px] py-[20px]" style={{ boxShadow: RAISED }}>
          <p className="text-[16px] font-extrabold text-[#0D2315]">Nothing is waiting on you</p>
          <p className="mt-[4px] text-[13px] leading-[1.5] text-[#5F6E65]">An item appears here the moment something is yours to do.</p>
        </div>
      )}

      {tiles.length ? (
        <section>
          <BlockHead title="Here’s what you can do" openDrawer={() => undefined} />
          <div className="grid grid-cols-2 gap-[10px]">
            {tiles.map((tile) => {
              const swatch = tile.tone && tile.tone !== "neutral" ? toneOf(tile.tone) : null;
              return (
                <Link key={tile.label} href={tile.href as Route} className="flex min-w-0 flex-col gap-[10px] rounded-[18px] p-[13px] active:scale-[0.98]" style={{ background: swatch ? swatch.bg : "#fff", boxShadow: swatch ? undefined : RAISED }}>
                  <span className="flex items-start gap-[9px]">
                    <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-white" style={{ color: swatch ? swatch.fg : "#17604F", boxShadow: swatch ? undefined : "inset 0 0 0 1px #E3ECE6" }}><Icon path={tile.icon} /></span>
                    <span className="min-w-0 pt-[1px]">
                      <span className="block text-pretty text-[14px] font-extrabold leading-[1.25] text-[#0D2315]">{tile.label}</span>
                      <span className="mt-[3px] block text-pretty text-[12px] font-medium leading-[1.4] text-[#6E7C74]">{tile.sub}</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {returned.length ? (
        <section>
          <BlockHead title="Returned to you" tag={`${returned.length} ${returned.length === 1 ? "item" : "items"}`} tagTone="negative" sub="Kept apart from the queue, because a return is a conversation." openDrawer={() => undefined} />
          <div className="grid gap-[10px]">
            {returned.map((item) => (
              <Link key={item.title} href={item.href as Route} className="block rounded-[20px] bg-white p-[16px]" style={{ boxShadow: RAISED }}>
                <span className="flex items-start justify-between gap-[10px]">
                  <span className="text-pretty text-[15px] font-extrabold leading-[1.3] text-[#0D2315]">{item.title}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA8A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-[2px] flex-none"><path d="M9 6l6 6-6 6" /></svg>
                </span>
                <span className="mt-[3px] block text-[12.5px] font-medium text-[#6E7C74]">{item.by}{item.when ? ` · ${item.when}` : ""}</span>
                <span className="mt-[10px] block rounded-[14px] px-[14px] py-[11px] text-pretty text-[13.5px] font-medium italic leading-[1.5]" style={{ background: "#FDF3F3", color: "#B23B3B" }}>“{item.note}”</span>
                <span className="mt-[10px] block text-[12.5px] leading-[1.45] text-[#6E7C74]">{item.fix}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <BlockHead title="Your queue" tag={`${queue.length} ${queue.length === 1 ? "item" : "items"}`} tagTone={queue.length ? "attention" : "positive"} sub="In deadline order. One tap opens the screen that clears it." openDrawer={() => undefined} />
        <RowsCard rows={rows} per={4} empty="Nothing is waiting on you. An item appears here the moment something is yours to do." />
        <p className="mt-[10px] px-[4px] text-pretty text-[12.5px] leading-[1.5] text-[#6E7C74]">An item leaves this list when the work is done — never because you looked at it.</p>
      </section>

      <section>
        <BlockHead title="Today’s periods" tag={periodsTag ?? undefined} tagTone="progress" sub="What is happening now and what is next are marked." openDrawer={() => undefined} />
        <div className="rounded-[20px] bg-white px-[16px] py-[14px]" style={{ boxShadow: RAISED }}>
          {periods.length ? (
            <ol>
              {periods.map((period, index) => {
                const live = period.state === "next" || period.state === "now";
                return (
                  <li key={`${period.from}-${index}`} className="relative flex gap-[12px] pb-[18px] last:pb-0">
                    <span className="w-[48px] flex-none tabular-nums leading-[1.2]">
                      <span className="block text-[13.5px] font-extrabold" style={{ color: period.state === "done" ? "#8C9A92" : "#0D2315" }}>{period.from}</span>
                      <span className="block text-[11.5px] font-semibold text-[#8C9A92]">{period.to}</span>
                    </span>
                    <span className="relative flex w-[14px] flex-none justify-center">
                      {index < periods.length - 1 ? <span aria-hidden className="absolute bottom-[-18px] top-[16px] w-[2px] rounded-full" style={{ background: "#E3ECE6" }} /> : null}
                      <span aria-hidden className={cn("relative mt-[4px] h-[12px] w-[12px] rounded-full border-2")} style={live ? { background: "#12796A", borderColor: "#12796A", boxShadow: "0 0 0 4px #D6EBE3" } : { background: period.state === "done" ? "#C9D5CE" : "#fff", borderColor: period.state === "done" ? "#C9D5CE" : "#B9CDC2" }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-[8px]">
                        <span className="text-pretty text-[14.5px] font-extrabold leading-[1.3]" style={{ color: period.state === "done" ? "#6E7C74" : "#0D2315" }}>{period.title}</span>
                        {period.state === "next" ? <Pill label="Next" tone="progress" /> : period.state === "now" ? <Pill label="Now" tone="submitted" /> : null}
                      </span>
                      {period.sub ? <span className="mt-[2px] block text-pretty text-[12.5px] font-medium leading-[1.4] text-[#6E7C74]">{period.sub}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-[6px] text-[13px] text-[#6E7C74]">No period is timetabled for you today.</p>
          )}
        </div>
        <p className="mt-[10px] px-[4px] text-pretty text-[12.5px] leading-[1.5] text-[#6E7C74]">A cover period is marked as cover, and leaves this page when the cover ends.</p>
      </section>

      <section className="rounded-[20px] bg-white px-[16px] py-[14px]" style={{ boxShadow: RAISED }}>
        <div className="flex items-center gap-[10px]">
          <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-[#0D2315]">Sync</h2>
          <Pill label={queued ? `${queued} queued` : "Nothing queued"} tone={queued ? "attention" : "positive"} />
        </div>
        <p className="mt-[6px] text-pretty text-[13px] leading-[1.45] text-[#5F6E65]">Never behind a menu — the pill at the top is always live.</p>
        {lastSync ? (
          <div className="mt-[12px] border-t pt-[12px]" style={{ borderColor: "#EDF3EF" }}>
            <p className="text-[12.5px] font-semibold text-[#6E7C74]">Last successful sync</p>
            <p className="mt-[2px] text-[15px] font-extrabold text-[#0D2315]">{lastSync}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
