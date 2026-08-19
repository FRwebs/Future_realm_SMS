import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { nigerianClassFieldOptions } from "@/lib/school-options";

const sectionOptions = [
  { label: "Creche", value: "CRECHE" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Junior Secondary", value: "JUNIOR_SECONDARY" },
  { label: "Senior Secondary", value: "SENIOR_SECONDARY" }
];

export default async function NewSubjectPage() {
  const session = await getServerSession();
  if (!session) return null;
  const permissions = await getServerPermissions(session);
  if (!(await canAccessServerPath(session, "/subjects")) || !permissions.includes("subjects.create")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/subjects" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to subjects</Link>
        <p className="mt-4 section-eyebrow">Academic setup</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Create Subject</h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Add a new subject, define where it applies in the school, and prepare it for timetable and scheme-of-work assignment.
        </p>
      </section>

      <ResourceForm
        title="Create subject"
        description="Use the school’s existing subject model. You can assign teachers and initialize schemes of work after saving."
        endpoint="/api/v1/academics/subjects"
        submitLabel="Create subject"
        fields={[
          { name: "name", label: "Subject name", required: true, placeholder: "Agricultural Science" },
          { name: "code", label: "Subject code", required: true, placeholder: "AGRIC" },
          { name: "waecCode", label: "WAEC code", placeholder: "AGR" },
          { name: "necoCode", label: "NECO code", placeholder: "AGR" },
          { name: "section", label: "Section", type: "select", required: true, options: sectionOptions },
          { name: "applicableClassLevelsJson", label: "Applicable classes", type: "multiselect", options: nigerianClassFieldOptions },
          { name: "description", label: "Description", type: "textarea", placeholder: "Short curriculum note" },
          { name: "isCore", label: "Core subject", type: "select", options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
          { name: "isOptional", label: "Optional subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "isWaecSubject", label: "WAEC / NECO subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "periodsPerWeek", label: "Periods per week", type: "number", defaultValue: 3, min: 1, max: 30 },
          { name: "requiresLab", label: "Requires lab", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "religionSpecific", label: "Religion specific", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "subjectCombination", label: "Senior track", type: "select", options: [{ label: "General", value: "general" }, { label: "Science", value: "science" }, { label: "Arts", value: "arts" }, { label: "Commercial", value: "commercial" }] },
          { name: "trackSpecific", label: "Track specific", placeholder: "SCIENCE, HUMANITIES, BUSINESS" },
          { name: "tradeSubject", label: "Trade subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] }
        ]}
      />
    </div>
  );
}
