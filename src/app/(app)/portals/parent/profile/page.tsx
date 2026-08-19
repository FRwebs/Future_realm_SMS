import Link from "next/link";
import type { Route } from "next";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { ParentProfileView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function ParentProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const profile = await apiGet<ParentProfileView>("/api/v1/parent-portal/profile");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent" as Route} className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to parent portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Parent profile</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Contact details are read-only unless the school enables profile update requests.
        </p>
      </section>
      <section className="surface-card p-6">
        <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{profile.parentName}</h2>
        <div className="mt-5 grid gap-3 text-[13px] text-[var(--color-text-secondary)] md:grid-cols-2">
          <p><span className="font-semibold text-[var(--color-text-primary)]">Relationship:</span> {profile.relationship ?? "Guardian"}</p>
          <p><span className="font-semibold text-[var(--color-text-primary)]">Phone:</span> {profile.phone ?? "Not recorded"}</p>
          <p><span className="font-semibold text-[var(--color-text-primary)]">Email:</span> {profile.email ?? "Not recorded"}</p>
          <p><span className="font-semibold text-[var(--color-text-primary)]">Address:</span> {profile.address ?? "Not recorded"}</p>
          <p><span className="font-semibold text-[var(--color-text-primary)]">SMS enabled:</span> {profile.canReceiveSms ? "Yes" : "No"}</p>
          <p><span className="font-semibold text-[var(--color-text-primary)]">Email enabled:</span> {profile.canReceiveEmail ? "Yes" : "No"}</p>
        </div>
      </section>
      <TableCard
        title="Linked children"
        description="Students attached to this guardian profile."
        items={profile.linkedChildren}
        columns={[
          { key: "studentName", header: "Student", render: (item) => item.studentName },
          { key: "admissionNumber", header: "Admission no.", render: (item) => item.admissionNumber },
          { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) }
        ]}
      />
    </div>
  );
}
