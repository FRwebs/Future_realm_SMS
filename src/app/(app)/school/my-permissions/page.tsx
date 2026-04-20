import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView } from "@/lib/domain/types";

export default async function MyPermissionsPage() {
  const session = await getServerSession();
  if (!session) return null;
  const payload = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">My access</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My Permissions</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">A read-only view of what your account can currently do in this school portal.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {payload.grouped.map((group) => (
          <article key={group.module} className="rounded-[1.75rem] border border-white/60 bg-white/90 p-5 shadow-panel">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-ink">{group.module}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.permissions.map((permission) => (
                <span key={permission.key} className="rounded-full bg-sand/70 px-3 py-1.5 text-xs font-semibold text-ink">
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
