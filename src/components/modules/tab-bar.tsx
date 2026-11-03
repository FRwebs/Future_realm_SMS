"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { usePhoneKind } from "@/components/layout/phone-shell";
import { useUiText } from "@/hooks/use-ui-text";
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
  const ui = useUiText();
  const teacherPhone = usePhoneKind() === "teacher";

  if (items.length <= 1) return null;

  return (
    <>
    {teacherPhone ? (
      // On a teacher's phone the tabs are a segmented control: one white pill, the current segment filled ink.
      <nav aria-label={ariaLabel} className="min-w-0 md:hidden">
        <div className="flex gap-[4px] overflow-x-auto rounded-[15px] bg-white p-[4px]" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.22)" }}>
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] flex-1 basis-0 items-center justify-center gap-[6px] whitespace-nowrap rounded-[11px] px-[8px] text-[13px] font-extrabold transition-colors",
                  active ? "bg-[#0D2315] text-white" : "text-[#435048]",
                )}
              >
                <span>{ui(item.label)}</span>
                {item.count ? <span className={cn("rounded-full px-[6px] py-[1px] text-[10.5px] font-black", active ? "bg-white/20 text-white" : "bg-[#EDF3EF] text-[#435048]")}>{item.count}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    ) : null}
    <nav
      aria-label={ariaLabel}
      className={cn("-mx-1 flex items-center gap-[3px] overflow-x-auto border-b border-[#DEE8E2] px-1", teacherPhone && "max-md:hidden")}
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
                : "border-b-transparent font-medium text-[#5E6D64]",
            )}
          >
            <span>{ui(item.label)}</span>
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
    </>
  );
}
