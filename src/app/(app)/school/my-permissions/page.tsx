import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView } from "@/lib/domain/types";

export default async function MyPermissionsPage() {
  const session = await getServerSession();
  if (!session) return null;
  const payload = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">My access</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My Permissions</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">A read-only view of what your account can currently do in this school portal.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {payload.grouped.map((group) => (
          <article key={group.module} className="surface-card p-5">
            <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{group.module}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.permissions.map((permission) => (
                <span
                  key={permission.key}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--color-bg-subtle)", color: "var(--color-text-primary)" }}
                >
                  {permission.label}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
