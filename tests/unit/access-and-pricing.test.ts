import { describe, expect, it } from "vitest";

import { actionOfRequest, LEVEL_ACTIONS } from "../../backend/src/modules/team-access/access";
import { inSchoolCurrency, setPricingSnapshot, tierNairaRate } from "../../backend/src/modules/platform-policy/pricing-snapshot";

const pricing = { anchor: "USD" as const, usd: { STANDARD: 0.4, PREMIUM: 0.6, ELITE: 0.8 }, ratesFor: "Term 1", ngnPerUsd: 1500, ngnPerGhs: 100, ngnPerKes: 0, ngnPerGbp: 0, shockPercent: 15, source: "", pending: null };

describe("actionOfRequest", () => {
  it("reads the action from the method and the path", () => {
    expect(actionOfRequest("GET", "/api/super-admin/billing/invoices")).toBe("view");
    expect(actionOfRequest("GET", "/api/super-admin/billing-extras/invoices/export")).toBe("export");
    expect(actionOfRequest("POST", "/api/super-admin/support-desk/tickets/assign")).toBe("create");
    expect(actionOfRequest("POST", "/api/super-admin/partners/statements/settle-many")).toBe("approve");
    expect(actionOfRequest("PATCH", "/api/super-admin/schools/abc")).toBe("edit");
    expect(actionOfRequest("DELETE", "/api/super-admin/anything")).toBe("delete");
  });

  it("gives Full delete and nobody less than View the right to change", () => {
    expect(LEVEL_ACTIONS.FULL).toContain("delete");
    expect(LEVEL_ACTIONS.EDIT).not.toContain("delete");
    expect(LEVEL_ACTIONS.VIEW).toEqual(["view", "export"]);
    expect(LEVEL_ACTIONS.NONE).toEqual([]);
  });
});

describe("pricing snapshot", () => {
  it("keeps the built-in naira price until a tier is authored in dollars", () => {
    setPricingSnapshot({ ...pricing, anchor: "NGN" });
    expect(tierNairaRate("STANDARD", 600)).toBe(600);
  });

  it("derives the naira price from the dollar price at the term's rate, to the nearest 50 kobo", () => {
    setPricingSnapshot(pricing);
    expect(tierNairaRate("STANDARD", 600)).toBe(600);
    expect(tierNairaRate("ELITE", 1200)).toBe(1200);
    setPricingSnapshot({ ...pricing, ngnPerUsd: 1523.37 });
    expect(tierNairaRate("STANDARD", 600)).toBe(609.5);
  });

  it("converts an invoice into the school's own currency, and refuses where no rate is fixed", () => {
    setPricingSnapshot(pricing);
    expect(inSchoolCurrency(1000, "NGN")).toBe(1000);
    expect(inSchoolCurrency(1000, "GHS")).toBe(10);
    expect(() => inSchoolCurrency(1000, "KES")).toThrow(/No rate is fixed for KES/);
  });
});
