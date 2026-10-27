"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/i18n/locales";

/** Lets a person read the sign-in screens in another language. Shown only when more than one language is switched on. */
export function LanguagePicker() {
  const router = useRouter();
  const current = useLocale();
  if (LOCALES.length < 2) return null;
  return (
    <label className="mt-[18px] flex items-center justify-center gap-2 text-[11px] text-[#5f6e65]">
      <span>Language</span>
      <select
        value={current}
        onChange={(event) => {
          document.cookie = `${LOCALE_COOKIE}=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="rounded-lg border border-[#dee8e2] bg-white px-2 py-1 text-[11px] font-semibold text-[#0d2315]"
      >
        {LOCALES.map((code: Locale) => (
          <option key={code} value={code}>{LOCALE_NAMES[code]}</option>
        ))}
      </select>
    </label>
  );
}
