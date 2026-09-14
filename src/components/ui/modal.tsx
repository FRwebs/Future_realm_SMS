"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
};

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
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelector<
      HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLAnchorElement
    >(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-ink/55 px-6 pt-11 pb-6">
      <button
        type="button"
        aria-label="Close modal backdrop"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="overlay-enter fixed inset-0"
      />

      <div
        ref={panelRef}
        className={cn(
          "modal-surface modal-enter relative z-[1] flex max-h-[calc(100vh-88px)] w-full flex-col overflow-hidden rounded-[20px] bg-white text-[var(--color-text-primary)] shadow-[0_50px_100px_-40px_rgba(13,35,21,0.6)] transition-all duration-200",
          MODAL_MAX_WIDTH[size],
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
      >
        {title || showCloseButton ? (
          <div className="relative overflow-hidden px-[26px] py-[22px]" style={{ background: "#0d2315" }}>
            <div className="pointer-events-none absolute -right-[70px] -top-[110px] h-[280px] w-[280px] rounded-full border border-[rgba(95,214,180,0.14)]" />
            <div className="relative flex items-start justify-between gap-5">
            <div className="min-w-0">
              {title ? (
                <h2 className="font-[var(--font-heading)] text-[21px] font-extrabold tracking-[-0.018em] text-white">{title}</h2>
              ) : null}
              {subtitle ? (
                <p className="mt-[7px] max-w-[520px] text-[12.5px] leading-[1.55] text-white/[62%]">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[rgba(255,255,255,0.12)] transition hover:bg-[rgba(255,255,255,0.2)]"
                aria-label="Close modal"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            ) : null}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-[26px] py-[22px]">{children}</div>

        {footer ? (
          <div className="border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
