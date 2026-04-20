"use client";

import { useRef } from "react";
import { AlertTriangle, Pencil, Plus, X } from "lucide-react";

import { ResourceField, ResourceForm } from "@/components/forms/resource-form";
import { cn } from "@/lib/utils/cn";

interface ResourceActionDialogProps {
  triggerLabel: string;
  title: string;
  description: string;
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  fields: ResourceField[];
  submitLabel: string;
  confirmLabel?: string;
  confirmMessage?: string;
  offlineKey?: string;
  variant?: "primary" | "secondary" | "danger";
}

const triggerStyles = {
  primary:
    "bg-ink text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] hover:bg-brand-800",
  secondary:
    "border border-ink/10 bg-white text-ink shadow-sm hover:bg-sand/70",
  danger:
    "bg-rose-700 text-white shadow-[0_10px_24px_rgba(190,24,93,0.18)] hover:bg-rose-800",
};

const triggerIcons = {
  primary: Plus,
  secondary: Pencil,
  danger: AlertTriangle,
};

export function ResourceActionDialog({
  triggerLabel,
  title,
  description,
  endpoint,
  method,
  fields,
  submitLabel,
  confirmLabel,
  confirmMessage,
  offlineKey,
  variant = "primary",
}: ResourceActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const TriggerIcon = triggerIcons[variant];

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside) {
      dialog.close();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.99]",
          triggerStyles[variant]
        )}
      >
        <TriggerIcon className="h-4 w-4" />
        <span>{triggerLabel}</span>
      </button>

      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        onCancel={closeDialog}
        className="w-[min(960px,calc(100vw-2rem))] rounded-[2rem] border border-white/60 bg-white p-0 text-ink shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop:bg-ink/55 backdrop:backdrop-blur-[3px]"
      >
        <div className="max-h-[min(88vh,900px)] overflow-hidden rounded-[2rem]">
          <div className="border-b border-ink/6 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(255,255,255,0.95),rgba(250,245,235,0.95))] px-6 py-5 md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
                  Action
                </p>
                <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold tracking-tight text-ink md:text-3xl">
                  {title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
                  {description}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ink/8 bg-white text-ink shadow-sm transition hover:bg-sand/70"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(min(88vh,900px)-132px)] overflow-y-auto px-6 py-6 md:px-8 md:py-7">
            <ResourceForm
              title={title}
              description={description}
              endpoint={endpoint}
              method={method}
              fields={fields}
              submitLabel={submitLabel}
              confirmLabel={confirmLabel}
              confirmMessage={confirmMessage}
              offlineKey={offlineKey}
              chrome="plain"
              showHeader={false}
              onSuccess={() => dialogRef.current?.close()}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
