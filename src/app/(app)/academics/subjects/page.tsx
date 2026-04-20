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
  if (!canAccessPath(session.role, "/academics/subjects")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const subjects = await apiGet<SubjectView[]>("/api/v1/academics/subjects");
  const canManage = canManagePath(session.role, "/academics/subjects") && !["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role);
  const classesResponse = canManage
    ? await apiGet<{ data: Array<{ id: string; name: string; level: string; arm?: string | null }> }>("/api/v1/classes")
    : { data: [] };
  const teachers = canManage
    ? await apiGet<Array<{ id: string; firstName: string; lastName: string; email: string }>>("/api/v1/classes/teacher-options")
    : [];
  const classOptions = classesResponse.data.map((classItem) => ({ label: classItem.name, value: classItem.id }));
  const teacherOptions = [
    { label: "No teacher", value: "" },
    ...teachers.map((teacher) => ({ label: `${teacher.firstName} ${teacher.lastName} (${teacher.email})`, value: teacher.id }))
  ];
  const subjectsByDepartment = Array.from(
    subjects.reduce((groups, subject) => {
      const department = subject.departmentName ?? subject.section?.replaceAll("_", " ") ?? "General Subjects";
      groups.set(department, [...(groups.get(department) ?? []), subject]);
      return groups;
    }, new Map<string, SubjectView[]>())
  ).sort(([a], [b]) => a.localeCompare(b));

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
                { name: "waecCode", label: "WAEC code", placeholder: "ENG" },
                { name: "necoCode", label: "NECO code", placeholder: "ENG" },
                { name: "section", label: "Section", type: "select", required: true, options: sectionOptions },
                { name: "applicableClassLevelsJson", label: "Applicable classes", type: "multiselect", options: nigerianClassFieldOptions },
                { name: "description", label: "Description", type: "textarea", placeholder: "Short curriculum or timetable note" },
                { name: "isCore", label: "Core subject", type: "select", options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                { name: "isOptional", label: "Optional subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                { name: "isWaecSubject", label: "WAEC/NECO subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                { name: "periodsPerWeek", label: "Periods per week", type: "number", defaultValue: 3, min: 1, max: 30 },
                { name: "requiresLab", label: "Requires lab/special room", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                { name: "religionSpecific", label: "Religion specific", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                { name: "subjectCombination", label: "SS combination", type: "select", options: [{ label: "General", value: "general" }, { label: "Science", value: "science" }, { label: "Arts", value: "arts" }, { label: "Commercial", value: "commercial" }] },
                { name: "trackSpecific", label: "SSS track", placeholder: "SCIENCE, HUMANITIES, BUSINESS, or blank" },
                { name: "tradeSubject", label: "Trade subject", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] }
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {subjectsByDepartment.map(([department, departmentSubjects]) => {
          const compulsoryCount = departmentSubjects.filter((subject) => subject.isCore).length;
          const optionalCount = departmentSubjects.filter((subject) => subject.isOptional).length;
          return (
            <article key={department} className="rounded-[2rem] border border-white/60 bg-white/90 p-5 shadow-panel">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">Department</p>
                  <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-ink">{department}</h2>
                </div>
                <div className="rounded-2xl bg-sand/70 px-4 py-3 text-sm text-ink/65">
                  <span className="font-semibold text-ink">{departmentSubjects.length}</span> subjects · {compulsoryCount} compulsory · {optionalCount} optional
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {departmentSubjects.map((subject) => (
                  <div key={subject.id} className="rounded-2xl border border-ink/6 bg-sand/45 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-ink">{subject.name}</p>
                        <p className="text-xs text-ink/55">{subject.code} · {subject.section?.replaceAll("_", " ") ?? "General"}</p>
                      </div>
                      <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                        {subject.isCore ? "Compulsory" : "Optional"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-ink/60">
                      Offered in {subject.applicableClassLevels.map(getNigeriaClassLabel).join(", ") || "configured classes"}.
                      {" "}
                      {subject.classCount ? `${subject.classCount} class${subject.classCount === 1 ? "" : "es"} currently assigned.` : "No class assignment yet."}
                    </p>
                    {canManage ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ResourceActionDialog
                          triggerLabel="Edit"
                          title={`Edit ${subject.name}`}
                          description="Update subject details, codes, class levels, WAEC/NECO flags, and timetable hints."
                          endpoint={`/api/v1/academics/subjects/${subject.id}`}
                          method="PATCH"
                          submitLabel="Save changes"
                          variant="secondary"
                          fields={[
                            { name: "name", label: "Subject name", required: true, defaultValue: subject.name },
                            { name: "code", label: "Subject code", required: true, defaultValue: subject.code },
                            { name: "waecCode", label: "WAEC code", defaultValue: subject.waecCode ?? "" },
                            { name: "necoCode", label: "NECO code", defaultValue: subject.necoCode ?? "" },
                            { name: "applicableClassLevelsJson", label: "Applicable classes", type: "multiselect", defaultValue: subject.applicableClassLevels, options: nigerianClassFieldOptions },
                            { name: "description", label: "Description", type: "textarea", defaultValue: subject.description ?? "" },
                            { name: "isCore", label: "Core subject", type: "select", defaultValue: String(subject.isCore), options: [{ label: "Yes", value: "true" }, { label: "No", value: "false" }] },
                            { name: "isOptional", label: "Optional subject", type: "select", defaultValue: String(subject.isOptional), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                            { name: "isWaecSubject", label: "WAEC/NECO subject", type: "select", defaultValue: String(subject.isWaecSubject ?? false), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                            { name: "periodsPerWeek", label: "Periods per week", type: "number", defaultValue: subject.periodsPerWeek ?? 3, min: 1, max: 30 },
                            { name: "requiresLab", label: "Requires lab/special room", type: "select", defaultValue: String(subject.requiresLab ?? false), options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
                            { name: "status", label: "Status", type: "select", defaultValue: subject.status, options: [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }] }
                          ]}
                        />
                        <ResourceActionDialog
                          triggerLabel="Assign teacher"
                          title={`Assign ${subject.name}`}
                          description="Assign a subject teacher to one class arm, or apply to all arms of that level."
                          endpoint={`/api/v1/academics/subjects/${subject.id}/assign-teacher`}
                          submitLabel="Save assignment"
                          variant="secondary"
                          fields={[
                            { name: "classId", label: "Class arm", type: "select", required: true, options: classOptions },
                            { name: "teacherId", label: "Teacher", type: "select", options: teacherOptions },
                            { name: "applyToAllArms", label: "Apply to all arms at this level", type: "select", options: [{ label: "No, only this class", value: "false" }, { label: "Yes, all arms", value: "true" }] },
                            { name: "reason", label: "Reason", type: "textarea", placeholder: "Optional assignment note" }
                          ]}
                        />
                        <ResourceActionDialog
                          triggerLabel="Archive"
                          title={`Archive ${subject.name}`}
                          description="Archive this subject if it has no score records. Existing class assignments are deactivated."
                          endpoint={`/api/v1/academics/subjects/${subject.id}`}
                          method="DELETE"
                          submitLabel="Archive subject"
                          confirmLabel="Confirm archive"
                          confirmMessage="This will archive the subject and remove it from active subject lists."
                          variant="danger"
                          fields={[]}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
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
          { key: "department", header: "Department", render: (item) => item.departmentName ?? "Unassigned" },
          { key: "classes", header: "Classes", render: (item) => item.applicableClassLevels.map(getNigeriaClassLabel).join(", ") || "Configurable" },
          { key: "assignments", header: "Assignments", render: (item) => `${item.classCount ?? 0} classes / ${item.teacherCount ?? 0} teachers` },
          { key: "core", header: "Core", render: (item) => (item.isCore ? "Yes" : "No") },
          { key: "optional", header: "Optional", render: (item) => (item.isOptional ? "Yes" : "No") },
          { key: "track", header: "Track", render: (item) => item.trackSpecific ?? (item.tradeSubject ? "Trade" : "All") },
          { key: "status", header: "Status", render: (item) => item.status }
        ]}
      />
    </div>
  );
}
