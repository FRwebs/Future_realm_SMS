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
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <a href="/portals/parent" className="text-sm font-semibold text-brand-700">Back to parent portal</a>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Parent profile</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Contact details are read-only unless the school enables profile update requests.
        </p>
      </section>
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">{profile.parentName}</h2>
        <div className="mt-5 grid gap-3 text-sm text-ink/72 md:grid-cols-2">
          <p><span className="font-semibold text-ink">Relationship:</span> {profile.relationship ?? "Guardian"}</p>
          <p><span className="font-semibold text-ink">Phone:</span> {profile.phone ?? "Not recorded"}</p>
          <p><span className="font-semibold text-ink">Email:</span> {profile.email ?? "Not recorded"}</p>
          <p><span className="font-semibold text-ink">Address:</span> {profile.address ?? "Not recorded"}</p>
          <p><span className="font-semibold text-ink">SMS enabled:</span> {profile.canReceiveSms ? "Yes" : "No"}</p>
          <p><span className="font-semibold text-ink">Email enabled:</span> {profile.canReceiveEmail ? "Yes" : "No"}</p>
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
