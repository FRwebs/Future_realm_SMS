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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">New role</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Create Role</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Select only the privileges this staff role needs. The backend prevents Principals from assigning permissions above their own level.</p>
      </section>
      <RoleEditorForm schoolId={session.schoolId} permissionGroups={permissions} />
    </div>
  );
}
