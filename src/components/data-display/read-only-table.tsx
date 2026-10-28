"use client";

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { Fragment, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A table that is only read: a handful of rows, no search, no paging, no ticking. TanStack Table holds the rows and their order (so a
 * column that has something to sort by can be sorted, and says so to a screen reader with `aria-sort`); the markup is ours. For a list a
 * person searches, pages or acts on, the module and Back Office tables are the ones to use.
 */
const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { alphanumeric: sortFn_alphanumeric } });

export type ReadOnlyColumn<TRow extends RowData> = {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  /** Gives the column a sort: what to compare the rows by. Left out, the column keeps the order the rows came in. */
  sortValue?: (row: TRow) => string | number;
  className?: string;
};

export function ReadOnlyTable<TRow extends RowData>({
  columns,
  rows,
  getRowId,
  empty,
  caption,
  headClassName,
  cellClassName,
  rowClassName,
  after,
}: {
  columns: Array<ReadOnlyColumn<TRow>>;
  rows: TRow[];
  getRowId: (row: TRow, index: number) => string;
  empty: ReactNode;
  /** A name for the table, for a screen reader; not drawn. */
  caption: string;
  headClassName?: string;
  cellClassName?: string;
  rowClassName?: string;
  /** Drawn straight after a row — a detail the row opens. */
  after?: (row: TRow) => ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const defs = useMemo(
    (): Array<ColumnDef<typeof features, TRow>> => columns.map((column) => ({ id: column.id, accessorFn: column.sortValue ?? (() => ""), enableSorting: Boolean(column.sortValue), sortFn: "alphanumeric" })),
    [columns],
  );
  const table = useTable({ features, columns: defs, data: rows, getRowId, state: { sorting }, onSortingChange: setSorting });

  if (rows.length === 0) return <>{empty}</>;
  const shown = table.getRowModel().rows;

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => {
            const state = table.getColumn(column.id)?.getIsSorted();
            return (
              <th key={column.id} scope="col" aria-sort={state === "asc" ? "ascending" : state === "desc" ? "descending" : column.sortValue ? "none" : undefined} className={cn(headClassName, column.className)}>
                {column.sortValue ? (
                  <button type="button" onClick={() => table.getColumn(column.id)?.toggleSorting(state === "asc")} className="inline-flex items-center gap-1 font-[inherit] uppercase tracking-[inherit] hover:underline">
                    {column.header}
                    <span aria-hidden="true">{state === "asc" ? "↑" : state === "desc" ? "↓" : ""}</span>
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
        {shown.map((row) => (
          <Fragment key={row.id}>
            <tr className={rowClassName}>
              {columns.map((column) => (
                <td key={column.id} className={cn(cellClassName, column.className)}>{column.cell(row.original)}</td>
              ))}
            </tr>
            {after?.(row.original)}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
