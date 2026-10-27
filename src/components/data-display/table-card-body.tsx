"use client";

import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";

import { usePortalType } from "@/components/layout/portal-context";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { useTableUrlState } from "@/hooks/use-table-url-state";

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

/**
 * Sorting, column visibility, paging and row selection are TanStack Table's (headless — the markup below is still ours). The features are
 * module-level because the library needs them stable between renders.
 */
const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

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
  const [acting, setActing] = useState(false);
  // The column sorted and the page live in the address (see `useTableUrlState`): a refresh or a shared link shows the same view.
  const url = useTableUrlState(title);
  const [sortId, sortDir] = url.sort.split(":");
  const sorting: SortingState = sortId && allColumns.some((column) => column.key === sortId && column.sortable) ? [{ id: sortId, desc: sortDir === "desc" }] : [];
  const pageIndex = Math.max(0, url.page - 1);
  const setPageIndex = (updater: number | ((current: number) => number)) => {
    const next = typeof updater === "function" ? updater(pageIndex) : updater;
    void url.setPage(next + 1);
  };
  const setSorting = (updater: SortingState | ((current: SortingState) => SortingState)) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    void url.setSort(next[0] ? `${next[0].id}:${next[0].desc ? "desc" : "asc"}` : "");
  };
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [choices, setChoices] = useState<Record<string, string>>({});

  // Each column sorts by the value the page prepared for it — numbers as numbers, words as words — with nothing last.
  const tableColumns = useMemo(
    (): Array<ColumnDef<typeof features, PreparedRow>> =>
      allColumns.map((column) => ({
        id: column.key,
        accessorFn: (row: PreparedRow) => row.sortValues[column.key] ?? null,
        enableSorting: column.sortable,
        sortFn: (a, b, columnId) => compareValues(a.getValue(columnId) as string | number | null, b.getValue(columnId) as string | number | null),
      })),
    [allColumns],
  );
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => String(row.key),
    enableRowSelection: Boolean(selection),
    state: { sorting, columnVisibility, rowSelection, pagination: { pageIndex, pageSize: pageSize || Math.max(rows.length, 1) } },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => setPageIndex((current) => (typeof updater === "function" ? updater({ pageIndex: current, pageSize: pageSize || Math.max(rows.length, 1) }) : updater).pageIndex),
    autoResetPageIndex: false,
  });

  const previousRows = useRef(rows);
  useEffect(() => {
    if (previousRows.current === rows) return;
    previousRows.current = rows;
    void url.setPage(1);
    setRowSelection({});
  }, [rows, url]);

  const picked = Object.keys(rowSelection).filter((id) => rowSelection[id]);
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
      table.resetRowSelection(true);
      router.refresh();
    } catch (error) {
      bulk.error(`${action.label} did not go through`, error instanceof Error ? error.message : "Please try again.");
    } finally {
      setActing(false);
    }
  }

  // Which columns a person hid is remembered on this device, per table.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(columnStorageKey(title));
      if (stored) setColumnVisibility(Object.fromEntries((JSON.parse(stored) as string[]).map((key) => [key, false])));
    } catch {
      // Ignore malformed/blocked storage — falls back to showing every column.
    }
  }, [title]);

  function toggleColumnVisibility(key: string) {
    setColumnVisibility((current) => {
      const hidden = allColumns.filter((column) => current[column.key] === false).map((column) => column.key);
      const isHidden = hidden.includes(key);
      // Never allow hiding every column — always leave at least one visible.
      if (!isHidden && allColumns.length - hidden.length <= 1) return current;
      const next = { ...current, [key]: isHidden };
      try {
        window.localStorage.setItem(columnStorageKey(title), JSON.stringify(allColumns.filter((column) => next[column.key] === false).map((column) => column.key)));
      } catch {
        // Best-effort persistence only.
      }
      return next;
    });
  }

  const columns = allColumns.filter((column) => columnVisibility[column.key] !== false);

  const primaryColumn = columns.find((column) => column.key === primaryColumnKey) ?? columns[0];
  const featuredColumns = columns.filter((column) => featuredColumnKeys.includes(column.key));
  const secondaryColumns = columns.filter(
    (column) => column.key !== primaryColumn?.key && !featuredColumnKeys.includes(column.key),
  );

  const tableRows = table.getRowModel().rows;
  const pageRows = tableRows.map((tableRow) => tableRow.original);
  const total = rows.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(pageIndex + 1, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * (pageSize || total) + 1;
  const rangeEnd = pageSize ? Math.min(currentPage * pageSize, total) : total;
  const sortKey = sorting[0]?.id ?? null;
  const sortDirection = sorting[0]?.desc ? "desc" : "asc";

  /** A click sorts ascending, the next descending, and so on — it never switches sorting off. */
  function toggleSort(column: PreparedColumn) {
    if (!column.sortable) return;
    setSorting((current) => (current[0]?.id === column.key ? [{ id: column.key, desc: !current[0].desc }] : [{ id: column.key, desc: false }]));
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-(--color-border-default) px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-(--font-display) text-[16px] font-bold text-(--color-text-primary)">{title}</h3>
            {description ? (
              <p className="mt-1 max-w-3xl text-[12.5px] leading-5 text-(--color-text-secondary)">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-[7px] rounded-[10px] border border-(--color-border-default) bg-(--color-bg-surface) px-[13px] py-[9px] text-[12.5px] font-semibold text-(--color-text-secondary) transition hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} className="popover-enter z-(--z-dropdown) w-52 rounded-[12px] border border-(--color-border-default) bg-(--color-bg-surface) p-2 shadow-(--shadow-md) outline-hidden">
                  <DropdownMenu.Label className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-(--color-text-muted)">Show columns</DropdownMenu.Label>
                  {allColumns.map((column) => (
                    <DropdownMenu.CheckboxItem
                      key={column.key}
                      checked={columnVisibility[column.key] !== false}
                      // Keep the menu open so several columns can be switched in one go.
                      onSelect={(event) => { event.preventDefault(); toggleColumnVisibility(column.key); }}
                      className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] text-(--color-text-primary) outline-hidden data-highlighted:bg-(--color-bg-subtle)"
                    >
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-(--color-border-default)">
                        <DropdownMenu.ItemIndicator><Check className="h-3 w-3" /></DropdownMenu.ItemIndicator>
                      </span>
                      {column.header || "(unlabeled)"}
                    </DropdownMenu.CheckboxItem>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
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
          <button type="button" onClick={() => table.resetRowSelection(true)} className="ml-auto text-[11.5px] text-white/70 underline">Clear</button>
        </div>
      ) : null}

      <div>
        {rows.length === 0 ? (
          <div className="empty-state m-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-accent-primary-dim) text-(--color-text-accent)">
              <span className="text-lg font-bold">+</span>
            </div>
            <p className="mt-4 text-[15px] font-semibold text-(--color-text-primary)">
              Nothing to display yet
            </p>
            <p className="mt-1 max-w-md text-[13px] text-(--color-text-secondary)">{emptyState}</p>
          </div>
        ) : (
          <>
            {/* Mobile view: stacked cards so important fields like grades are always visible */}
            <div className="grid gap-3 p-5 md:hidden">
              {pageRows.map((row) => (
                <article
                  key={row.key}
                  className="rounded-[12px] border border-(--color-border-default) bg-(--color-bg-surface) p-4 shadow-(--shadow-sm) transition hover:border-(--color-border-strong) hover:shadow-(--shadow-md)"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--color-text-muted)">
                        {primaryColumn?.header ?? "Record"}
                      </p>
                      <div className="mt-1 text-[15px] font-semibold text-(--color-text-primary)">
                        {primaryColumn ? row.cells[primaryColumn.key] : null}
                      </div>
                    </div>

                    {featuredColumns.length > 0 ? (
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {featuredColumns.map((column) => (
                          <div
                            key={column.key}
                            className="rounded-full bg-(--color-accent-primary-dim) px-3 py-1 text-[12px] font-semibold text-(--color-text-accent)"
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
                          className="rounded-xl bg-(--color-bg-subtle) px-3 py-2"
                        >
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--color-text-muted)">
                            {column.header}
                          </dt>
                          <dd className="mt-1 text-[13px] text-(--color-text-secondary)">
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
                            <input type="checkbox" aria-label="Select every row on this page" checked={tableRows.length > 0 && table.getIsAllPageRowsSelected()} onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)} className="h-3.5 w-3.5 accent-(--color-accent-primary)" />
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
                                "border-b border-[#E6EEE9] px-5 py-[11px] text-left text-[10.5px] font-semibold uppercase tracking-wider text-[#5f6e65]",
                                column.headerClassName ?? "",
                              ].join(" ")}
                            >
                              {column.sortable ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSort(column)}
                                  className="inline-flex items-center gap-1 text-inherit transition hover:text-(--color-text-primary)"
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
                      {tableRows.map((tableRow) => {
                        const row = tableRow.original;
                        return (
                        <tr
                          key={tableRow.id}
                          className="bg-(--color-bg-surface) text-[12.5px] text-(--color-text-secondary) transition hover:bg-(--color-bg-elevated)"
                        >
                          {selection ? (
                            <td className="w-10 border-b border-[#F2F7F4] px-5 py-[13px] align-top">
                              <input type="checkbox" aria-label="Select this row" checked={tableRow.getIsSelected()} onChange={(event) => tableRow.toggleSelected(event.target.checked)} className="h-3.5 w-3.5 accent-(--color-accent-primary)" />
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {pageSize && totalPages > 1 ? (
              <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 border-t border-(--color-border-default) px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <p className="min-w-0 text-center text-[12px] text-(--color-text-muted) sm:text-left">
                  Showing {rangeStart}–{rangeEnd} of {total}
                </p>
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => table.previousPage()}
                    disabled={currentPage <= 1}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--color-border-default) text-(--color-text-secondary) transition hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="min-w-0 text-center text-[12px] font-semibold text-(--color-text-primary) sm:whitespace-nowrap">
                    Page {currentPage} of {totalPages}
                  </p>
                  <button
                    type="button"
                    onClick={() => table.nextPage()}
                    disabled={currentPage >= totalPages}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--color-border-default) text-(--color-text-secondary) transition hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-40"
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
