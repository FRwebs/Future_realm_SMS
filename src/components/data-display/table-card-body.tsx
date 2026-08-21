"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface PreparedColumn {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
  sortable: boolean;
}

export interface PreparedRow {
  key: string | number;
  cells: Record<string, ReactNode>;
  sortValues: Record<string, string | number | null>;
}

interface TableCardBodyProps {
  title: string;
  description: ReactNode;
  emptyState: string;
  actions?: ReactNode;
  columns: PreparedColumn[];
  rows: PreparedRow[];
  primaryColumnKey?: string;
  featuredColumnKeys: string[];
  pageSize: number | false;
}

type SortDirection = "asc" | "desc";

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function TableCardBody({
  title,
  description,
  emptyState,
  actions,
  columns,
  rows,
  primaryColumnKey,
  featuredColumnKeys,
  pageSize,
}: TableCardBodyProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const primaryColumn = columns.find((column) => column.key === primaryColumnKey) ?? columns[0];
  const featuredColumns = columns.filter((column) => featuredColumnKeys.includes(column.key));
  const secondaryColumns = columns.filter(
    (column) => column.key !== primaryColumn?.key && !featuredColumnKeys.includes(column.key),
  );

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const decorated = rows.map((row, index) => ({ row, index }));
    decorated.sort((a, b) => {
      const cmp = compareValues(a.row.sortValues[sortKey] ?? null, b.row.sortValues[sortKey] ?? null);
      if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
      return a.index - b.index;
    });
    return decorated.map((entry) => entry.row);
  }, [rows, sortKey, sortDirection]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pageRows = pageSize
    ? sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedRows;

  const rangeStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * (pageSize || sortedRows.length) + 1;
  const rangeEnd = pageSize ? Math.min(currentPage * pageSize, sortedRows.length) : sortedRows.length;

  function toggleSort(column: PreparedColumn) {
    if (!column.sortable) return;
    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDirection("asc");
    }
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="section-eyebrow">Data overview</p>
            <h3 className="mt-2 font-[var(--font-display)] text-[20px] font-bold text-[var(--color-text-primary)]">{title}</h3>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {description}
            </p>
          </div>

          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>

      <div className="p-5 md:p-6">
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
              <span className="text-lg font-bold">+</span>
            </div>
            <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">
              Nothing to display yet
            </p>
            <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">{emptyState}</p>
          </div>
        ) : (
          <>
            {/* Mobile view: stacked cards so important fields like grades are always visible */}
            <div className="grid gap-3 md:hidden">
              {pageRows.map((row) => (
                <article
                  key={row.key}
                  className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        {primaryColumn?.header ?? "Record"}
                      </p>
                      <div className="mt-1 text-[15px] font-semibold text-[var(--color-text-primary)]">
                        {primaryColumn ? row.cells[primaryColumn.key] : null}
                      </div>
                    </div>

                    {featuredColumns.length > 0 ? (
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {featuredColumns.map((column) => (
                          <div
                            key={column.key}
                            className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-accent)]"
                          >
                            {row.cells[column.key]}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {secondaryColumns.length > 0 ? (
                    <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {secondaryColumns.map((column) => (
                        <div
                          key={column.key}
                          className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2"
                        >
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                            {column.header}
                          </dt>
                          <dd className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                            {row.cells[column.key]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </article>
              ))}
            </div>

            {/* Desktop view: plain table, no inner scroll box — the page scrolls naturally */}
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <caption className="sr-only">{title}</caption>
                    <thead className="bg-[var(--color-bg-subtle)]">
                      <tr>
                        {columns.map((column) => {
                          const isActive = sortKey === column.key;

                          return (
                            <th
                              key={column.key}
                              scope="col"
                              aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                              className={[
                                "border-b border-[var(--color-border-default)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]",
                                column.headerClassName ?? "",
                              ].join(" ")}
                            >
                              {column.sortable ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSort(column)}
                                  className="inline-flex items-center gap-1 text-inherit transition hover:text-[var(--color-text-primary)]"
                                >
                                  {column.header}
                                  {isActive ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                                  )}
                                </button>
                              ) : (
                                column.header
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {pageRows.map((row) => (
                        <tr
                          key={row.key}
                          className="border-b border-[var(--color-border-muted)] bg-[var(--color-bg-surface)] text-[13px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-elevated)]"
                        >
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className={[
                                "px-4 py-3 align-top",
                                column.cellClassName ?? "",
                              ].join(" ")}
                            >
                              {row.cells[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {pageSize && totalPages > 1 ? (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  Showing {rangeStart}–{rangeEnd} of {sortedRows.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                    Page {currentPage} of {totalPages}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
