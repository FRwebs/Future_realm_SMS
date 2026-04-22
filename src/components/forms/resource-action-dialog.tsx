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
  primary: "btn-primary px-5",
  secondary: "btn-secondary px-5",
  danger: "btn-destructive px-5",
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
          "inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.99]",
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
        className="w-[min(900px,calc(100vw-2rem))] rounded-[20px] border border-slate-100 bg-white p-0 text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.2)] backdrop:bg-black/50 backdrop:backdrop-blur-[3px]"
      >
        <div className="max-h-[min(88vh,900px)] overflow-hidden rounded-[20px]">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(235,244,238,0.95),rgba(255,255,255,0.98),rgba(246,250,247,0.96))] px-6 py-5 md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="section-eyebrow">Action</p>
                <h2 className="mt-2 text-[20px] font-bold text-slate-900 md:text-[24px]">{title}</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600">{description}</p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                className="icon-btn shrink-0"
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
