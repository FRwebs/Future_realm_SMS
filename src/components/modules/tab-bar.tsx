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
      className="-mx-1 flex items-center gap-[3px] overflow-x-auto border-b border-[var(--color-border-default)] px-1"
    >
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex flex-none items-center gap-[7px] whitespace-nowrap border-b-2 px-[13px] py-[9px] text-[11.5px] transition-[color,border-color] duration-150",
              active
                ? "border-b-[var(--color-accent-primary)] font-semibold text-[var(--color-text-primary)]"
                : "border-b-transparent font-medium text-[var(--color-text-muted)] hover:border-b-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <span>{item.label}</span>
            {item.count ? (
              <span
                className={cn(
                  "rounded-full px-[6px] py-[1.5px] text-[9.5px] font-bold leading-[1.2]",
                  active
                    ? "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]"
                    : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
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
