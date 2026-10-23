import type { PanelRow, TableRow, TableWindow } from "@/lib/modules/panels";
import { narrowRows } from "@/lib/modules/table-query";

/**
 * A table that is long enough is sent one page at a time.
 *
 * The browser used to receive every row and narrow them itself, which is fine at a hundred and a burden at a thousand: the page's weight and
 * the time to read it grew with the school. Now a table of more than `WINDOW_OVER` rows keeps its search, its filters and its page in the
 * address, the server applies them with the same rules the browser would have, and only the rows to be seen are sent.
 *
 * A table is told apart by where it sits on the page (`t0_1`: first row of panels, second panel), so two long tables on one page do not
 * share a search box. Short tables are untouched.
 */
export const WINDOW_OVER = 60;
export const WINDOW_SIZE = 25;

export type WindowTarget = { module: string; tab: string; query: Record<string, string | undefined> };

export const windowKey = (r: number, p: number) => `t${r}_${p}`;

export function exportAddress(target: WindowTarget, r: number, p: number) {
  const params = new URLSearchParams({ m: target.module, t: target.tab, r: String(r), p: String(p) });
  const query = Object.fromEntries(Object.entries(target.query).filter(([, value]) => value !== undefined));
  if (Object.keys(query).length) params.set("q", JSON.stringify(query));
  return `/table-export?${params.toString()}`;
}

/** The search, filter choices and page this table was asked for, read from the address. */
export function askedOf(key: string, filters: Array<{ label: string; value: string }>, query: Record<string, string | undefined>) {
  const pageNumber = Number(query[`${key}_p`]);
  const values: Record<string, string> = {};
  filters.forEach((filter, index) => {
    values[filter.label] = query[`${key}_f${index}`] ?? filter.value;
  });
  return { q: query[`${key}_q`] ?? "", values, page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1 };
}

export type NarrowedTable = { rows: TableRow[]; matched: number; window: TableWindow };

/** One long table, narrowed and cut to its page. `all` skips the cut: what an export wants. */
export function narrowTable(panel: { rows: TableRow[]; filters?: Array<{ label: string; value: string; options: string[]; column?: number; match?: Record<string, string>; go?: Record<string, string> }> }, key: string, target: WindowTarget, address: { r: number; p: number }, all = false): NarrowedTable {
  const asked = askedOf(key, panel.filters ?? [], target.query);
  const narrowed = narrowRows(panel.rows, panel.filters, asked.q, asked.values);
  const pages = Math.max(1, Math.ceil(narrowed.length / WINDOW_SIZE));
  const page = Math.min(asked.page, pages);
  return {
    rows: all ? narrowed : narrowed.slice((page - 1) * WINDOW_SIZE, page * WINDOW_SIZE),
    matched: narrowed.length,
    window: { key, page, size: WINDOW_SIZE, matched: narrowed.length, total: panel.rows.length, q: asked.q, filters: asked.values, exportUrl: exportAddress(target, address.r, address.p) },
  };
}

export function windowRows(rows: PanelRow[], target: WindowTarget): PanelRow[] {
  return rows.map((row, r) => ({
    ...row,
    panels: row.panels.map((panel, p) => {
      if (panel.type !== "table" || panel.rows.length <= WINDOW_OVER) return panel;
      const narrowed = narrowTable(panel, windowKey(r, p), target, { r, p });
      return { ...panel, rows: narrowed.rows, window: narrowed.window, per: 0 };
    }),
  }));
}
