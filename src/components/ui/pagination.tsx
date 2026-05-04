"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showItemCount?: boolean;
  className?: string;
};

function pageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "...", totalPages] as const;
  if (currentPage >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages] as const;
}

function PageButton({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-[12px] font-semibold transition",
        active
          ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-sm)]"
          : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-elevated)]",
        props.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  showItemCount = true,
  className,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-text-secondary)]">
        {showItemCount ? (
          <span>
            Showing <span className="font-semibold text-[var(--color-text-primary)]">{startItem}-{endItem}</span> of{" "}
            <span className="font-semibold text-[var(--color-text-primary)]">{totalItems.toLocaleString()}</span> results
          </span>
        ) : null}
        {showPageSizeSelector ? (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-9 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-[12px] font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-4 focus:ring-[var(--color-accent-primary-dim)]"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <PageButton onClick={() => onPageChange(1)} disabled={safePage === 1} aria-label="First page">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </PageButton>
        <PageButton onClick={() => onPageChange(safePage - 1)} disabled={safePage === 1} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageButton>
        {pageNumbers(safePage, totalPages).map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="w-8 text-center text-[0.8rem] text-[var(--color-text-muted)]">
              ...
            </span>
          ) : (
            <PageButton
              key={page}
              onClick={() => onPageChange(page)}
              active={safePage === page}
              aria-current={safePage === page ? "page" : undefined}
              aria-label={`Page ${page}`}
            >
              {page}
            </PageButton>
          )
        )}
        <PageButton onClick={() => onPageChange(safePage + 1)} disabled={safePage === totalPages} aria-label="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </PageButton>
        <PageButton onClick={() => onPageChange(totalPages)} disabled={safePage === totalPages} aria-label="Last page">
          <ChevronsRight className="h-3.5 w-3.5" />
        </PageButton>
      </div>
    </div>
  );
}
