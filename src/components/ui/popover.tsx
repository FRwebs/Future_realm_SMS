"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative inline-flex"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-popover-close='true']")) {
          window.setTimeout(() => setOpen(false), 0);
        }
      }}
    >
      {trigger({
        open,
        toggle: () => setOpen((current) => !current),
        close: () => setOpen(false),
      })}

      {open ? (
        <div
          className={cn(
            "popover-enter absolute top-[calc(100%+0.5rem)] z-[var(--z-dropdown)] min-w-[240px] rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)] p-4 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)]",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}
