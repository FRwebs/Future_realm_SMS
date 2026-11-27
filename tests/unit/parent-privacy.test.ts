import { privacyPage } from "@/lib/modules/live/parent/privacy";

const school = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  school: { id, name, short: name.split(" ")[0], place: "Ibadan, Oyo, Nigeria", phone: "08036660016" },
  children: ["Daniel"], dpo: null, hostedIn: "Nigeria", regime: "NDPA 2023",
  retention: [{ dataClass: "Attendance records", kept: "7 years", basis: "Education authority requirement", hostedIn: "Nigeria" }],
  permissions: [{ name: "Photography and image use", covers: "Photographs", basis: "Your choice, withdrawable any time", version: "2026-10-16" }],
  copyWithinDays: 10, ...extra,
});
let notice: unknown;
vi.mock("@/lib/api/server", () => ({ apiGet: async () => notice, observe: () => undefined }));

type Panel = { type: string; title?: string; facts?: Array<[string, string, string?]>; rows?: unknown[]; items?: Array<{ label: string; drawer?: { sub?: string; submit?: { endpoint: string } }; href?: string }> };
const panels = async () => {
  const page = await privacyPage();
  return { page, all: page.rows.flatMap((entry) => entry.panels) as unknown as Panel[] };
};

describe("a parent's privacy page", () => {
  it("names who is responsible, from the school's own records, and offers the parent's data as a file at once", async () => {
    notice = { controller: "the school", processor: "FutureRealm", schools: [school("s1", "Greenfield College, Ibadan")] };
    const { page, all } = await panels();
    expect(page.primary).toMatchObject({ label: "Download my data", href: "/api/v1/parent-portal/ws/account/download", download: true });
    const responsible = all.find((panel) => panel.title === "Who is responsible")!;
    const byLabel = Object.fromEntries(responsible.facts!.map(([label, value]) => [label, value]));
    expect(byLabel["The school"]).toContain("Greenfield College");
    expect(byLabel["The software"]).toBe("FutureRealm");
    expect(byLabel["Who to ask"]).toContain("08036660016"); // no named contact on file, so the office is the honest answer
    expect(byLabel["The law that applies"]).toBe("NDPA 2023");
    expect(page.desc).toContain("Greenfield College");
  });

  it("says how long, why, what is held and what the school asks permission for", async () => {
    notice = { controller: "the school", processor: "FutureRealm", schools: [school("s1", "Greenfield College, Ibadan")] };
    const { all } = await panels();
    expect(all.find((panel) => panel.title === "How long it is kept")!.rows).toHaveLength(1);
    expect(all.find((panel) => panel.title === "What is held about you")).toBeDefined();
    expect(all.find((panel) => panel.title === "What is held about your children")).toBeDefined();
    expect(all.find((panel) => panel.title === "What the school asks your permission for")!.items![0]!.label).toBe("Photography and image use");
  });

  it("asks for the children's records with a dated promise, and gives the same notice for each school a family is at", async () => {
    notice = { controller: "the school", processor: "FutureRealm", schools: [school("s1", "Greenfield College"), school("s2", "Lakeside Academy", { copyWithinDays: 5 })] };
    const { all } = await panels();
    const rights = all.filter((panel) => panel.title?.startsWith("What you can do"));
    expect(rights).toHaveLength(2);
    expect(rights[0]!.title).toContain("Greenfield");
    expect(rights[1]!.items![0]!.drawer!.sub).toMatch(/within 5 school days/);
    expect(rights[0]!.items![0]!.drawer!.submit!.endpoint).toMatch(/account\/requests$/);
    expect(all.filter((panel) => panel.title?.startsWith("Who is responsible"))).toHaveLength(2);
  });
});
