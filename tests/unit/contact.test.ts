import { describe, expect, it } from "vitest";
import { emailProblem, phoneProblem } from "../../src/lib/domain/contact";

describe("phone numbers", () => {
  it("accepts a Nigerian mobile however it is written", () => {
    for (const ok of ["08031234567", "0803 123 4567", "+234 803 123 4567", "2348031234567", "0803-123-4567", "(0803) 123 4567"]) expect(phoneProblem(ok)).toBeNull();
  });

  it("turns away what cannot be a number, and says why", () => {
    expect(phoneProblem("123")).toMatch(/only 3 digits/);
    expect(phoneProblem("abc")).toMatch(/digits only/);
    expect(phoneProblem("12ab12ab12")).toMatch(/digits only/);
    expect(phoneProblem("0803123456789012345")).toMatch(/too many digits/);
    expect(phoneProblem("0803+1234567")).toMatch(/\+ sign/);
  });

  it("holds a mobile to the Nigerian format, but lets an office line be a landline", () => {
    expect(phoneProblem("01 234 5678")).toMatch(/Nigerian mobile/);
    expect(phoneProblem("01 234 5678", { kind: "line" })).toBeNull();
    expect(phoneProblem("0603 123 4567")).toMatch(/Nigerian mobile/);
  });

  it("uses the country's own pattern from configuration, and names that country", () => {
    const ghana = { pattern: "^(\\+?233|0)[235]\\d{8}$", country: "Ghana" };
    expect(phoneProblem("024 123 4567", ghana)).toBeNull();
    expect(phoneProblem("+233 24 123 4567", ghana)).toBeNull();
    expect(phoneProblem("0803 123 4567", ghana)).toMatch(/valid Ghana mobile/);
  });

  it("checks only the shape when the country has no pattern, and treats empty as not its business", () => {
    expect(phoneProblem("0803 123 4567", { country: "any" })).toBeNull();
    expect(phoneProblem("123", { country: "any" })).toMatch(/only 3 digits/);
    expect(phoneProblem("")).toBeNull();
    expect(phoneProblem(undefined)).toBeNull();
  });
});

describe("email addresses", () => {
  it("accepts an address with a name, an @ and a domain", () => {
    for (const ok of ["a@b.co", "tobi.eze@school.edu.ng", "x+tag@mail.example.com"]) expect(emailProblem(ok)).toBeNull();
  });

  it("turns away an address that cannot receive anything", () => {
    for (const bad of ["not-an-email", "a@b", "@school.com", "a b@school.com", "a@@b.com", "a..b@school.com", "a@school..com", "a@b.c"]) expect(emailProblem(bad)).toMatch(/not complete/);
    expect(emailProblem("")).toBeNull();
  });
});
