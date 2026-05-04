"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";

import { ResourceField, ResourceForm } from "@/components/forms/resource-form";
import { Modal } from "@/components/ui/modal";
import { SidePanel } from "@/components/ui/side-panel";
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
  variant?: "primary" | "secondary" | "danger" | "menu" | "menuDanger";
  presentation?: "modal" | "drawer";
}

const triggerStyles = {
  primary: "btn-primary px-5",
  secondary: "btn-secondary px-5",
  danger: "btn-destructive px-5",
  menu: "flex w-full rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-primary-50 hover:text-primary-700",
  menuDanger: "flex w-full rounded-xl px-3 py-2 text-left text-rose-700 hover:bg-rose-50",
};

const triggerIcons = {
  primary: Plus,
  secondary: Pencil,
  danger: AlertTriangle,
  menu: Pencil,
  menuDanger: AlertTriangle,
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
  presentation = "modal",
}: ResourceActionDialogProps) {
  const [open, setOpen] = useState(false);
  const TriggerIcon = triggerIcons[variant];
  const formId = `${endpoint.replace(/[^a-z0-9]/gi, "-")}-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  function openDialog() {
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        data-popover-close={variant === "menu" || variant === "menuDanger" ? "true" : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.99]",
          triggerStyles[variant]
        )}
      >
        <TriggerIcon className="h-4 w-4" />
        <span>{triggerLabel}</span>
      </button>

      {presentation === "drawer" ? (
        <SidePanel
          open={open}
          onClose={() => setOpen(false)}
          title={title}
          subtitle={description}
          size="lg"
        >
          <ResourceForm
            formId={formId}
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
            onSuccess={() => setOpen(false)}
          />
        </SidePanel>
      ) : (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={title}
          subtitle={description}
          size="lg"
        >
          <ResourceForm
            formId={formId}
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
            onSuccess={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
