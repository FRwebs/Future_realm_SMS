"use client";

import * as Sentry from "@sentry/nextjs";
import { useReportWebVitals } from "next/web-vitals";

/**
 * Core Web Vitals as real people on real connections experience them. A metric rated "poor" by the web's own thresholds (LCP over 4 s, INP
 * over 500 ms, CLS over 0.25 …) is sent to error reporting with the route it happened on, so slow screens are found from the field and not
 * guessed from a developer's laptop. Nothing leaves the browser until a Sentry DSN is configured; in development a poor metric is logged.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (metric.rating !== "poor") return;
    if (process.env.NODE_ENV !== "production") console.warn(`[web-vitals] ${metric.name} is poor: ${Math.round(metric.value)}`);
    Sentry.captureMessage(`Poor ${metric.name}`, {
      level: "warning",
      tags: { webVital: metric.name, route: window.location.pathname.replace(/\/c[a-z0-9]{20,}/g, "/:id").replace(/\/\d+/g, "/:n") },
      extra: { value: Math.round(metric.value), rating: metric.rating, navigationType: metric.navigationType },
    });
  });
  return null;
}
