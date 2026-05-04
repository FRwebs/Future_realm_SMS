import { AccessDenied } from "@/components/feedback/access-denied";
import { SupportInfoCard, SupportPortalPageHeader } from "@/components/portals/support-portal-ui";
import { getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function LibrarianPortalProfilePage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/librarian/profile"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  return (
    <div className="space-y-6">
      <SupportPortalPageHeader eyebrow="My profile" title={session.name} description="Your identity inside the circulation, catalog, and membership workflows." />
      <SupportInfoCard title="Account" description="Role and email context for this portal session.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Role</p>
            <p className="mt-2 font-semibold text-[var(--color-text-primary)]">{roleLabels[session.role]}</p>
          </div>
          <div className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Email</p>
            <p className="mt-2 font-semibold text-[var(--color-text-primary)]">{session.email}</p>
          </div>
        </div>
      </SupportInfoCard>
    </div>
  );
}
