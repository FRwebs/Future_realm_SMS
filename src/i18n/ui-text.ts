import { getTranslations } from "next-intl/server";

import { uiKey } from "./ui-key";

/** `useUiText`, for server components: the same labels, looked up the same way, falling back to the English as written. */
export async function getUiText() {
  const t = await getTranslations("ui");
  return (text: string) => (text && t.has(uiKey(text) as never) ? t(uiKey(text) as never) : text);
}
