"use client";

import { useState } from "react";

export const TOOLTIP_OPEN_DELAY_MS = 400;

export const TOAST_DURATIONS = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
} as const;

export const MODAL_MAX_WIDTH = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  // The mockup's form modal is 684px wide; every Back Office dialog uses this size.
  report: "max-w-[684px]",
  // The mockup's decision modal — a consequence, a reason and what will be recorded.
  reason: "max-w-[540px]",
} as const;

export const SIDE_PANEL_WIDTH = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
} as const;

export type DisclosureState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  set: (next: boolean) => void;
};

export function useDisclosure(initial = false): DisclosureState {
  const [isOpen, setIsOpen] = useState(initial);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((current) => !current),
    set: (next: boolean) => setIsOpen(next),
  };
}

export function openDisclosure(setter: (next: boolean) => void) {
  setter(true);
}

export function closeDisclosure(setter: (next: boolean) => void) {
  setter(false);
}

export function toggleDisclosure(
  setter: (updater: (current: boolean) => boolean) => void,
) {
  setter((current) => !current);
}

export function isEscapeKey(event: KeyboardEvent | { key: string }) {
  return event.key === "Escape";
}
