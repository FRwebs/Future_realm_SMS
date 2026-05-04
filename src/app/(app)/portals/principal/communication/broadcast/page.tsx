import { PrincipalCommandLink, PrincipalInfoCard, PrincipalPageHeader, PrincipalQuickLink } from "@/components/portals/principal-portal-ui";
import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalDashboardBundle, loadPrincipalPeopleBundle } from "@/lib/principal/portal";

export default async function PrincipalBroadcastPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/communication/broadcast"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [{ students }, { teachers, announcements }] = await Promise.all([
    loadPrincipalPeopleBundle(),
    loadPrincipalDashboardBundle(),
  ]);

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Parent broadcast center"
        title="Plan parent-facing communication with leadership context"
        description="This view keeps parent reach, school notice volume, and leadership communication entry points organised before you jump into the full messaging workflow."
        actions={<PrincipalQuickLink href="/communications" label="Compose message" />}
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PrincipalInfoCard
          title="Audience readiness"
          description="A quick read of who your next leadership broadcast could reach."
        >
          <div className="grid gap-3">
            {[
              ["Students", students.length],
              ["Teachers", teachers.length],
              ["Recent announcements", announcements.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[1.25rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3"
              >
                <span className="text-[13px] text-[var(--color-text-secondary)]">{label}</span>
                <span className="font-[var(--font-mono)] text-[13px] font-semibold text-[var(--color-text-primary)]">{value}</span>
              </div>
            ))}
          </div>
        </PrincipalInfoCard>

        <div className="grid gap-4 md:grid-cols-2">
          <PrincipalCommandLink href="/communications" title="Broadcast to parents" detail="Use the main communications workspace for announcements, messages, and school-wide outreach." />
          <PrincipalCommandLink href="/admissions" title="Broadcast to applicants" detail="Reach new families still progressing through admissions and enrollment conversion." />
          <PrincipalCommandLink href="/portals/principal/communication/announcements" title="Review recent notices" detail="Check what parents and staff have already seen before sending the next message." />
          <PrincipalCommandLink href="/portals/principal/reports/analytics" title="Use analytics first" detail="Pair your broadcast strategy with academic, attendance, and admissions data." />
        </div>
      </section>
    </div>
  );
}
