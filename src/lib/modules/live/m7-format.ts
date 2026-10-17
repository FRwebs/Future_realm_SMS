import type { AccountState } from "@/lib/modules/live/m7-types";
import type { PanelTone } from "@/lib/modules/panels";

/** Small readings every Staff & Access screen shares: dates, plurals, how long since a sign-in. */

export const ACCOUNT_TONE: Record<AccountState, PanelTone> = {
  Active: "positive",
  Dormant: "attention",
  "Never activated": "negative",
  Suspended: "neutral",
};

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dayLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** "Today", "3 days ago", or "Never" — read from the sign-in itself. */
export function lastSeen(row: { account: AccountState; accountDays: number; lastLoginAt: string | null }): string {
  if (!row.lastLoginAt) return "Never";
  if (row.accountDays === 0) return "Today";
  if (row.accountDays === 1) return "Yesterday";
  return `${row.accountDays} days ago`;
}
