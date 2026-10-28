"use client";

import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiJson } from "@/lib/api/client";
import { rowMatches } from "@/lib/modules/table-query";
import type { TableFilter, TableRow, TableWindow } from "@/lib/modules/panels";

/**
 * The engine under the school's tables, in two forms that offer the same thing to the view:
 *
 *  - `useLocalTable` — every row is here; TanStack Table searches, filters, pages and selects them.
 *  - `useServedTable` — only one page of a longer list is here; TanStack Query fetches the page asked for (keeping the one on screen while
 *    it loads, and fetching the next in the background), and TanStack Table pages and selects what arrived.
 *
 * The view draws the same table either way and never needs to know which it is holding.
 */

/** What the table is narrowed by: the words in the search box and the choice on each filter. */
type Narrowing = { filters: TableFilter[] | undefined; needle: string; values: Record<string, string> };

/**
 * Features, row models and filter functions live at module scope because the library needs them stable between renders. A row passes the
 * global filter when it passes the same test the server applies to a long table (`rowMatches`), so short and long tables mean the same
 * thing by "matches".
 */
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

const columns: Array<ColumnDef<typeof features, TableRow>> = [{ id: "row", accessorFn: () => "" }];
const passes = (row: { original: TableRow }, _columnId: string, narrowing: Narrowing) => rowMatches(row.original, narrowing.filters, narrowing.needle, narrowing.values);

type Mode = { kind: "local"; pageSize: number } | { kind: "served"; pageIndex: number; pageSize: number; rowCount: number };

function useRowsTable(rows: TableRow[], filters: TableFilter[] | undefined, selectable: boolean, narrowing: Narrowing, mode: Mode, pageIndex: number, setPageIndex: (index: number) => void) {
  // A row is ticked by what it is, not where it sits: its place in the rows it came from, so a filter or a page turn never moves a tick
  // onto a different record.
  const ids = useMemo(() => new Map(rows.map((row, index) => [row, String(index)])), [rows]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // New rows (a refresh, another page) arrive with nothing ticked: the same index would now be a different record.
  const previous = useRef(rows);
  useEffect(() => {
    if (previous.current === rows) return;
    previous.current = rows;
    setRowSelection({});
  }, [rows]);

  const served = mode.kind === "served";
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => ids.get(row) ?? "",
    globalFilterFn: passes,
    enableRowSelection: selectable,
    manualFiltering: served,
    manualPagination: served,
    ...(mode.kind === "served" ? { rowCount: mode.rowCount } : {}),
    state: { globalFilter: served ? undefined : narrowing, pagination: { pageIndex: served ? mode.pageIndex : pageIndex, pageSize: mode.pageSize }, rowSelection },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize: mode.pageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    onRowSelectionChange: setRowSelection,
    autoResetPageIndex: false,
  });

  const pageRows = table.getRowModel().rows;
  const visible = useMemo(() => pageRows.map((row) => row.original), [pageRows]);
  const filteredRows = served ? rows : table.getFilteredRowModel().rows.map((row) => row.original);
  const selectedRows = rows.filter((row) => rowSelection[ids.get(row) ?? ""]);
  const allVisibleSelected = visible.length > 0 && table.getIsAllPageRowsSelected();

  return {
    visible,
    filteredRows,
    shownTotal: served ? mode.rowCount : filteredRows.length,
    isSelected: (row: TableRow) => Boolean(rowSelection[ids.get(row) ?? ""]),
    toggleRow: (row: TableRow) =>
      setRowSelection((current) => {
        const id = ids.get(row) ?? "";
        const { [id]: was, ...rest } = current;
        return was ? rest : { ...rest, [id]: true };
      }),
    toggleAllVisible: () => table.toggleAllPageRowsSelected(!allVisibleSelected),
    allVisibleSelected,
    selectedRows,
    clearSelection: () => setRowSelection({}),
    pageCount: table.getPageCount(),
    perPage: mode.pageSize,
    filters,
  };
}

export type TableEngine = ReturnType<typeof useRowsTable> & {
  query: string;
  setQuery: (text: string) => void;
  filterValues: Record<string, string>;
  setFilter: (filter: TableFilter, value: string) => void;
  /** Where the table now is (0-based). */
  pageIndex: number;
  turnTo: (index: number) => void;
  /** Rows are being fetched for a new search, filter or page; the old ones stay on screen meanwhile. */
  busy: boolean;
  failure: string | null;
  retry: () => void;
  /** Every row the table was handed (for the rows a bulk action or an export needs by name). */
  all: TableRow[];
  /** The total behind the filters, for "3 of 40". */
  everyRow: number;
  /** Every row that passes what is searched and chosen, as a file — the server's to give on a long list. */
  exportUrl?: string;
};

/** A table whose rows are all here. */
export function useLocalTable(rows: TableRow[], filters: TableFilter[] | undefined, per: number | undefined, selectable: boolean): TableEngine {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => Object.fromEntries((filters ?? []).map((filter) => [filter.label, filter.value])));
  const [pageIndex, setPageIndex] = useState(0);
  const narrowing = useMemo<Narrowing>(() => ({ filters, needle: query, values: filterValues }), [filters, query, filterValues]);
  // Any list long enough to need it is paged, without each page asking for it; `per: 0` is "show every row".
  const pageSize = per === 0 ? Math.max(rows.length, 1) : per ?? 12;
  const table = useRowsTable(rows, filters, selectable, narrowing, { kind: "local", pageSize }, pageIndex, setPageIndex);
  const pageCount = Math.max(1, table.pageCount);

  return {
    ...table,
    pageCount,
    pageIndex: Math.min(pageIndex, pageCount - 1),
    query,
    setQuery: (text) => {
      setQuery(text);
      setPageIndex(0);
    },
    filterValues,
    setFilter: (filter, value) => {
      setFilterValues((current) => ({ ...current, [filter.label]: value }));
      setPageIndex(0);
    },
    turnTo: setPageIndex,
    busy: false,
    failure: null,
    retry: () => undefined,
    all: rows,
    everyRow: rows.length,
  };
}

type Asked = { q: string; page: number; values: Record<string, string> };
type Answer = { rows: TableRow[]; window: TableWindow };

/** The address this table's wanted page is read from: the page's own query, with this table's search, filters and page laid over it. */
function addressFor(win: TableWindow, filters: TableFilter[], asked: Asked) {
  const url = new URL(win.pageUrl, "http://local");
  const base = url.searchParams.get("q") ? (JSON.parse(url.searchParams.get("q") as string) as Record<string, string>) : {};
  const next: Record<string, string> = { ...base };
  for (const name of Object.keys(next)) if (name.startsWith(`${win.key}_`)) delete next[name];
  if (asked.q.trim()) next[`${win.key}_q`] = asked.q.trim();
  if (asked.page > 1) next[`${win.key}_p`] = String(asked.page);
  filters.forEach((filter, index) => {
    const chosen = asked.values[filter.label];
    if (chosen !== undefined && chosen !== filter.value) next[`${win.key}_f${index}`] = chosen;
  });
  if (Object.keys(next).length) url.searchParams.set("q", JSON.stringify(next));
  else url.searchParams.delete("q");
  return { path: `${url.pathname}${url.search}`, query: next };
}

/** Writes the table's search, filters and page into the address bar — as `?t0_1_q=…`, as ever — without redrawing the page. */
function writeAddress(win: TableWindow, query: Record<string, string>) {
  const next = new URLSearchParams(window.location.search);
  for (const name of [...next.keys()]) if (name.startsWith(`${win.key}_`)) next.delete(name);
  for (const [name, value] of Object.entries(query)) if (name.startsWith(`${win.key}_`)) next.set(name, value);
  const search = next.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
}

/** A table that is one page of a longer list: the next page is fetched, not drawn again with the whole page. */
export function useServedTable(win: TableWindow, rows: TableRow[], filters: TableFilter[] | undefined, selectable: boolean): TableEngine {
  const client = useQueryClient();
  const list = useMemo(() => filters ?? [], [filters]);
  const server = useMemo<Asked>(() => ({ q: win.q, page: win.page, values: win.filters }), [win]);
  const [asked, setAsked] = useState<Asked>(server);
  const [typed, setTyped] = useState(win.q);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (typing.current) clearTimeout(typing.current); }, []);

  const where = addressFor(win, list, asked);
  const sameAsServer = asked.q === server.q && asked.page === server.page && list.every((filter) => (asked.values[filter.label] ?? filter.value) === (server.values[filter.label] ?? filter.value));
  const key = useMemo(() => ["table-window", addressFor(win, list, { q: "", page: 1, values: {} }).path.split("&q=")[0], where.path] as const, [win, list, where.path]);

  const result = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiJson<Answer>(where.path, signal),
    // The first view is the one the server drew into the page, so nothing is fetched to show it.
    ...(sameAsServer ? { initialData: { rows, window: win } satisfies Answer } : {}),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // The page was drawn again by the server (a save, a refresh): what it sent is the truth, and any other page held is now out of date.
  const drawn = useRef(win);
  useEffect(() => {
    if (drawn.current === win) return;
    drawn.current = win;
    client.removeQueries({ queryKey: ["table-window", key[1]] });
    client.setQueryData(["table-window", key[1], addressFor(win, list, { q: win.q, page: win.page, values: win.filters }).path], { rows, window: win } satisfies Answer);
    setAsked({ q: win.q, page: win.page, values: win.filters });
    setTyped(win.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, rows]);

  const answer = result.data ?? { rows, window: win };
  const pages = Math.max(1, Math.ceil(answer.window.matched / answer.window.size));
  // The page after this one is fetched while it is read, so turning to it is immediate.
  useEffect(() => {
    if (asked.page >= pages) return;
    const ahead = addressFor(win, list, { ...asked, page: asked.page + 1 });
    void client.prefetchQuery({ queryKey: ["table-window", key[1], ahead.path], queryFn: ({ signal }) => apiJson<Answer>(ahead.path, signal), staleTime: 30_000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, pages]);

  const ask = useCallback(
    (next: Asked) => {
      setAsked(next);
      writeAddress(win, addressFor(win, list, next).query);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [win, filters],
  );

  const table = useRowsTable(answer.rows, filters, selectable, { filters, needle: "", values: {} }, { kind: "served", pageIndex: asked.page - 1, pageSize: answer.window.size, rowCount: answer.window.matched }, asked.page - 1, () => undefined);

  return {
    ...table,
    pageCount: pages,
    pageIndex: asked.page - 1,
    query: typed,
    setQuery: (text) => {
      setTyped(text);
      if (typing.current) clearTimeout(typing.current);
      // Typing waits for a pause; clearing the box does not.
      if (!text.trim()) ask({ ...asked, q: "", page: 1 });
      else typing.current = setTimeout(() => ask({ ...asked, q: text.trim(), page: 1 }), 350);
    },
    filterValues: Object.fromEntries(list.map((filter) => [filter.label, asked.values[filter.label] ?? filter.value])),
    setFilter: (filter, value) => ask({ ...asked, values: { ...asked.values, [filter.label]: value }, page: 1 }),
    turnTo: (index) => ask({ ...asked, page: index + 1 }),
    busy: result.isFetching && result.isPlaceholderData,
    failure: result.isError ? (result.error instanceof Error ? result.error.message : "That page could not be loaded.") : null,
    retry: () => void result.refetch(),
    all: answer.rows,
    everyRow: answer.window.total,
    exportUrl: answer.window.exportUrl,
  };
}
