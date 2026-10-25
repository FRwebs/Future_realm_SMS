"use client";

import type { Route } from "next";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";

export function NavigationNoticeListener() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const banner = useNotice();
  const handledNoticeRef = useRef<string | null>(null);

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (!notice) return;
    const from = searchParams.get("from");
    const noticeKey = `${pathname}:${notice}:${from ?? ""}`;
    if (handledNoticeRef.current === noticeKey) return;
    handledNoticeRef.current = noticeKey;

    if (notice === "not-authorized") {
      banner.warning(
        "Not authorised",
        from
          ? `Your account cannot open ${from}. You were returned to a workspace you can use.`
          : "Your account cannot open that route. You were returned to a workspace you can use.",
      );
    }

    if (notice === "module-off") {
      const name = searchParams.get("module") ?? "That module";
      banner.warning(
        `${name} is switched off`,
        searchParams.get("scope") === "platform"
          ? "FutureRealm has switched this module off for every school for now. You were returned to a workspace you can use."
          : "FutureRealm has switched this module off for your school. Contact support if you need it back.",
      );
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("module");
    next.delete("scope");
    next.delete("notice");
    next.delete("from");
    const query = next.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the notice hook's setters never change
  }, [pathname, router, searchParams]);

  // Said at the top of the page you were returned to — where you were looking when it happened — and kept until you dismiss it.
  return <InlineNotice notice={banner.notice} onDismiss={banner.clear} className="mb-4" />;
}
