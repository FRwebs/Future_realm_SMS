"use client";

import posthog from "posthog-js";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Product analytics (PostHog) — which screens are used and where people get stuck. Off until NEXT_PUBLIC_POSTHOG_KEY is set.
 *
 * This product holds children's records, so it is deliberately quiet: no session recording, no automatic capture of clicks or typing, no
 * identification of people (events are anonymous), "do not track" is honoured, and a page is reported by its route, never by the ids or
 * query strings inside it. What remains is "this screen was opened", enough to see which features matter and which are never found.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/** `/students/cm9x…/results?term=2` -> `/students/:id/results` */
export const routeOf = (path: string) => path.split("?")[0]!.replace(/\/c[a-z0-9]{20,}/g, "/:id").replace(/\/\d+/g, "/:n");

let started = false;

export function ProductAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!key || started) return;
    started = true;
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      respect_dnt: true,
      persistence: "memory",
    });
  }, []);

  useEffect(() => {
    if (key && started) posthog.capture("$pageview", { $current_url: routeOf(pathname), $pathname: routeOf(pathname) });
  }, [pathname]);

  return null;
}
