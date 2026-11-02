import { headers } from "next/headers";

import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { PanelTone, TabContent } from "@/lib/modules/panels";

export const PW = "/api/v1/parent-portal/ws";

export type ParentChild = {
  id: string; name: string; first: string; initials: string; admissionNumber: string;
  arm: string; level: string; classId: string | null; photoUrl: string | null;
};

export type ParentMe = {
  id: string; name: string; first: string; relationship: string; phone: string; email: string | null;
  language: string; school: string;
  term: { id: string; name: string; session: string; start: string | null; end: string | null; week: number; weeks: number } | null;
  today: string; now: string;
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
export const childOf = (query: Record<string, string | undefined>, me: ParentMe): string => {
  const asked = query.child?.trim();
  return asked && me.children.some((child) => child.id === asked) ? asked : "all";
};

export const greeting = (clock: string) => {
  const hour = Number(clock.slice(0, 2));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

export const money = (value: number) => `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
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
