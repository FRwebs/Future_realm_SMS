import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * Real, server-driven pagination for a table whose rows already come from a paginated
 * backend endpoint (as opposed to TableCard's client-side pageSize, which only re-paginates
 * whatever single page of rows it was handed). Renders the same footer style as TableCardBody
 * so a hand-rolled table (e.g. SchoolBulkTable) looks identical to one built on TableCard.
 */
export function ServerPagination({
  baseHref,
  params,
  page,
  totalPages,
  total,
  limit,
}: {
  baseHref: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    if (targetPage > 1) query.set("page", String(targetPage));
    const qs = query.toString();
    return qs ? `${baseHref}?${qs}` : baseHref;
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);
  const buttonBase = "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-default)] px-5 py-3 sm:flex-row">
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1) as Route} className={`${buttonBase} hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]`} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${buttonBase} cursor-not-allowed opacity-40`} aria-hidden>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
          Page {page} of {totalPages}
        </p>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1) as Route} className={`${buttonBase} hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]`} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${buttonBase} cursor-not-allowed opacity-40`} aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
