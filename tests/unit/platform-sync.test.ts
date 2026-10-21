import { describe, expect, it } from "vitest";

import { API_PREFIXES_BY_MODULE, PLATFORM_KEYS_BY_MODULE } from "../../backend/src/modules/platform-sync/availability";
import { planForTier, tierForPlan } from "../../backend/src/modules/platform-sync/plan-sync";
import { schoolModules } from "../../src/lib/modules/school-modules";

describe("plan and tier stay one answer", () => {
  it("reads a tier from each plan the Back Office sells", () => {
    expect(tierForPlan("BASIC")).toBe("STANDARD");
    expect(tierForPlan("PROFESSIONAL")).toBe("PREMIUM");
    expect(tierForPlan("ENTERPRISE")).toBe("ELITE");
  });

  it("moves the plan when a tier takes effect, but keeps one that already means that tier", () => {
    expect(planForTier("PREMIUM", "STANDARD")).toBe("PROFESSIONAL");
    expect(planForTier("STANDARD", "BASIC")).toBe("BASIC");
    expect(planForTier("ELITE", "PROFESSIONAL")).toBe("ENTERPRISE");
  });

  it("never rewrites Custom, which marks a negotiated price or a concession", () => {
    expect(planForTier("STANDARD", "CUSTOM")).toBe("CUSTOM");
    expect(planForTier("PREMIUM", "CUSTOM")).toBe("CUSTOM");
  });
});

describe("module availability map", () => {
  it("names only modules the School Admin really has", () => {
    const slugs = new Set(schoolModules.map((module) => module.slug));
    for (const slug of Object.keys(PLATFORM_KEYS_BY_MODULE)) expect(slugs.has(slug)).toBe(true);
    for (const [, slug] of API_PREFIXES_BY_MODULE) expect(slugs.has(slug)).toBe(true);
  });

  it("can never switch off the pages a school needs to get back in", () => {
    for (const core of ["command-center", "school-configuration", "staff-access", "subscription-billing", "approvals-workflow", "audit-security", "sync-support"]) {
      expect(PLATFORM_KEYS_BY_MODULE[core]).toBeUndefined();
      expect(API_PREFIXES_BY_MODULE.some(([, slug]) => slug === core)).toBe(false);
    }
  });

  it("closes every switchable module at the API as well as in the sidebar", () => {
    const closed = new Set(API_PREFIXES_BY_MODULE.map(([, slug]) => slug));
    for (const slug of Object.keys(PLATFORM_KEYS_BY_MODULE)) expect(closed.has(slug)).toBe(true);
  });
});
