import { ReactNode } from "react";

import { TableCardBody, type PreparedColumn, type PreparedRow } from "./table-card-body";

export interface TableColumn<TItem> {
  key: string;
  header: string;
  render: (item: TItem) => ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;

  /**
   * Optional accessor returning a comparable primitive for sorting.
   * When omitted, TableCard tries `item[column.key]` as a fallback —
   * set this explicitly for computed/formatted columns.
   */
  sortValue?: (item: TItem) => string | number | Date | null | undefined;

  /**
   * Set false to hide the sort toggle for this column even if a
   * sortable value can be derived (e.g. an "actions" column).
   */
  sortable?: boolean;
}

interface TableCardProps<TItem> {
  title: string;
  description: ReactNode;
  columns: TableColumn<TItem>[];
  items: TItem[];
  emptyState?: string;

  /**
   * Strongly recommended so rows keep stable identity.
   */
  getRowKey?: (item: TItem, index: number) => string | number;

  /**
   * The column that should act like the main label on mobile.
   * For example: "name", "student", "subject", "className".
   */
  primaryColumnKey?: string;

  /**
   * Columns that should be visually emphasized on mobile.
   * Use this for grade, status, score, result, or completion fields.
   */
  featuredColumnKeys?: string[];

  /**
   * Optional action slot for buttons like Add, Export, Filter, etc.
   */
  actions?: ReactNode;

  /**
   * Rows per page. Set to `false` to disable pagination entirely.
   * Defaults to 10.
   */
  pageSize?: number | false;
}

function resolveSortValue<TItem>(item: TItem, column: TableColumn<TItem>): string | number | Date | null | undefined {
  if (column.sortValue) return column.sortValue(item);
  const raw = (item as Record<string, unknown> | null)?.[column.key];
  if (typeof raw === "string" || typeof raw === "number" || raw instanceof Date) return raw;
  return undefined;
}

/**
 * Server-safe: `render`/`sortValue` accessors run here so only the
 * resulting ReactNode/primitives (never functions) cross into the
 * "use client" TableCardBody that owns sort/pagination state.
 */
export function TableCard<TItem>({
  title,
  description,
  columns,
  items,
  emptyState = "No records found.",
  getRowKey,
  primaryColumnKey,
  featuredColumnKeys = [],
  actions,
  pageSize = 10,
}: TableCardProps<TItem>) {
  const preparedColumns: PreparedColumn[] = columns.map((column) => {
    const sortable =
      column.sortable !== false &&
      items.some((item) => {
        const value = resolveSortValue(item, column);
        return value !== undefined && value !== null;
      });

    return {
      key: column.key,
      header: column.header,
      headerClassName: column.headerClassName,
      cellClassName: column.cellClassName,
      sortable,
    };
  });

  const primaryKey =
    primaryColumnKey && columns.some((column) => column.key === primaryColumnKey)
      ? primaryColumnKey
      : columns[0]?.key;

  const rows: PreparedRow[] = items.map((item, index) => {
    const cells: Record<string, ReactNode> = {};
    const sortValues: Record<string, string | number | null> = {};

    for (const column of columns) {
      cells[column.key] = column.render(item);
      const raw = resolveSortValue(item, column);
      sortValues[column.key] = raw instanceof Date ? raw.getTime() : raw ?? null;
    }

    return {
      key: getRowKey ? getRowKey(item, index) : index,
      cells,
      sortValues,
    };
  });

  return (
    <TableCardBody
      title={title}
      description={description}
      emptyState={emptyState}
      actions={actions}
      columns={preparedColumns}
      rows={rows}
      primaryColumnKey={primaryKey}
      featuredColumnKeys={featuredColumnKeys}
      pageSize={pageSize}
    />
  );
}
