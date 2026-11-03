import { forYouTab } from "@/lib/modules/live/t19-training";

const course = (over: Record<string, unknown>) => ({ id: "c1", title: "Safeguarding and child protection", summary: null, section: "Safeguarding", provider: "Greenfield College", hours: 2, format: "Self-paced", certificateName: "Safeguarding", validMonths: 12, pathway: null, lessons: 4, done: 1, completed: false, state: "In progress", required: true, requiredBy: "2026-09-30", requiredNote: null, dueDays: 5, outcomes: [], owned: true, ...over });
const home = {
  persona: "subject-teacher", cpd: { hours: 6.5, target: 30 }, required: [course({})], inProgress: [course({ id: "c2", title: "Assessment for learning", required: false, requiredBy: null, hours: 6, done: 2, state: "In progress" })],
  recommended: [{ course: course({ id: "c3", title: "Practical science safely", required: false, requiredBy: null, done: 0, state: "Not started", owned: false, priceLabel: "₦45,000" }), why: "You teach Chemistry SSS 2A." }],
  pathways: [], certificates: 3, expiring: null, total: 3, completed: 0,
} as unknown as Parameters<typeof forYouTab>[0];

type Loose = { type: string; title?: string; props?: { title: string; cta: { label: string } }; items?: Array<{ label: string; side?: string; bar?: { label: string } }> };

describe("the teacher phone's Training, For you", () => {
  it("leads with the course to open, then figures and the three lists, and keeps the desktop rows desktop-only", () => {
    const rows = forYouTab(home).rows;
    const panels = rows.filter((entry) => entry.show === "phone").flatMap((entry) => entry.panels as unknown as Loose[]);
    expect(panels[0]!.type).toBe("embed");
    expect(panels[0]!.props!.title).toBe("Safeguarding and child protection");
    expect(panels[0]!.props!.cta.label).toBe("Continue the course");
    expect(panels.map((panel) => panel.title).filter(Boolean)).toEqual(["Required by your school", "In progress", "Recommended for you"]);
    expect(panels[2]!.items![0]!.bar!.label).toBe("1 of 4");
    expect(panels[4]!.items![0]!.side).toBe("₦45,000");
    expect(rows.filter((entry) => entry.show !== "phone").every((entry) => entry.show === "desktop")).toBe(true);
  });
});
