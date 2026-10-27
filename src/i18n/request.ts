import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

/**
 * Which language a request is in: the person's saved choice (a cookie), else what their browser asks for, else English (Nigeria). Routes are
 * not prefixed with a language — a school's links look the same whichever language the person reads them in.
 */
async function resolveLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const asked = ((await headers()).get("accept-language") ?? "").split(",").map((part) => part.trim().split(";")[0]!.slice(0, 2).toLowerCase());
  return asked.find(isLocale) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, timeZone: "Africa/Lagos", messages: (await import(`../messages/${locale}.json`)).default };
});
