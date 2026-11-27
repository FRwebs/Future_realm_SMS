import { changeOf, reasonOf } from "../../backend/src/common/audit-diff";

describe("what an audit entry records of a change", () => {
  it("keeps only the fields that changed, as they were and as they are", () => {
    const before = { name: "Third Term", startDate: new Date("2026-05-08T00:00:00Z"), isCurrent: false, updatedAt: new Date("2026-01-01") };
    const after = { name: "Third Term", startDate: new Date("2026-05-11T00:00:00Z"), isCurrent: false, updatedAt: new Date("2026-02-02") };
    const change = changeOf(before, after);
    expect(change?.old).toEqual({ startDate: "2026-05-08T00:00:00.000Z" });
    expect(change?.new).toEqual({ startDate: "2026-05-11T00:00:00.000Z" });
  });

  it("says nothing when nothing changed", () => {
    expect(changeOf({ a: 1, b: "x" }, { a: 1, b: "x" })).toBeNull();
  });

  it("reads a field that was empty as nothing, and tells apart a changed object", () => {
    const change = changeOf({ motto: null, flags: { a: 1 } }, { motto: "Learn", flags: { a: 2 } });
    expect(change?.old).toEqual({ motto: null, flags: { a: 1 } });
    expect(change?.new).toEqual({ motto: "Learn", flags: { a: 2 } });
  });

  it("can be limited to named fields", () => {
    expect(changeOf({ a: 1, b: 1 }, { a: 2, b: 2 }, ["b"])?.new).toEqual({ b: 2 });
  });

  it("takes the reason a person gave, trimmed, and none when they gave none", () => {
    expect(reasonOf({ reason: "  The ministry moved resumption  " })).toBe("The ministry moved resumption");
    expect(reasonOf({ reason: "   " })).toBeUndefined();
    expect(reasonOf({})).toBeUndefined();
    expect(reasonOf(null)).toBeUndefined();
  });
});
