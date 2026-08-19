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
  size = "md",
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
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal backdrop"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="overlay-enter absolute inset-0 bg-ink/55 backdrop-blur-[8px]"
      />

      <div
        ref={panelRef}
        className={cn(
          "modal-surface modal-enter relative z-[1] flex max-h-[min(88vh,900px)] w-full flex-col overflow-hidden rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] transition-all duration-200",
          MODAL_MAX_WIDTH[size],
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
      >
        {title || showCloseButton ? (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-default)] px-6 py-5">
            <div className="min-w-0">
              {title ? (
                <h2 className="font-[var(--font-display)] text-[20px] font-bold text-[var(--color-text-primary)]">{title}</h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="icon-btn shrink-0"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <div className="border-t border-[var(--color-border-default)] px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
