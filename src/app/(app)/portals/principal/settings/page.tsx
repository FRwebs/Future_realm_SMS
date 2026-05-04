import { AccessDenied } from "@/components/feedback/access-denied";
import { PrincipalCommandLink, PrincipalInfoCard, PrincipalPageHeader } from "@/components/portals/principal-portal-ui";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { loadPrincipalDashboardBundle } from "@/lib/principal/portal";

export default async function PrincipalSettingsPage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/principal/settings"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { overview } = await loadPrincipalDashboardBundle();

  return (
    <div className="grid gap-6">
      <PrincipalPageHeader
        eyebrow="Leadership settings"
        title="School identity, policy, and configuration access"
        description="This page keeps principal-level configuration organised while routing detailed edits to the right existing school modules."
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PrincipalInfoCard
          title="Current context"
          description="High-level school identity and active academic cycle visible from the shared dashboard context."
        >
          <div className="grid gap-3">
            {[
              ["School", overview.schoolName],
              ["Session", overview.currentSession],
              ["Term", overview.currentTerm],
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

        <div className="grid gap-4 md:grid-cols-2">
          <PrincipalCommandLink href="/school/configuration" title="Configuration hub" detail="School information, classes, sessions, and calendar resources." />
          <PrincipalCommandLink href="/admissions/settings" title="Admissions policy" detail="Intake configuration, offer workflow, and principal-approval rules." />
          <PrincipalCommandLink href="/academics/results/assessment-format" title="Academic policy" detail="Assessment format, grading rules, and broadsheet workflow inputs." />
          <PrincipalCommandLink href="/finance/settings" title="Finance settings" detail="Read bursary configuration, payment methods, and receipt behavior." />
        </div>
      </section>
    </div>
  );
}
