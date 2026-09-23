import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import type { SessionUser, MyPermissionsView } from "@/lib/domain/types";
import { schoolPermissionsForRole } from "@/lib/modules/school-access";
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
