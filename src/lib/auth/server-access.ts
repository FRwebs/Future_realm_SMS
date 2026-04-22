import { cache } from "react";

import { apiGet } from "@/lib/api/server";
import type { SessionUser, MyPermissionsView } from "@/lib/domain/types";
import { canAccessPathWithPermissions, getDefaultPermissionsForRole } from "@/lib/navigation/registry";

const getResolvedPermissions = cache(async (schoolId: string, userId: string, role: SessionUser["role"]) => {
  try {
    const payload = await apiGet<MyPermissionsView>(`/api/v1/school/${schoolId}/roles-management/permissions/my`);
    return payload.permissions;
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
