"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

import { TOOLTIP_OPEN_DELAY_MS } from "@/lib/ui/interaction";
import { cn } from "@/lib/utils/cn";

/**
 * A tooltip on Radix: it opens on hover and on keyboard focus, closes on Escape, stays inside the viewport, and is tied to its trigger for
 * assistive technology. The wrapping element is what the pointer and focus land on.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixTooltip.Provider delayDuration={TOOLTIP_OPEN_DELAY_MS} skipDelayDuration={150}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span className={cn("relative inline-flex", className)}>{children}</span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side="top"
            sideOffset={8}
            collisionPadding={8}
            className="z-(--z-tooltip) w-max max-w-[200px] rounded-xl border border-(--color-border-strong) bg-(--color-bg-overlay) px-3 py-2 text-[11px] font-medium leading-5 text-(--color-text-primary) shadow-(--shadow-md)"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
