import { forgotPasswordSchema, resetPasswordSchema, signInCodeSchema, signInSchema } from "@/lib/validation/auth";

const messages = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]));

describe("sign-in, recovery and reset rules", () => {
  it("asks for both details when neither is given", () => {
    expect(messages(signInSchema.safeParse({ identifier: " ", password: "", trustDevice: true }))).toEqual({
      identifier: "Enter your email address or User ID.",
      password: "Enter your password.",
    });
  });

  it("accepts an email address or a numeric User ID", () => {
    expect(signInSchema.safeParse({ identifier: "482173", password: "x", trustDevice: false }).success).toBe(true);
    expect(signInSchema.safeParse({ identifier: "  a@school.ng ", password: "x", trustDevice: true }).data?.identifier).toBe("a@school.ng");
  });

  it("wants a code before it will try one", () => {
    expect(messages(signInCodeSchema.safeParse({ code: "  " }))).toEqual({ code: "Enter the 6-digit code." });
  });

  it("tells a missing email from a malformed one", () => {
    expect(messages(forgotPasswordSchema.safeParse({ email: "" })).email).toBe("Enter the email address of your account.");
    expect(messages(forgotPasswordSchema.safeParse({ email: "not-an-email" })).email).toBe("That does not look like an email address.");
    expect(forgotPasswordSchema.safeParse({ email: "boss@school.ng" }).success).toBe(true);
  });

  it("names each password gap separately and together", () => {
    expect(messages(resetPasswordSchema.safeParse({ password: "", confirmPassword: "" }))).toEqual({
      password: "Choose a new password.",
      confirmPassword: "Type it again to be sure.",
    });
    expect(messages(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" })).password).toBe("Use at least 8 characters.");
    expect(messages(resetPasswordSchema.safeParse({ password: "longenough1", confirmPassword: "different1" })).confirmPassword).toBe("The two passwords are not the same.");
    expect(resetPasswordSchema.safeParse({ password: "longenough1", confirmPassword: "longenough1" }).success).toBe(true);
  });
});
