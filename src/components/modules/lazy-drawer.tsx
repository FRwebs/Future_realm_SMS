"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import type { DrawerSpec } from "@/lib/modules/panels";

/**
 * The drawer is large (forms, fields, documents, steps) and nobody has one open when a page arrives. It is fetched as its own piece of
 * the page, a moment after the page is usable — so it is there before anyone clicks, and is not part of what the page waits for.
 */
const Drawer = dynamic(() => import("@/components/modules/module-drawer").then((loaded) => loaded.ModuleDrawer), { ssr: false });

let warmed = false;
/** Ask for the drawer's code while the browser is idle. Safe to call from every page: it asks once. */
export function warmDrawer() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  const ask = () => void import("@/components/modules/module-drawer");
  if ("requestIdleCallback" in window) (window as unknown as { requestIdleCallback: (run: () => void, options?: { timeout: number }) => void }).requestIdleCallback(ask, { timeout: 4000 });
  else setTimeout(ask, 1500);
}

export function ModuleDrawer({ spec, onClose }: { spec: DrawerSpec | null; onClose: () => void }) {
  useEffect(() => warmDrawer(), []);
  return spec ? <Drawer spec={spec} onClose={onClose} /> : null;
}
