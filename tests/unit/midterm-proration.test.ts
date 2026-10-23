import {
  MIN_UPGRADE_DAYS,
  checkUpgradeWindow,
  daysBetween,
  directionOf,
  proratedUpgradeCharge,
  prorationBasis,
} from "../../backend/src/modules/subscription-billing/proration";

const term = { startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-03-31T00:00:00Z") };

describe("how much of a term is left", () => {
  it("counts a term inclusively, so the last day is one the school has", () => {
    // 1 January to 31 March is 90 days apart and 91 days long.
    expect(daysBetween(term.startDate, term.endDate)).toBe(89);
    expect(prorationBasis(term, term.startDate).totalTermDays).toBe(90);
  });

  it("charges for today, because today is a day the school gets the new tier", () => {
    const onTheFirstDay = prorationBasis(term, new Date("2026-01-01T09:00:00Z"));
    expect(onTheFirstDay.remainingTermDays).toBe(90);
    expect(onTheFirstDay.prorationRatio).toBe(1);
  });

  it("leaves one day on the last day of term, never zero", () => {
    const onTheLastDay = prorationBasis(term, new Date("2026-03-31T23:00:00Z"));
    expect(onTheLastDay.remainingTermDays).toBe(1);
  });

  it("never reports more days remaining than the term has", () => {
    const beforeItStarted = prorationBasis(term, new Date("2025-12-01T00:00:00Z"));
    expect(beforeItStarted.remainingTermDays).toBe(beforeItStarted.totalTermDays);
    expect(beforeItStarted.prorationRatio).toBe(1);
  });

  it("reports nothing remaining once the term is over", () => {
    expect(prorationBasis(term, new Date("2026-04-15T00:00:00Z")).remainingTermDays).toBe(0);
  });

  it("ignores the time of day, so two upgrades on one day cost the same", () => {
    const morning = prorationBasis(term, new Date("2026-02-01T06:00:00Z"));
    const evening = prorationBasis(term, new Date("2026-02-01T22:00:00Z"));
    expect(morning).toEqual(evening);
  });
});

describe("what a mid-term upgrade costs", () => {
  it("charges only the difference between the rates, for the part of the term left", () => {
    // Half a term left, 100 students, Standard 600 to Premium 900.
    expect(
      proratedUpgradeCharge({ activeStudentCount: 100, oldRate: 600, newRate: 900, prorationRatio: 0.5 }),
    ).toBe(15_000);
  });

  it("charges the whole difference when the whole term is left", () => {
    expect(
      proratedUpgradeCharge({ activeStudentCount: 100, oldRate: 600, newRate: 1200, prorationRatio: 1 }),
    ).toBe(60_000);
  });

  it("never bills the full new rate — the term is already paid for at the old one", () => {
    const charge = proratedUpgradeCharge({ activeStudentCount: 10, oldRate: 600, newRate: 900, prorationRatio: 1 });
    // 10 x the 300 difference, not 10 x the 900 rate.
    expect(charge).toBe(3_000);
    expect(charge).toBeLessThan(10 * 900);
  });

  it("charges nothing for a downgrade, which is scheduled rather than billed", () => {
    expect(
      proratedUpgradeCharge({ activeStudentCount: 500, oldRate: 1200, newRate: 600, prorationRatio: 0.5 }),
    ).toBe(0);
  });

  it("charges nothing when the tier does not move", () => {
    expect(
      proratedUpgradeCharge({ activeStudentCount: 500, oldRate: 900, newRate: 900, prorationRatio: 0.5 }),
    ).toBe(0);
  });

  it("gives a figure in kobo, not a recurring decimal", () => {
    const charge = proratedUpgradeCharge({ activeStudentCount: 7, oldRate: 600, newRate: 900, prorationRatio: 1 / 3 });
    expect(charge).toBe(700);
    expect(Number.isFinite(charge)).toBe(true);
  });
});

describe("the guardrail on a late upgrade", () => {
  it("refuses to prorate when less than a week of the term is left", () => {
    const result = checkUpgradeWindow(MIN_UPGRADE_DAYS - 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UPGRADE_WINDOW_CLOSED");
      // The refusal has to say what to do instead, not only that it refused.
      expect(result.message).toContain("next term");
    }
  });

  it("allows it on exactly the seventh day, so the boundary is not off by one", () => {
    expect(checkUpgradeWindow(MIN_UPGRADE_DAYS).ok).toBe(true);
  });

  it("counts the singular day correctly when only one is left", () => {
    const result = checkUpgradeWindow(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("1 day of this term");
  });
});

describe("which way a change goes", () => {
  it("reads the direction from the price, not the tier's name", () => {
    expect(directionOf(600, 900)).toBe("UPGRADE");
    expect(directionOf(1200, 600)).toBe("DOWNGRADE");
    expect(directionOf(900, 900)).toBe("SAME");
  });
});
