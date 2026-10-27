"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { uiKey } from "@/i18n/ui-key";

/**
 * The words around the pages — menu entries, section titles — in the person's language. A label is looked up by what it says in English
 * (so the navigation, which names its own entries, needs no key of its own); a label nobody has translated yet is shown as it is, never as
 * a key, so a half-translated menu reads as English where it must.
 */
export function useUiText() {
  const t = useTranslations("ui");
  return useCallback((text: string) => (text && t.has(uiKey(text) as never) ? t(uiKey(text) as never) : text), [t]);
}
