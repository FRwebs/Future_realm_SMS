"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { DrawerSpec } from "@/lib/modules/panels";

type Act = { label: string; href?: string; drawer?: DrawerSpec };
export type StudentNowProps = {
  live: boolean; label: string; when: string; subject: string; who: string; topic: string | null; acts: Act[];
  later: Array<{ time: string; subject: string; who: string; tag: string; brk: boolean }>; laterEmpty: string; laterTitle: string;
  openDrawer?: (spec: DrawerSpec) => void;
};

const ACT = "inline-flex items-center gap-[6px] whitespace-nowrap rounded-[9px] px-[13px] py-[8px] text-[11.5px] font-semibold transition";

/** The lesson running now, and what is left of the day. It looks again each minute, so "now" stays true. */
export function StudentNow({ live, label, when, subject, who, topic, acts, later, laterEmpty, laterTitle, openDrawer }: StudentNowProps) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[16px] text-white" style={{ background: "#0D2315", boxShadow: "0 18px 40px -28px rgba(13,35,21,0.75)" }}>
      <div className="grid gap-[18px] p-[18px] sm:p-[22px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-[7px] rounded-full px-[10px] py-[4px] text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ background: live ? "#3EE08A" : "rgba(255,255,255,0.14)", color: live ? "#0D2315" : "#fff" }}>
            <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: live ? "#0D2315" : "#9FB8A7" }} />
            {label}
          </span>
          <p className="mt-[10px] text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>{when}</p>
          <h2 className="mt-[6px] text-balance text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em]">{subject}</h2>
          {who ? <p className="mt-[5px] text-[12px]" style={{ color: "rgba(255,255,255,0.78)" }}>{who}</p> : null}
          {topic ? (
            <div className="mt-[12px] max-w-[520px] rounded-[11px] px-[12px] py-[9px]" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.6)" }}>This week’s topic</p>
              <p className="mt-[2px] text-pretty text-[12.5px] font-semibold leading-[1.4]">{topic}</p>
            </div>
          ) : null}
          {acts.length ? (
            <div className="mt-[14px] flex flex-wrap gap-[8px]">
              {acts.map((act, index) => {
                const style = index === 0 ? { background: "#fff", color: "#0D2315", border: "1px solid #fff" } : { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.22)" };
                return act.href ? (
                  <Link key={act.label} href={act.href as Route} className={ACT} style={style}>{act.label}</Link>
                ) : (
                  <button key={act.label} type="button" onClick={() => act.drawer && openDrawer?.(act.drawer)} className={ACT} style={style}>{act.label}</button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="min-w-0 border-t pt-[14px] lg:border-l lg:border-t-0 lg:pl-[18px] lg:pt-0" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.6)" }}>{laterTitle}</p>
          {later.length ? (
            <ul className="mt-[8px] grid max-h-[210px] gap-[1px] overflow-y-auto pr-[2px]">
              {later.map((item) => (
                <li key={`${item.time}-${item.subject}`} className="flex items-center gap-[10px] border-b py-[7px]" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <span className="w-[42px] flex-none text-[11px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>{item.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px]" style={{ fontWeight: item.brk ? 500 : 600, color: item.brk ? "rgba(255,255,255,0.6)" : "#fff" }}>{item.subject}</span>
                    {item.who ? <span className="block truncate text-[10.5px]" style={{ color: "rgba(255,255,255,0.6)" }}>{item.who}</span> : null}
                  </span>
                  {item.tag ? <span className="flex-none rounded-full px-[7px] py-[2px] text-[9px] font-extrabold uppercase tracking-[0.06em]" style={{ background: "#9EE7CF", color: "#0D2315" }}>{item.tag}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-[10px] text-[12px]" style={{ color: "rgba(255,255,255,0.7)" }}>{laterEmpty}</p>
          )}
        </div>
      </div>
    </section>
  );
}
