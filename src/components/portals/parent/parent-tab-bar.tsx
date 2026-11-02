"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";

import { parentPages, parentHref } from "@/lib/modules/parent-workspace";
import type { ParentPageSlug } from "@/lib/modules/parent-workspace";

/**
 * The parent portal on a phone.
 *
 * The mockup drops the sidebar entirely below tablet width and gives the thumb
 * a bar at the bottom: the four things a parent opens daily, and More for the
 * rest. That is the right trade on a 375px screen — a rail costs either a third
 * of the width or a tap to open, and a parent checking whether a payment landed
 * should not pay either.
 *
 * The four are not arbitrary. They are what a parent comes back for — is my
 * child in school, how are they doing, what do I owe — and everything else is
 * something they do once and leave.
 */

const PRIMARY: ParentPageSlug[] = ["overview", "attendance", "results", "fees"];

/** The short names the bar uses. A tab label has to fit a fifth of a phone. */
const SHORT: Partial<Record<ParentPageSlug, string>> = {
  overview: "Home",
  attendance: "Attendance",
  results: "Results",
  fees: "Fees",
  learning: "Timetable",
  messages: "Messages",
  calendar: "Calendar",
  meetings: "Meetings",
  consents: "Forms",
  requests: "Requests",
  profile: "Profiles",
  prefs: "Notifications",
  account: "Account",
};

const MORE_ICON = "M5 4.5h5v5H5zM14 4.5h5v5h-5zM5 14.5h5v5H5zM14 14.5h5v5h-5z";

export function ParentTabBar({
  visible,
  counts,
  urgent,
}: {
  /** Which pages this school shows parents — a page it keeps back is not in the bar. */
  visible: string[];
  counts: Record<string, number>;
  urgent: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const page = pathname.replace(/^\/portals\/parent\/?/, "") || "overview";
  const child = params.get("child") ?? undefined;

  // A route change closes the sheet; otherwise it would sit over the page a
  // parent just asked for.
  useEffect(() => { setMoreOpen(false); }, [pathname, params]);

  // Escape closes it, like every other overlay in this product.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const shown = parentPages.filter((entry) => visible.includes(entry.slug));
  const primary = shown.filter((entry) => PRIMARY.includes(entry.slug));
  const rest = shown.filter((entry) => !PRIMARY.includes(entry.slug));
  const moreCount = rest.reduce((sum, entry) => sum + (counts[`p_${entry.slug}`] ?? 0), 0);
  const moreUrgent = rest.some((entry) => urgent[`p_${entry.slug}`]);
  const onMore = !primary.some((entry) => entry.slug === page);

  const cap = (value: number) => (value > 9 ? "9+" : String(value));

  const cell = (key: string, label: string, icon: string, on: boolean, count: number, isUrgent: boolean, body: (inner: React.ReactNode) => React.ReactNode) =>
    body(
      <>
        <span
          className="flex h-[32px] w-[32px] items-center justify-center rounded-full"
          style={on ? { background: "#0D2315", color: "#fff" } : { color: "#8A978F" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" width={on ? 17 : 23} height={on ? 17 : 23} aria-hidden>
            <path d={icon} />
          </svg>
        </span>
        <span
          className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ fontSize: "min(11px, 3.3vw)", fontWeight: on ? 800 : 700, color: on ? "#0D2315" : "#7C8A82" }}
        >
          {label}
        </span>
        {count ? (
          <span
            className="absolute top-[2px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[4px] text-[10px] font-black text-white"
            style={{ left: "calc(50% + 6px)", background: isUrgent ? "#DB5555" : "#E0A526", color: isUrgent ? "#fff" : "#0D2315", border: "2px solid #fff" }}
          >
            {cap(count)}
          </span>
        ) : null}
        {on ? <span className="absolute -bottom-[6px] left-1/2 h-[3px] w-[26px] -translate-x-1/2 rounded-full" style={{ background: "#0D2315" }} /> : null}
      </>,
    );

  const cellClass = "relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-[4px]";

  return (
    <>
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-[37] bg-[rgba(13,35,21,0.5)] md:hidden"
          />
          <div
            role="dialog"
            aria-label="Everything else"
            className="fixed inset-x-0 bottom-0 z-[38] max-h-[70vh] overflow-y-auto rounded-t-[24px] bg-white px-[14px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-[10px] md:hidden"
            style={{ boxShadow: "0 -12px 30px -18px rgba(13,35,21,0.55)" }}
          >
            <span className="mx-auto mb-[12px] block h-[4px] w-[38px] rounded-full" style={{ background: "#DEE8E2" }} />
            <p className="mb-[8px] text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "#67766D" }}>Everything else</p>
            <div className="grid grid-cols-3 gap-[8px]">
              {rest.map((entry) => {
                const count = counts[`p_${entry.slug}`] ?? 0;
                return (
                  <Link
                    key={entry.slug}
                    href={parentHref(entry.slug, child) as Route}
                    className="relative flex min-h-[86px] flex-col items-center justify-center gap-[7px] rounded-[14px] border px-[6px] py-[10px] text-center"
                    style={{ borderColor: "#DEE8E2", background: page === entry.slug ? "#F1F7F4" : "#fff" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#435048" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width={21} height={21} aria-hidden>
                      <path d={entry.icon} />
                    </svg>
                    <span className="text-[10.5px] font-semibold leading-[1.25]" style={{ color: "#0D2315" }}>{SHORT[entry.slug] ?? entry.label}</span>
                    {count ? (
                      <span
                        className="absolute right-[7px] top-[7px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[4px] text-[9.5px] font-black"
                        style={{ background: urgent[`p_${entry.slug}`] ? "#DB5555" : "#E0A526", color: urgent[`p_${entry.slug}`] ? "#fff" : "#0D2315" }}
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
        aria-label="Parent portal"
        className="sticky bottom-0 z-[36] grid flex-none grid-cols-5 rounded-t-[24px] bg-white px-[6px] pb-[calc(10px+env(safe-area-inset-bottom))] pt-[8px] md:hidden"
        style={{ boxShadow: "0 -12px 30px -22px rgba(13,35,21,0.45)" }}
      >
        {primary.map((entry) =>
          cell(
            entry.slug,
            SHORT[entry.slug] ?? entry.label,
            entry.icon,
            page === entry.slug,
            counts[`p_${entry.slug}`] ?? 0,
            Boolean(urgent[`p_${entry.slug}`]),
            (inner) => (
              <Link key={entry.slug} href={parentHref(entry.slug, child) as Route} aria-current={page === entry.slug ? "page" : undefined} className={cellClass}>
                {inner}
              </Link>
            ),
          ),
        )}
        {cell("more", "More", MORE_ICON, onMore, moreCount, moreUrgent, (inner) => (
          <button key="more" type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} className={cellClass}>
            {inner}
          </button>
        ))}
      </nav>
    </>
  );
}
