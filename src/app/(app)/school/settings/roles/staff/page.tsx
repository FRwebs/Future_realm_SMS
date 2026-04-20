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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Staff access</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Staff Role Assignment</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Assign roles to staff, add controlled grants or revokes, and preview the final resolved permission set.</p>
      </section>
      <StaffRoleManager schoolId={session.schoolId} staff={staff} roles={roles} permissionGroups={permissions} />
    </div>
  );
}
