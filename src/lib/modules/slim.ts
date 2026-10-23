import type { DrawerSpec, PanelRow, TableCellKind, TableRow } from "@/lib/modules/panels";

/**
 * A long table sends every row to the browser, and every row sends its drawer — the whole record behind it — whether or not anyone ever
 * opens it. On a school of a thousand children that is megabytes of drawers for a list someone reads ten rows of.
 *
 * So the rows past the first few keep a stub in place of their drawer (just its title and kind, which is what shows while it opens) and
 * the drawer itself is fetched from `/row-drawer` when somebody opens it, built by the same code that built the page. Search and paging
 * still see every row; only what is behind a row waits for a click.
 *
 * A stub remembers the title of the drawer it stands for. If the list has changed underneath it by the time it is opened, the title no
 * longer matches and the person is asked to refresh, rather than being shown somebody else's record.
 */
/** A table keeps the drawers of its first page (and never fewer than ten), and slims only when that leaves more than a page's worth behind. */
export const MIN_KEPT = 10;
export const SLACK = 10;
export const keptRows = (per: number | undefined) => Math.max(per && per > 0 ? per : 20, MIN_KEPT);

export type SlimTarget = { module: string; tab: string; query: Record<string, string | undefined> };

const stubUrl = (target: SlimTarget, address: { r: number; p: number; i: number; c: number }, title: string) => {
  const params = new URLSearchParams({ m: target.module, t: target.tab, r: String(address.r), p: String(address.p), i: String(address.i), c: String(address.c), e: title });
  const query = Object.entries(target.query).filter(([, value]) => value !== undefined) as Array<[string, string]>;
  if (query.length) params.set("q", JSON.stringify(Object.fromEntries(query)));
  return `/row-drawer?${params.toString()}`;
};

const stub = (spec: DrawerSpec, url: string): DrawerSpec => ({ mode: spec.mode, kicker: spec.kicker, title: spec.title, readOnly: spec.readOnly, load: url });

export function slimRows(rows: PanelRow[], target: SlimTarget): PanelRow[] {
  return rows.map((row, r) => ({
    ...row,
    panels: row.panels.map((panel, p) => {
      if (panel.type !== "table") return panel;
      const keep = keptRows(panel.per);
      if (panel.rows.length <= keep + SLACK) return panel;
      return {
        ...panel,
        rows: panel.rows.map((tableRow, i): TableRow => {
          if (i < keep) return tableRow;
          const next: TableRow = { ...tableRow };
          if (tableRow.drawer && !tableRow.drawer.load) next.drawer = stub(tableRow.drawer, stubUrl(target, { r, p, i, c: -1 }, tableRow.drawer.title));
          next.cells = tableRow.cells.map((cell, c): TableCellKind => {
            if ((cell.kind === "action" || cell.kind === "pill") && cell.drawer && !cell.drawer.load) return { ...cell, drawer: stub(cell.drawer, stubUrl(target, { r, p, i, c }, cell.drawer.title)) } as TableCellKind;
            return cell;
          });
          return next;
        }),
      };
    }),
  }));
}

/** The drawer a stub stands for, found again in freshly built rows — or null when the list is no longer what it was. */
export function drawerAt(rows: PanelRow[], address: { r: number; p: number; i: number; c: number }, title: string): DrawerSpec | null {
  const panel = rows[address.r]?.panels[address.p];
  if (!panel || panel.type !== "table") return null;
  const tableRow = panel.rows[address.i];
  if (!tableRow) return null;
  const found = address.c < 0 ? tableRow.drawer : (() => {
    const cell = tableRow.cells[address.c];
    return cell && (cell.kind === "action" || cell.kind === "pill") ? cell.drawer : undefined;
  })();
  return found && found.title === title ? found : null;
}
