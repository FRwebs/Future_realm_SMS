"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** The pages a teacher must be able to open with no connection — keep in step with KEPT_PAGES in public/sw.js. */
const KEPT_PAGES = [/^\/attendance\/mark(\/|$)/, /^\/score-entry-results\/enter(\/|$)/];

/**
 * Registers the service worker once the page has finished loading — in production only, so development never serves a stale file.
 *
 * It also does the two things that make "works offline" true on a phone:
 *   - asks the browser to keep this site's storage (a register held for sending must not be cleared to make room);
 *   - on a register or a score sheet, asks for the page once more in a way the worker keeps, so that page opens later with no connection
 *     even when it was reached by tapping through the app rather than by typing its address.
 */
export function ServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !navigator.onLine) return;
    if (!KEPT_PAGES.some((pattern) => pattern.test(pathname))) return;
    // Once the page has settled, so keeping it never competes with showing it.
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker.ready
        .then(() => fetch(`${window.location.pathname}${window.location.search}`, { credentials: "same-origin", headers: { "x-fr-keep": "1", Accept: "text/html" } }))
        .catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
