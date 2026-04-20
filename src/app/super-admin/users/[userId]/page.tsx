import Link from "next/link";

import { StatusBadge } from "@/components/data-display/status-badge";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/utils/formatters";

interface SuperAdminUserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  school: { id: string; name: string; status: string; plan: string };
  profileType: string;
}

export default async function SuperAdminUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await apiGet<SuperAdminUserProfile>(`/api/super-admin/users/${userId}`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/super-admin/users" className="text-sm font-semibold text-brand-700">Back to users</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">User profile</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{user.name}</h1>
            <p className="mt-2 text-sm text-ink/60">{user.email} · {user.role.replaceAll("_", " ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={user.status} />
            <ResourceActionDialog
              triggerLabel="Impersonate"
              title={`Impersonate ${user.name}`}
              description="Generate a short-lived support token for this user. Every impersonation is audited."
              endpoint={`/api/super-admin/impersonate/${user.id}`}
              method="POST"
              variant="danger"
              submitLabel="Generate token"
              confirmLabel="Confirm Impersonation"
              fields={[]}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">School</p>
          <p className="mt-2 font-semibold text-ink">{user.school.name}</p>
          <p className="mt-1 text-sm text-ink/55">{user.school.plan} · {user.school.status}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Profile type</p>
          <p className="mt-2 font-semibold text-ink">{user.profileType}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Last login</p>
          <p className="mt-2 font-semibold text-ink">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</p>
        </article>
        <article className="rounded-[1.5rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Joined</p>
          <p className="mt-2 font-semibold text-ink">{formatDate(user.createdAt)}</p>
        </article>
      </section>
    </div>
  );
}
