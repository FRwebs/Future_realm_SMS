import { describeOffer, offeredAtLevel } from "../../src/lib/domain/subject-offering";

const lowerPrimaryEnglish = { section: "PRIMARY", applicableClassLevels: ["PRIMARY_1", "PRIMARY_2", "PRIMARY_3"] };
const upperPrimaryEnglish = { section: "PRIMARY", applicableClassLevels: ["PRIMARY_4", "PRIMARY_5", "PRIMARY_6"] };
const jssEnglish = { section: "JUNIOR_SECONDARY", applicableClassLevels: ["JSS_1", "JSS_2", "JSS_3"] };

describe("which classes a subject is for", () => {
  it("offers English Studies to the classes it names, and only those", () => {
    expect(offeredAtLevel(lowerPrimaryEnglish, { name: "Primary 1", schoolSection: "PRIMARY" })).toBe(true);
    expect(offeredAtLevel(upperPrimaryEnglish, { name: "Primary 1", schoolSection: "PRIMARY" })).toBe(false);
    expect(offeredAtLevel(jssEnglish, { name: "Primary 1", schoolSection: "PRIMARY" })).toBe(false);
    expect(offeredAtLevel(jssEnglish, { name: "JSS 2", schoolSection: "JUNIOR_SECONDARY" })).toBe(true);
  });

  it("falls back to the section when no levels are named, and to anyone when nothing is", () => {
    expect(offeredAtLevel({ section: "PRIMARY" }, { name: "Primary 3", schoolSection: "PRIMARY" })).toBe(true);
    expect(offeredAtLevel({ section: "PRIMARY" }, { name: "JSS 1", schoolSection: "JUNIOR_SECONDARY" })).toBe(false);
    expect(offeredAtLevel({}, { name: "SSS 3", schoolSection: "SENIOR_SECONDARY" })).toBe(true);
  });

  it("does not refuse a class level whose name it cannot place", () => {
    expect(offeredAtLevel(lowerPrimaryEnglish, { name: "Grade Seven", schoolSection: "PRIMARY" })).toBe(true);
    expect(offeredAtLevel(lowerPrimaryEnglish, null)).toBe(true);
  });

  it("says the levels the way a person would", () => {
    expect(describeOffer(lowerPrimaryEnglish)).toBe("Primary 1–3");
    expect(describeOffer(jssEnglish)).toBe("JSS 1–3");
    expect(describeOffer({ applicableClassLevels: ["PRE_NURSERY", "NURSERY_1", "NURSERY_2", "KG_RECEPTION"] })).toBe("Pre Nursery, Kg Reception, Nursery 1–2");
    expect(describeOffer({ section: "SENIOR_SECONDARY" })).toBe("Senior Secondary");
  });
});
