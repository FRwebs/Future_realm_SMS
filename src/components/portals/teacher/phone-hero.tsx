"use client";

import Link from "next/link";
import type { Route } from "next";

import { DARK } from "@/components/modules/phone-teacher-panels";

export type HeroProps = {
  eyebrow: string;
  title: string;
  sub?: string;
  icon: string;
  chips?: string[];
  cta?: { label: string; href: string };
};

const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";

/**
 * The one card a teacher's phone screen leads with — what this week asks for — drawn as the teacher mobile mockup's hero: the dark card
 * with its pale tab behind it, the rings in the corner, the subject over the topic, and one button. Everything on it is read from the
 * screen's own data, so it says nothing the list under it does not.
 */
export function PhoneHero({ eyebrow, title, sub, icon, chips, cta }: HeroProps) {
  return (
    <div className="relative pt-[10px]">
      <span aria-hidden className="absolute left-[22px] right-[22px] top-0 h-[44px] rounded-[18px]" style={{ background: "#CFE5DA" }} />
      <div className="relative overflow-hidden rounded-[22px] px-[18px] pb-[18px] pt-[14px]" style={{ background: DARK, boxShadow: "0 18px 30px -22px rgba(13,35,21,0.95)" }}>
        <span aria-hidden className="pointer-events-none absolute -bottom-[96px] -right-[70px] h-[230px] w-[230px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.14)" }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-[54px] -right-[28px] h-[146px] w-[146px] rounded-full border-[1.5px]" style={{ borderColor: "rgba(95,214,180,0.12)" }} />
        <div className="relative flex min-h-[44px] items-center gap-[10px]">
          <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-full" style={{ background: "rgba(95,214,180,0.16)", color: "#5FD6B4" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.74)" }}>{eyebrow}</span>
        </div>
        <h2 className="relative mt-[8px] text-pretty text-[22px] font-extrabold leading-[1.2] tracking-[-0.015em] text-white">{title}</h2>
        {sub ? <p className="relative mt-[6px] text-pretty text-[13px] font-medium leading-[1.5]" style={{ color: "rgba(255,255,255,0.76)" }}>{sub}</p> : null}
        {chips?.length ? (
          <div className="relative mt-[12px] flex flex-wrap gap-[8px]">
            {chips.map((chip) => (
              <span key={chip} className="rounded-full px-[14px] py-[7px] text-[12.5px] font-bold text-white" style={{ background: "rgba(255,255,255,0.1)" }}>{chip}</span>
            ))}
          </div>
        ) : null}
        {cta ? (
          <Link href={cta.href as Route} className="relative mt-[16px] flex h-[48px] items-center justify-center gap-[8px] rounded-[14px] bg-white px-[18px] text-[14px] font-extrabold text-[#0D2315] active:scale-[0.98]">
            <span className="truncate">{cta.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ARROW} /></svg>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
