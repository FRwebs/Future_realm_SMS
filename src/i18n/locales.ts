/**
 * The languages the product speaks.
 *
 * English (Nigeria) is complete and always on. Yoruba, Hausa and Igbo exist as DRAFTS of the sign-in screens: they are checked by machine
 * (same keys, same placeholders) but have not been read by a fluent speaker, and a school's words reaching a parent in a clumsy or wrong
 * translation is worse than English. So they are switched off until a reviewer has signed off every line — then set
 * NEXT_PUBLIC_ENABLE_DRAFT_LOCALES=true (staging first), and remove `_meta.status: "draft"` from a language's file once it is approved.
 *
 * To add a language: add its code to `ALL_LOCALES`, create `src/messages/<code>.json` with the same keys, and have it reviewed. Anything a
 * language lacks falls back to English.
 */
export const ALL_LOCALES = ["en", "yo", "ha", "ig"] as const;
export type Locale = (typeof ALL_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "fr_locale";

/** What each language calls itself — shown in the language picker, never translated. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", yo: "Yorùbá", ha: "Hausa", ig: "Igbo" };

const draftsOn = process.env.NEXT_PUBLIC_ENABLE_DRAFT_LOCALES === "true";
export const LOCALES: readonly Locale[] = draftsOn ? ALL_LOCALES : ["en"];
export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);
