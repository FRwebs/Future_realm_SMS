import { CAPABILITIES, PLAN_TO_TIER, TIERS, discountFor, metaOf, quote, rateOf, round2, tierOf } from "../../backend/src/modules/subscription-billing/billing.shared";

describe("the price list", () => {
  it("prices a tier per student per term", () => {
    expect(TIERS.STANDARD.rate).toBe(600);
    expect(TIERS.PREMIUM.rate).toBe(900);
    expect(TIERS.ELITE.rate).toBe(1200);
  });

  it("gives more to the dearer tiers and takes nothing away", () => {
    expect(TIERS.ELITE.baseSms).toBeGreaterThan(TIERS.PREMIUM.baseSms);
    expect(TIERS.PREMIUM.baseSms).toBeGreaterThan(TIERS.STANDARD.baseSms);
    for (const capability of CAPABILITIES) {
      if (capability.standard) expect(capability.premium && capability.elite).toBe(true);
      if (capability.premium) expect(capability.elite).toBe(true);
    }
  });

  it("keeps the full data export on every tier", () => {
    expect(CAPABILITIES.find((capability) => capability.label.includes("Full data export"))).toMatchObject({ standard: true, premium: true, elite: true });
  });
});

describe("credits", () => {
  it("gives the volume discount only at its thresholds", () => {
    expect(discountFor(9_999)).toBe(0);
    expect(discountFor(10_000)).toBe(0.03);
    expect(discountFor(24_999)).toBe(0.03);
    expect(discountFor(25_000)).toBe(0.06);
  });

  it("works a price out to the kobo", () => {
    expect(quote("SMS", 10_000)).toMatchObject({ rate: 3.8, gross: 38000, subtotal: 36860 });
    expect(quote("WHATSAPP", 2_500)).toMatchObject({ gross: 11000, subtotal: 11000 });
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("which tier a school is on", () => {
  it("reads it from the plan it was sold until it chooses one", () => {
    expect(tierOf({ plan: "ENTERPRISE", schoolSubscription: null })).toBe("ELITE");
    expect(tierOf({ plan: "BASIC", schoolSubscription: null })).toBe("STANDARD");
    expect(PLAN_TO_TIER.PROFESSIONAL).toBe("PREMIUM");
  });

  it("prefers the school's own choice, and its own negotiated rate", () => {
    expect(tierOf({ plan: "ENTERPRISE", schoolSubscription: { tier: "PREMIUM" } })).toBe("PREMIUM");
    expect(rateOf({ plan: "ENTERPRISE", schoolSubscription: { tier: "PREMIUM", ratePerStudent: null } })).toBe(900);
    expect(rateOf({ plan: "ENTERPRISE", schoolSubscription: { tier: "PREMIUM", ratePerStudent: 750 } })).toBe(750);
  });

  it("reads an invoice's notes without failing on nothing", () => {
    expect(metaOf(null)).toEqual({});
    expect(metaOf({ kind: "TOPUP" }).kind).toBe("TOPUP");
  });
});
