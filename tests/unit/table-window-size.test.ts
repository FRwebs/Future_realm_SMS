import { readFileSync } from "node:fs";

import { WINDOW_OVER, WINDOW_SIZE, windowRows } from "../../src/lib/modules/window";
import type { PanelRow, TableRow } from "../../src/lib/modules/panels";

const rows = (n: number): TableRow[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, cells: [{ kind: "text", text: `Row ${i}` }], keywords: `row ${i}` }) as TableRow);
const page = (n: number): PanelRow[] => [{ cols: "1fr", panels: [{ type: "table", title: "T", head: ["A"], rows: rows(n) }] }] as PanelRow[];
const target = { module: "m", tab: "t", query: {} };

describe("a long table is sent one page at a time", () => {
  it("sends the first page, with a real page size, and says how many there are", () => {
    const [row] = windowRows(page(WINDOW_OVER + 22), target);
    const panel = row!.panels[0] as { rows: TableRow[]; window: { page: number; matched: number; size: number } };
    expect(WINDOW_SIZE).toBe(12);
    expect(panel.rows).toHaveLength(12);
    expect(panel.window.page).toBe(1);
    expect(panel.window.matched).toBe(WINDOW_OVER + 22);
  });

  it("sends the page asked for", () => {
    const [row] = windowRows(page(WINDOW_OVER + 22), { ...target, query: { t0_0_p: "2" } });
    expect((row!.panels[0] as { window: { page: number } }).window.page).toBe(2);
  });

  it("takes the page size from a file the server may read", () => {
    // The server cuts the table to its page. A constant imported from a "use client" file reaches the server as a reference, not as a
    // number — every page came out empty — so the size lives in a file with no client marker, and the server file reads it from there.
    expect(readFileSync("src/lib/modules/table-size.ts", "utf8")).not.toMatch(/^\s*["']use client["']/m);
    expect(readFileSync("src/lib/modules/window.ts", "utf8")).not.toMatch(/from "@\/components\//);
  });
});
