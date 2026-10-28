import { withoutSecrets } from "../../backend/src/common/secret-strip.interceptor";

describe("what an answer may never carry", () => {
  it("removes a password hash and a two-step secret wherever they sit, and leaves everything else as it was", () => {
    const user = { id: "u1", firstName: "Ada", passwordHash: "$2b$10$abc", mfaSecret: "JBSWY3DP", mfaBackupCodeHashes: ["h1"], mfaEnabled: true };
    const answer = { ok: true, data: { leads: [{ id: "l1", assignedTo: user }], createdAt: new Date("2026-01-01T00:00:00Z") } };
    const clean = withoutSecrets(answer);
    expect(JSON.stringify(clean)).not.toMatch(/passwordHash|mfaSecret|mfaBackupCodeHashes|\$2b\$/);
    expect(clean.data.leads[0]!.assignedTo).toEqual({ id: "u1", firstName: "Ada", mfaEnabled: true });
    expect(clean.data.createdAt).toBeInstanceOf(Date);
  });

  it("passes text, numbers and nothing through untouched", () => {
    expect(withoutSecrets("x")).toBe("x");
    expect(withoutSecrets(3)).toBe(3);
    expect(withoutSecrets(null)).toBeNull();
  });
});
