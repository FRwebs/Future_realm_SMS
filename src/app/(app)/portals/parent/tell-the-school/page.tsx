import Link from "next/link";
import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { TellTheSchool, type FamilySubmission, type SubmissionOptions } from "@/components/portals/tell-the-school";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function TellTheSchoolPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;

  const [options, submissions] = await Promise.all([
    apiGet<SubmissionOptions>("/api/v1/parent-portal/submissions/options"),
    apiGet<FamilySubmission[]>("/api/v1/parent-portal/submissions"),
  ]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to parent portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Tell the school</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">An absence explanation, a change of who collects your child, or a question. A person at the school owns it from the moment it arrives.</p>
      </section>
      <TellTheSchool options={options} submissions={submissions} />
    </div>
  );
}
