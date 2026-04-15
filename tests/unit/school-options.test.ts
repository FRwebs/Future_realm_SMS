import {
  compareNigeriaClassOrder,
  getNigeriaClassGroups,
  getNigeriaClassLabel,
  getNigeriaSchoolSection,
  isBasicEducationClass,
  isJuniorSecondaryClass,
  isNurseryClass,
  isPrimaryClass,
  isSeniorSecondaryClass,
  normalizeNigeriaClassValue,
  sortNigeriaClasses
} from "@/lib/school-options";

describe("Nigerian school class options", () => {
  it("normalizes canonical values, human labels, legacy SS labels, and arm suffixes", () => {
    expect(normalizeNigeriaClassValue("CRECHE")).toBe("CRECHE");
    expect(normalizeNigeriaClassValue("Crèche")).toBe("CRECHE");
    expect(normalizeNigeriaClassValue("Pre Nursery")).toBe("PRE_NURSERY");
    expect(normalizeNigeriaClassValue("KG / Reception")).toBe("KG_RECEPTION");
    expect(normalizeNigeriaClassValue("Primary 4 - Blue")).toBe("PRIMARY_4");
    expect(normalizeNigeriaClassValue("JSS1")).toBe("JSS_1");
    expect(normalizeNigeriaClassValue("SS 1 - Emerald")).toBe("SSS_1");
    expect(normalizeNigeriaClassValue("SSS_3")).toBe("SSS_3");
    expect(normalizeNigeriaClassValue("Diploma 1")).toBeUndefined();
  });

  it("groups classes by the Nigerian academic sections", () => {
    const groups = getNigeriaClassGroups();

    expect(groups.map((group) => group.label)).toEqual([
      "Creche",
      "Nursery",
      "Primary",
      "Junior Secondary",
      "Senior Secondary"
    ]);
    expect(groups.find((group) => group.section === "NURSERY")?.options.map((option) => option.value)).toEqual([
      "PRE_NURSERY",
      "NURSERY_1",
      "NURSERY_2",
      "KG_RECEPTION",
      "NURSERY_3"
    ]);
  });

  it("looks up human labels and school sections from canonical or legacy inputs", () => {
    expect(getNigeriaClassLabel("SS 2 - Topaz")).toBe("SSS 2");
    expect(getNigeriaClassLabel("Reception")).toBe("KG / Reception");
    expect(getNigeriaClassLabel("PRIMARY_6")).toBe("Primary 6");
    expect(getNigeriaSchoolSection("Nursery 2")).toBe("NURSERY");
    expect(getNigeriaSchoolSection("JSS 3 - Gold")).toBe("JUNIOR_SECONDARY");
  });

  it("exposes predicate helpers for nursery, primary, JSS, SSS, and basic education", () => {
    expect(isNurseryClass("Pre-Nursery")).toBe(true);
    expect(isPrimaryClass("Primary 1")).toBe(true);
    expect(isJuniorSecondaryClass("JSS 2")).toBe(true);
    expect(isSeniorSecondaryClass("SS 3")).toBe(true);
    expect(isBasicEducationClass("JSS 3")).toBe(true);
    expect(isBasicEducationClass("SSS 1")).toBe(false);
  });

  it("sorts by academic order instead of alphabetical order", () => {
    expect(compareNigeriaClassOrder("Primary 6", "JSS 1")).toBeLessThan(0);
    expect(sortNigeriaClasses(["SSS_1", "CRECHE", "JSS_3", "PRIMARY_1", "KG_RECEPTION"])).toEqual([
      "CRECHE",
      "KG_RECEPTION",
      "PRIMARY_1",
      "JSS_3",
      "SSS_1"
    ]);
  });
});
