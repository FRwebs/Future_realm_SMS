"use client";

import type { Route } from "next";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { usePortalType } from "@/components/layout/portal-context";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

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
  return (
    <Popover
      align={align}
      panelClassName={cn(
        compact && !triggerText
          ? "fr-rowmenu !w-[209px] !min-w-[209px] !rounded-[12px] !border-[#DEE8E2] !bg-white !p-[5.5px] !shadow-[0_20px_41.5px_-18px_rgba(13,35,21,0.45)] !backdrop-blur-none"
          : "min-w-[200px] p-1.5",
        panelClassName
      )}
      trigger={({ toggle, open }) =>
        triggerText ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={triggerLabel}
            aria-expanded={open}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-text-accent)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)]"
          >
            {triggerText}
          </button>
        ) : (
          <Tooltip content={triggerLabel}>
            <button
              type="button"
              onClick={toggle}
              aria-label={triggerLabel}
              aria-expanded={open}
              className={cn(
                compact ? "inline-flex h-[25px] w-[25px] items-center justify-center rounded-lg text-[#9FB8A7] transition hover:bg-[#F1F8F4] hover:text-[#0D2315]" : "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] transition",
                !compact && "hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]",
              )}
            >
              <MoreVertical className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          </Tooltip>
        )
      }
    >
      {() => <div className={compact && !triggerText ? "grid gap-0" : "grid gap-1"}>{children}</div>}
    </Popover>
  );
}

const itemClassName =
  "flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold transition-colors duration-150";

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
    <Link
      href={href as Route}
      data-popover-close="true"
      className={cn(itemClassName, "text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]", className)}
    >
      {children}
    </Link>
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
    <button
      type="button"
      data-popover-close="true"
      onClick={onClick}
      className={cn(
        itemClassName,
        destructive
          ? "text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
