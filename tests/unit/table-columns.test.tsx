import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";

import { PanelRows } from "@/components/modules/panel-renderer";
import { row, type Panel, type TableCellKind, type TableRow } from "@/lib/modules/panels";
import { columnWidths, estimateWidth, planColumns } from "@/lib/ui/table-columns";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

/**
 * One column rule for every table in the product.
 *
 * Tables used to be left to the browser's own auto layout, so the same column was one width on one
 * page and another width on the next, and a column of long names could be squeezed by a column of
 * two-letter codes. These pin the rule the mockup applies instead: content-shaped columns take
 * their own content and nothing more, and the rest share what is left in proportion to what they
 * actually hold.
 */

const text = (value: string): TableCellKind => ({ kind: "text", text: value });
/** One column's worth of cells, for the estimator. */
const column = (...cells: TableCellKind[]): TableCellKind[] => cells;
/** Whole rows, for the planner. */
const rows = (...each: TableCellKind[][]): Array<{ cells: TableCellKind[] }> => each.map((cells) => ({ cells }));

describe("what a column is worth", () => {
  it("grows with the longest thing in it, heading included", () => {
    const short = estimateWidth("No", column(text("1"), text("2")));
    const long = estimateWidth("No", column(text("Ayomide Oluwafunmilayo Adebayo-Johnson")));
    expect(long).toBeGreaterThan(short);
    // the heading counts even when every cell is tiny
    expect(estimateWidth("Continuous assessment", column(text("4")))).toBeGreaterThan(short);
  });

  it("never lets one column swallow the table, or shrink past reading", () => {
    expect(estimateWidth("x", column(text("y")))).toBeGreaterThanOrEqual(44);
    expect(estimateWidth("x", column(text("z".repeat(400))))).toBeLessThanOrEqual(300);
  });

  it("knows a chip, a bar and a tick are not prose", () => {
    const tick = estimateWidth("On", column({ kind: "mark", ok: true }));
    const bar = estimateWidth("Done", column({ kind: "bar", pct: 50, label: "6/12" }));
    expect(tick).toBeLessThan(bar);
    expect(bar).toBeGreaterThanOrEqual(108);
  });
});

describe("planning a table's columns", () => {
  const head = ["Student", "Arm", "State"];
  const body = rows(
    [{ kind: "name", name: "Ada Obi", sub: "GC/2024/001" }, text("JSS 2 Gold"), { kind: "pill", label: "Enrolled" }],
    [{ kind: "name", name: "Chidi Okonkwo-Abubakar", sub: "GC/2024/002" }, text("JSS 2 Gold"), { kind: "pill", label: "Withdrawn" }],
  );

  it("gives a column of chips its own content and no slack", () => {
    const plan = planColumns(head, body);
    expect(plan.tracks[2]!.kind).toBe("fixed");
  });

  it("gives a column of names a share of what is left", () => {
    const plan = planColumns(head, body);
    expect(plan.tracks[0]!.kind).toBe("flex");
  });

  it("never gives slack to a column laid right or centre — a figure does not grow", () => {
    const plan = planColumns(["Student", "Marks"], rows([{ kind: "name", name: "Ada Obi" }, text("72")]), { align: ["left", "right"] });
    expect(plan.tracks[1]!.kind).toBe("fixed");
  });

  it("weighs a hand-written template against what the column actually holds", () => {
    const wide = planColumns(head, rows([{ kind: "name", name: "A".repeat(60) }, text("x"), { kind: "pill", label: "On" }]), { authored: "0.5fr 1fr 1fr" });
    const narrow = planColumns(head, rows([{ kind: "name", name: "A" }, text("x"), { kind: "pill", label: "On" }]), { authored: "0.5fr 1fr 1fr" });
    const share = (plan: ReturnType<typeof planColumns>) => (plan.tracks[0]!.kind === "flex" ? plan.tracks[0]!.share : 0);
    // the same authored weight, but the column holding more gets more
    expect(share(wide)).toBeGreaterThan(share(narrow));
  });

  it("adds up a width the table cannot be drawn below", () => {
    const plan = planColumns(head, body);
    expect(plan.minWidth).toBeGreaterThan(0);
    expect(planColumns(head, body, { selectable: true }).minWidth).toBeGreaterThan(plan.minWidth);
  });

  it("turns the plan into widths a colgroup can carry, which together make one table", () => {
    const widths = columnWidths(planColumns(head, body));
    expect(widths).toHaveLength(3);
    // Every column is a plain percentage, and they come to one whole table. A `<col>` width that
    // mixes a percentage with a length is dropped under `table-layout: fixed` and the engine
    // divides the table equally instead, which is how a column of long names ended up exactly as
    // wide as a column of single digits.
    widths.forEach((width) => expect(width).toMatch(/^\d+(\.\d+)?%$/));
    const parts = widths.map((width) => Number.parseFloat(width));
    expect(parts.reduce((sum, part) => sum + part, 0)).toBeCloseTo(100, 2);
    // The column holding the longest text is the widest one.
    expect(Math.max(...parts)).toBe(parts[0]);
  });

  it("gives the tick column a width of its own when the rows can be selected", () => {
    const plain = columnWidths(planColumns(head, body));
    const ticked = columnWidths(planColumns(head, body, { selectable: true }), true);
    expect(ticked).toHaveLength(plain.length + 1);
    expect(Number.parseFloat(ticked[0]!)).toBeLessThan(Number.parseFloat(ticked[1]!));
    expect(ticked.map((w) => Number.parseFloat(w)).reduce((sum, part) => sum + part, 0)).toBeCloseTo(100, 2);
  });
});

describe("a rendered table", () => {
  const panel = (count: number): Panel => ({
    type: "table", title: "Students", head: ["Student", "Arm", "State"],
    rows: Array.from({ length: count }, (_, index): TableRow => ({
      id: `s${index}`,
      cells: [{ kind: "name", name: `Child ${index}` }, { kind: "text", text: "JSS 2 Gold" }, { kind: "pill", label: "Enrolled" }],
    })),
  });

  it("carries a colgroup, so every row lines up on the same columns", () => {
    const html = renderToStaticMarkup(<PanelRows rows={[row("1fr", [panel(3)])]} />);
    expect(html).toContain("<colgroup>");
    expect(html).toContain("table-layout:fixed");
  });

  it("shows twelve rows before it pages, whatever the table", () => {
    const html = renderToStaticMarkup(<PanelRows rows={[row("1fr", [panel(30)])]} />);
    const body = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    expect((body.match(/<tr/g) ?? []).length).toBe(12);
  });

  it("does not page a table that asked to show everything", () => {
    const html = renderToStaticMarkup(<PanelRows rows={[row("1fr", [{ ...panel(30), per: 0 } as Panel])]} />);
    const body = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    expect((body.match(/<tr/g) ?? []).length).toBe(30);
  });
});

describe("a table whose rows are wider than its headings", () => {
  it("still gives the extra cell a column, instead of leaving it nowhere to go", () => {
    const plan = planColumns(["Item", "With"], rows([text("A note"), text("Mr Obi"), { kind: "pill", label: "Submitted" }]));
    expect(plan.tracks).toHaveLength(3);
    expect(columnWidths(plan)).toHaveLength(3);
  });
});
