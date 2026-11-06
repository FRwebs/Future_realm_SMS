"use client";

import Link from "next/link";
import type { Route } from "next";

export type Chip = { label: string; href: string; on?: boolean; count?: number };

/**
 * A row of choices under a phone screen's heading — the terms of a scheme of work. The one that is lit is the one being read; each of
 * the others is a link to its own address, so what is lit is the server's to say.
 */
export function PhoneChips({ chips }: { chips: Chip[] }) {
  return (
    <div className="-mx-4 flex gap-[10px] overflow-x-auto px-4 pb-[2px]" style={{ scrollbarWidth: "none" }} role="tablist">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href as Route}
          role="tab"
          aria-selected={Boolean(chip.on)}
          className="flex min-h-[42px] flex-none items-center whitespace-nowrap rounded-full border px-[18px] text-[13.5px] font-bold"
          style={chip.on ? { background: "#E3F1EA", borderColor: "#5FBF9F", color: "#0D2315" } : { background: "#fff", borderColor: "#E4EDE8", color: "#435048" }}
        >
          {chip.label}
          {chip.count ? <span className="ml-[8px] rounded-full px-[7px] py-[1px] text-[11.5px] font-black" style={chip.on ? { background: "#0D2315", color: "#fff" } : { background: "#EDF3EF", color: "#435048" }}>{chip.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
