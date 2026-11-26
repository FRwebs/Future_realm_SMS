import { isUnderage } from "../../backend/src/common/student-account";
import { CONSENT_DEFAULTS } from "../../backend/src/modules/student-records/consent.shared";

const now = new Date("2026-11-26T10:00:00Z");

describe("a student account needs a guardian's consent until the student is 18", () => {
  it("treats someone not yet 18 as needing it", () => {
    expect(isUnderage(new Date("2012-05-01"), now)).toBe(true);
    expect(isUnderage(new Date("2008-11-27"), now)).toBe(true);
  });

  it("stops needing it on the 18th birthday", () => {
    expect(isUnderage(new Date("2008-11-26"), now)).toBe(false);
    expect(isUnderage(new Date("2001-01-01"), now)).toBe(false);
  });

  it("is a consent every school asks, answered for the child and not the family", () => {
    const type = CONSENT_DEFAULTS.find((entry) => entry.code === "student-account");
    expect(type?.scope).toBe("child");
    expect(type?.basis).toBe(false);
  });
});
