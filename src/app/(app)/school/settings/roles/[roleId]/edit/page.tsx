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
      <div className="portal-page">
        <section className="surface-hero p-6 md:p-7">
          <p className="section-eyebrow">Role details</p>
          <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{role.name}</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{role.description ?? "System role details are read-only."}</p>
        </section>
        <section className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Permissions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(role.permissions ?? []).map((permission) => (
              <span
                key={permission}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--color-bg-subtle)", color: "var(--color-text-primary)" }}
              >
                {permission}
              </span>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Edit role</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">{role.name}</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">Update a custom school role and its permission matrix.</p>
      </section>
      <RoleEditorForm schoolId={session.schoolId} permissionGroups={permissions} role={role} />
    </div>
  );
}
