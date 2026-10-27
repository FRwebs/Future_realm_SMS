"use client";

import { useRouter } from "next/navigation";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { useTableUrlState } from "@/hooks/use-table-url-state";

import type { PreparedColumn, PreparedRow, SelectionAction, SelectionConfig } from "./table-card-body";

/**
 * The Back Office table, drawn the way the mockup draws it: a head with the title, a line of context and the actions; an optional
 * toolbar; a header row in small capitals; rows with generous padding and a hairline between them; a pager that numbers the pages;
 * and a footnote strip. Nothing in it sorts, hides columns or shows a big empty-state icon — the mockup has none of those.
 */

type Props = {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  emptyState: string;
  actions?: ReactNode;
  filterBar?: ReactNode;
  footnote?: ReactNode;
  columns: PreparedColumn[];
  rows: PreparedRow[];
  pageSize: number | false;
  selection?: SelectionConfig;
};

/** The words a cell shows, read back out of what it renders, so a table can be searched the way a person reads it. */
function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement(node)) return Children.toArray((node.props as { children?: ReactNode }).children).map(nodeText).join(" ");
  return "";
}

/**
 * The table's rows are filtered, paged and selected by TanStack Table (headless — the markup below is still ours). The features and the
 * column helper live at module scope because the library requires them to be stable between renders.
 */
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
});

const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("fr_csrf="))?.split("=")[1] ?? "";

/** The mockup pages a table of ten or more rows, eight to a page. */
const perPage = (total: number, pageSize: number | false) => (pageSize === false || total < 10 ? 0 : 8);

export function BackOfficeTable({ title, description, meta, emptyState, actions, filterBar, footnote, columns, rows, pageSize, selection }: Props) {
  const router = useRouter();
  // What a bulk action did, said above the rows it acted on — and kept after the selection it came from has cleared.
  const bulk = useNotice();
  const [acting, setActing] = useState(false);
  // The search and the page live in the address (see `useTableUrlState`), so this view can be refreshed, shared and gone back to.
  const url = useTableUrlState(title);
  const query = url.query;
  const pageIndex = Math.max(0, url.page - 1);
  const setPageIndex = (updater: number | ((current: number) => number)) => {
    const next = typeof updater === "function" ? updater(pageIndex) : updater;
    void url.setPage(next + 1);
  };
  const setQuery = (value: string) => {
    void url.setQuery(value);
    void url.setPage(1);
  };
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [choices, setChoices] = useState<Record<string, string>>({});

  // A table long enough to page can be searched, as in the mockup — unless the page already brought its own toolbar.
  const all = rows;
  const per = perPage(all.length, pageSize);
  const searchable = !filterBar && per > 0;
  const needle = query.trim().toLowerCase();

  // Each column answers the search with the words it shows, read back out of what it renders.
  const tableColumns = useMemo(
    (): Array<ColumnDef<typeof features, PreparedRow>> => columns.map((column) => ({ id: column.key, accessorFn: (row: PreparedRow) => nodeText(row.cells[column.key]) })),
    [columns],
  );
  const pagination: PaginationState = { pageIndex, pageSize: per || Math.max(all.length, 1) };
  const table = useTable({
    features,
    columns: tableColumns,
    data: all,
    getRowId: (row) => String(row.key),
    globalFilterFn: "includesString",
    enableRowSelection: Boolean(selection),
    state: { globalFilter: searchable ? needle : "", pagination, rowSelection },
    onPaginationChange: (updater) => setPageIndex((current) => (typeof updater === "function" ? updater({ pageIndex: current, pageSize: pagination.pageSize }) : updater).pageIndex),
    onRowSelectionChange: setRowSelection,
    autoResetPageIndex: false,
  });

  // New rows (a refresh, a different tab) start from the first page with nothing picked. Comparing with the previous rows, not a
  // "first run" flag, keeps the page from the address on load.
  const previousRows = useRef(rows);
  useEffect(() => {
    if (previousRows.current === rows) return;
    previousRows.current = rows;
    void url.setPage(1);
    setRowSelection({});
  }, [rows, url]);

  const picked = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const matching = table.getFilteredRowModel().rows;
  const pages = per ? Math.max(1, Math.ceil(matching.length / per)) : 1;
  const current = Math.min(pageIndex, pages - 1);
  const shown = table.getRowModel().rows;
  const hasHead = Boolean(title) || Boolean(actions) || Boolean(meta);

  async function run(action: SelectionAction) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    const ids = picked.map(String);
    if (action.method === "DOWNLOAD") {
      window.location.href = `${action.endpoint}${action.endpoint.includes("?") ? "&" : "?"}${action.idsField}=${encodeURIComponent(ids.join(","))}`;
      return;
    }
    setActing(true);
    try {
      const response = await fetch(action.endpoint, { method: action.method ?? "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ ...(action.extra ?? {}), ...(action.choice ? { [action.choice.field]: choices[action.label] } : {}), [action.idsField]: ids }) });
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

  const allOn = shown.length > 0 && table.getIsAllPageRowsSelected();
  const box = (on: boolean) => `flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-[4.5px] border-[1.5px] text-[10.5px] font-extrabold text-white ${on ? "border-[#0D2315] bg-[#0D2315]" : "border-[#C2D2C8] bg-white"}`;
  const pageButton = (on: boolean, disabled: boolean) => `flex h-[25px] min-w-[25px] items-center justify-center rounded-lg border px-[7px] text-[11px] font-semibold ${on ? "border-[#0D2315] bg-[#0D2315] text-white" : `border-[#DEE8E2] bg-white ${disabled ? "cursor-default text-[#C2D2C8]" : "cursor-pointer text-[#435048] hover:border-[#BFDCD1] hover:bg-[#EFF6F2]"}`}`;

  // Which page numbers to draw: all of them up to seven, else first, last and the neighbours of the current one.
  const numbers: Array<number | "gap-a" | "gap-b"> = [];
  if (pages <= 7) for (let i = 0; i < pages; i += 1) numbers.push(i);
  else {
    numbers.push(0);
    if (current > 2) numbers.push("gap-a");
    for (let i = Math.max(1, current - 1); i <= Math.min(pages - 2, current + 1); i += 1) numbers.push(i);
    if (current < pages - 3) numbers.push("gap-b");
    numbers.push(pages - 1);
  }
  const first = matching.length ? current * per + 1 : 0;
  const last = per ? Math.min(matching.length, current * per + per) : matching.length;

  return (
    <section className="surface-card min-w-0 overflow-hidden">
      {hasHead ? (
        <div className="flex flex-wrap items-start justify-between gap-[12.5px] border-b border-[#EDF3EF] px-[18px] pb-[12.5px] pt-[14.5px]">
          <div className="min-w-0 flex-[1_1_300px]">
            <h3 className="text-pretty text-[12.5px] font-semibold leading-[1.3] text-(--color-text-primary)">{title}</h3>
            {description ? <p className="mt-[3.5px] text-pretty text-[10.5px] leading-normal text-[#5f6e65]">{description}</p> : null}
          </div>
          {actions || meta ? (
            <div className="flex min-w-0 flex-[0_1_auto] items-center justify-end gap-[12.5px]">
              {meta ? <div className="min-w-0 text-pretty text-right text-[10.5px] leading-[1.45] text-[#5f6e65]">{meta}</div> : null}
              {actions ? <div className="flex flex-none items-center gap-[7px]">{actions}</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {filterBar}
      {searchable ? (
        <div className="flex flex-wrap items-center gap-[7px] border-b border-[#EDF3EF] bg-[#FCFDFC] px-[18px] py-[12.5px]">
          <div className="flex min-w-[236px] items-center gap-2 rounded-[9px] border border-[#DEE8E2] bg-white px-[11px] py-[7px]">
            <Search className="h-3 w-3 shrink-0 text-[#5E6D64]" strokeWidth={1.9} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${String(columns[0]?.header || "this table").toLowerCase()}`} aria-label="Search this table" className="min-w-0 flex-1 border-none bg-transparent text-[11.5px] text-[#0D2315] outline-hidden placeholder:text-[#7a8f82]" />
            {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="flex shrink-0 text-[#5E6D64] hover:text-[#0D2315]"><X className="h-3 w-3" /></button> : null}
          </div>
          {needle ? <span className="ml-auto text-[10.5px] text-[#5f6e65]">{matching.length} of {all.length} shown</span> : null}
        </div>
      ) : null}

      <div className="px-3 pt-3 empty:hidden"><InlineNotice notice={bulk.notice} onDismiss={bulk.clear} /></div>
      {selection && picked.length > 0 ? (
        <div className="px-3 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0D2315] px-4 py-[11px]">
            <div className="flex items-center gap-[11px]">
              <button type="button" aria-label="Clear the selection" onClick={() => table.resetRowSelection(true)} className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-white">
                <span className="block h-[2px] w-[9px] rounded-sm bg-[#0D2315]" />
              </button>
              <span className="text-[12.5px] font-semibold text-white">{picked.length} {picked.length === 1 ? selection.noun : selection.nounPlural} selected</span>
              <button type="button" onClick={() => table.resetRowSelection(true)} className="text-[11.5px] text-white/60 hover:text-white">Clear</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selection.actions.map((action) => (
                <span key={action.label} className="inline-flex items-center gap-1.5">
                  {action.choice ? (
                    <select aria-label={action.choice.label} value={choices[action.label] ?? ""} onChange={(event) => setChoices((currentChoices) => ({ ...currentChoices, [action.label]: event.target.value }))} className="rounded-lg border border-white/30 bg-[#0D2315] px-2.5 py-[6px] text-[12px] font-semibold text-white">
                      <option value="">{action.choice.label}</option>
                      {action.choice.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : null}
                  <button type="button" disabled={acting || Boolean(action.choice && !choices[action.label])} onClick={() => void run(action)} className={action.kind === "primary" ? "whitespace-nowrap rounded-lg bg-white px-3 py-[6px] text-[12px] font-semibold text-[#0D2315] hover:bg-[#E4F1EC] disabled:opacity-60" : "whitespace-nowrap rounded-lg border border-white/30 px-3 py-[6px] text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"}>
                    {action.label}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {matching.length === 0 ? (
        <div className="px-[18px] py-[23.5px] text-center text-[11.5px] text-[#5f6e65]">{needle && all.length ? `Nothing matches “${query.trim()}” in this table.` : emptyState}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-separate border-spacing-0 text-[11.5px]">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {selection ? (
                  <th scope="col" className="w-[34px] border-b border-[#E6EEE9] bg-[#F7FAF8] py-[10px] pl-[18px] pr-[6.25px]">
                    <button type="button" role="checkbox" aria-checked={allOn} aria-label="Select every row on this page" onClick={() => table.toggleAllPageRowsSelected(!allOn)} className={box(allOn)}>{allOn ? "✓" : ""}</button>
                  </th>
                ) : null}
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={["whitespace-nowrap border-b border-[#E6EEE9] bg-[#F7FAF8] px-[6.25px] py-[10px] text-left text-[9.5px] font-semibold uppercase tracking-wider text-[#5f6e65] first:pl-[18px] last:pr-[18px]", column.headerClassName ?? ""].join(" ")}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((tableRow) => {
                const row = tableRow.original;
                const on = tableRow.getIsSelected();
                return (
                <tr key={tableRow.id} className="text-[11.5px] text-[#435048]">
                  {selection ? (
                    <td className="w-[34px] border-b border-[#F2F7F4] py-[11.5px] pl-[18px] pr-[6.25px] align-middle">
                      <button type="button" role="checkbox" aria-checked={on} aria-label="Select this row" onClick={() => tableRow.toggleSelected()} className={box(on)}>{on ? "✓" : ""}</button>
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={["border-b border-[#F2F7F4] px-[6.25px] py-[11.5px] align-middle first:pl-[18px] last:pr-[18px]", column.cellClassName ?? ""].join(" ")}>
                      {row.cells[column.key]}
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {per && pages > 1 ? (
        <div className="flex items-center justify-between gap-[14px] border-t border-[#EDF3EF] bg-[#FCFDFC] px-[18px] py-[10px]">
          <p className="text-[10.5px] text-[#5f6e65]">Showing {first}–{last} of {matching.length}</p>
          <div className="flex flex-none items-center gap-[6px]">
            <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => table.setPageIndex(Math.max(0, current - 1))} className={pageButton(false, current === 0)}>‹</button>
            {numbers.map((n, index) =>
              typeof n === "number" ? (
                <button key={n} type="button" onClick={() => table.setPageIndex(n)} className={pageButton(n === current, false)}>{n + 1}</button>
              ) : (
                <span key={`${n}-${index}`} className="flex h-[25px] min-w-[18px] items-center justify-center text-[11px] text-[#B4C4BB]">…</span>
              )
            )}
            <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => table.setPageIndex(Math.min(pages - 1, current + 1))} className={pageButton(false, current >= pages - 1)}>›</button>
          </div>
        </div>
      ) : null}

      {footnote ? <div className="border-t border-[#EDF3EF] bg-[#F7FAF8] px-[18px] py-[11px] text-[10.5px] text-[#5f6e65]">{footnote}</div> : null}
    </section>
  );
}
