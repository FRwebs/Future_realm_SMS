import { AccessDenied } from "@/components/feedback/access-denied";
import { PermissionsAccessPanel } from "@/components/roles/permissions-access-panel";
import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, PermissionGroupView, SchoolRoleView } from "@/lib/domain/types";

function can(permissions: string[], permission: string) {
  return permissions.includes(permission);
}

export default async function RolesManagementPage() {
  const session = await getServerSession();
  if (!session) return null;

  const myPermissions = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);
  if (!can(myPermissions.permissions, "roles.view")) {
    return <AccessDenied detail="You do not currently have the roles.view permission for this school." />;
  }

  const [roles, permissionGroups] = await Promise.all([
    apiGet<SchoolRoleView[]>(`/api/v1/school/${session.schoolId}/roles-management/roles`),
    apiGet<PermissionGroupView[]>(`/api/v1/school/${session.schoolId}/roles-management/permissions`),
  ]);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Enterprise access control</p>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Roles & Permissions</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
            Review system and custom roles from one premium permission matrix. Use the role editor for changes and staff assignment for per-user access.
          </p>
        </div>
      </section>

      <PermissionsAccessPanel
        roles={roles}
        permissionGroups={permissionGroups}
        schoolId={session.schoolId}
        canCreate={can(myPermissions.permissions, "roles.create")}
        canEdit={can(myPermissions.permissions, "roles.edit")}
        canAssign={can(myPermissions.permissions, "roles.assign")}
      />
    </div>
  );
}
