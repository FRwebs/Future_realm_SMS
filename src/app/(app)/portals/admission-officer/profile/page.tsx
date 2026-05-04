import { AccessDenied } from "@/components/feedback/access-denied";
import {
  AdmissionInfoCard,
  AdmissionPortalPageHeader,
  AdmissionQuickLink,
} from "@/components/portals/admission-officer-ui";
import { getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";

export default async function AdmissionOfficerProfilePage() {
  const session = await getServerSession();
  if (!session) return null;

  if (!(await canAccessServerPath(session, "/portals/admission-officer/profile"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  return (
    <div className="grid gap-6">
      <AdmissionPortalPageHeader
        eyebrow="Profile"
        title="Admissions officer profile"
        description="Your portal identity and operating context inside the admissions workflow."
        actions={
          <>
            <AdmissionQuickLink
              href="/portals/admission-officer"
              label="Dashboard"
            />
            <AdmissionQuickLink
              href="/school/profile"
              label="School profile"
            />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <AdmissionInfoCard
          title="Portal identity"
          description="The role and account currently operating the admissions portal."
        >
          <dl className="grid gap-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Name
              </dt>
              <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
                {session.name}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Role
              </dt>
              <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
                {roleLabels[session.role]}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Email
              </dt>
              <dd className="mt-1 text-sm text-[var(--color-text-primary)]">
                {session.email}
              </dd>
            </div>
          </dl>
        </AdmissionInfoCard>

        <AdmissionInfoCard
          title="Workflow scope"
          description="What this portal is optimized to help you run every day."
        >
          <ul className="grid gap-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            <li>Application intake and triage</li>
            <li>Document review and screening coordination</li>
            <li>Offer issuance and guardian response follow-up</li>
            <li>Enrollment conversion for accepted applicants</li>
          </ul>
        </AdmissionInfoCard>
      </section>
    </div>
  );
}
