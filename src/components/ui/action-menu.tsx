"use client";

import type { Route } from "next";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { usePortalType } from "@/components/layout/portal-context";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type MenuHold = { hold: () => () => void } | null;
const InsideActionMenu = createContext<MenuHold>(null);

/**
 * Set inside an `ActionMenu`. A menu item that opens a dialog must keep the menu's items mounted while that dialog is open — otherwise
 * closing the menu would take the dialog with it. `hold()` says "keep me" and returns the function that lets go.
 */
export const useActionMenu = () => useContext(InsideActionMenu);

export function ActionMenu({
  children,
  align = "right",
  triggerLabel = "More actions",
  triggerText,
  panelClassName,
  compact: compactProp,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  triggerLabel?: string;
  /** When set, renders a labeled text button (e.g. "Manage") instead of the default icon-only trigger. */
  triggerText?: string;
  panelClassName?: string;
  /** The Back Office row menu: a bare ⋮ and a slim panel. On by default inside the Back Office, off elsewhere. */
  compact?: boolean;
}) {
  const inBackOffice = usePortalType() === "super_admin";
  const compact = compactProp ?? inBackOffice;
  const slim = compact && !triggerText;
  // While an item's dialog is open the items stay mounted (hidden), so closing the menu does not take the dialog with it.
  const [holds, setHolds] = useState(0);
  const hold = useCallback(() => {
    setHolds((count) => count + 1);
    return () => setHolds((count) => count - 1);
  }, []);
  const keep = holds > 0 || undefined;
  const menu = useMemo(() => ({ hold }), [hold]);
  return (
    <DropdownMenu.Root modal={false}>
      {triggerText ? (
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={triggerLabel}
            className="inline-flex items-center justify-center rounded-lg border border-(--color-border-default) bg-(--color-bg-surface) px-3 py-1.5 text-[12.5px] font-semibold text-(--color-text-accent) shadow-(--shadow-sm) transition hover:border-(--color-accent-primary) hover:bg-(--color-accent-primary-dim)"
          >
            {triggerText}
          </button>
        </DropdownMenu.Trigger>
      ) : (
        <Tooltip content={triggerLabel}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={triggerLabel}
              className={cn(
                compact ? "inline-flex h-[25px] w-[25px] items-center justify-center rounded-lg text-[#9FB8A7] transition hover:bg-[#F1F8F4] hover:text-[#0D2315]" : "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--color-border-default) bg-(--color-bg-surface) text-(--color-text-secondary) shadow-(--shadow-sm) transition",
                !compact && "hover:border-(--color-accent-primary) hover:bg-(--color-accent-primary-dim) hover:text-(--color-text-accent)",
              )}
            >
              <MoreVertical className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          </DropdownMenu.Trigger>
        </Tooltip>
      )}
      <DropdownMenu.Portal forceMount={keep}>
        <DropdownMenu.Content
          forceMount={keep}
          side="bottom"
          align={align === "right" ? "end" : "start"}
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            "popover-enter z-(--z-dropdown) grid data-[state=closed]:hidden min-w-[240px] rounded-[14px] border border-(--color-border-default) bg-[color-mix(in_srgb,var(--color-bg-surface)_96%,transparent)] text-(--color-text-primary) shadow-(--shadow-lg) outline-hidden backdrop-blur-xl",
            slim
              ? "fr-rowmenu w-[209px]! min-w-[209px]! rounded-[12px]! border-[#DEE8E2]! bg-white! p-[5.5px]! shadow-[0_20px_41.5px_-18px_rgba(13,35,21,0.45)]! backdrop-blur-none! gap-0"
              : "min-w-[200px] gap-1 p-1.5",
            panelClassName,
          )}
        >
          <InsideActionMenu.Provider value={menu}>{children}</InsideActionMenu.Provider>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const itemClassName =
  "flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold outline-hidden transition-colors duration-150";

export function ActionMenuLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href as Route}
        className={cn(itemClassName, "text-(--color-text-secondary) data-highlighted:bg-(--color-accent-primary-dim) data-highlighted:text-(--color-text-accent)", className)}
      >
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

export function ActionMenuButton({
  children,
  onClick,
  destructive = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu.Item
      onSelect={() => onClick?.()}
      className={cn(
        itemClassName,
        destructive
          ? "text-danger data-highlighted:bg-(--color-danger-dim)"
          : "text-(--color-text-secondary) data-highlighted:bg-(--color-accent-primary-dim) data-highlighted:text-(--color-text-accent)",
        className,
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
