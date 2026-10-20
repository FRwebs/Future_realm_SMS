"use client";

import { useEffect } from "react";

/**
 * Tells the platform how long this page took to load, and on what kind of connection — once per page view, a fifth of the
 * time. It is what lets Infrastructure say how the product feels on 3G instead of guessing.
 */
export function PageLoadBeacon() {
  useEffect(() => {
    if (Math.random() > 0.2) return;
    const send = () => {
      try {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const loadMs = Math.round(navigation ? navigation.loadEventEnd || navigation.domContentLoadedEventEnd : performance.now());
        if (!loadMs || loadMs < 1) return;
        const csrf = document.cookie.split("; ").find((item) => item.startsWith("fr_csrf="))?.split("=")[1] ?? "";
        const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
        void fetch("/api/v1/telemetry/page-load", { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ path: window.location.pathname, loadMs, connection }) }).catch(() => undefined);
      } catch {
        // Telemetry must never get in the way of the page.
      }
    };
    if (document.readyState === "complete") send();
    else window.addEventListener("load", () => window.setTimeout(send, 0), { once: true });
  }, []);
  return null;
}
