import { describe, expect, it } from "vitest";

import { isSeniorClass, modeOfValue, noPeriodRegisterBecause, takesPeriodRegister } from "../../backend/src/common/attendance-mode";

describe("how the school takes attendance", () => {
  it("reads the policy's own wording, and treats anything unsaid as daily", () => {
    expect(modeOfValue("Daily")).toBe("daily");
    expect(modeOfValue("Per period")).toBe("period");
    expect(modeOfValue("Hybrid · daily with per-period for senior classes")).toBe("hybrid");
    expect(modeOfValue(undefined)).toBe("daily");
    expect(modeOfValue("")).toBe("daily");
  });

  it("knows the senior classes by their section or by their name", () => {
    expect(isSeniorClass({ name: "SSS 2", schoolSection: null })).toBe(true);
    expect(isSeniorClass({ name: "SS 1", schoolSection: null })).toBe(true);
    expect(isSeniorClass({ name: "Whatever", schoolSection: "SENIOR_SECONDARY" })).toBe(true);
    expect(isSeniorClass({ name: "JSS 3", schoolSection: "JUNIOR_SECONDARY" })).toBe(false);
    expect(isSeniorClass({ name: "Primary 4", schoolSection: null })).toBe(false);
  });

  it("asks a register for each period only where the mode says so", () => {
    const junior = { name: "JSS 1", schoolSection: "JUNIOR_SECONDARY" };
    const senior = { name: "SSS 1", schoolSection: "SENIOR_SECONDARY" };
    expect(takesPeriodRegister("daily", senior)).toBe(false);
    expect(takesPeriodRegister("period", junior)).toBe(true);
    expect(takesPeriodRegister("hybrid", junior)).toBe(false);
    expect(takesPeriodRegister("hybrid", senior)).toBe(true);
  });

  it("says why there is no register, and says nothing when there is one", () => {
    expect(noPeriodRegisterBecause("daily")).toMatch(/once a day/);
    expect(noPeriodRegisterBecause("hybrid")).toMatch(/only in its senior classes/);
    expect(noPeriodRegisterBecause("period")).toBeNull();
  });
});
