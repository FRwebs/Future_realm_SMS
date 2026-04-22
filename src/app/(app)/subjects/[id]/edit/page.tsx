import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SubjectView } from "@/lib/domain/types";
import { nigerianClassFieldOptions } from "@/lib/school-options";

const sectionOptions = [
  { label: "Creche", value: "CRECHE" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Junior Secondary", value: "JUNIOR_SECONDARY" },
  { label: "Senior Secondary", value: "SENIOR_SECONDARY" }
];

export default async function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) return null;
  const permissions = await getServerPermissions(session);
  if (!(await canAccessServerPath(session, "/subjects")) || !permissions.includes("subjects.edit")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const subject = await apiGet<SubjectView>(`/api/v1/academics/subjects/${id}`);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel md:p-8">
        <Link href={`/subjects/${id}`} className="text-sm font-semibold text-brand-700">Back to subject</Link>
        <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Academic setup</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">Edit Subject</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/68">
          Update subject identity, section, timetable hints, and class applicability without leaving the academic workspace.
        </p>
      </section>

      <ResourceForm
        title={`Edit ${subject.name}`}
        description="These updates follow the existing subject model already used across timetables, class assignments, and results."
        endpoint={`/api/v1/academics/subjects/${id}`}
        method="PATCH"
        submitLabel="Save changes"
        fields={[
          { name: "name", label: "Subject name", required: true, defaultValue: subject.name },
          { name: "code", label: "Subject code", required: true, defaultValue: subject.code },
          { name: "waecCode", label: "WAEC code", defaultValue: subject.waecCode ?? "" },
          { name: "necoCode", label: "NECO code", defaultValue: subject.necoCode ?? "" },
          { name: "section", label: "Section", type: "select", required: true, defaultValue: subject.section, options: sectionOptions },
          { name: "applicableClassLevelsJson", label: "Applicable classes", type: "multiselect", defaultValue: subject.applicableClassLevels, options: nigerianClassFieldOptions },
          { name: "description", label: "Description", type: "textarea", defaultValue: subject.description ?? "" },
          { name: "isCore", label: "Core subject", type: "select", defaultValue: String(subject.isCore), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
          { name: "isOptional", label: "Optional subject", type: "select", defaultValue: String(subject.isOptional), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "isWaecSubject", label: "WAEC / NECO subject", type: "select", defaultValue: String(subject.isWaecSubject ?? false), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "periodsPerWeek", label: "Periods per week", type: "number", defaultValue: subject.periodsPerWeek ?? 3, min: 1, max: 30 },
          { name: "requiresLab", label: "Requires lab", type: "select", defaultValue: String(subject.requiresLab ?? false), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "religionSpecific", label: "Religion specific", type: "select", defaultValue: String(subject.religionSpecific), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "subjectCombination", label: "Senior track", type: "select", defaultValue: subject.subjectCombination ?? "general", options: [{ label: "General", value: "general" }, { label: "Science", value: "science" }, { label: "Arts", value: "arts" }, { label: "Commercial", value: "commercial" }] },
          { name: "trackSpecific", label: "Track specific", defaultValue: subject.trackSpecific ?? "" },
          { name: "tradeSubject", label: "Trade subject", type: "select", defaultValue: String(subject.tradeSubject), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
          { name: "status", label: "Status", type: "select", defaultValue: subject.status, options: [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }] }
        ]}
      />
    </div>
  );
}
