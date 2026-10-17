import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import type { SessionUser, MyPermissionsView } from "@/lib/domain/types";
import { isSchoolStaffRole, moduleLevelForRole, schoolPermissionsForRole } from "@/lib/modules/school-access";
import { schoolModules, schoolPermissionKey } from "@/lib/modules/school-modules";
import { canAccessPathWithPermissions, getDefaultPermissionsForRole } from "@/lib/navigation/registry";

/**
 * A user's permissions: whatever the school has granted them on the server,
 * plus the sixteen-module grid their role template carries.
 *
 * The module grid is a property of the role rather than of the record, so it is
 * merged in either way — without it a signed-in member of staff would resolve to
 * the legacy domain keys alone and be locked out of every module.
 */
const getResolvedPermissions = cache(async (schoolId: string, userId: string, role: SessionUser["role"]) => {
  const modulePermissions = schoolPermissionsForRole(role);

  try {
    const payload = await apiGet<MyPermissionsView>(`/api/v1/school/${schoolId}/roles-management/permissions/my`);
    // What the server resolved is the whole answer for school staff: it already carries the
    // role template, and it also carries what the school took away from this person. Merging
    // the static grid back in would quietly give every revoked action back.
    if (isSchoolStaffRole(role)) return payload.permissions;
    return [...new Set([...payload.permissions, ...modulePermissions])];
  } catch {
    return getDefaultPermissionsForRole(role);
  }
});

export async function getServerPermissions(session: SessionUser) {
  return getResolvedPermissions(session.schoolId, session.userId, session.role);
}

export async function canAccessServerPath(session: SessionUser, path: string) {
  const permissions = await getServerPermissions(session);
  return canAccessPathWithPermissions(session.role, path, permissions);
}

export async function hasServerPermission(
  session: SessionUser,
  required: string | string[],
  mode: "all" | "any" = "all",
) {
  const permissions = new Set(await getServerPermissions(session));
  const requiredPermissions = Array.isArray(required) ? required : [required];

  if (mode === "any") {
    return requiredPermissions.some((permission) => permissions.has(permission));
  }

  return requiredPermissions.every((permission) => permissions.has(permission));
}


/**
 * Whether a person can open a module at all: they hold View on at least one of its tabs.
 * Read from what the server resolved for them, so a grant or a refusal made in Permissions
 * is honoured, not just the role they were hired into.
 */
export async function canOpenModule(session: SessionUser, moduleCode: string) {
  // The pages write a module as the mockup does ("M07"); the grid keys it "m7".
  const wanted = moduleCode.toLowerCase().replace(/^m0+(\d)/, "m$1");
  const module = schoolModules.find((item) => item.code === wanted);
  if (!module) return false;
  if (!isSchoolStaffRole(session.role)) return moduleLevelForRole(session.role, moduleCode) > 0;
  const permissions = new Set(await getServerPermissions(session));
  return module.tabs.some((tab) => permissions.has(schoolPermissionKey(module.slug, tab.slug, "View")));
}
