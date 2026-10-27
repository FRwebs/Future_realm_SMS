"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus } from "lucide-react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { usePortalType } from "@/components/layout/portal-context";
import { ResourceField, ResourceForm, type ResourceImpact } from "@/components/forms/resource-form";
import { useActionMenu } from "@/components/ui/action-menu";
import { Modal } from "@/components/ui/modal";
import { MODAL_MAX_WIDTH } from "@/lib/ui/interaction";
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
  variant?: "primary" | "secondary" | "danger" | "menu" | "menuDanger" | "heroWhite" | "textAction" | "textActionDanger" | "cardPrimary" | "cardCompact";
  presentation?: "modal" | "drawer";
  size?: keyof typeof MODAL_MAX_WIDTH;
  /** What saving this does — the mockup's summary panel under the fields. */
  impact?: ResourceImpact;
  /** The standing caveat for this form, shown on the left of the footer. */
  note?: string;
  /** What the record will say for a decision dialog: the change as before and after. */
  recorded?: { line?: string; before?: string; after?: string };
  /** A stepped form: each step has a name and a line of its own; fields name the step they belong to. */
  steps?: Array<{ name: string; sub?: string }>;
  /** Stay open after a successful run, showing the server's answer — a test that reports what it would do. */
  keepOpen?: boolean;
  /** Reshapes the values just before they are sent. */
  transform?: (payload: Record<string, unknown>) => Record<string, unknown>;
  /** An export: the values are sent as query parameters to this address, which answers with a file. */
  downloadHref?: string;
}

const triggerStyles = {
  primary: "btn-primary px-5",
  secondary: "btn-secondary px-5",
  danger: "btn-destructive px-5",
  menu: "flex w-full items-center justify-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-(--color-text-secondary) transition-colors duration-150 hover:bg-(--color-accent-primary-dim) hover:text-(--color-text-accent)",
  menuDanger: "flex w-full items-center justify-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-danger transition-colors duration-150 hover:bg-(--color-danger-dim)",
  // Matches the mockup's white pill primary-action button used inside the ink module
  // hero (e.g. "Add school", "New campaign", "Create Ticket") — see ModuleHeroAction.
  heroWhite: "whitespace-nowrap rounded-full bg-white px-5 py-3 text-[#0d2315] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)] hover:bg-[#eaf3ee]",
  // Matches the mockup's compact list-row action text (e.g. Profile page's "Sessions & security" list).
  textAction: "text-[11.5px] font-semibold text-(--color-text-accent) hover:underline",
  textActionDanger: "text-[11.5px] font-semibold text-danger hover:underline",
  // Matches the mockup's compact plan-card action buttons (e.g. "Edit plan" on a Plans &
  // Features subscription-plan card): filled ink, 8px radius, small padding, no icon.
  cardPrimary: "rounded-[8px] bg-[#0d2315] px-3 py-[7px] text-[11.5px] font-semibold text-white hover:bg-[#132e1d]",
  // Matches the mockup's compact bordered card action buttons (e.g. "Duplicate", "Archive").
  cardCompact: "rounded-[8px] border border-(--color-border-default) bg-transparent px-[11px] py-[6px] text-[11.5px] font-semibold text-[#435048] hover:border-(--color-border-strong)",
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
  size = "report",
  impact,
  note,
  recorded,
  downloadHref,
  steps,
  transform,
  keepOpen,
}: ResourceActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const backOffice = usePortalType() === "super_admin";
  // In the Back Office a primary action is a small ink button with a plus; every other action is a plain bordered one with no icon.
  const menu = useActionMenu();
  const inMenu = Boolean(menu);
  // Opened from a menu item: ask the menu to keep its items mounted until this dialog is closed.
  useEffect(() => (open && menu ? menu.hold() : undefined), [open, menu]);
  const TriggerIcon = backOffice ? (variant === "primary" || variant === "heroWhite" ? Plus : undefined) : triggerIcons[variant];
  const backOfficeStyle: Partial<Record<keyof typeof triggerStyles, string>> = {
    primary: "gap-[6px] whitespace-nowrap rounded-[9px] bg-[#0D2315] px-[13px] py-2 text-[12px] font-semibold text-white hover:bg-[#17402A]",
    secondary: "gap-[6px] whitespace-nowrap rounded-[9px] border border-[#DEE8E2] bg-white px-3 py-[7px] text-[12px] font-semibold text-[#435048] hover:bg-[#F7FAF8]",
    danger: "gap-[6px] whitespace-nowrap rounded-[9px] border border-[#F3E0E0] bg-white px-3 py-[7px] text-[12px] font-semibold text-[#B23B3B] hover:bg-[#FDF3F3]"
  };
  // A dialog that asks for nothing but a reason (or only a yes) is the mockup's decision modal: small, with the consequence first.
  const reasonLayout = backOffice && !impact && !note && fields.filter((field) => field.type !== "hidden").length <= 1 && fields.filter((field) => field.type !== "hidden").every((field) => field.type === "textarea");
  const danger = variant === "danger" || variant === "menuDanger" || variant === "textActionDanger" || /^(cancel|suspend|roll back|revoke|reject|close|delete|remove|expire|dismiss|force|end |archive|lift)/i.test(submitLabel);
  const formId = `${endpoint.replace(/[^a-z0-9]/gi, "-")}-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  function openDialog() {
    setStepIndex(0);
    setOpen(true);
  }

  const stepper = steps ? (
    <div className="flex flex-wrap items-center gap-[7px]">
      {steps.map((item, index) => (
        <button
          key={item.name}
          type="button"
          onClick={() => setStepIndex(index)}
          className="flex items-center gap-2 whitespace-nowrap rounded-full py-[7px] pl-2 pr-[11px]"
          style={{ background: index === stepIndex ? "#fff" : index < stepIndex ? "rgba(95,214,180,0.14)" : "rgba(255,255,255,0.07)" }}
        >
          <span
            className="flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full font-(--font-heading) text-[10.5px] font-bold"
            style={{ background: index === stepIndex ? "#0D2315" : index < stepIndex ? "#2FA98F" : "rgba(255,255,255,0.16)", color: index <= stepIndex ? "#fff" : "rgba(255,255,255,0.65)" }}
          >
            {index + 1}
          </span>
          <span className="text-[11.5px] font-semibold" style={{ color: index === stepIndex ? "#0D2315" : index < stepIndex ? "#8FE0C6" : "rgba(255,255,255,0.62)" }}>{item.name}</span>
        </button>
      ))}
      <span className="ml-auto whitespace-nowrap text-[11px] font-semibold text-white/50">Step {stepIndex + 1} of {steps.length}</span>
    </div>
  ) : undefined;

  const triggerClass = cn(
    "inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99]",
    backOffice && backOfficeStyle[variant] ? "" : variant === "textAction" || variant === "textActionDanger" || variant === "cardPrimary" || variant === "cardCompact" ? "" : "text-[13px] font-semibold",
    backOffice && backOfficeStyle[variant] ? backOfficeStyle[variant] : triggerStyles[variant]
  );
  const triggerBody = (
    <>
      {TriggerIcon ? <TriggerIcon className={backOffice && variant === "primary" ? "h-[13px] w-[13px] text-[#5FD6B4]" : backOffice ? "h-[15px] w-[15px]" : "h-4 w-4"} strokeWidth={backOffice ? 2.4 : undefined} /> : null}
      <span>{triggerLabel}</span>
    </>
  );
  // Inside an action menu the trigger is a real menu item (arrow keys, typeahead, closes the menu); anywhere else it is a plain button.
  const trigger = inMenu ? (
    <button type="button" className={triggerClass}>{triggerBody}</button>
  ) : (
    <button type="button" onClick={openDialog} className={triggerClass}>{triggerBody}</button>
  );

  return (
    <>
      {inMenu ? <DropdownMenu.Item asChild onSelect={openDialog}>{trigger}</DropdownMenu.Item> : trigger}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={reasonLayout ? undefined : title}
        subtitle={reasonLayout ? undefined : steps?.[stepIndex]?.sub ?? description}
        headerExtra={stepper}
        showCloseButton={!reasonLayout}
        size={reasonLayout ? "reason" : size}
      >
        <ResourceForm
          formId={formId}
          title={title}
          description={reasonLayout && confirmMessage ? `${description} ${confirmMessage}` : description}
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
          onCancel={() => setOpen(false)}
          impact={impact}
          note={note}
          layout={reasonLayout ? "reason" : "form"}
          danger={danger}
          recorded={recorded}
          downloadHref={downloadHref}
          steps={steps}
          stepIndex={stepIndex}
          onStepChange={setStepIndex}
          transform={transform}
          keepOpen={keepOpen}
        />
      </Modal>
    </>
  );
}
