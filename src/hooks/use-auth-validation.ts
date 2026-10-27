"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import en from "@/messages/en.json";
import type { AuthValidationMessages } from "@/lib/validation/auth";

/** The words the sign-in rules say, in the person's language. */
export function useAuthValidationMessages(): AuthValidationMessages {
  const t = useTranslations("auth.validation");
  return useMemo(() => Object.fromEntries(Object.keys(en.auth.validation).map((key) => [key, t(key as keyof AuthValidationMessages)])) as AuthValidationMessages, [t]);
}
