"use client";

import { useEffect, useRef } from "react";

/**
 * Moves focus to an element the moment it appears. For a field that arrives because the person just asked for it — a sign-in code after
 * the password, a new sub-topic row — not for anything present when the page loads, which is what the `autoFocus` attribute is for and
 * what screen-reader users are right to be wary of. Used as `ref={focusOnMount}`.
 */
export function focusOnMount(node: HTMLElement | null) {
  node?.focus();
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * For a dialog that is drawn by hand rather than by Radix: focus moves into it when it opens, Tab and Shift+Tab stay inside it, and
 * focus goes back to the control that opened it when it closes. Put the returned ref on the dialog's panel (not its backdrop).
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const panel = ref.current;
    if (!active || !panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // A field that asked for focus on its own (focusOnMount) keeps it; otherwise the first control takes it.
    const start = setTimeout(() => {
      if (!panel.contains(document.activeElement)) (focusable()[0] ?? panel).focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return event.preventDefault();
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const inside = panel!.contains(document.activeElement);
      if (!inside) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(start);
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [active]);

  return ref;
}
