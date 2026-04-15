import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AssessmentComponentView, GradingSchemeView, SectionAssessmentComponentView } from "@/lib/domain/types";

const defaultBands = JSON.stringify(
  [
    { label: "A", minScore: 70, maxScore: 100, remark: "Excellent", order: 1 },
    { label: "B", minScore: 60, maxScore: 69.99, remark: "Very Good", order: 2 },
    { label: "C", minScore: 50, maxScore: 59.99, remark: "Good", order: 3 },
    { label: "D", minScore: 45, maxScore: 49.99, remark: "Pass", order: 4 },
    { label: "E", minScore: 40, maxScore: 44.99, remark: "Fair", order: 5 },
    { label: "F", minScore: 0, maxScore: 39.99, remark: "Fail", order: 6 }
  ],
  null,
  2
);

export default async function ResultSettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [schemes, components, sectionComponents] = await Promise.all([
    apiGet<GradingSchemeView[]>("/api/v1/academics/grading-schemes"),
    apiGet<AssessmentComponentView[]>("/api/v1/academics/assessments"),
    apiGet<SectionAssessmentComponentView[]>("/api/v1/academics/section-assessment-components")
  ]);
  const canManage = canManagePath(session.role, "/academics/results") && !["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Grading and assessment setup</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Configure Nigerian termly grade bands, ranking rules, pass mark, and assessment components.
        </p>
      </section>

      {canManage ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <ResourceForm
            title="Create grading scheme"
            description="Activating a scheme deactivates other schemes for this school."
            endpoint="/api/v1/academics/grading-schemes"
            submitLabel="Save scheme"
            fields={[
              { name: "name", label: "Scheme name", required: true, placeholder: "WAEC/NECO O-Level Default" },
              { name: "description", label: "Description", placeholder: "Optional note" },
              { name: "passMark", label: "Pass mark", type: "number", required: true, min: 0, max: 100, defaultValue: 40 },
              {
                name: "rankingEnabled",
                label: "Ranking enabled",
                type: "select",
                options: [
                  { label: "Yes", value: "true" },
                  { label: "No", value: "false" }
                ]
              },
              { name: "bandsJson", label: "Grade bands JSON", type: "textarea", required: true, defaultValue: defaultBands }
            ]}
          />
          <ResourceForm
            title="Create assessment component"
            description="Set component max score and weight for CA, project, exam, or school-specific components."
            endpoint="/api/v1/academics/assessments"
            submitLabel="Save component"
            fields={[
              { name: "name", label: "Component name", required: true, placeholder: "CA1" },
              { name: "code", label: "Code", required: true, placeholder: "CA1" },
              { name: "weight", label: "Weight", type: "number", required: true, min: 1, max: 100 },
              { name: "maxScore", label: "Maximum score", type: "number", required: true, min: 1, max: 100 },
              { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 }
            ]}
          />
          <ResourceForm
            title="Create section component"
            description="Define Nigerian CA/exam weights by school section. Active components for a section must total 100%."
            endpoint="/api/v1/academics/section-assessment-components"
            submitLabel="Save section component"
            fields={[
              {
                name: "section",
                label: "School section",
                type: "select",
                required: true,
                options: [
                  { label: "Crèche", value: "CRECHE" },
                  { label: "Nursery", value: "NURSERY" },
                  { label: "Primary", value: "PRIMARY" },
                  { label: "Junior Secondary", value: "JUNIOR_SECONDARY" },
                  { label: "Senior Secondary", value: "SENIOR_SECONDARY" }
                ]
              },
              { name: "name", label: "Component name", required: true, placeholder: "Terminal Examination" },
              { name: "code", label: "Code", required: true, placeholder: "EXAM" },
              {
                name: "type",
                label: "Assessment type",
                type: "select",
                required: true,
                options: [
                  { label: "Assignment", value: "ASSIGNMENT" },
                  { label: "Classwork", value: "CLASSWORK" },
                  { label: "Quiz", value: "QUIZ" },
                  { label: "Test", value: "TEST" },
                  { label: "Mid-term Test", value: "MID_TERM_TEST" },
                  { label: "Practical", value: "PRACTICAL" },
                  { label: "Project", value: "PROJECT" },
                  { label: "Examination", value: "EXAMINATION" }
                ]
              },
              { name: "weight", label: "Weight", type: "number", required: true, min: 0, max: 100, defaultValue: 100 },
              { name: "maxScore", label: "Maximum score", type: "number", required: true, min: 1, max: 100, defaultValue: 100 },
              { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 }
            ]}
          />
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <TableCard
          title="Grading schemes"
          description="Active and historical grading rules."
          items={schemes}
          columns={[
            { key: "name", header: "Scheme", render: (item) => item.name },
            { key: "active", header: "Active", render: (item) => (item.isActive ? "Yes" : "No") },
            { key: "ranking", header: "Ranking", render: (item) => (item.rankingEnabled ? "Enabled" : "Disabled") },
            { key: "passMark", header: "Pass", render: (item) => item.passMark }
          ]}
        />
        <TableCard
          title="Assessment components"
          description="Current score components and their configured caps."
          items={components}
          columns={[
            { key: "name", header: "Component", render: (item) => item.name },
            { key: "code", header: "Code", render: (item) => item.code },
            { key: "weight", header: "Weight", render: (item) => item.weight },
            { key: "max", header: "Max", render: (item) => item.maxScore },
            { key: "active", header: "Active", render: (item) => (item.isActive ? "Yes" : "No") }
          ]}
        />
        <TableCard
          title="Section weights"
          description="Nigeria-specific component weights by crèche, nursery, primary, JSS, and SSS."
          items={sectionComponents}
          columns={[
            { key: "section", header: "Section", render: (item) => item.section.replaceAll("_", " ") },
            { key: "name", header: "Component", render: (item) => item.name },
            { key: "weight", header: "Weight", render: (item) => item.weight },
            { key: "max", header: "Max", render: (item) => item.maxScore }
          ]}
        />
      </section>
    </div>
  );
}
