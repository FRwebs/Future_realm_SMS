"use client";

import { useEffect, useRef, useState } from "react";

import { TOOLTIP_OPEN_DELAY_MS } from "@/lib/ui/interaction";
import { cn } from "@/lib/utils/cn";

export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  function handleOpen() {
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, TOOLTIP_OPEN_DELAY_MS);
  }

  function handleClose() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {open ? (
        <span className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-[var(--z-tooltip)] w-max max-w-[200px] -translate-x-1/2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)] px-3 py-2 text-[11px] font-medium leading-5 text-[var(--color-text-primary)] shadow-[var(--shadow-md)]">
          {content}
        </span>
      ) : null}
    </span>
  );
}
