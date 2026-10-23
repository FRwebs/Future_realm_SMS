/**
 * A number that changes whenever something changes who a person is allowed to be in this school: their role or permissions, the class or
 * subject they are assigned, the term, the school's settings, a module the platform switched off.
 *
 * The API stamps it on every answer (`x-fr-ctx`). The web server remembers what it learned about a person — their permissions, their
 * teaching assignments, the school's name and term — for as long as that stamp does not change, instead of for a few seconds. So the
 * memory is long when nothing changes (the usual case: a teacher reading a page for a minute between clicks) and ends the moment
 * something does.
 *
 * It is compared for equality only, never ordered: a restart, or a second API process, gives a different value and the web server simply
 * asks again. It can only ever cause an extra question, never a stale answer.
 */
export const CTX_HEADER = "x-fr-ctx";

const boot = Date.now().toString(36);
let counter = 0;
let current = `${boot}.${counter}`;

export const ctxVersion = () => current;
export function bumpCtxVersion() {
  counter += 1;
  current = `${boot}.${counter}`;
}

/** The models whose writes can change what the web server remembers about a person. */
const WATCHED = new Set([
  "ClassRoom", "ClassSubject", "CoverAssignment", "Department", "StaffProfile", "Term", "AcademicSession",
  "Role", "RolePermission", "UserRoleAssignment", "UserPermissionOverride", "ConfigurationItem",
  "School", "SchoolSubscription", "SchoolConcession", "PlatformSetting", "PlatformFeatureFlag", "PlatformFeatureFlagOverride", "FeatureFlagStage",
  "MaintenanceWindow", "PlatformSubscriptionPlan", "PlatformAnnouncement",
]);
const WRITES = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);
/** A user is written on every sign-in; only a change to who they are counts. */
const USER_IDENTITY = ["role", "isActive", "accountStatus", "deletedAt", "schoolId", "jobTitle"];

export function changesWhoSomeoneIs(model: string | undefined, action: string, args: unknown): boolean {
  if (!model || !WRITES.has(action)) return false;
  if (WATCHED.has(model)) return true;
  if (model === "User") {
    const data = (args as { data?: Record<string, unknown> } | undefined)?.data;
    if (action === "create" || action === "createMany" || action === "delete" || action === "deleteMany") return true;
    return Boolean(data && USER_IDENTITY.some((key) => key in data));
  }
  return false;
}
