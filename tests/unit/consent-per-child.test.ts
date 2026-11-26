import { CONSENT_DEFAULTS, FAMILY_LEVEL, answerKey, familyAnswer } from "../../backend/src/modules/student-records/consent.shared";

describe("a consent belongs to the child it was given for", () => {
  it("keeps only the guardian's notification channels at family level", () => {
    const family = CONSENT_DEFAULTS.filter((type) => type.scope === "family").map((type) => type.code);
    expect(family).toEqual(["channels"]);
    for (const code of ["core", "health", "photo", "third-party"]) expect(CONSENT_DEFAULTS.find((type) => type.code === code)?.scope).toBe("child");
  });

  it("keys an answer by guardian, consent and child, so two children never share a row", () => {
    expect(answerKey("g1", "photo", "tobi").guardianId_typeCode_studentId).toEqual({ guardianId: "g1", typeCode: "photo", studentId: "tobi" });
    expect(answerKey("g1", "photo", "chidinma").guardianId_typeCode_studentId.studentId).not.toBe("tobi");
    expect(answerKey("g1", "channels").guardianId_typeCode_studentId.studentId).toBe(FAMILY_LEVEL);
  });

  it("reads a family as given only when every child has it", () => {
    expect(familyAnswer([{ status: "GIVEN" }, { status: "GIVEN" }], 2)).toBe("GIVEN");
    expect(familyAnswer([{ status: "GIVEN" }], 2)).toBe("NOT_GIVEN");
    expect(familyAnswer([], 2)).toBe("NOT_GIVEN");
  });

  it("never reads a withdrawal for one child as given for the family", () => {
    expect(familyAnswer([{ status: "GIVEN" }, { status: "WITHDRAWN" }], 2)).toBe("WITHDRAWN");
  });

  it("does not call a family with no children covered", () => {
    expect(familyAnswer([], 0)).toBe("NOT_GIVEN");
  });
});
