"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

type PanelPosition = { top: number; left: number };

const GAP = 8;
const VIEWPORT_MARGIN = 8;
const DEFAULT_PANEL_WIDTH = 240;

export function Popover({
  trigger,
  children,
  align = "right",
  panelClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void; close: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const anchor = rootRef.current;
    if (!anchor) return;
    const anchorRect = anchor.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth ?? DEFAULT_PANEL_WIDTH;
    const panelHeight = panelRef.current?.offsetHeight ?? 0;

    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const openUpward = spaceBelow < panelHeight + GAP && anchorRect.top > panelHeight + GAP;
    const top = openUpward ? anchorRect.top - GAP - panelHeight : anchorRect.bottom + GAP;

    const rawLeft = align === "right" ? anchorRect.right - panelWidth : anchorRect.left;
    const maxLeft = window.innerWidth - panelWidth - VIEWPORT_MARGIN;
    const left = Math.min(Math.max(rawLeft, VIEWPORT_MARGIN), Math.max(maxLeft, VIEWPORT_MARGIN));

    setPosition({ top: Math.max(top, VIEWPORT_MARGIN), left });
  }

  useEffect(() => {
    if (!open) return;

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger({
        open,
        toggle: () => {
          setHasOpened(true);
          setOpen((current) => {
            const next = !current;
            if (!next) setPosition(null);
            return next;
          });
        },
        close: () => setOpen(false),
      })}

      {hasOpened
        ? createPortal(
            <div
              ref={panelRef}
              aria-hidden={!open}
              style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
              onClickCapture={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest("[data-popover-close='true']")) {
                  window.setTimeout(() => setOpen(false), 0);
                }
              }}
              className={cn(
                "popover-enter fixed z-[var(--z-dropdown)] min-w-[240px] rounded-[14px] border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-bg-surface)_96%,transparent)] p-4 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] backdrop-blur-xl",
                open && position ? "visible" : "invisible pointer-events-none",
                panelClassName,
              )}
            >
              {children({ close: () => setOpen(false) })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
