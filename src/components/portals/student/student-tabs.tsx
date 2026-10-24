"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/** The tabs inside one student page. The one you are on is in the address (`?tab=`), so a refresh and a shared link land in the same place. */
export function StudentTabs({ tabs, active, ariaLabel }: { tabs: Array<{ label: string; count?: number }>; active: string; ariaLabel: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (tabs.length <= 1) return null;
  const hrefFor = (label: string) => {
    const next = new URLSearchParams(params.toString());
    if (label === tabs[0]!.label) next.delete("tab");
    else next.set("tab", label);
    const query = next.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  };
  return (
    <nav aria-label={ariaLabel} className="-mx-1 flex items-center gap-[3px] overflow-x-auto border-b border-[#DEE8E2] px-1">
      {tabs.map((tab) => {
        const on = tab.label === active;
        return (
          <Link
            key={tab.label}
            href={hrefFor(tab.label) as Route}
            aria-current={on ? "page" : undefined}
            className={cn(
              "group -mb-px flex flex-none items-center gap-[7px] whitespace-nowrap border-b-2 px-[13px] py-[9px] text-[11.5px] transition-[color,border-color] duration-150 hover:border-b-[#BFDCD1] hover:text-[#0D2315]",
              on ? "border-b-[#12796A] font-semibold text-[#0D2315]" : "border-b-transparent font-medium text-[#67766D]",
            )}
          >
            <span>{tab.label}</span>
            {tab.count ? <span className={cn("rounded-full px-[6px] py-[1.5px] text-[9.5px] font-bold leading-[1.2]", on ? "bg-[#E4F1EC] text-[#17604F]" : "bg-[#F1F4F2] text-[#5C6A62]")}>{tab.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
