import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalInfoCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function PrincipalProfilePage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/profile"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const permissions = await getServerPermissions(session);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Principal profile"
        title="Account summary and authority footprint"
        description="A quick leadership snapshot of identity, role, and the permissions currently resolved for this principal account."
        actions={<PrincipalQuickLink href="/school/profile" label="Open school profile" />}
      />

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <PrincipalInfoCard
          title="Identity"
          description="Core session identity information for the signed-in principal account."
        >
          <div className="grid gap-3">
            {[
              ["Name", session.name],
              ["Email", session.email],
              ["Role", roleLabels[session.role]],
              ["School ID", session.schoolId],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <span className="text-[13px] text-[var(--color-text-secondary)]">{label}</span>
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{value}</span>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>

        <PrincipalInfoCard
          title="Resolved permissions"
          description="These are the live permission keys backing what this principal can see and do in the school product."
        >
          <div className="flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <span
                key={permission}
                className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-secondary)]"
              >
                {permission}
              </span>
            ))}
          </div>
        </PrincipalInfoCard>
      </section>
    </div>
  );
}
