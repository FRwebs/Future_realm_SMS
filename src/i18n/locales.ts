/**
 * The languages the product speaks. English (Nigeria) is complete; to add one — Yoruba, Hausa or Igbo are the first candidates — add its
 * code here and a `src/messages/<code>.json` with the same keys, translated by a fluent speaker (machine translation of a school's
 * words to parents is not good enough). Anything missing from a language falls back to English.
 */
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "fr_locale";
export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);
