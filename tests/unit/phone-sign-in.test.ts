import { normalPhone, validMobile } from "../../src/lib/messaging/merge";
import { looksLikeUserCode } from "../../src/lib/auth/user-code";

describe("a phone number is recognised as a sign-in, however it is written", () => {
  it.each(["08030000202", "+2348030000202", "2348030000202", "0803 000 0202", "+234 803 000 0202", "0803-000-0202"])("%s is the same number", (written) => {
    expect(validMobile(written)).toBe(true);
    expect(normalPhone(written)).toBe("08030000202");
  });

  it("is never mistaken for an email address or a User ID", () => {
    expect(validMobile("amaka@school.ng")).toBe(false);
    expect(validMobile("482173")).toBe(false);
    expect(looksLikeUserCode("08030000202")).toBe(false);
    expect(looksLikeUserCode("482173")).toBe(true);
  });
});
