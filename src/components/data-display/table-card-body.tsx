"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";

import { usePortalType } from "@/components/layout/portal-context";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";

import { BackOfficeTable } from "./back-office-table";

export interface PreparedColumn {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
  sortable: boolean;
}

/** An action offered once rows are ticked. Serialisable, so a server page can describe it. */
export interface SelectionAction {
  label: string;
  kind?: "primary" | "normal";
  /** Where the ticked row keys go. A download action opens it as a GET with the keys in the query. */
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE" | "DOWNLOAD";
  /** The body (or query) field that carries the ticked keys. */
  idsField: string;
  extra?: Record<string, unknown>;
  confirm?: string;
  /** Something to choose before this action can run — who the tickets go to, which priority. Sent in the body under `field`. */
  choice?: { field: string; label: string; options: Array<{ label: string; value: string }> };
}

export interface SelectionConfig {
  noun: string;
  nounPlural: string;
  actions: SelectionAction[];
}

function getCookie(name: string) {
  return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.split("=")[1];
}

export interface PreparedRow {
  key: string | number;
  cells: Record<string, ReactNode>;
  sortValues: Record<string, string | number | null>;
}

interface TableCardBodyProps {
  title: string;
  description?: ReactNode;
  /** Who may change it, or a count — small text to the right of the actions. */
  meta?: ReactNode;
  emptyState: string;
  actions?: ReactNode;
  /** Optional filter/search toolbar rendered between the header and the table body. */
  filterBar?: ReactNode;
  /** Optional muted note rendered in its own strip below the table, e.g. a source/ownership caveat. */
  footnote?: ReactNode;
  columns: PreparedColumn[];
  rows: PreparedRow[];
  primaryColumnKey?: string;
  featuredColumnKeys: string[];
  pageSize: number | false;
  selection?: SelectionConfig;
}

type SortDirection = "asc" | "desc";

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function columnStorageKey(title: string) {
  return `sms:table-columns:${title}`;
}

function StandardTableCardBody({
  title,
  description,
  emptyState,
  actions,
  filterBar,
  footnote,
  columns: allColumns,
  rows,
  primaryColumnKey,
  featuredColumnKeys,
  pageSize,
  selection,
}: TableCardBodyProps) {
  const router = useRouter();
  // What a bulk action did, said above the rows it acted on — and kept after the selection it came from has cleared.
  const bulk = useNotice();
  const [picked, setPicked] = useState<Array<string | number>>([]);
  const [acting, setActing] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    setPage(1);
    setPicked([]);
  }, [rows]);

  async function runSelection(action: SelectionAction) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    const ids = picked.map(String);
    if (action.method === "DOWNLOAD") {
      window.location.href = `${action.endpoint}${action.endpoint.includes("?") ? "&" : "?"}${action.idsField}=${encodeURIComponent(ids.join(","))}`;
      return;
    }
    setActing(true);
    try {
      const response = await fetch(action.endpoint, { method: action.method ?? "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" }, body: JSON.stringify({ ...(action.extra ?? {}), ...(action.choice ? { [action.choice.field]: choices[action.label] } : {}), [action.idsField]: ids }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "That did not go through.");
      bulk.success(action.label, body.message ?? `Done for ${ids.length} ${ids.length === 1 ? selection?.noun : selection?.nounPlural}.`);
      setPicked([]);
      router.refresh();
    } catch (error) {
      bulk.error(`${action.label} did not go through`, error instanceof Error ? error.message : "Please try again.");
    } finally {
      setActing(false);
    }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(columnStorageKey(title));
      if (stored) setHiddenKeys(JSON.parse(stored));
    } catch {
      // Ignore malformed/blocked storage — falls back to showing every column.
    }
  }, [title]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(event.target as Node)) {
        setColumnsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnsMenuOpen]);

  function toggleColumnVisibility(key: string) {
    setHiddenKeys((current) => {
      const isHidden = current.includes(key);
      // Never allow hiding every column — always leave at least one visible.
      if (!isHidden && allColumns.length - current.length <= 1) return current;
      const next = isHidden ? current.filter((item) => item !== key) : [...current, key];
      try {
        window.localStorage.setItem(columnStorageKey(title), JSON.stringify(next));
      } catch {
        // Best-effort persistence only.
      }
      return next;
    });
  }

  const columns = allColumns.filter((column) => !hiddenKeys.includes(column.key));

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
      <div className="border-b border-[var(--color-border-default)] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-[var(--font-display)] text-[16px] font-bold text-[var(--color-text-primary)]">{title}</h3>
            {description ? (
              <p className="mt-1 max-w-3xl text-[12.5px] leading-5 text-[var(--color-text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div ref={columnsMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setColumnsMenuOpen((open) => !open)}
                className="inline-flex items-center gap-[7px] rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[13px] py-[9px] text-[12.5px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)]"
                aria-haspopup="true"
                aria-expanded={columnsMenuOpen}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
              {columnsMenuOpen ? (
                <div className="popover-enter absolute right-0 top-[calc(100%+6px)] z-20 w-52 rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2 shadow-[var(--shadow-md)]">
                  <p className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    Show columns
                  </p>
                  {allColumns.map((column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)]"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenKeys.includes(column.key)}
                        onChange={() => toggleColumnVisibility(column.key)}
                        className="h-3.5 w-3.5 rounded border-[var(--color-border-default)] accent-[var(--color-accent-primary)]"
                      />
                      {column.header || "(unlabeled)"}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            {actions}
          </div>
        </div>
      </div>

      {filterBar}

      <div className="px-3 pt-3 empty:hidden"><InlineNotice notice={bulk.notice} onDismiss={bulk.clear} /></div>
      {selection && picked.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E6EEE9] bg-[#0D2315] px-5 py-3 text-[12px] text-white">
          <span className="mr-2 font-semibold">{picked.length} {picked.length === 1 ? selection.noun : selection.nounPlural} selected</span>
          {selection.actions.map((action) => (
            <span key={action.label} className="inline-flex items-center gap-1.5">
              {action.choice ? (
                <select aria-label={action.choice.label} value={choices[action.label] ?? ""} onChange={(event) => setChoices((current) => ({ ...current, [action.label]: event.target.value }))} className="rounded-full border border-white/30 bg-[#0D2315] px-3 py-1.5 text-[11.5px] font-semibold text-white">
                  <option value="">{action.choice.label}</option>
                  {action.choice.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : null}
            <button type="button" disabled={acting || Boolean(action.choice && !choices[action.label])} onClick={() => void runSelection(action)} className={action.kind === "primary" ? "rounded-full bg-white px-3.5 py-1.5 font-semibold text-[#0D2315] disabled:opacity-60" : "rounded-full border border-white/30 px-3.5 py-1.5 font-semibold text-white disabled:opacity-60"}>
              {action.label}
            </button>
            </span>
          ))}
          <button type="button" onClick={() => setPicked([])} className="ml-auto text-[11.5px] text-white/70 underline">Clear</button>
        </div>
      ) : null}

      <div>
        {rows.length === 0 ? (
          <div className="empty-state m-5">
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
            <div className="grid gap-3 p-5 md:hidden">
              {pageRows.map((row) => (
                <article
                  key={row.key}
                  className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]"
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
              <div className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
                    <caption className="sr-only">{title}</caption>
                    <thead className="bg-[#F7FAF8]">
                      <tr>
                        {selection ? (
                          <th scope="col" className="w-10 border-b border-[#E6EEE9] px-5 py-[11px]">
                            <input type="checkbox" aria-label="Select every row on this page" checked={pageRows.length > 0 && pageRows.every((row) => picked.includes(row.key))} onChange={(event) => setPicked((current) => (event.target.checked ? Array.from(new Set([...current, ...pageRows.map((row) => row.key)])) : current.filter((key) => !pageRows.some((row) => row.key === key))))} className="h-3.5 w-3.5 accent-[var(--color-accent-primary)]" />
                          </th>
                        ) : null}
                        {columns.map((column) => {
                          const isActive = sortKey === column.key;

                          return (
                            <th
                              key={column.key}
                              scope="col"
                              aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                              className={[
                                "border-b border-[#E6EEE9] px-5 py-[11px] text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#5f6e65]",
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
                          className="bg-[var(--color-bg-surface)] text-[12.5px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-elevated)]"
                        >
                          {selection ? (
                            <td className="w-10 border-b border-[#F2F7F4] px-5 py-[13px] align-top">
                              <input type="checkbox" aria-label="Select this row" checked={picked.includes(row.key)} onChange={(event) => setPicked((current) => (event.target.checked ? [...current, row.key] : current.filter((key) => key !== row.key)))} className="h-3.5 w-3.5 accent-[var(--color-accent-primary)]" />
                            </td>
                          ) : null}
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className={[
                                "border-b border-[#F2F7F4] px-5 py-[13px] align-top",
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
              <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 border-t border-[var(--color-border-default)] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <p className="min-w-0 text-center text-[12px] text-[var(--color-text-muted)] sm:text-left">
                  Showing {rangeStart}–{rangeEnd} of {sortedRows.length}
                </p>
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage <= 1}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="min-w-0 text-center text-[12px] font-semibold text-[var(--color-text-primary)] sm:whitespace-nowrap">
                    Page {currentPage} of {totalPages}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
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

      {footnote ? <div className="border-t border-[#EDF3EF] bg-[#F7FAF8] px-5 py-3 text-[11.5px] text-[#5f6e65]">{footnote}</div> : null}
    </section>
  );
}

/** The Back Office draws its tables the mockup's way; every other portal keeps the standard one. */
export function TableCardBody(props: TableCardBodyProps) {
  const portal = usePortalType();
  if (portal === "super_admin") {
    return <BackOfficeTable title={props.title} description={props.description} meta={props.meta} emptyState={props.emptyState} actions={props.actions} filterBar={props.filterBar} footnote={props.footnote} columns={props.columns} rows={props.rows} pageSize={props.pageSize} selection={props.selection} />;
  }
  return <StandardTableCardBody {...props} />;
}
