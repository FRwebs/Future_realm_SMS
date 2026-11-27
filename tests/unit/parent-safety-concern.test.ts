import { requestsPage } from "@/lib/modules/live/parent/requests";

const data = {
  today: "2026-11-27", items: [], typical: null, children: [{ id: "k1", first: "Daniel", name: "Daniel Yusuf" }, { id: "k2", first: "Maryam", name: "Maryam Yusuf" }],
  types: [{ name: "Absence explanation", days: 2, reviewer: "Form master", accepted: true }, { name: "Meeting request", days: 5, reviewer: "Principal", accepted: true }],
  schoolPhone: "08036660016",
  concerns: [{ id: "c1", child: "Daniel", urgent: true, closed: false, opened: "2026-11-26" }],
};
vi.mock("@/lib/api/server", () => ({ apiGet: async () => data, observe: () => undefined }));

type Item = { label: string; sub?: string; pill?: string; drawer?: { title: string; sub?: string; fields?: Array<{ label: string; required?: boolean; options?: string[] }>; submit?: { endpoint: string; map: Record<string, string>; encode?: Record<string, Record<string, string>> } } };
const lists = async () => {
  const page = await requestsPage("all", {});
  return page.rows.flatMap((entry) => entry.panels).filter((panel) => panel.type === "list") as unknown as Array<{ title: string; items: Item[] }>;
};

describe("a parent's concern about a child's safety", () => {
  it("is the first thing offered to start, with the school's phone beside it", async () => {
    const start = (await lists()).find((list) => list.title === "Start a request")!;
    const first = start.items[0]!;
    expect(first.label).toBe("A concern about my child’s safety or wellbeing");
    expect(first.sub).toMatch(/safeguarding lead and the Principal/);
    expect(first.sub).toMatch(/not to the form master/);
    expect(first.sub).toContain("08036660016");
  });

  it("goes to its own private route, not the requests the form master and the office see", async () => {
    const start = (await lists()).find((list) => list.title === "Start a request")!;
    const drawer = start.items[0]!.drawer!;
    expect(drawer.submit!.endpoint).toMatch(/\/parent-portal\/ws\/concerns$/);
    expect(drawer.submit!.endpoint).not.toMatch(/submissions/);
    expect(drawer.sub).toMatch(/not the form master, not the school office/);
    expect(drawer.sub).toContain("08036660016");
    expect(drawer.fields!.map((field) => field.label)).toEqual(["Who is it about?", "What is worrying you?", "Is anyone in danger right now?"]);
    expect(drawer.submit!.encode!["Who is it about?"]).toEqual({ "Daniel Yusuf": "k1", "Maryam Yusuf": "k2" });
    expect(drawer.submit!.encode!["Is anyone in danger right now?"]).toEqual({ No: "false", Yes: "true" });
  });

  it("lists the concerns the parent raised as received — never what the school did", async () => {
    const mine = (await lists()).find((list) => list.title === "Concerns you raised")!;
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ label: "A concern about Daniel", pill: "With the safeguarding lead" });
    expect(mine.items[0]!.sub).toMatch(/marked urgent/);
    expect(mine.items[0]!.drawer).toBeUndefined();
  });
});
