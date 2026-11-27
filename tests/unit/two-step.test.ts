import { afterEach, describe, expect, it } from "vitest";
import { needsSecondStep, twoStepFor } from "../../backend/src/common/two-step";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("two-step sign-in", () => {
  it("covers the owner exactly as it covers the Principal, Proprietor and Bursar", () => {
    for (const role of ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "BURSAR"]) expect(needsSecondStep(role)).toBe(true);
    for (const role of ["TEACHER", "PARENT", "STUDENT"]) expect(needsSecondStep(role)).toBe(false);
  });

  it("says a code reaches the person only when the server can send one", () => {
    delete process.env.SMTP_HOST; delete process.env.AUTH_EMAIL_MFA;
    expect(twoStepFor("SCHOOL_OWNER")).toEqual({ required: true, byEmail: false });
    process.env.SMTP_HOST = "smtp.example.test";
    expect(twoStepFor("SCHOOL_OWNER")).toEqual({ required: true, byEmail: true });
    expect(twoStepFor("TEACHER")).toEqual({ required: false, byEmail: false });
  });
});
