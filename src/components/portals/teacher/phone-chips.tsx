"use client";

import Link from "next/link";
import type { Route } from "next";

export type Chip = { label: string; href: string; on?: boolean };

/**
 * A row of choices under a phone screen's heading — the terms of a scheme of work. The one that is lit is the one being read; each of
 * the others is a link to its own address, so what is lit is the server's to say.
 */
export function PhoneChips({ chips }: { chips: Chip[] }) {
  return (
    <div className="flex flex-wrap gap-[10px]" role="tablist">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href as Route}
          role="tab"
          aria-selected={Boolean(chip.on)}
          className="flex min-h-[42px] items-center whitespace-nowrap rounded-full border px-[18px] text-[14px] font-bold"
          style={chip.on ? { background: "#E3F1EA", borderColor: "#5FBF9F", color: "#0D2315" } : { background: "#fff", borderColor: "#E4EDE8", color: "#435048" }}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
