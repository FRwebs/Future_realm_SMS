"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

export type TabBarItem = {
  href: string;
  label: string;
  /** Optional count shown in a pill inside the tab. */
  count?: string;
};

/**
 * The tab strip inside a module.
 *
 * The mockup underlines the current tab rather than enclosing it: flat labels
 * in a row, the active one inked and carrying a 2px accent rule, all sitting on
 * a hairline that runs the width of the page. Values are matched to the
 * mockup's own tab style — 11.5px, 9px/13px padding, 3px between tabs.
 */
export function TabBar({ items, ariaLabel }: { items: TabBarItem[]; ariaLabel: string }) {
  const pathname = usePathname();

  if (items.length <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="-mx-1 flex items-center gap-[3px] overflow-x-auto border-b border-[#DEE8E2] px-1"
    >
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group -mb-px flex flex-none items-center gap-[7px] whitespace-nowrap border-b-2 px-[13px] py-[9px] text-[11.5px] transition-[color,border-color] duration-150 hover:border-b-[#BFDCD1] hover:text-[#0D2315]",
              active
                ? "border-b-[#12796A] font-semibold text-[#0D2315]"
                : "border-b-transparent font-medium text-[#67766D]",
            )}
          >
            <span>{item.label}</span>
            {item.count ? (
              <span
                className={cn(
                  "rounded-full px-[6px] py-[1.5px] text-[9.5px] font-bold leading-[1.2]",
                  active ? "bg-[#E4F1EC] text-[#17604F]" : "bg-[#F1F4F2] text-[#5C6A62]",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
