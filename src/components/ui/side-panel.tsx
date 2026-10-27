"use client";

import { X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

import { useReturnFocus } from "@/components/ui/use-return-focus";
import { SIDE_PANEL_WIDTH } from "@/lib/ui/interaction";
import { cn } from "@/lib/utils/cn";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIDE_PANEL_WIDTH;
};

/** A drawer built on Radix: focus is trapped and returned, the page behind is inert, and Escape or an outside click closes it. */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: SidePanelProps) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-enter fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-[8px]">
          <div className="absolute inset-y-0 right-0 flex w-full justify-end">
            <Dialog.Content
              onCloseAutoFocus={returnFocus}
              {...(subtitle ? {} : { "aria-describedby": undefined })}
              className={cn(
                "panel-enter-right flex h-full w-full flex-col border-l border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] outline-none transition-transform duration-200",
                "max-md:max-w-full",
                SIDE_PANEL_WIDTH[size],
              )}
            >
              <div className="sticky top-0 z-[1] flex items-start justify-between gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-5 py-4">
                <div className="min-w-0">
                  <Dialog.Title className="font-[var(--font-display)] text-[20px] font-bold text-[var(--color-text-primary)]">{title}</Dialog.Title>
                  {subtitle ? (
                    <Dialog.Description className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                      {subtitle}
                    </Dialog.Description>
                  ) : null}
                </div>
                <Dialog.Close className="icon-btn shrink-0" aria-label="Close side panel">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>

              <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent-primary)] px-5 py-5">{children}</div>

              {footer ? (
                <div className="sticky bottom-0 border-t border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-5 py-4">
                  {footer}
                </div>
              ) : null}
            </Dialog.Content>
          </div>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
