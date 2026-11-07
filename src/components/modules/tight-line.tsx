"use client";

import { useEffect, useState, type ReactNode } from "react";

import { usePhoneKind } from "@/components/layout/phone-shell";
import { TIGHT_FLOOR, tighten, type TightRule } from "@/lib/ui/tight-copy";

/**
 * A line under the phone's copy rule, drawn by an element that exists at every width.
 *
 * The rule belongs to a narrow window, so the width of the window has to decide it. `usePhoneKind`
 * only knows which portal the page belongs to, and a panel heading, a field hint or a tile's second
 * line is the same element on a laptop as on a phone — so asking it alone shortened a laptop's copy
 * too. Measuring the width in JavaScript instead would mean every phone drew the long line and
 * swapped it after hydration, so both forms go into the markup and CSS picks between them.
 *
 * Where the rule drops the line altogether there is no phone form at all, and `hidePhone` says so,
 * because an empty paragraph still leaves its margin on the screen.
 */
export function useTightLine(rule: TightRule, text: string | undefined): { node: ReactNode; hidePhone: boolean } {
  const kind = usePhoneKind();
  if (!kind || !text || text.length < TIGHT_FLOOR) return { node: text ?? null, hidePhone: false };
  const short = tighten(rule, text);
  if (short === text) return { node: text, hidePhone: false };
  return {
    node: (
      <>
        {short ? <span className="md:hidden">{short}</span> : null}
        <span className="max-md:hidden">{text}</span>
      </>
    ),
    hidePhone: !short,
  };
}

/**
 * Whether the window is a phone's width, for the one slot CSS cannot reach.
 *
 * A placeholder is an attribute rather than a node, so it cannot be written twice and hidden one way
 * or the other. It starts as the full line, which is what the server rendered, and shortens once the
 * browser has said how wide it is — a swap inside an empty box, where nothing moves.
 */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(max-width: 767.98px)");
    const read = () => setNarrow(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return narrow;
}
