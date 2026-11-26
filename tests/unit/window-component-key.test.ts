import { sectionColumnKey } from "../../backend/src/modules/score-results/scores.shared";

describe("the stored component an assessment window is set against", () => {
  it("is named by section, component and maximum, so another section's cannot be mistaken for it", () => {
    expect(sectionColumnKey("JUNIOR_SECONDARY", { code: "TEST_1", type: "TEST", maxScore: 10 })).toBe("JUNIOR_SECONDARY:TEST_1:10");
    expect(sectionColumnKey("PRIMARY", { code: "TEST_1", type: "TEST", maxScore: 10 })).toBe("PRIMARY:TEST_1:10");
    expect(sectionColumnKey("PRIMARY", { code: "TEST_1", type: "TEST", maxScore: 10 })).not.toBe(sectionColumnKey("SENIOR_SECONDARY", { code: "TEST_1", type: "TEST", maxScore: 10 }));
  });

  it("calls every examination EXAM, whatever the school named it", () => {
    expect(sectionColumnKey("SENIOR_SECONDARY", { code: "TERMINAL_EXAM", type: "EXAMINATION", maxScore: 40 })).toBe("SENIOR_SECONDARY:EXAM:40");
  });
});
