import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; schoolId: string; userId: string; students: Array<{ studentId: string; student: { id: string; schoolId: string } }> };
const state = { rows: [] as Row[], opened: [] as Array<{ schoolId: string; input: Record<string, unknown> }> };

vi.mock("../../src/lib/db/prisma", () => ({ prisma: { guardian: { findMany: async () => state.rows } } }));
vi.mock("../../backend/src/modules/guardian-management/submission-intake", () => ({
  submissionTypes: async () => [],
  openSubmission: async (schoolId: string, input: Record<string, unknown>) => { state.opened.push({ schoolId, input }); return { id: "sub-1" }; },
}));

import { FamilyInboxService } from "../../backend/src/modules/parent-portal/family-inbox.service";

const parent = { userId: "u-funke", schoolId: "school-a", role: "PARENT" } as never;
const detail = "Please tell me what the school needs from me.";

describe("a request from a parent whose children are at two schools", () => {
  beforeEach(() => {
    state.opened = [];
    state.rows = [
      { id: "g-a", schoolId: "school-a", userId: "u-funke", students: [{ studentId: "kid-a", student: { id: "kid-a", schoolId: "school-a" } }] },
      { id: "g-b", schoolId: "school-b", userId: "u-funke", students: [{ studentId: "kid-b", student: { id: "kid-b", schoolId: "school-b" } }] },
    ];
  });

  it("about a child goes to that child's school, under that school's own guardian record", async () => {
    await new FamilyInboxService().submit(parent, { type: "Result query", child: "kid-b", detail });
    expect(state.opened).toHaveLength(1);
    expect(state.opened[0]).toMatchObject({ schoolId: "school-b", input: { guardianId: "g-b", childId: "kid-b" } });
  });

  it("about no child goes to the school they name, or else the one they signed in to", async () => {
    const service = new FamilyInboxService();
    await service.submit(parent, { type: "Contact update", school: "school-b", detail });
    await service.submit(parent, { type: "Contact update", detail });
    expect(state.opened.map((entry) => [entry.schoolId, entry.input.guardianId])).toEqual([["school-b", "g-b"], ["school-a", "g-a"]]);
  });

  it("is refused for a school they are not a guardian at", async () => {
    await expect(new FamilyInboxService().submit(parent, { type: "Contact update", school: "school-z", detail })).rejects.toThrow(/not a guardian at that school/);
    expect(state.opened).toHaveLength(0);
  });
});
