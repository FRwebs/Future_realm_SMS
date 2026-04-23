"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

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

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: SidePanelProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[170]">
      <button
        type="button"
        aria-label="Close side panel backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />

      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <section
          className={cn(
            "flex h-full w-full flex-col border-l border-slate-100 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.18)] transition-transform duration-200",
            "max-md:max-w-full",
            SIDE_PANEL_WIDTH[size],
          )}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="sticky top-0 z-[1] flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold text-slate-900">{title}</h2>
              {subtitle ? (
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="icon-btn shrink-0"
              aria-label="Close side panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {footer ? (
            <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}
