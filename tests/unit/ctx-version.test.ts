import { bumpCtxVersion, changesWhoSomeoneIs, ctxVersion } from "@/lib/cache/ctx-version";

describe("what changes who somebody is in a school", () => {
  it("counts a change to the things a person's access and assignments are made of", () => {
    for (const model of ["ClassRoom", "ClassSubject", "UserRoleAssignment", "UserPermissionOverride", "Term", "ConfigurationItem", "PlatformSetting", "MaintenanceWindow"]) {
      expect(changesWhoSomeoneIs(model, "update", { data: {} })).toBe(true);
      expect(changesWhoSomeoneIs(model, "create", { data: {} })).toBe(true);
    }
  });

  it("ignores reads, and ignores the ordinary traffic of a busy school", () => {
    expect(changesWhoSomeoneIs("ClassRoom", "findMany", {})).toBe(false);
    for (const model of ["StudentAttendance", "NotificationLog", "MessageDelivery", "AuditLog", "ScoreEntry", "Payment", "TrainingEnrolment"]) {
      expect(changesWhoSomeoneIs(model, "create", { data: {} })).toBe(false);
      expect(changesWhoSomeoneIs(model, "update", { data: {} })).toBe(false);
    }
  });

  it("counts a user's role or standing changing, but not a sign-in", () => {
    expect(changesWhoSomeoneIs("User", "update", { data: { lastLoginAt: new Date() } })).toBe(false);
    expect(changesWhoSomeoneIs("User", "update", { data: { role: "PRINCIPAL" } })).toBe(true);
    expect(changesWhoSomeoneIs("User", "update", { data: { isActive: false } })).toBe(true);
    expect(changesWhoSomeoneIs("User", "create", { data: {} })).toBe(true);
  });

  it("moves the stamp when bumped, and only then", () => {
    const before = ctxVersion();
    expect(ctxVersion()).toBe(before);
    bumpCtxVersion();
    expect(ctxVersion()).not.toBe(before);
  });
});
