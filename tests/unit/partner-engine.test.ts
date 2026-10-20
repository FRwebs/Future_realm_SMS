import { describe, expect, it } from "vitest";

import { ratesFor, relationshipYear } from "../../backend/src/modules/partners/partner-engine.service";

describe("what a partner is paid in each year of a school", () => {
  it("uses the partner's own schedule when it has one", () => {
    expect(ratesFor({ yearRates: [20, 12, 6], commissionRatePercent: 20 }, 20)).toEqual([20, 12, 6]);
  });

  it("steps the deal rate down to 60% and then 30% when there is no schedule, and then it ends", () => {
    expect(ratesFor({ yearRates: null, commissionRatePercent: 20 }, 20)).toEqual([20, 12, 6]);
    expect(ratesFor({ yearRates: [], commissionRatePercent: 15 }, 15)).toEqual([15, 9, 4.5]);
  });

  it("ignores a schedule that is not made of percentages", () => {
    expect(ratesFor({ yearRates: ["x", -5, 200 * 0 + 10], commissionRatePercent: 10 }, 10)).toEqual([10]);
  });
});

describe("the relationship year", () => {
  const first = new Date("2026-08-04T00:00:00Z");

  it("counts from the first reconciled invoice, not from the agreement", () => {
    expect(relationshipYear(first, new Date("2026-08-04T00:00:00Z"))).toBe(1);
    expect(relationshipYear(first, new Date("2027-08-03T00:00:00Z"))).toBe(1);
    expect(relationshipYear(first, new Date("2027-08-05T00:00:00Z"))).toBe(2);
    expect(relationshipYear(first, new Date("2029-08-10T00:00:00Z"))).toBe(4);
  });
});
