import { AccessDenied } from "@/components/feedback/access-denied";
import { RoleEditorForm } from "@/components/roles/role-editor-form";
import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, PermissionGroupView, SchoolRoleView } from "@/lib/domain/types";

export default async function EditRolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  const { roleId } = await params;

  const myPermissions = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);
  if (!myPermissions.permissions.includes("roles.view")) {
    return <AccessDenied detail="You need roles.view before you can inspect role details." />;
  }

  const [permissions, role] = await Promise.all([
    apiGet<PermissionGroupView[]>(`/api/v1/school/${session.schoolId}/roles-management/permissions`),
    apiGet<SchoolRoleView>(`/api/v1/school/${session.schoolId}/roles-management/roles/${roleId}`),
  ]);

  if (role.isSystem || !myPermissions.permissions.includes("roles.edit")) {
    return (
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Role details</p>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{role.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">{role.description ?? "System role details are read-only."}</p>
        </section>
        <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Permissions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(role.permissions ?? []).map((permission) => (
              <span key={permission} className="rounded-full bg-sand/70 px-3 py-1.5 text-xs font-semibold text-ink">{permission}</span>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Edit role</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{role.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">Update a custom school role and its permission matrix.</p>
      </section>
      <RoleEditorForm schoolId={session.schoolId} permissionGroups={permissions} role={role} />
    </div>
  );
}
