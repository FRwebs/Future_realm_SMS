import { drawerAt, slimRows } from "@/lib/modules/slim";
import type { DrawerSpec, PanelRow, TableRow } from "@/lib/modules/panels";

const spec = (title: string): DrawerSpec => ({ mode: "view", kicker: "Family", title, facts: [["A", "b", "c"]], fields: [] });
const table = (count: number, per?: number): PanelRow[] => [{
  cols: "1fr",
  panels: [{
    type: "table", title: "Families", head: ["Name", ""], per,
    rows: Array.from({ length: count }, (_, i): TableRow => ({ id: `r${i}`, cells: [{ kind: "text", text: `Family ${i}` }, { kind: "action", label: "Open", drawer: spec(`Family ${i}`) }], drawer: spec(`Family ${i}`) })),
  }],
}];
const target = { module: "parents-guardians", tab: "consent", query: { term: "2" } };

describe("long tables send their drawers when they are opened", () => {
  it("leaves a short table whole", () => {
    const rows = table(18, 10);
    expect(slimRows(rows, target)).toEqual(rows);
  });

  it("keeps the first page's drawers and stubs the rest, still opening and still searchable", () => {
    const slim = slimRows(table(60, 10), target);
    const panel = slim[0]!.panels[0]!;
    if (panel.type !== "table") throw new Error("table expected");
    expect(panel.rows).toHaveLength(60);
    expect(panel.rows[3]!.drawer!.load).toBeUndefined();
    expect(panel.rows[3]!.drawer!.facts).toBeDefined();
    const stub = panel.rows[45]!.drawer!;
    expect(stub.title).toBe("Family 45");
    expect(stub.facts).toBeUndefined();
    expect(stub.load).toContain("/row-drawer?");
    expect(stub.load).toContain("m=parents-guardians");
    expect(stub.load).toContain("i=45");
    expect(panel.rows[45]!.id).toBe("r45");
  });

  it("stubs the drawer behind a row's action cell too", () => {
    const panel = slimRows(table(60, 10), target)[0]!.panels[0]!;
    if (panel.type !== "table") throw new Error("table expected");
    const cell = panel.rows[50]!.cells[1]!;
    expect(cell.kind === "action" && cell.drawer?.load).toContain("c=1");
  });

  it("finds the drawer again in freshly built rows, and refuses it when the list has changed", () => {
    const fresh = table(60, 10);
    expect(drawerAt(fresh, { r: 0, p: 0, i: 45, c: -1 }, "Family 45")?.facts).toBeDefined();
    expect(drawerAt(fresh, { r: 0, p: 0, i: 45, c: 1 }, "Family 45")?.title).toBe("Family 45");
    // Somebody was added at the top: row 45 is now a different family.
    expect(drawerAt(fresh, { r: 0, p: 0, i: 45, c: -1 }, "Family 44")).toBeNull();
    expect(drawerAt(fresh, { r: 0, p: 0, i: 99, c: -1 }, "Family 99")).toBeNull();
    expect(drawerAt(fresh, { r: 2, p: 0, i: 0, c: -1 }, "Family 0")).toBeNull();
  });
});
