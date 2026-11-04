import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string; schoolId: string; userId: string | null; email: string | null; mergedIntoId: string | null; safeguardingRestrictedAt: Date | null;
  firstName: string; lastName: string; relationship: string; kids: string[]; school: { name: string; shortName: string | null; city: string | null; state: string | null };
};
const state = { rows: [] as Row[], user: { id: "u-funke", email: "Funke@Example.ng" } as { id: string; email: string } | null, contacts: [] as Array<Record<string, unknown>>, audits: [] as Array<Record<string, unknown>>, raceTaken: false };

const matches = (row: Row, where: Record<string, unknown>) => {
  if ("userId" in where && row.userId !== where.userId) return false;
  if ("mergedIntoId" in where && row.mergedIntoId !== where.mergedIntoId) return false;
  if ("safeguardingRestrictedAt" in where && row.safeguardingRestrictedAt !== where.safeguardingRestrictedAt) return false;
  if ("id" in where && row.id !== where.id) return false;
  const email = where.email as { equals: string } | undefined;
  if (email && row.email?.toLowerCase() !== email.equals.toLowerCase()) return false;
  const school = where.schoolId as { notIn: string[] } | undefined;
  if (school?.notIn?.includes(row.schoolId)) return false;
  return true;
};
const shape = (row: Row) => ({ ...row, students: row.kids.map((name) => ({ studentId: name, student: { firstName: name } })) });

const prisma: Record<string, unknown> = {
  user: { findFirst: async () => state.user },
  guardian: {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      where.userId && typeof where.userId === "string"
        ? state.rows.filter((row) => row.userId === where.userId && !row.mergedIntoId).map(shape)
        : state.rows.filter((row) => matches(row, where) && row.kids.length).map(shape),
    findFirst: async ({ where }: { where: Record<string, unknown> }) => state.rows.filter((row) => matches(row, where)).map(shape)[0] ?? null,
    updateMany: async ({ where, data }: { where: { id: string; userId: null }; data: { userId: string } }) => {
      const row = state.rows.find((item) => item.id === where.id && item.userId === where.userId);
      if (!row || state.raceTaken) return { count: 0 };
      row.userId = data.userId;
      return { count: 1 };
    },
  },
  guardianContact: { create: async ({ data }: { data: Record<string, unknown> }) => { state.contacts.push(data); } },
  auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { state.audits.push(data); } },
  $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(prisma),
};
vi.mock("../../src/lib/db/prisma", () => ({ get prisma() { return prisma; } }));

import { linkSchool, schoolOffers } from "../../backend/src/modules/parent-portal/school-links";

const session = { userId: "u-funke", schoolId: "school-a", role: "PARENT", email: "funke@example.ng", name: "Funke" } as never;
const place = { name: "Grace International School", shortName: "GIS", city: "Accra", state: "Greater Accra" };
const row = (over: Partial<Row>): Row => ({
  id: "g-b", schoolId: "school-b", userId: null, email: "funke@example.ng", mergedIntoId: null, safeguardingRestrictedAt: null,
  firstName: "Funke", lastName: "Yusuf", relationship: "Mother", kids: ["Kemi"], school: place, ...over,
});

describe("a parent adding a second school to the login they already have", () => {
  beforeEach(() => {
    state.user = { id: "u-funke", email: "Funke@Example.ng" };
    state.contacts = [];
    state.audits = [];
    state.raceTaken = false;
    state.rows = [row({ id: "g-a", schoolId: "school-a", userId: "u-funke", kids: ["Daniel"] }), row({})];
  });

  it("is offered the record a school wrote with their own email, whatever the capitals", async () => {
    const offers = await schoolOffers(session);
    expect(offers).toEqual([{ id: "g-b", name: "Funke Yusuf", relationship: "Mother", school: place.name, short: "GIS", place: "Accra, Greater Accra", children: ["Kemi"] }]);
  });

  it("is never offered a record that only shares a phone number, or a different email", async () => {
    state.rows = [state.rows[0]!, row({ email: "someone.else@example.ng" }), row({ id: "g-c", email: null })];
    expect(await schoolOffers(session)).toEqual([]);
  });

  it("is not offered a record that another login holds, a merged one, a safeguarding-restricted one, or one with no child", async () => {
    state.rows = [
      state.rows[0]!,
      row({ id: "g-taken", userId: "u-other" }),
      row({ id: "g-merged", mergedIntoId: "g-x" }),
      row({ id: "g-held", safeguardingRestrictedAt: new Date() }),
      row({ id: "g-empty", kids: [] }),
    ];
    expect(await schoolOffers(session)).toEqual([]);
  });

  it("is not offered a school they already belong to", async () => {
    state.rows = [state.rows[0]!, row({ id: "g-same", schoolId: "school-a" })];
    expect(await schoolOffers(session)).toEqual([]);
  });

  it("links only when they accept, and leaves a trail at the school", async () => {
    expect(await schoolOffers(session)).toHaveLength(1);
    expect(state.rows[1]!.userId).toBeNull();
    expect(await linkSchool(session, "g-b")).toEqual({ id: "g-b", school: place.name, children: 1 });
    expect(state.rows[1]!.userId).toBe("u-funke");
    expect(state.contacts).toMatchObject([{ schoolId: "school-b", guardianId: "g-b", kind: "LINK", createdById: "u-funke" }]);
    expect(state.audits).toMatchObject([{ schoolId: "school-b", actorId: "u-funke", entityId: "g-b" }]);
    expect(await schoolOffers(session)).toEqual([]);
  });

  it("refuses a record whose email is not theirs, even if they name it directly", async () => {
    state.rows[1]!.email = "someone.else@example.ng";
    await expect(linkSchool(session, "g-b")).rejects.toThrow(/not open to link/);
    expect(state.rows[1]!.userId).toBeNull();
    expect(state.audits).toEqual([]);
  });

  it("refuses a record already held by another login", async () => {
    state.rows[1]!.userId = "u-other";
    await expect(linkSchool(session, "g-b")).rejects.toThrow(/not open to link/);
    expect(state.rows[1]!.userId).toBe("u-other");
  });

  it("changes nothing if another login took the record between the check and the write", async () => {
    state.raceTaken = true;
    await expect(linkSchool(session, "g-b")).rejects.toThrow(/a moment ago/);
    expect(state.contacts).toEqual([]);
    expect(state.audits).toEqual([]);
  });
});
