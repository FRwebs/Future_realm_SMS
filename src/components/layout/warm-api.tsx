"use client";

import { useEffect } from "react";

import { wakeApi } from "@/lib/api/wake";

/** Starts waking the API as soon as any page is open (see lib/api/wake). Draws nothing. */
export function WarmApi() {
  useEffect(() => {
    void wakeApi();
  }, []);
  return null;
}
