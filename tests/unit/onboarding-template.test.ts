import { describe, expect, it } from "vitest";

import { calendarFor, classValueOf, ladderFor, offeredTo, sampleNames, schoolDays, seeded, subjectsFor } from "../../backend/src/modules/onboarding/school-template";
import { looksLikeUserCode, normaliseUserCode } from "../../src/lib/auth/user-code";

describe("the class ladder a school is given", () => {
  it("builds a class for every rung of every level chosen, once each", () => {
    const names = ladderFor(["Primary / Elementary", "Junior Secondary"]).map((rung) => rung.name);
    expect(names).toEqual(["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "JSS 1", "JSS 2", "JSS 3"]);
  });

  it("uses exactly what was typed for a level the product has no name for", () => {
    const ladder = ladderFor(["Kindergarten", "Reception", "form 1", "Form 1"]);
    expect(ladder.map((rung) => rung.name)).toEqual(["KG 1", "KG 2", "Reception", "form 1"]);
    expect(ladder.at(-1)?.section).toBeNull();
  });
});

describe("the subjects a class is offered", () => {
  it("gives a primary 4 class its own level's subjects, each once, without optional or faith-specific ones", () => {
    const seeds = subjectsFor("Nigeria", "PRIMARY").map((subject) => ({ ...subject, applicableClassLevels: subject.levels }));
    const names = offeredTo(seeds, "Primary 4").map((subject) => subject.name);
    expect(names).toContain("Mathematics");
    expect(names).not.toContain("Arabic");
    expect(names.some((name) => /Religious/.test(name))).toBe(false);
    expect(new Set(names).size).toBe(names.length);
  });

  it("starts every other country from a plain international set rather than a Nigerian one", () => {
    const names = subjectsFor("Ghana", "PRIMARY").map((subject) => subject.name);
    expect(names).toContain("English Language");
    expect(names).not.toContain("Nigerian History");
  });

  it("knows a class by its Nigerian value only when it has one", () => {
    expect(classValueOf("Primary 4")).toBe("PRIMARY_4");
    expect(classValueOf("Grade 7")).toBeNull();
  });
});

describe("the school year", () => {
  it("is the First Term of a new year from September, and the year that began last September from January", () => {
    expect(calendarFor(new Date("2026-10-20T10:00:00Z"))).toMatchObject({ sessionName: "2026/2027", current: { name: "First Term" } });
    expect(calendarFor(new Date("2027-02-10T10:00:00Z"))).toMatchObject({ sessionName: "2026/2027", current: { name: "Second Term" } });
    expect(calendarFor(new Date("2027-08-10T10:00:00Z"))).toMatchObject({ sessionName: "2026/2027", current: { name: "Third Term" } });
  });

  it("counts weekdays only", () => {
    // Mon 19 Oct to Sun 25 Oct 2026
    expect(schoolDays(new Date("2026-10-19T00:00:00Z"), new Date("2026-10-25T00:00:00Z"))).toHaveLength(5);
  });
});

describe("the sample class", () => {
  it("is the same for the same school every time, and never has anyone to message", () => {
    const a = seeded("school-1");
    const b = seeded("school-1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(sampleNames("Nigeria")).toHaveLength(30);
    expect(sampleNames("Kenya")[0]).not.toHaveProperty("phone");
  });
});

describe("User IDs", () => {
  it("recognises the six-digit and TC- forms and nothing that looks like an email", () => {
    expect(looksLikeUserCode("482173")).toBe(true);
    expect(looksLikeUserCode("tc-4291")).toBe(true);
    expect(looksLikeUserCode("principal@school.com")).toBe(false);
    expect(looksLikeUserCode("12345")).toBe(false);
    expect(normaliseUserCode(" tc-4291 ")).toBe("TC-4291");
  });
});
