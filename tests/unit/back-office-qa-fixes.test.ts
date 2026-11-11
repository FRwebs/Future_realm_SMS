import { describe, expect, it } from "vitest";

import { mfaIsSkippable } from "../../backend/src/modules/auth/auth.service";
import { addressFormatOk, addressIsReserved } from "../../backend/src/modules/web-address-registry/web-address-registry.service";
import { geoFor } from "../../src/lib/onboarding/geo";
import { NIGERIA_LGAS, lgasFor } from "../../src/lib/onboarding/nigeria-lgas";

/**
 * The rules behind four findings in the Back Admin QA tracker, and the geography the Add school
 * wizard asks for.
 *
 * Three were checks that looked present and were not: a second factor that quietly stood
 * aside when email was not configured, an address check that only knew three names, and an LGA
 * field with nothing behind it.
 */

describe("the second factor on a back-office sign-in", () => {
  const withoutMail = () => {
    delete process.env.AUTH_EMAIL_MFA;
    delete process.env.SMTP_HOST;
  };

  it("is never skipped for an account that runs the platform, however the mail server is set up", () => {
    withoutMail();
    for (const role of ["SUPER_ADMIN", "PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT_AGENT", "FINANCE_MANAGER", "DEVELOPER"]) {
      expect(mfaIsSkippable(role)).toBe(false);
    }
  });

  it("still stands aside for a school leader when no mail server can carry the code", () => {
    withoutMail();
    // An unreachable mailbox must not shut a school out of its own workspace.
    expect(mfaIsSkippable("PRINCIPAL")).toBe(true);
    expect(mfaIsSkippable("BURSAR")).toBe(true);
  });

  it("is required of everyone once a mail server exists", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    expect(mfaIsSkippable("PRINCIPAL")).toBe(false);
    expect(mfaIsSkippable("SUPER_ADMIN")).toBe(false);
    delete process.env.SMTP_HOST;
  });

  it("is required of everyone when it is switched on by hand", () => {
    process.env.AUTH_EMAIL_MFA = "on";
    expect(mfaIsSkippable("PRINCIPAL")).toBe(false);
    delete process.env.AUTH_EMAIL_MFA;
  });
});

describe("a school's web address", () => {
  it("accepts the shape addresses are actually issued in, hyphens and all", () => {
    expect(addressFormatOk("powerhouse")).toBe(true);
    expect(addressFormatOk("greenfield-college")).toBe(true);
    expect(addressFormatOk("queens-ibadan-2")).toBe(true);
  });

  it("refuses a shape that would not make a usable address", () => {
    expect(addressFormatOk("ab")).toBe(false);
    expect(addressFormatOk("a".repeat(31))).toBe(false);
    expect(addressFormatOk("-leading")).toBe(false);
    expect(addressFormatOk("trailing-")).toBe(false);
    expect(addressFormatOk("double--hyphen")).toBe(false);
    expect(addressFormatOk("Upper")).toBe(false);
    expect(addressFormatOk("has space")).toBe(false);
  });

  it("refuses a reserved term, and refuses it inside a longer name too", () => {
    expect(addressIsReserved("waec")).toBe(true);
    expect(addressIsReserved("neco")).toBe(true);
    expect(addressIsReserved("jamb")).toBe(true);
    expect(addressIsReserved("admin")).toBe(true);
    expect(addressIsReserved("futurerealm")).toBe(true);
    // the point of the containment check: a qualifier must not launder a reserved name
    expect(addressIsReserved("waec-lagos")).toBe(true);
    expect(addressIsReserved("my-admin-school")).toBe(true);
  });

  it("leaves an ordinary school name alone", () => {
    expect(addressIsReserved("greenfield-college")).toBe(false);
    expect(addressIsReserved("powerhouse")).toBe(false);
  });
});

describe("the second-level division a school sits in", () => {
  it("covers every Nigerian state with the right number of LGAs", () => {
    expect(Object.keys(NIGERIA_LGAS)).toHaveLength(37);
    expect(Object.values(NIGERIA_LGAS).reduce((sum, list) => sum + list.length, 0)).toBe(774);
    // a few counts that are easy to check against the official figures
    expect(NIGERIA_LGAS.Lagos).toHaveLength(20);
    expect(NIGERIA_LGAS.Kano).toHaveLength(44);
    expect(NIGERIA_LGAS.Oyo).toHaveLength(33);
    expect(NIGERIA_LGAS.Bayelsa).toHaveLength(8);
    expect(NIGERIA_LGAS["FCT Abuja"]).toHaveLength(6);
  });

  it("is keyed to the state names the country picker offers, so nothing falls between them", () => {
    expect(new Set(Object.keys(NIGERIA_LGAS))).toEqual(new Set(geoFor("Nigeria").divisions));
  });

  it("offers a list for a Nigerian state and nothing where there is no list to offer", () => {
    expect(lgasFor("Nigeria", "Oyo")).toContain("Ibadan North");
    expect(lgasFor("Nigeria", "Lagos")).toContain("Ikeja");
    // a state that does not exist, and a country whose second level has no dataset: both empty,
    // which is what turns the field back into free text rather than an empty dropdown.
    expect(lgasFor("Nigeria", "Atlantis")).toEqual([]);
    expect(lgasFor("Kenya", "Nairobi")).toEqual([]);
  });

  it("holds no duplicates within a state", () => {
    for (const [state, list] of Object.entries(NIGERIA_LGAS)) {
      expect(new Set(list).size, `${state} repeats an LGA`).toBe(list.length);
    }
  });
});
