import Link from "next/link";
import type { Route } from "next";

import type { ParentChild } from "@/lib/modules/live/parent/shared";
import { parentHref } from "@/lib/modules/parent-workspace";
import { toneOf } from "@/lib/modules/tones";
import type { PanelTone } from "@/lib/modules/panels";

export type SwitcherChild = ParentChild & {
  /** One line about where this child stands on the page being read. */
  stat: string;
  statTone?: PanelTone;
  /** How many things about this child need the parent. */
  needs: number;
  /** Whether any of them is overdue rather than merely waiting. */
  urgent: boolean;
};

/**
 * Which child the page is about.
 *
 * A family with two children has two of everything — two attendance records,
 * two fee balances — and the question "which one" comes before every other
 * question. So it is answered once, here, above the page, and carried in the
 * address so that what is selected is the server's to decide and a link to a
 * child's page is a link a parent can keep.
 *
 * "Whole family" is first and is the default. Each chip carries a count of what
 * needs doing for that child, so a parent can see where the problem is without
 * opening each one.
 */
export function ChildSwitcher({
  page,
  selected,
  children,
  family,
}: {
  page: string;
  selected: string;
  children: SwitcherChild[];
  family: { stat: string; needs: number; urgent: boolean };
}) {
  const chip = (
    key: string,
    initials: string,
    name: string,
    stat: string,
    statTone: PanelTone | undefined,
    needs: number,
    urgent: boolean,
    photo: string | null,
  ) => {
    const on = key === selected;
    return (
      <Link
        key={key}
        href={parentHref(page, key) as Route}
        aria-current={on ? "true" : undefined}
        title={`${name}${needs ? ` · ${needs} ${needs === 1 ? "thing needs" : "things need"} you` : ""}`}
        className="flex min-w-0 flex-none items-center gap-[9px] rounded-full border px-[10px] py-[5px] transition-[background,border-color] duration-150"
        style={on ? { background: "#0D2315", borderColor: "#0D2315" } : { background: "#fff", borderColor: "#DEE8E2" }}
      >
        <span className="relative flex-none">
          <span
            className="flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-full border font-[family-name:var(--font-heading)] text-[10px] font-extrabold"
            style={on ? { background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.24)" } : { background: "#EBF1FA", color: "#2A5A96", borderColor: "#C9DAF0" }}
          >
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
          </span>
          {needs ? (
            <span
              className="absolute -right-[5px] -top-[4px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[4px] text-[9px] font-extrabold leading-none"
              style={{
                background: urgent ? "#C93F3F" : "#E0A526",
                color: urgent ? "#fff" : "#0D2315",
                border: `1.5px solid ${on ? "#0D2315" : "#F2F7F4"}`,
              }}
            >
              {needs}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-[11.5px] font-semibold leading-[1.25]" style={{ color: on ? "#fff" : "#0D2315" }}>
            {name}
          </span>
          <span
            className="block truncate text-[9.5px] font-semibold leading-[1.3]"
            style={{ color: on ? "rgba(255,255,255,0.7)" : statTone ? toneOf(statTone).fg : "#67766D" }}
          >
            {stat}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <nav aria-label="Which child" className="mb-[14px] flex flex-wrap items-center gap-[7px]">
      {chip("all", "All", "Whole family", family.stat, undefined, family.needs, family.urgent, null)}
      {children.map((child) => chip(child.id, child.initials, child.first, child.stat, child.statTone, child.needs, child.urgent, child.photoUrl))}
    </nav>
  );
}
