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
        "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[0.8rem] font-medium transition",
        active ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
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
    <div className={cn("flex flex-col items-center justify-between gap-3 py-3 sm:flex-row", className)}>
      <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-slate-500">
        {showItemCount ? (
          <span>
            Showing <span className="font-medium text-slate-700">{startItem}-{endItem}</span> of{" "}
            <span className="font-medium text-slate-700">{totalItems.toLocaleString()}</span> results
          </span>
        ) : null}
        {showPageSizeSelector ? (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[0.78rem] font-medium text-slate-700 outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-slate-100"
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
            <span key={`ellipsis-${index}`} className="w-8 text-center text-[0.8rem] text-slate-400">
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
