import { collectorUntil } from "../../backend/src/common/collectors";

const now = new Date("2026-11-26T10:00:00Z");

describe("how long an accepted collector may collect", () => {
  it("never ends for someone added for good", () => {
    expect(collectorUntil({ permanent: true }, now)).toBeNull();
    expect(collectorUntil({ permanent: true, date: "2026-12-01" }, now)).toBeNull();
  });

  it("ends with the named day for someone added for one day", () => {
    expect(collectorUntil({ date: "2026-12-01" }, now)?.toISOString()).toBe("2026-12-01T23:59:59.999Z");
  });

  it("ends tomorrow when no day was named", () => {
    expect(collectorUntil({}, now)?.toISOString()).toBe("2026-11-27T10:00:00.000Z");
  });
});
