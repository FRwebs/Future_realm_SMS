import type { Response } from "express";

import { ALL_LOCALES, LOCALE_COOKIE, type Locale } from "../../../src/i18n/locales";

/** The names a form may send for a language — the codes themselves, and what each language calls itself. */
const BY_NAME: Record<string, Locale> = { english: "en", yoruba: "yo", yorùbá: "yo", hausa: "ha", igbo: "ig" };

/** `"Hausa"`, `"ha"`, `" HA "` → `"ha"`; anything else → null. */
export function toLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if ((ALL_LOCALES as readonly string[]).includes(text)) return text as Locale;
  return BY_NAME[text] ?? null;
}

/**
 * Remembers the language on this device. The web app reads this cookie to pick the language of every page it draws, so the choice takes
 * effect the moment the page is refreshed — and signing in on a new device sets it again from the account.
 */
export function rememberLocale(response: Response, locale: Locale | null) {
  if (!locale) return;
  response.cookie(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: "lax", httpOnly: false });
}
