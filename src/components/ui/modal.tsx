"use client";

import { X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

import { useReturnFocus } from "@/components/ui/use-return-focus";
import { MODAL_MAX_WIDTH } from "@/lib/ui/interaction";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof MODAL_MAX_WIDTH;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  /** Sits under the title and subtitle inside the ink header — a stepper, for example. */
  headerExtra?: React.ReactNode;
};

/**
 * A dialog built on Radix, so focus is trapped and restored, the page behind is inert to assistive technology, Escape and an outside click
 * close it in the right order when dialogs stack, and the title and subtitle are what a screen reader announces. The look is ours.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "report",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  headerExtra,
}: ModalProps) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-enter fixed inset-0 z-(--z-modal) flex items-start justify-center overflow-y-auto bg-ink/55 px-[21.5px] py-[39.5px]">
          <Dialog.Content
            {...(subtitle ? {} : { "aria-describedby": undefined })}
            onCloseAutoFocus={returnFocus}
            onInteractOutside={(event) => { if (!closeOnBackdrop) event.preventDefault(); }}
            onEscapeKeyDown={(event) => { if (!closeOnEscape) event.preventDefault(); }}
            className={cn(
              "modal-surface modal-enter relative z-1 flex max-h-[calc(100vh-79px)] w-full flex-col overflow-hidden rounded-[20px] bg-white text-(--color-text-primary) shadow-[0_45px_90px_-36px_rgba(13,35,21,0.6)] outline-hidden transition-all duration-200",
              MODAL_MAX_WIDTH[size],
            )}
          >
            {title ? null : <Dialog.Title className="sr-only">Dialog</Dialog.Title>}
            {title || showCloseButton ? (
              <div className="relative overflow-hidden px-[23.5px] py-[20px]" style={{ background: "#0d2315" }}>
                <div className="pointer-events-none absolute right-[-63px] top-[-99px] h-[252px] w-[252px] rounded-full border border-[rgba(95,214,180,0.14)]" />
                <div className="relative flex items-start justify-between gap-[18px]">
                  <div className="min-w-0">
                    {title ? (
                      <Dialog.Title className="text-pretty font-(--font-heading) text-[19px] font-extrabold tracking-[-0.018em] text-white">{title}</Dialog.Title>
                    ) : null}
                    {subtitle ? (
                      <Dialog.Description className="mt-[6.5px] max-w-[468px] text-pretty text-[11.5px] leading-[1.55] text-white/62">
                        {subtitle}
                      </Dialog.Description>
                    ) : null}
                  </div>

                  {showCloseButton ? (
                    <Dialog.Close
                      className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(255,255,255,0.12)] transition hover:bg-[rgba(255,255,255,0.2)]"
                      aria-label="Close modal"
                    >
                      <X className="h-[12.5px] w-[12.5px] text-white" strokeWidth={2.2} />
                    </Dialog.Close>
                  ) : null}
                </div>
                {headerExtra ? <div className="relative mt-[15px]">{headerExtra}</div> : null}
              </div>
            ) : null}

            {/* A scrolling region must be reachable by keyboard so its content can be scrolled without a mouse (axe: scrollable-region-focusable). */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--color-accent-primary) px-[23.5px] py-[20px]">{children}</div>

            {footer ? (
              <div className="border-t border-[#EDF3EF] bg-[#FBFDFC] px-[23.5px] py-[13.5px]">{footer}</div>
            ) : null}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
