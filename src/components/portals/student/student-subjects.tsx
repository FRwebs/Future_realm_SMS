"use client";

import type { DrawerSpec } from "@/lib/modules/panels";
import { toneOf } from "@/lib/modules/tones";

type PartView = { name: string; value: string; max: string; pending: boolean; fill: string };
export type SubjectCard = {
  id: string; name: string; abbr: string; teacher: string; swatch: [string, string, string]; flag: { label: string; tone: "negative" | "attention" } | null;
  topic: string | null; open: string; parts: PartView[]; foot: string; drawer: DrawerSpec; scheme: DrawerSpec | null;
  /** A past term's total, as published: it replaces the line about this week's topic. */
  final?: { value: string; sub: string };
};
export type SubjectsProps = { groups: Array<{ label: string; cards: SubjectCard[] }>; openDrawer?: (spec: DrawerSpec) => void };

/** Each subject as a card: who teaches it, what the week is about, and every mark the school has released so far — Pending until it has. */
export function StudentSubjects({ groups, openDrawer }: SubjectsProps) {
  return (
    <>
    <PhoneSubjects groups={groups} openDrawer={openDrawer} />
    <div className="grid min-w-0 gap-[18px] max-md:hidden">
      {groups.map((group) => (
        <section key={group.label} className="min-w-0">
          <div className="mb-[9px] flex items-baseline gap-[8px]">
            <h2 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{group.label}</h2>
            <span className="rounded-full px-[7px] py-[1.5px] text-[9.5px] font-bold" style={{ background: "#F1F4F2", color: "#5C6A62" }}>{group.cards.length}</span>
            <span className="h-px flex-1" style={{ background: "#E4EDE8" }} />
          </div>
          <div className="grid gap-[11px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
            {group.cards.map((card) => (
              <div
                key={card.id}
                className="relative flex min-w-0 cursor-pointer flex-col gap-[11px] rounded-[14px] border bg-(--color-bg-surface) p-[14px] text-left transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-[#BFDCD1]"
                style={{ borderColor: "#DEE8E2" }}
              >
                <div className="flex items-start gap-[11px]">
                  <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] border text-[11px] font-extrabold tracking-[0.04em]" style={{ background: card.swatch[0], color: card.swatch[1], borderColor: card.swatch[2] }}>{card.abbr}</span>
                  <span className="min-w-0 flex-1">
                    {/* The whole card opens the subject: the name is the real button, stretched over the card, so the Scheme link inside it is not nested in one. */}
                    <button type="button" onClick={() => openDrawer?.(card.drawer)} className="block w-full truncate text-left text-[12.5px] font-bold after:absolute after:inset-0 after:content-['']" style={{ color: "#0D2315" }}>{card.name}</button>
                    <span className="block truncate text-[10.5px]" style={{ color: "#5E6D64" }}>{card.teacher}</span>
                  </span>
                  {card.flag ? <span className="flex-none rounded-full border px-[8px] py-[2.5px] text-[10px] font-semibold" style={{ background: toneOf(card.flag.tone).bg, color: toneOf(card.flag.tone).fg, borderColor: toneOf(card.flag.tone).bd }}>{card.flag.label}</span> : null}
                </div>
                {card.final ? (
                  <div className="flex items-baseline justify-between gap-[8px] rounded-[9px] px-[10px] py-[7px]" style={{ background: "#F7FAF8" }}>
                    <span className="text-[17px] font-extrabold tabular-nums" style={{ color: "#0D2315" }}>{card.final.value}</span>
                    <span className="min-w-0 truncate text-[10.5px]" style={{ color: "#5E6D64" }}>{card.final.sub}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between gap-[8px] rounded-[9px] px-[10px] py-[7px]" style={{ background: "#F7FAF8" }}>
                    <span className="min-w-0 truncate text-[11px]" style={{ color: card.topic ? "#0D2315" : "#5E6D64" }}>{card.topic ? <><span style={{ color: "#5E6D64" }}>This week · </span>{card.topic}</> : "No topic posted this week"}</span>
                    {card.open ? <span className="flex-none text-[10px] font-semibold" style={{ color: "#8A6410" }}>{card.open}</span> : null}
                  </div>
                )}
                <div className="grid gap-[6px]" style={{ gridTemplateColumns: `repeat(${Math.max(card.parts.length, 1)}, minmax(0, 1fr))` }}>
                  {card.parts.map((part) => (
                    <div key={part.name} className="min-w-0">
                      <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: "#5E6D64" }}>{part.name}</p>
                      <p className="mt-[2px] text-[13px] font-bold tabular-nums" style={{ color: part.pending ? "#6B7A71" : "#0D2315" }}>
                        {part.pending ? "Pending" : part.value}
                        {part.pending ? null : <span className="text-[10px] font-medium" style={{ color: "#5E6D64" }}> / {part.max}</span>}
                      </p>
                      <div className="mt-[4px] h-[4px] overflow-hidden rounded-full" style={{ background: "#EEF2EF" }}><div className="h-full rounded-full" style={{ width: part.fill, background: "#22A06B" }} /></div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-[8px] border-t pt-[9px]" style={{ borderColor: "#EDF3EF" }}>
                  <span className="text-[10.5px]" style={{ color: "#5E6D64" }}>{card.foot}</span>
                  {card.scheme ? <button type="button" onClick={(event) => { event.stopPropagation(); openDrawer?.(card.scheme!); }} className="relative z-10 -my-[6px] inline-flex min-h-[24px] items-center px-[4px] text-[10.5px] font-semibold hover:underline" style={{ color: "#12796A" }}>Scheme of work</button> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
    </>
  );
}

/** What a phone sees: each subject as one row — its short name in a circle, who teaches it and the week's topic, the marks so far and a bar. */
function PhoneSubjects({ groups, openDrawer }: SubjectsProps) {
  return (
    <div className="grid min-w-0 gap-[18px] md:hidden">
      {groups.map((group) => (
        <section key={group.label} className="min-w-0">
          <div className="mb-[8px] flex items-center gap-[8px] px-[2px]">
            <h2 className="text-[14.5px] font-extrabold text-[#0D2315]">{group.label}</h2>
            <span className="rounded-full bg-[#EEF4F0] px-[8px] py-[1px] text-[12px] font-extrabold text-[#5F6E65]">{group.cards.length}</span>
          </div>
          <ul className="overflow-hidden rounded-[18px] bg-white" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -16px rgba(13,35,21,0.22)" }}>
            {group.cards.map((card, index) => {
              const released = card.parts.filter((part) => !part.pending);
              const sum = released.reduce((total, part) => total + (Number.parseFloat(part.value) || 0), 0);
              const tone = card.flag ? toneOf(card.flag.tone) : null;
              const value = card.final ? card.final.value : released.length ? String(Math.round(sum * 10) / 10) : "";
              const meta = card.final ? "" : released.length ? "of 100 so far" : "Pending";
              const label = card.parts.map((part) => `${part.name} ${part.pending ? "pending" : `${part.value}/${part.max}`}`).join(" · ");
              return (
                <li key={card.id} className={index ? "border-t border-[#EDF3EF]" : ""}>
                  <button type="button" onClick={() => openDrawer?.(card.drawer)} className="flex min-h-[66px] w-full items-center gap-[12px] px-[16px] py-[12px] text-left active:bg-[#F7FAF8]">
                    <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[12.5px] font-black" style={{ background: tone ? tone.bg : "#EEF4F0", color: tone ? tone.fg : "#0D2315" }}>{card.abbr}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-pretty text-[14px] font-bold leading-[1.35] text-[#0D2315]">{card.name}</span>
                      <span className="mt-[2px] block text-pretty text-[12.5px] font-medium leading-[1.45] text-[#6E7C74]">{card.teacher.split(" · ")[0]} · {card.final ? card.final.sub : card.topic ?? "No topic posted this week"}</span>
                      {card.parts.length ? (
                        <span className="mt-[8px] block">
                          <span className="block h-[5px] overflow-hidden rounded-full bg-[#EEF2EF]"><span className="block h-full rounded-full bg-[#22A06B]" style={{ width: `${Math.min(100, sum)}%` }} /></span>
                          <span className="mt-[5px] block text-pretty text-[11.5px] font-semibold leading-[1.4] text-[#8C9A92]">{label}</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-none flex-col items-end gap-[4px]">
                      {card.flag && tone ? <span className="whitespace-nowrap rounded-full px-[9px] py-[2px] text-[11.5px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{card.flag.label}</span> : null}
                      {value ? <span className="text-[15.5px] font-black leading-[1.1] tabular-nums text-[#0D2315]">{value}</span> : null}
                      {meta ? <span className="text-[11.5px] font-semibold text-[#6E7C74]">{meta}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}