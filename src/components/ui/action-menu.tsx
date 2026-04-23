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
  panelClassName,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  triggerLabel?: string;
  panelClassName?: string;
}) {
  return (
    <Popover
      align={align}
      panelClassName={cn("min-w-[190px] p-1.5", panelClassName)}
      trigger={({ toggle, open }) => (
        <Tooltip content={triggerLabel}>
          <button
            type="button"
            onClick={toggle}
            aria-label={triggerLabel}
            aria-expanded={open}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition",
              "hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700",
            )}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    >
      {() => <div className="grid gap-1">{children}</div>}
    </Popover>
  );
}

const itemClassName =
  "flex w-full items-center rounded-xl px-3 py-2 text-left text-[13px] font-medium transition";

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
      className={cn(itemClassName, "text-slate-700 hover:bg-primary-50 hover:text-primary-700", className)}
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
          ? "text-rose-700 hover:bg-rose-50"
          : "text-slate-700 hover:bg-primary-50 hover:text-primary-700",
        className,
      )}
    >
      {children}
    </button>
  );
}
