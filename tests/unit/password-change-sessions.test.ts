import { predatesPasswordChange } from "../../backend/src/auth/session.guard";

/**
 * Changing a password signs the other devices out.
 *
 * Every account page in this product tells the person so — the student one
 * says "You stay signed in here; other devices are asked to sign in again" —
 * and until this check existed that sentence was not true: a signed token was
 * trusted on its signature alone, so a device that had the old password kept
 * working indefinitely.
 *
 * The whole-seconds comparison is the part worth guarding. A token's `iat` is
 * floored to the second, so a token minted in the same second as the change
 * looks up to a second older than it. Comparing in milliseconds signs out the
 * device that just changed its own password — which is both the opposite of
 * what the page promises and the first thing anyone would notice.
 */

const at = (iso: string) => new Date(iso);
const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("a session that predates a password change", () => {
  it("turns away a token minted before the change", () => {
    expect(
      predatesPasswordChange(seconds("2026-10-24T12:00:00.000Z"), at("2026-10-24T12:30:00.000Z")),
    ).toBe(true);
  });

  it("keeps a token minted after the change", () => {
    expect(
      predatesPasswordChange(seconds("2026-10-24T12:31:00.000Z"), at("2026-10-24T12:30:00.000Z")),
    ).toBe(false);
  });

  it("keeps the device that made the change, whose token lands in the same second", () => {
    // The change is written first, then the replacement token is minted — so
    // the token's second is the change's second, and its milliseconds are lost.
    const changedAt = at("2026-10-24T12:30:00.858Z");
    const replacement = seconds("2026-10-24T12:30:00.861Z");
    expect(predatesPasswordChange(replacement, changedAt)).toBe(false);
  });

  it("still turns away a token from the second before the change", () => {
    expect(
      predatesPasswordChange(seconds("2026-10-24T12:29:59.000Z"), at("2026-10-24T12:30:00.858Z")),
    ).toBe(true);
  });

  it("leaves an account that has never changed its password alone", () => {
    expect(predatesPasswordChange(seconds("2020-01-01T00:00:00.000Z"), null)).toBe(false);
    expect(predatesPasswordChange(seconds("2020-01-01T00:00:00.000Z"), undefined)).toBe(false);
  });
});
