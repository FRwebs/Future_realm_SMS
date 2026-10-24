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
    <div className="grid min-w-0 gap-[18px]">
      {groups.map((group) => (
        <section key={group.label} className="min-w-0">
          <div className="mb-[9px] flex items-baseline gap-[8px]">
            <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{group.label}</h3>
            <span className="rounded-full px-[7px] py-[1.5px] text-[9.5px] font-bold" style={{ background: "#F1F4F2", color: "#5C6A62" }}>{group.cards.length}</span>
            <span className="h-px flex-1" style={{ background: "#E4EDE8" }} />
          </div>
          <div className="grid gap-[11px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
            {group.cards.map((card) => (
              <article
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => openDrawer?.(card.drawer)}
                onKeyDown={(event) => { if (event.key === "Enter") openDrawer?.(card.drawer); }}
                className="flex min-w-0 cursor-pointer flex-col gap-[11px] rounded-[14px] border bg-[var(--color-bg-surface)] p-[14px] text-left transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-[#BFDCD1]"
                style={{ borderColor: "#DEE8E2" }}
              >
                <div className="flex items-start gap-[11px]">
                  <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] border text-[11px] font-extrabold tracking-[0.04em]" style={{ background: card.swatch[0], color: card.swatch[1], borderColor: card.swatch[2] }}>{card.abbr}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold" style={{ color: "#0D2315" }}>{card.name}</span>
                    <span className="block truncate text-[10.5px]" style={{ color: "#67766D" }}>{card.teacher}</span>
                  </span>
                  {card.flag ? <span className="flex-none rounded-full border px-[8px] py-[2.5px] text-[10px] font-semibold" style={{ background: toneOf(card.flag.tone).bg, color: toneOf(card.flag.tone).fg, borderColor: toneOf(card.flag.tone).bd }}>{card.flag.label}</span> : null}
                </div>
                {card.final ? (
                  <div className="flex items-baseline justify-between gap-[8px] rounded-[9px] px-[10px] py-[7px]" style={{ background: "#F7FAF8" }}>
                    <span className="text-[17px] font-extrabold tabular-nums" style={{ color: "#0D2315" }}>{card.final.value}</span>
                    <span className="min-w-0 truncate text-[10.5px]" style={{ color: "#67766D" }}>{card.final.sub}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between gap-[8px] rounded-[9px] px-[10px] py-[7px]" style={{ background: "#F7FAF8" }}>
                    <span className="min-w-0 truncate text-[11px]" style={{ color: card.topic ? "#0D2315" : "#8C9A92" }}>{card.topic ? <><span style={{ color: "#67766D" }}>This week · </span>{card.topic}</> : "No topic posted this week"}</span>
                    {card.open ? <span className="flex-none text-[10px] font-semibold" style={{ color: "#8A6410" }}>{card.open}</span> : null}
                  </div>
                )}
                <div className="grid gap-[6px]" style={{ gridTemplateColumns: `repeat(${Math.max(card.parts.length, 1)}, minmax(0, 1fr))` }}>
                  {card.parts.map((part) => (
                    <div key={part.name} className="min-w-0">
                      <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: "#67766D" }}>{part.name}</p>
                      <p className="mt-[2px] text-[13px] font-bold tabular-nums" style={{ color: part.pending ? "#AAB8B0" : "#0D2315" }}>
                        {part.pending ? "Pending" : part.value}
                        {part.pending ? null : <span className="text-[10px] font-medium" style={{ color: "#67766D" }}> / {part.max}</span>}
                      </p>
                      <div className="mt-[4px] h-[4px] overflow-hidden rounded-full" style={{ background: "#EEF2EF" }}><div className="h-full rounded-full" style={{ width: part.fill, background: "#22A06B" }} /></div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-[8px] border-t pt-[9px]" style={{ borderColor: "#EDF3EF" }}>
                  <span className="text-[10.5px]" style={{ color: "#67766D" }}>{card.foot}</span>
                  {card.scheme ? <button type="button" onClick={(event) => { event.stopPropagation(); openDrawer?.(card.scheme!); }} className="text-[10.5px] font-semibold hover:underline" style={{ color: "#12796A" }}>Scheme of work</button> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
