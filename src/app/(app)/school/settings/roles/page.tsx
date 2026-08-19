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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div>
          <p className="section-eyebrow">Enterprise access control</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Roles & Permissions</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
