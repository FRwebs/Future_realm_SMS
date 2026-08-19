import { AccessDenied } from "@/components/feedback/access-denied";
import { RoleEditorForm } from "@/components/roles/role-editor-form";
import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, PermissionGroupView } from "@/lib/domain/types";

export default async function NewRolePage() {
  const session = await getServerSession();
  if (!session) return null;

  const myPermissions = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);
  if (!myPermissions.permissions.includes("roles.create")) {
    return <AccessDenied detail="You need roles.create before you can create a custom school role." />;
  }

  const permissions = await apiGet<PermissionGroupView[]>(`/api/v1/school/${session.schoolId}/roles-management/permissions`);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">New role</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Create Role</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">Select only the privileges this staff role needs. The backend prevents Principals from assigning permissions above their own level.</p>
      </section>
      <RoleEditorForm schoolId={session.schoolId} permissionGroups={permissions} />
    </div>
  );
}
