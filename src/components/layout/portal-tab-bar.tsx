"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";

import { ParentMoreSheet } from "@/components/layout/phone-parent-more";
import { TeacherMoreSheet } from "@/components/layout/phone-teacher-more";
import { usePhoneKind } from "@/components/layout/phone-shell";
import type { SessionUser } from "@/lib/domain/types";

export type TabBarItem = {
  /** The rail id this came from, which is also how counts and tones are keyed. */
  id: string;
  label: string;
  /** The name the bar uses. A tab label has to fit a fifth of a phone. */
  short?: string;
  icon: string;
  href: string;
};

const MORE_ICON = "M5 4.5h5v5H5zM14 4.5h5v5h-5zM5 14.5h5v5H5zM14 14.5h5v5h-5z";

/**
 * A portal on a phone.
 *
 * Both the parent and teacher mobile mockups drop the sidebar below tablet
 * width and give the thumb a bar at the bottom: four things opened daily, and
 * More for the rest. That is the right trade on a 375px screen — a rail costs
 * either a third of the width or a tap to open, and someone checking one figure
 * between lessons should pay neither.
 *
 * Which four is not this component's business. The parent portal fixes them;
 * the teacher portal picks the first four of a priority order that the teacher
 * can actually see, because a subject teacher and a head of department do not
 * open the same four things.
 */
export function PortalTabBar({
  items,
  primaryIds,
  counts,
  urgent,
  label,
  account,
}: {
  items: TabBarItem[];
  /** The ids that get their own tab, in the order they should appear. */
  primaryIds: string[];
  counts: Record<string, number>;
  urgent: Record<string, boolean>;
  label: string;
  /** Who is signed in. A teacher's More sheet opens on their own card and ends in sign-out. */
  account?: { session: SessionUser; schoolName?: string; kids?: number; schools?: number };
}) {
  const kind = usePhoneKind();
  const pathname = usePathname();
  const params = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);

  // A route change closes the sheet; otherwise it sits over the page just asked for.
  useEffect(() => { setMoreOpen(false); }, [pathname, params]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Which item is being read: the one whose address matches most of the path.
  // A module is its first path segment ("/lesson-notes"); a portal's own pages sit three deep ("/portals/parent/fees"). Matching the whole address
  // would call the Notes tab "More" the moment a teacher opened the module's other tab.
  const pathOf = (href: string) => href.split("?")[0]!.replace(/\/$/, "");
  const baseOf = (href: string) => { const parts = pathOf(href).split("/").filter(Boolean); return `/${parts.slice(0, parts[0] === "portals" ? 3 : 1).join("/")}`; };
  const active = items
    .filter((item) => { const base = baseOf(item.href); return pathname === base || pathname.startsWith(`${base}/`); })
    .sort((a, b) => baseOf(b.href).length - baseOf(a.href).length)[0] ?? null;

  const primary = primaryIds.map((id) => items.find((item) => item.id === id)).filter((item): item is TabBarItem => Boolean(item));
  const rest = items.filter((item) => !primaryIds.includes(item.id));
  const moreCount = rest.reduce((sum, item) => sum + (counts[item.id] ?? 0), 0);
  const moreUrgent = rest.some((item) => urgent[item.id]);
  const onMore = !primary.some((item) => item.id === active?.id);
  const cap = (value: number) => (value > 9 ? "9+" : String(value));
  const cellClass = "relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-[4px]";

  const inside = (icon: string, text: string, on: boolean, count: number, isUrgent: boolean) => (
    <>
      <span className="flex h-[32px] w-[32px] items-center justify-center rounded-full" style={on ? { background: "#0D2315", color: "#fff" } : { color: "#8A978F" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" width={on ? 17 : 23} height={on ? 17 : 23} aria-hidden>
          <path d={icon} />
        </svg>
      </span>
      <span
        className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: "min(11px, 3.3vw)", fontWeight: on ? 800 : 700, color: on ? "#0D2315" : "#5C6B62" }}
      >
        {text}
      </span>
      {count ? (
        <span
          className="absolute top-[2px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[4px] text-[10px] font-black"
          style={{ left: "calc(50% + 6px)", background: isUrgent ? "#C93F3F" : "#E0A526", color: isUrgent ? "#fff" : "#0D2315", border: "2px solid #fff" }}
        >
          {cap(count)}
        </span>
      ) : null}
      {on ? <span className="absolute -bottom-[6px] left-1/2 h-[3px] w-[26px] -translate-x-1/2 rounded-full" style={{ background: "#0D2315" }} /> : null}
    </>
  );

  return (
    <>
      {moreOpen && kind === "teacher" && account ? (
        <TeacherMoreSheet items={items} primaryIds={primaryIds} counts={counts} urgent={urgent} pathname={pathname} session={account.session} schoolName={account.schoolName} onClose={() => setMoreOpen(false)} />
      ) : moreOpen && kind === "parent" && account ? (
        <ParentMoreSheet items={items} primaryIds={primaryIds} counts={counts} urgent={urgent} session={account.session} kids={account.kids ?? 0} schools={account.schools ?? 1} school={account.schoolName} onClose={() => setMoreOpen(false)} />
      ) : moreOpen ? (
        <>
          <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="fixed inset-0 z-[37] bg-[rgba(13,35,21,0.5)] md:hidden" />
          <div
            role="dialog"
            aria-label="Everything else"
            className="fixed inset-x-0 bottom-0 z-[38] max-h-[70vh] overflow-y-auto rounded-t-[24px] bg-white px-[14px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-[10px] md:hidden"
            style={{ boxShadow: "0 -12px 30px -18px rgba(13,35,21,0.55)" }}
          >
            <span className="mx-auto mb-[12px] block h-[4px] w-[38px] rounded-full" style={{ background: "#DEE8E2" }} />
            <p className="mb-[8px] text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "#67766D" }}>Everything else</p>
            <div className="grid grid-cols-3 gap-[8px]">
              {rest.map((item) => {
                const count = counts[item.id] ?? 0;
                return (
                  <Link
                    key={item.id}
                    href={item.href as Route}
                    className="relative flex min-h-[86px] flex-col items-center justify-center gap-[7px] rounded-[14px] border px-[6px] py-[10px] text-center"
                    style={{ borderColor: "#DEE8E2", background: active?.id === item.id ? "#F1F7F4" : "#fff" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#435048" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width={21} height={21} aria-hidden>
                      <path d={item.icon} />
                    </svg>
                    <span className="text-[10.5px] font-semibold leading-[1.25]" style={{ color: "#0D2315" }}>{item.short ?? item.label}</span>
                    {count ? (
                      <span
                        className="absolute right-[7px] top-[7px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[4px] text-[9.5px] font-black"
                        style={{ background: urgent[item.id] ? "#C93F3F" : "#E0A526", color: urgent[item.id] ? "#fff" : "#0D2315" }}
                      >
                        {cap(count)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <nav
        aria-label={label}
        className="sticky bottom-0 z-[36] grid flex-none grid-cols-5 rounded-t-[24px] bg-white px-[6px] pb-[calc(10px+env(safe-area-inset-bottom))] pt-[8px] md:hidden"
        style={{ boxShadow: "0 -12px 30px -22px rgba(13,35,21,0.45)" }}
      >
        {primary.map((item) => (
          <Link
            key={item.id}
            href={item.href as Route}
            aria-current={active?.id === item.id ? "page" : undefined}
            className={cellClass}
          >
            {inside(item.icon, item.short ?? item.label, active?.id === item.id, counts[item.id] ?? 0, Boolean(urgent[item.id]))}
          </Link>
        ))}
        <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} className={cellClass}>
          {inside(MORE_ICON, "More", onMore, moreCount, moreUrgent)}
        </button>
      </nav>
    </>
  );
}
