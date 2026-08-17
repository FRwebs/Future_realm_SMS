"use client";

import type { Route } from "next";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

export function ActionMenu({
  children,
  align = "right",
  triggerLabel = "More actions",
  triggerText,
  panelClassName,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  triggerLabel?: string;
  /** When set, renders a labeled text button (e.g. "Manage") instead of the default icon-only trigger. */
  triggerText?: string;
  panelClassName?: string;
}) {
  return (
    <Popover
      align={align}
      panelClassName={cn("min-w-[200px] p-1.5", panelClassName)}
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
                "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] transition",
                "hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]",
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </Tooltip>
        )
      }
    >
      {() => <div className="grid gap-1">{children}</div>}
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
