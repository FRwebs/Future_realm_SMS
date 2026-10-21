import { CAPABILITIES, PLAN_TO_TIER, TIERS, discountFor, metaOf, priceLockOf, quote, rateOf, round2, tierOf } from "../../backend/src/modules/subscription-billing/billing.shared";

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

describe("a price a school is holding", () => {
  const DAY = 86_400_000;
  const held = (over: Record<string, unknown> = {}) => ({
    plan: "STANDARD",
    schoolSubscription: {
      tier: "STANDARD",
      ratePerStudent: null,
      lockedMonthlyPrice: 450,
      priceLockedUntil: new Date(Date.now() + 30 * DAY),
      priceLockReason: "Held at the price agreed before the change",
      ...over
    }
  });

  it("charges the held price, not the tier's", () => {
    expect(rateOf(held())).toBe(450);
    expect(TIERS.STANDARD.rate).toBe(600);
  });

  it("stops holding it once the date passes", () => {
    const lapsed = held({ priceLockedUntil: new Date(Date.now() - DAY) });
    expect(priceLockOf(lapsed)).toBeNull();
    expect(rateOf(lapsed)).toBe(TIERS.STANDARD.rate);
  });

  it("lets a rate negotiated outright beat a held one", () => {
    expect(rateOf(held({ ratePerStudent: 300 }))).toBe(300);
  });

  it("falls back to the tier when nothing is held", () => {
    expect(rateOf(held({ lockedMonthlyPrice: null, priceLockedUntil: null }))).toBe(TIERS.STANDARD.rate);
  });

  it("reports what is held and why", () => {
    const lock = priceLockOf(held());
    expect(lock?.rate).toBe(450);
    expect(lock?.reason).toContain("agreed before the change");
  });
});
