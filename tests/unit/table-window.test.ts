import type { PanelRow, TableRow } from "@/lib/modules/panels";
import { narrowRows, tableCsv } from "@/lib/modules/table-query";
import { WINDOW_OVER, WINDOW_SIZE, askedOf, narrowTable, windowKey, windowRows } from "@/lib/modules/window";

const children = (count: number): TableRow[] => Array.from({ length: count }, (_, i) => ({
  id: `s${i}`, keywords: i % 3 === 0 ? "medical" : "",
  cells: [{ kind: "name", name: `Child ${String(i).padStart(3, "0")}`, sub: `ADM${i}` }, { kind: "text", text: i % 2 ? "JSS 1" : "JSS 2" }, { kind: "pill", label: i % 5 === 0 ? "Never activated" : "Active" }, { kind: "action", label: "Open", href: `/x/${i}` }],
}));
const table = (count: number): PanelRow[] => [{
  cols: "1fr",
  panels: [
    { type: "note", tone: "neutral", title: "Hello", body: "A note" },
    { type: "table", title: "Registry", head: ["Student", "Class", "Portal", ""], rows: children(count), search: "Find", per: 10, filters: [{ label: "Class", value: "All", options: ["All", "JSS 1", "JSS 2"], column: 1 }, { label: "Portal", value: "All", options: ["All", "Active", "Never activated"], column: 2 }] },
  ],
}];
const target = (query: Record<string, string | undefined> = {}) => ({ module: "student-records", tab: "registry", query });

describe("a long table is sent one page at a time", () => {
  it("leaves a table of ordinary length alone", () => {
    expect(windowRows(table(WINDOW_OVER), target())).toEqual(table(WINDOW_OVER));
  });

  it("sends the first page, and says how many there are", () => {
    const panel = windowRows(table(200), target())[0]!.panels[1]!;
    if (panel.type !== "table") throw new Error("table expected");
    expect(panel.rows).toHaveLength(WINDOW_SIZE);
    expect(panel.window).toMatchObject({ key: "t0_1", page: 1, size: WINDOW_SIZE, matched: 200, total: 200 });
    expect(panel.rows[0]!.id).toBe("s0");
  });

  it("reads the page, the search and each filter from the address", () => {
    const panel = windowRows(table(200), target({ t0_1_p: "3", t0_1_f0: "JSS 1" }))[0]!.panels[1]!;
    if (panel.type !== "table") throw new Error("table expected");
    expect(panel.window).toMatchObject({ page: 3, matched: 100, filters: { Class: "JSS 1", Portal: "All" } });
    expect(panel.rows[0]!.id).toBe("s101");
    expect(panel.rows.every((row) => row.cells[1]!.kind === "text" && (row.cells[1] as { text: string }).text === "JSS 1")).toBe(true);
  });

  it("searches every row, not just the page on screen — names, admission numbers and keywords", () => {
    const find = (q: string) => {
      const panel = windowRows(table(200), target({ t0_1_q: q }))[0]!.panels[1]!;
      if (panel.type !== "table" || !panel.window) throw new Error("window expected");
      return panel.window.matched;
    };
    expect(find("child 199")).toBe(1);
    expect(find("ADM150")).toBe(1);
    expect(find("medical")).toBe(67);
    expect(find("nobody")).toBe(0);
  });

  it("agrees with what the browser does to a short table", () => {
    const rows = children(200);
    const source = table(200)[0]!.panels[1]!;
    const filters = source.type === "table" ? source.filters : undefined;
    const browser = narrowRows(rows, filters, "child 1", { Class: "JSS 2", Portal: "Never activated" });
    const server = narrowTable({ rows, filters }, "t0_1", target({ t0_1_q: "child 1", t0_1_f0: "JSS 2", t0_1_f1: "Never activated" }), { r: 0, p: 1 }, true);
    expect(server.rows.map((row) => row.id)).toEqual(browser.map((row) => row.id));
  });

  it("holds the page within the pages there are, and asks for page one when the address is nonsense", () => {
    const panel = windowRows(table(200), target({ t0_1_p: "99" }))[0]!.panels[1]!;
    if (panel.type !== "table" || !panel.window) throw new Error("window expected");
    expect(panel.window.page).toBe(8);
    expect(panel.rows).toHaveLength(200 - 7 * WINDOW_SIZE);
    expect(askedOf("t0_1", [], { t0_1_p: "-4" }).page).toBe(1);
    expect(askedOf("t0_1", [], { t0_1_p: "abc" }).page).toBe(1);
  });

  it("keeps two long tables on one page from sharing a search box", () => {
    expect(windowKey(0, 1)).not.toBe(windowKey(1, 1));
    const two: PanelRow[] = [table(100)[0]!, table(100)[0]!];
    const out = windowRows(two, target({ t1_1_q: "child 005" }));
    const [a, b] = [out[0]!.panels[1]!, out[1]!.panels[1]!];
    if (a.type !== "table" || b.type !== "table") throw new Error("tables expected");
    expect(a.window!.matched).toBe(100);
    expect(b.window!.matched).toBe(1);
  });

  it("exports every matching row with the table's own headings, and none of the buttons", () => {
    const narrowed = narrowTable({ rows: children(200) }, "t0_1", target({ t0_1_q: "child 00" }), { r: 0, p: 1 }, true);
    expect(narrowed.rows).toHaveLength(10);
    const csv = tableCsv(["Student", "Class", "Portal", ""], narrowed.rows).split("\n");
    expect(csv[0]).toBe('"Student","Class","Portal"');
    expect(csv).toHaveLength(11);
    expect(csv[1]).toBe('"Child 000 (ADM0)","JSS 2","Never activated"');
    expect(narrowed.window.exportUrl).toContain("/table-export?m=student-records&t=registry&r=0&p=1");
  });

  it("narrows by how recent a row is, and leaves a row with no time out of any recent window", () => {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const rows: TableRow[] = [
      { id: "now", at: hoursAgo(1), cells: [{ kind: "text", text: "a" }] },
      { id: "week", at: hoursAgo(100), cells: [{ kind: "text", text: "b" }] },
      { id: "old", at: hoursAgo(2000), cells: [{ kind: "text", text: "c" }] },
      { id: "undated", cells: [{ kind: "text", text: "d" }] },
    ];
    const filters = [{ label: "Sent", value: "Any date", options: ["Any date", "Last 24 hours", "Last 7 days"], since: { "Last 24 hours": 24, "Last 7 days": 168 } }];
    const ids = (chosen: string) => narrowRows(rows, filters, "", { Sent: chosen }).map((row) => row.id);
    expect(ids("Any date")).toEqual(["now", "week", "old", "undated"]);
    expect(ids("Last 24 hours")).toEqual(["now"]);
    expect(ids("Last 7 days")).toEqual(["now", "week"]);
  });
});
