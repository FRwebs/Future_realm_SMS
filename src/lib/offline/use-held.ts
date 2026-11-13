"use client";

import { useEffect, useState } from "react";

import { OUTBOX_KINDS, outboxCount, type OutboxEntry } from "@/lib/offline/outbox";

export type HeldCounts = Record<OutboxEntry["kind"], number>;

/**
 * What this device is still holding, by kind.
 *
 * A figure on a page is otherwise the school's, read on the server, and the server cannot know what
 * one teacher's phone is carrying. This reads it off the device after the page has mounted, so a
 * card can say "2 waiting" and mean it. Until then the authored figure stands, which is what the
 * server rendered — so the page does not flicker a number it has not checked.
 */
export function useHeldCounts(enabled = true): HeldCounts | null {
  const [held, setHeld] = useState<HeldCounts | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const read = () => setHeld(Object.fromEntries(OUTBOX_KINDS.map((kind) => [kind, outboxCount(kind)])) as HeldCounts);
    read();
    // Another tab sending the queue, or this one going back online, changes what is waiting here.
    window.addEventListener("storage", read);
    window.addEventListener("online", read);
    const tick = window.setInterval(read, 15_000);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("online", read);
      window.clearInterval(tick);
    };
  }, [enabled]);
  return held;
}

/**
 * The authored cards with any device figure replaced by what this device is actually holding.
 *
 * A figure above zero means work is waiting to be sent, which is the one thing about it worth
 * noticing, so the card takes the attention tone the moment there is something there.
 */
export function onDevice<T extends { device?: OutboxEntry["kind"]; value: string; tone?: unknown }>(cards: T[], held: HeldCounts | null): T[] {
  if (!held) return cards;
  return cards.map((card) => (card.device ? { ...card, value: String(held[card.device]), tone: held[card.device] ? "attention" : card.tone } : card));
}
