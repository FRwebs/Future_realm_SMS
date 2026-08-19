"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

export function FinancePageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="finance-page-header">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="finance-eyebrow">{eyebrow}</p>
          <h1 className="finance-title mt-4">{title}</h1>
          <p className="finance-subtitle mt-4">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function FinancePanel({
  className,
  children,
  elevated = false,
}: {
  className?: string;
  children: React.ReactNode;
  elevated?: boolean;
}) {
  return <section className={cn(elevated ? "finance-panel-elevated" : "finance-panel", className)}>{children}</section>;
}

export function FinanceStatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.toUpperCase();
  const tone =
    normalized.includes("PAID") || normalized.includes("SUCCESS") || normalized.includes("ACTIVE")
      ? "success"
      : normalized.includes("OVERDUE") || normalized.includes("PENDING") || normalized.includes("PARTIAL")
        ? "warning"
        : normalized.includes("REVERSE") || normalized.includes("FAILED") || normalized.includes("VOID")
          ? "danger"
          : "neutral";

  const className =
    tone === "success"
      ? "bg-emerald-500/14 text-emerald-300"
      : tone === "warning"
        ? "bg-amber-500/14 text-amber-300"
        : tone === "danger"
          ? "bg-rose-500/14 text-rose-300"
          : "text-[var(--finance-neutral-badge-fg)]";

  return <span className={cn("finance-status-badge", tone === "neutral" && "finance-soft-surface", className)}>{status.replaceAll("_", " ")}</span>;
}

export function FinanceStatCard({
  icon,
  label,
  value,
  delta,
  accent = "teal",
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delta?: { value: string; trend: "up" | "down" | "neutral" };
  accent?: "teal" | "amber" | "rose" | "slate";
  helper?: string;
}) {
  const iconClass =
    accent === "teal"
      ? "bg-[#12796a]/16 text-[#4fa895]"
      : accent === "amber"
        ? "bg-amber-500/16 text-amber-300"
        : accent === "rose"
          ? "bg-rose-500/16 text-rose-300"
          : "finance-icon-surface";

  const barClass =
    accent === "teal"
      ? "from-[#4fa895] to-[#12796a]"
      : accent === "amber"
        ? "from-amber-400 to-orange-400"
        : accent === "rose"
          ? "from-rose-400 to-pink-400"
          : "from-slate-400 to-slate-500";

  return (
    <article className="finance-kpi-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("grid h-11 w-11 place-items-center rounded-2xl", iconClass)}>{icon}</div>
        {delta ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              delta.trend === "up"
                ? "bg-emerald-500/12 text-emerald-300"
                : delta.trend === "down"
                  ? "bg-rose-500/12 text-rose-300"
                  : "finance-soft-surface text-[var(--finance-text-secondary)]",
            )}
          >
            {delta.value}
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--finance-text-secondary)]">
        {label}
      </p>
      <div className="mt-2">
        {typeof value === "number" ? (
          <AnimatedMetric value={value} />
        ) : (
          <p className="finance-mono text-[32px] font-bold leading-none text-[var(--finance-text-primary)]">{value}</p>
        )}
      </div>
      {helper ? <p className="mt-3 text-xs text-[var(--finance-text-secondary)]">{helper}</p> : null}
      <div className={cn("mt-5 h-1 rounded-full bg-gradient-to-r", barClass)} />
    </article>
  );
}

function AnimatedMetric({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <p className="finance-mono text-[32px] font-bold leading-none text-[var(--finance-text-primary)]">{display.toLocaleString("en-NG", { maximumFractionDigits: 0 })}</p>;
}

export type FinanceColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
};

export function FinanceDataTable<T>({
  rows,
  columns,
  page,
  pageSize,
  onPageChange,
  totalLabel,
  rowKey,
  rowActions,
  emptyState,
  stickyFirstColumn = false,
}: {
  rows: T[];
  columns: FinanceColumn<T>[];
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  totalLabel?: string;
  rowKey: (row: T, index: number) => string;
  rowActions?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  stickyFirstColumn?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [rows, safePage, pageSize]);

  return (
    <div className="finance-soft-surface overflow-hidden rounded-[16px]">
      <div className="finance-table-scroll max-h-[640px] overflow-auto">
        <table className="finance-table min-w-full">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    column.align === "right" && "text-right",
                    stickyFirstColumn && index === 0 && "finance-table-sticky-cell sticky left-0 z-[2]",
                  )}
                >
                  {column.header}
                </th>
              ))}
              {rowActions ? <th className="text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, index) => (
              <tr key={rowKey(row, index)}>
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={cn(
                      column.className,
                      column.align === "right" && "text-right",
                      stickyFirstColumn &&
                        columnIndex === 0 &&
                        "finance-table-sticky-cell sticky left-0 z-[1]",
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {rowActions ? <td className="text-right">{rowActions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagedRows.length === 0 && emptyState ? <div className="p-8">{emptyState}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--finance-border)] px-4 py-3 text-sm text-[var(--finance-text-secondary)]">
        <p>{totalLabel ?? `${rows.length} records`}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="finance-btn-secondary min-h-[40px] px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <span className="rounded-full border border-[var(--finance-border)] px-3 py-2 text-xs">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="finance-btn-secondary min-h-[40px] px-3"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function FinanceEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-[16px] border border-dashed border-[var(--finance-border)] bg-[var(--finance-surface-soft)] px-6 py-14 text-center">
      <div className="finance-shimmer h-12 w-12 rounded-2xl" />
      <h3 className="mt-5 font-[var(--font-finance-heading)] text-xl font-bold text-[var(--finance-text-primary)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-[var(--finance-text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function FinanceDrawer({
  open,
  onClose,
  title,
  subtitle,
  width = "480px",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handle);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[180]">
      <button type="button" aria-label="Close drawer backdrop" onClick={onClose} className="finance-drawer-backdrop absolute inset-0" />
      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <section
          role="dialog"
          aria-modal="true"
          className="finance-drawer-panel panel-enter-right flex h-full w-full max-w-full flex-col"
          style={{ width }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--finance-border)] px-5 py-5">
            <div className="min-w-0">
              <h2 className="font-[var(--font-finance-heading)] text-[24px] font-bold text-[var(--finance-text-primary)]">{title}</h2>
              {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--finance-text-secondary)]">{subtitle}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="finance-icon-btn" aria-label="Close drawer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="finance-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="border-t border-[var(--finance-border)] px-5 py-4">{footer}</div> : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}
