"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

import { Pill } from "@/components/modules/phone-teacher-panels";
import type { DrawerSpec, PanelTone } from "@/lib/modules/panels";

export type PickerItem = { id: string; title: string; sub: string; icon: string; href: string; pill: string; tone: PanelTone; price?: string; priceKobo?: number; buyable: boolean; bar?: { pct: number; label: string } };

/**
 * The catalogue's courses, ticked to buy together as the teacher mobile mockup draws them. A course the teacher can buy has a box; one
 * they already hold, or have asked for, does not. Ticking some raises a bar with what they come to, and "Add to basket" opens the same
 * confirmation the laptop's bulk action does — nothing is bought from here.
 */
export function PhoneCoursePicker({ title, tag, sub, items, template, openDrawer }: { title: string; tag: string; sub?: string; items: PickerItem[]; template: DrawerSpec; openDrawer?: (spec: DrawerSpec) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = items.filter((item) => picked.includes(item.id));
  const total = chosen.reduce((sum, item) => sum + (item.priceKobo ?? 0), 0);
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  const raised = "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.22)";
  return (
    <section className="min-w-0">
      <div className="mb-[8px] flex items-baseline gap-[10px] px-[2px]">
        <h2 className="text-[16px] font-extrabold text-[#0D2315]">{title}</h2>
        <span className="rounded-full bg-[#EDF3EF] px-[9px] py-[2px] text-[11.5px] font-bold text-[#435048]">{tag}</span>
      </div>
      {sub ? <p className="mb-[10px] px-[2px] text-[13px] leading-[1.5] text-[#6E7C74]">{sub}</p> : null}
      {items.length ? (
        <ul className="overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: raised }}>
          {items.map((item, index) => (
            <li key={item.id} className="flex items-stretch" style={index ? { borderTop: "1px solid #EDF3EF" } : undefined}>
              {item.buyable ? (
                <button type="button" role="checkbox" aria-checked={picked.includes(item.id)} aria-label={`Select ${item.title}`} onClick={() => toggle(item.id)} className="flex w-[52px] flex-none items-center justify-center">
                  <span className="flex h-[24px] w-[24px] items-center justify-center rounded-[8px] border-2" style={picked.includes(item.id) ? { background: "#0D2315", borderColor: "#0D2315" } : { borderColor: "#C9D6CE" }}>
                    {picked.includes(item.id) ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5 9-10" /></svg> : null}
                  </span>
                </button>
              ) : <span className="w-[14px] flex-none" />}
              <Link href={item.href as Route} className="flex min-h-[72px] min-w-0 flex-1 items-center gap-[12px] py-[12px] pr-[16px]">
                <span className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-[#EEF4F0] text-[#17604F]" aria-hidden>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-pretty text-[14px] font-bold leading-[1.35] text-[#0D2315]">{item.title}</span>
                  <span className="mt-[3px] block text-pretty text-[12.5px] font-medium leading-[1.45] text-[#6E7C74]">{item.sub}</span>
                  {item.bar ? (
                    <span className="mt-[8px] flex items-center gap-[10px]">
                      <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#EDF3EF]"><span className="block h-full rounded-full bg-[#2A5A96]" style={{ width: `${Math.max(2, Math.min(100, item.bar.pct))}%` }} /></span>
                      <span className="flex-none text-[12.5px] font-semibold tabular-nums text-[#6E7C74]">{item.bar.label}</span>
                    </span>
                  ) : null}
                </span>
                <span className="flex max-w-[40%] flex-none flex-col items-end gap-[5px] text-right">
                  {item.price ? <span className="text-[14px] font-extrabold text-[#0D2315]">{item.price}</span> : null}
                  <Pill label={item.pill} tone={item.tone} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-[20px] bg-white px-[18px] py-[22px] text-center text-[13px] text-[#6E7C74]" style={{ boxShadow: raised }}>Nothing for your role in this section yet.</p>}
      {chosen.length ? (
        <div className="sticky bottom-0 z-[30] -mx-4 -mb-4 mt-[14px] flex items-center gap-[12px] rounded-t-[22px] bg-white px-[14px] pb-[12px] pt-[10px]" style={{ boxShadow: "0 -12px 30px -22px rgba(13,35,21,0.45)" }}>
          <span className="min-w-0 flex-1 text-[13px] font-bold text-[#435048]">{chosen.length} selected{total ? ` · ₦${(total / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}` : ""}</span>
          <button type="button" onClick={() => openDrawer?.({ ...template, submit: { ...template.submit!, body: { courseIds: chosen.map((item) => item.id) } } })} className="h-[52px] flex-none rounded-[16px] bg-[#0D2315] px-[22px] text-[15px] font-extrabold text-white">Add to basket</button>
        </div>
      ) : null}
    </section>
  );
}
