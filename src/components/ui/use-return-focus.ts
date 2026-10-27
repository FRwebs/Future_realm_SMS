"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Radix returns focus to a `Trigger` it owns; our dialogs are opened by whatever button the caller drew, so the opener is remembered here
 * (the moment `open` turns true, before focus moves into the dialog) and focus is handed back to it on close.
 */
export function useReturnFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  return useCallback((event: Event) => {
    const target = opener.current;
    if (target && target.isConnected) {
      event.preventDefault();
      target.focus();
    }
  }, []);
}
