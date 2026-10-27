import { getUrl } from "@/lib/api/client";

describe("getUrl", () => {
  it("fills placeholders and appends a query", () => {
    expect(getUrl("/api/super-admin/internal-team/devices/{userId}", { userId: "u 1" })).toBe("/api/super-admin/internal-team/devices/u%201");
    expect(getUrl("/api/v1/onboarding/slug-check", { slug: "green field", empty: undefined })).toBe("/api/v1/onboarding/slug-check?slug=green+field");
    expect(getUrl("/api/v1/memberships/mine")).toBe("/api/v1/memberships/mine");
  });

  it("refuses, at compile time, an endpoint the API does not have or a placeholder with the wrong name", () => {
    // These lines are checked by `npm run type-check`; the directives fail the build if the calls ever start to type-check.
    // @ts-expect-error — no such endpoint
    expect(() => getUrl("/api/v1/memberships/mine-typo")).not.toThrow();
    // @ts-expect-error — the placeholder is called userId
    expect(() => getUrl("/api/super-admin/internal-team/devices/{userId}", { id: "x" })).not.toThrow();
  });
});
