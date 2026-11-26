import { ADMISSION_PREFIX, admissionPrefixFor, derivedAdmissionPrefix, formatAdmission } from "../../src/lib/domain/admission-number";

describe("a school's admission numbers carry its own letters", () => {
  it("reads the letters from the school's name, never from another school's", () => {
    expect(derivedAdmissionPrefix({ shortName: "Living Academy" })).toBe("LA");
    expect(derivedAdmissionPrefix({ name: "Greenfield College Ibadan" })).toBe("GCI");
    expect(derivedAdmissionPrefix({ shortName: "Bright" })).toBe("BRI");
    expect(derivedAdmissionPrefix({ shortName: "St. Mary's & Sons Academy" })).toBe("SMSA");
  });

  it("prefers the short name, then the full name, then a plain fallback", () => {
    expect(derivedAdmissionPrefix({ shortName: "Hope School", name: "Hope Hill Schools" })).toBe("HS");
    expect(derivedAdmissionPrefix({ shortName: "", name: "Hope Hill Schools" })).toBe("HHS");
    expect(derivedAdmissionPrefix({ shortName: null, name: null })).toBe("ADM");
    expect(derivedAdmissionPrefix({ name: "7" })).toBe("ADM");
  });

  it("uses the school's own choice when it is a valid one", () => {
    expect(admissionPrefixFor({ admissionPrefix: "gfc", shortName: "Living Academy" })).toBe("GFC");
    expect(admissionPrefixFor({ admissionPrefix: "A", shortName: "Living Academy" })).toBe("LA");
    expect(admissionPrefixFor({ admissionPrefix: "ab-1", shortName: "Living Academy" })).toBe("LA");
    expect(ADMISSION_PREFIX.test("LA26")).toBe(true);
  });

  it("writes prefix, year and a four-digit running number", () => {
    expect(formatAdmission("LA", 2026, 1)).toBe("LA/26/0001");
    expect(formatAdmission("LA", 2027, 12345)).toBe("LA/27/12345");
  });
});
