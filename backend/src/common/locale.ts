import type { Response } from "express";

import { ALL_LOCALES, LOCALE_COOKIE, type Locale } from "../../../src/i18n/locales";
import { PREFS_COOKIE, devicePreferencesFrom, encodeDevicePreferences, type Preferences } from "../../../src/lib/preferences";

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

/** Remembers the choices that change what this device does by itself (density, confirmations, offline keeping). */
export function rememberDevicePreferences(response: Response, preferences: Preferences | null | undefined) {
  // The value is already URL-safe (see encodeDevicePreferences); a second round of encoding would leave the browser unable to read it.
  response.cookie(PREFS_COOKIE, encodeDevicePreferences(devicePreferencesFrom(preferences)), { path: "/", maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: "lax", httpOnly: false, encode: (value) => value });
}
