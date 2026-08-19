import { AccessDenied } from "@/components/feedback/access-denied";
import { StaffRoleManager } from "@/components/roles/staff-role-manager";
import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, PermissionGroupView, SchoolRoleView, StaffRoleRowView } from "@/lib/domain/types";

export default async function StaffRolesPage() {
  const session = await getServerSession();
  if (!session) return null;

  const myPermissions = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);
  if (!myPermissions.permissions.includes("roles.assign")) {
    return <AccessDenied detail="You need roles.assign before you can assign roles or set user-level permission overrides." />;
  }

  const [staff, roles, permissions] = await Promise.all([
    apiGet<StaffRoleRowView[]>(`/api/v1/school/${session.schoolId}/roles-management/staff-roles`),
    apiGet<SchoolRoleView[]>(`/api/v1/school/${session.schoolId}/roles-management/roles`),
    apiGet<PermissionGroupView[]>(`/api/v1/school/${session.schoolId}/roles-management/permissions`),
  ]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Staff access</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Staff Role Assignment</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">Assign roles to staff, add controlled grants or revokes, and preview the final resolved permission set.</p>
      </section>
      <StaffRoleManager schoolId={session.schoolId} staff={staff} roles={roles} permissionGroups={permissions} />
    </div>
  );
}
