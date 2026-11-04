import { headers } from "next/headers";

import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { PanelTone, TabContent } from "@/lib/modules/panels";

export const PW = "/api/v1/parent-portal/ws";

export type ParentChild = {
  id: string; name: string; first: string; initials: string; admissionNumber: string;
  arm: string; level: string; classId: string | null; photoUrl: string | null;
  /** Which school this child is at, named only when the family spans more than one. */
  schoolId?: string; school?: string;
};

export type ParentMe = {
  id: string; name: string; first: string; relationship: string; phone: string; email: string | null;
  language: string; school: string;
  term: { id: string; name: string; session: string; start: string | null; end: string | null; week: number; weeks: number } | null;
  today: string; now: string;
  /** True when the family's children are at more than one school. */
  manySchools?: boolean;
  /** Every school the family belongs to, each with its own currency, time zone and the day and clock in it. */
  schools?: Array<{ id: string; name: string; short: string; currency: string; timezone: string; today: string; now: string; place: string; office?: { phone: string | null; website: string | null; where: string | null } }>;
  /** The school office: its name, how to ring it, where it is. */
  office: { name: string; phone: string | null; website: string | null; where: string | null };
  /** What this school has chosen to show parents, by page name. */
  sees: string[];
  /** Messages from the school that have not been opened. */
  unread: number;
  children: ParentChild[];
};

export type NeedItem = {
  kind: string; childId: string | null; child: string;
  label: string; sub: string; pill: string; tone: PanelTone;
  action: string; href: string; due: string;
};

export const loadMe = () => apiGet(`${PW}/me`, observe<ParentMe>(localContracts["src/lib/modules/live/parent/shared.ts#6e8a2861"]));
export const loadNeeds = (child: string) => apiGet(`${PW}/needs?child=${encodeURIComponent(child)}`, observe<{ items: NeedItem[] }>(localContracts["src/lib/modules/live/parent/shared.ts#51171b30"]));

/** What a page hands the shell: the tab content, plus the tabs inside the page and which child it is about. */
export type ParentContent = TabContent & {
  eyebrow?: string;
  tabs?: Array<{ label: string; count?: number }>;
  /** The page draws its own choices on a phone, so the strip of tabs is not offered there. */
  tabsOnLaptopOnly?: boolean;
  tab?: string;
};

/**
 * Which child a page is about.
 *
 * "all" — the whole family — is the default, because a parent arriving at the
 * portal has not yet said which child they mean, and several pages are more
 * useful read across the family anyway. A child id that is not theirs falls
 * back to the family view rather than erroring: the switcher is a view, not a
 * permission, and the reads behind it are scoped to their own children.
 */
/** The clock at each of the family's schools — one time for a one-school family, and each school's own when they differ ("10:34 Abuja · 09:34 Accra"). */
export const clocksOf = (me: ParentMe): string => {
  const schools = me.schools ?? [];
  // Schools on the same clock need it said once; it is only when they differ that each one's own is named.
  if (schools.length < 2 || schools.every((school) => school.now === schools[0]!.now)) return me.now;
  return schools.map((school) => `${school.now} ${school.place || school.short}`).join(" · ");
};

/** "Whole family", and — only when the children are at more than one school — which schools that covers: "Whole family · both schools". */
export const wholeFamily = (label: string, me: ParentMe): string => {
  const count = me.schools?.length ?? 0;
  return count >= 2 && label === "Whole family" ? `Whole family · ${count === 2 ? "both" : `all ${count}`} schools` : label;
};

export const childOf = (query: Record<string, string | undefined>, me: ParentMe): string => {
  const asked = query.child?.trim();
  return asked && me.children.some((child) => child.id === asked) ? asked : "all";
};

export const greeting = (clock: string) => {
  const hour = Number(clock.slice(0, 2));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

/**
 * A figure in a school's own money. Naira is written as it always has been; any other currency is written the way its own country does
 * ("GH₵11,550"). Two currencies are never added together — a family at two schools reads two figures.
 */
export const money = (value: number, currency = "NGN") => {
  if (currency === "NGN") return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  const locale = ({ GHS: "en-GH", KES: "en-KE", ZAR: "en-ZA", GBP: "en-GB" } as Record<string, string>)[currency] ?? "en";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  }
};
/** The sign a currency is written with — "₦", "GH₵" — for the label of an amount field. */
export const symbolOf = (currency = "NGN") => money(0, currency).replace(/[\d.,\s]/g, "") || currency;
/** The currency's own name, for a sentence: "Nigerian naira", "Ghanaian cedi". */
export const currencyName = (currency = "NGN") => {
  try { return new Intl.DisplayNames("en", { type: "currency" }).of(currency)?.toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) ?? currency; } catch { return currency; }
};
export const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const dShort = (iso: string) => dayOf(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const dLong = (iso: string) => dayOf(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const dDow = (iso: string) => dayOf(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** The address a phone is given. It is built from the address this page was opened at, so it works wherever the school is hosted. */
export async function absolute(path: string): Promise<string> {
  try {
    const list = await headers();
    const host = list.get("x-forwarded-host") ?? list.get("host");
    const proto = list.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    return host ? `${proto}://${host}${path}` : path;
  } catch {
    return path;
  }
}
