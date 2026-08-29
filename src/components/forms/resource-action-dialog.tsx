"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";

import { ResourceField, ResourceForm } from "@/components/forms/resource-form";
import { Modal } from "@/components/ui/modal";
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
  variant?: "primary" | "secondary" | "danger" | "menu" | "menuDanger" | "heroWhite" | "textAction" | "textActionDanger";
  presentation?: "modal" | "drawer";
}

const triggerStyles = {
  primary: "btn-primary px-5",
  secondary: "btn-secondary px-5",
  danger: "btn-destructive px-5",
  menu: "flex w-full items-center justify-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]",
  menuDanger: "flex w-full items-center justify-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--color-danger)] transition-colors duration-150 hover:bg-[var(--color-danger-dim)]",
  // Matches the mockup's white pill primary-action button used inside the ink module
  // hero (e.g. "Add school", "New campaign", "Create Ticket") — see ModuleHeroAction.
  heroWhite: "whitespace-nowrap rounded-full bg-white px-5 py-3 text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] hover:bg-[#eaf3ee]",
  // Matches the mockup's compact list-row action text (e.g. Profile page's "Sessions & security" list).
  textAction: "text-[11.5px] font-semibold text-[var(--color-text-accent)] hover:underline",
  textActionDanger: "text-[11.5px] font-semibold text-[var(--color-danger)] hover:underline",
};

const triggerIcons: Partial<Record<keyof typeof triggerStyles, typeof Plus>> = {
  primary: Plus,
  secondary: Pencil,
  danger: AlertTriangle,
  menu: Pencil,
  menuDanger: AlertTriangle,
  heroWhite: Plus,
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
          "inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99]",
          variant === "textAction" || variant === "textActionDanger" ? "" : "text-[13px] font-semibold",
          triggerStyles[variant]
        )}
      >
        {TriggerIcon ? <TriggerIcon className="h-4 w-4" /> : null}
        <span>{triggerLabel}</span>
      </button>

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
    </>
  );
}
