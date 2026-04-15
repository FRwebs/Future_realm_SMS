import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { SubjectView } from "@/lib/domain/types";
import { getNigeriaClassLabel, nigerianClassFieldOptions } from "@/lib/school-options";

const sectionOptions = [
  { label: "Creche", value: "CRECHE" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Junior Secondary", value: "JUNIOR_SECONDARY" },
  { label: "Senior Secondary", value: "SENIOR_SECONDARY" }
];

export default async function SubjectsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const subjects = await apiGet<SubjectView[]>("/api/v1/academics/subjects");
  const canManage = canManagePath(session.role, "/academics/results") && !["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to academics</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Nigerian subject taxonomy</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">Subjects</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Manage configurable subjects for crèche, nursery, primary, JSS, and SSS, including optional, religion-specific, track-specific, and trade subjects.
            </p>
          </div>
          {canManage ? (
            <ResourceActionDialog
              triggerLabel="Add subject"
              title="Add subject"
              description="Create or update a school subject without leaving the academics workspace."
              endpoint="/api/v1/academics/subjects"
              submitLabel="Save subject"
              confirmLabel="Confirm subject"
              fields={[
                { name: "name", label: "Subject name", required: true, placeholder: "Digital Technologies" },
                { name: "code", label: "Subject code", required: true, placeholder: "DIGTECH" },
                { name: "section", label: "Section", type: "select", required: true, options: sectionOptions },
                { name: "applicableClassLevelsJson", label: "Applicable classes", type: "multiselect", options: nigerianClassFieldOptions },
                { name: "isCore", label: "Core subject", type: "select", options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                { name: "isOptional", label: "Optional subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                { name: "religionSpecific", label: "Religion specific", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                { name: "trackSpecific", label: "SSS track", placeholder: "SCIENCE, HUMANITIES, BUSINESS, or blank" },
                { name: "tradeSubject", label: "Trade subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] }
              ]}
            />
          ) : null}
        </div>
      </section>

      <TableCard
        title="Subject register"
        description="Seeded Nigerian defaults remain configurable per school."
        items={subjects}
        columns={[
          {
            key: "subject",
            header: "Subject",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.name}</p>
                <p className="text-xs text-ink/55">{item.code}</p>
              </div>
            )
          },
          { key: "section", header: "Section", render: (item) => item.section?.replaceAll("_", " ") ?? "General" },
          { key: "classes", header: "Classes", render: (item) => item.applicableClassLevels.map(getNigeriaClassLabel).join(", ") || "Configurable" },
          { key: "core", header: "Core", render: (item) => (item.isCore ? "Yes" : "No") },
          { key: "optional", header: "Optional", render: (item) => (item.isOptional ? "Yes" : "No") },
          { key: "track", header: "Track", render: (item) => item.trackSpecific ?? (item.tradeSubject ? "Trade" : "All") },
          { key: "status", header: "Status", render: (item) => item.status }
        ]}
      />
    </div>
  );
}
