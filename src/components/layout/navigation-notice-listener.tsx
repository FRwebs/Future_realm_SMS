"use client";

import type { Route } from "next";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";

export function NavigationNoticeListener() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const handledNoticeRef = useRef<string | null>(null);

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (!notice) return;
    const from = searchParams.get("from");
    const noticeKey = `${pathname}:${notice}:${from ?? ""}`;
    if (handledNoticeRef.current === noticeKey) return;
    handledNoticeRef.current = noticeKey;

    if (notice === "not-authorized") {
      showToast({
        variant: "warning",
        title: "Not authorised",
        description: from
          ? `Your account cannot open ${from}. You were returned to a workspace you can use.`
          : "Your account cannot open that route. You were returned to a workspace you can use.",
      });
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("notice");
    next.delete("from");
    const query = next.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  }, [pathname, router, searchParams, showToast]);

  return null;
}
