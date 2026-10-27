"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A popover on Radix: it is placed against the trigger, flips and shifts to stay on screen, closes on Escape or an outside press, keeps
 * keyboard focus sensible, and hands focus back to the trigger when it closes. The caller still draws its own trigger and decides what is
 * inside; anything marked `data-popover-close="true"` closes the panel when pressed.
 */
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Anchor asChild>
        <div ref={anchorRef} className="relative inline-flex">
          {trigger({ open, toggle: () => setOpen((current) => !current), close })}
        </div>
      </RadixPopover.Anchor>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side="bottom"
          align={align === "right" ? "end" : "start"}
          sideOffset={8}
          collisionPadding={8}
          // The trigger toggles on its own press; counting that press as "outside" would close the panel and the toggle would reopen it.
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            anchorRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
          }}
          onClickCapture={(event) => {
            if ((event.target as HTMLElement | null)?.closest("[data-popover-close='true']")) window.setTimeout(close, 0);
          }}
          className={cn(
            "popover-enter z-[var(--z-dropdown)] min-w-[240px] rounded-[14px] border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-bg-surface)_96%,transparent)] p-4 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] outline-none backdrop-blur-xl",
            panelClassName,
          )}
        >
          {children({ close })}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
