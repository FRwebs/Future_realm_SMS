"use client";

import Link from "next/link";
import type { Route } from "next";

/**
 * The only controls on a printable sheet. They are hidden when it prints, so the
 * paper carries the list and nothing else.
 */
export function PrintControls({ backHref, label }: { backHref: string; label: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link
        href={backHref as Route}
        className="rounded-[9px] border border-[#CFDDD5] bg-white px-[15px] py-[9px] text-[12px] font-semibold text-[#435048]"
      >
        Back
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-[#6B7A71]">{label}</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-[9px] bg-[#0D2315] px-[17px] py-[10px] text-[12px] font-semibold text-white"
        >
          Print
        </button>
      </div>
    </div>
  );
}
