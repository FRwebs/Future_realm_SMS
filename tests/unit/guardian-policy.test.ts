import { GUARDIAN_PAGES, hiddenGuardianPages, type GuardianVisible } from "../../backend/src/modules/parent-portal/guardian-policy";
import { POLICY_DEFINITIONS } from "@/lib/modules/school-policies";

describe("guardian portal visibility", () => {
  it("hides nothing when a school shows every page", () => {
    expect(hiddenGuardianPages({ sees: new Set(GUARDIAN_PAGES) })).toEqual([]);
  });

  it("names the pages a school keeps back, in the web app's own words", () => {
    const sees = new Set<GuardianVisible>(["Attendance", "Report cards"]);
    expect(hiddenGuardianPages({ sees })).toEqual(["results", "fees", "timetable", "announcements"]);
  });

  it("is the same list the policy screen offers, and defaults to everything a guardian has always seen", () => {
    const policy = POLICY_DEFINITIONS.find((item) => item.code === "guardian_portal_visibility");
    const options = (policy?.fields[0] as { options?: string[] }).options;
    expect([...GUARDIAN_PAGES].sort()).toEqual([...(options ?? [])].sort());
    expect([...(policy?.defaults.sees as string[])].sort()).toEqual([...GUARDIAN_PAGES].sort());
  });
});
