import Link from "next/link";
import type { Route } from "next";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ResourceForm } from "@/components/forms/resource-form";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import {
  AcademicAssessmentView,
  AssessmentComponentView,
  GradingSchemeView,
  SectionAssessmentComponentView,
} from "@/lib/domain/types";
import {
  nigerianClassFieldOptions,
  nigerianClassOptions,
  normalizeNigeriaClassValue,
} from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

const assessmentTypeOptions = [
  { label: "Assignment", value: "ASSIGNMENT" },
  { label: "Classwork", value: "CLASSWORK" },
  { label: "Quiz", value: "QUIZ" },
  { label: "Test", value: "TEST" },
  { label: "Mid-term Test", value: "MID_TERM_TEST" },
  { label: "Practical", value: "PRACTICAL" },
  { label: "Project", value: "PROJECT" },
  { label: "Examination", value: "EXAMINATION" },
];

const submissionModeOptions = [
  { label: "Paper", value: "PAPER" },
  { label: "CBT", value: "CBT" },
  { label: "Practical", value: "PRACTICAL" },
  { label: "Oral", value: "ORAL" },
];

const assessmentStatusOptions = [
  { label: "All statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Closed", value: "CLOSED" },
  { label: "Marked", value: "MARKED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Published", value: "PUBLISHED" },
];

const defaultBands = JSON.stringify(
  [
    { label: "A", minScore: 70, maxScore: 100, remark: "Excellent", order: 1 },
    { label: "B", minScore: 60, maxScore: 69.99, remark: "Very Good", order: 2 },
    { label: "C", minScore: 50, maxScore: 59.99, remark: "Good", order: 3 },
    { label: "D", minScore: 45, maxScore: 49.99, remark: "Pass", order: 4 },
    { label: "E", minScore: 40, maxScore: 44.99, remark: "Fair", order: 5 },
    { label: "F", minScore: 0, maxScore: 39.99, remark: "Fail", order: 6 },
  ],
  null,
  2,
);

type AssessmentFormatPageProps = {
  searchParams?: Promise<{
    q?: string;
    className?: string;
    subject?: string;
    status?: string;
  }>;
};

function WorkspaceStatCard({
  label,
  value,
  note,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "brand" | "emerald" | "ink" | "amber";
}) {
  const toneMap = {
    brand: "from-brand-700 via-brand-600 to-emerald-500",
    emerald: "from-emerald-700 via-brand-600 to-ink",
    ink: "from-ink via-brand-900 to-brand-700",
    amber: "from-amber via-brand-700 to-ink",
  };

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-panel">
      <div className={`h-1.5 bg-gradient-to-r ${toneMap[tone]}`} />
      <div className="p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-ink/45">{label}</p>
        <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-ink">{value}</p>
        <p className="mt-2 text-sm leading-6 text-ink/60">{note}</p>
      </div>
    </article>
  );
}

export default async function AssessmentFormatPage({ searchParams }: AssessmentFormatPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/academics/results/assessment-format"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [schemes, components, sectionComponents, assessments, permissions, params] = await Promise.all([
    apiGet<GradingSchemeView[]>("/api/v1/academics/grading-schemes"),
    apiGet<AssessmentComponentView[]>("/api/v1/academics/assessments"),
    apiGet<SectionAssessmentComponentView[]>("/api/v1/academics/section-assessment-components"),
    apiGet<AcademicAssessmentView[]>("/api/v1/academics/academic-assessments"),
    getServerPermissions(session),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const canManage =
    canManagePath(session.role, "/academics/results") ||
    permissions.some((permission) =>
      ["settings.grading", "results.edit", "results.create", "results.compile"].includes(permission),
    );
  const canCreateAssessment =
    canManage ||
    permissions.some((permission) => ["results.create", "results.edit", "exams.view"].includes(permission));

  const q = params?.q?.trim().toLowerCase();
  const selectedClass = normalizeNigeriaClassValue(params?.className) ?? "";
  const subjectOptions = [
    { label: "All subjects", value: "" },
    ...Array.from(new Set(assessments.map((item) => item.subject)))
      .sort()
      .map((subject) => ({ label: subject, value: subject })),
  ];

  const filteredAssessments = assessments.filter((assessment) => {
    const matchesSearch =
      !q ||
      [assessment.title, assessment.subject, assessment.teacherName, assessment.className]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    const matchesClass = !selectedClass || normalizeNigeriaClassValue(assessment.className) === selectedClass;
    const matchesSubject = !params?.subject || assessment.subject === params.subject;
    const matchesStatus = !params?.status || assessment.status === params.status;
    return matchesSearch && matchesClass && matchesSubject && matchesStatus;
  });

  const activeSummary = [
    params?.q ? `Search: ${params.q}` : "",
    selectedClass ? `Class: ${selectedClass.replaceAll("_", " ")}` : "",
    params?.subject ? `Subject: ${params.subject}` : "",
    params?.status ? `Status: ${params.status.replaceAll("_", " ")}` : "",
  ].filter(Boolean);

  const activeSchemes = schemes.filter((item) => item.isActive).length;
  const activeComponents = components.filter((item) => item.isActive).length;
  const activeSectionComponents = sectionComponents.filter((item) => item.isActive).length;
  const activeAssessments = assessments.filter((item) => ["ACTIVE", "MARKED", "APPROVED"].includes(item.status)).length;
  const totalCandidates = assessments.reduce((sum, item) => sum + item.candidateCount, 0);
  const totalEnteredScores = assessments.reduce((sum, item) => sum + item.enteredCount, 0);
  const completionRate = totalCandidates === 0 ? 0 : Math.round((totalEnteredScores / totalCandidates) * 100);
  const atRiskAssessments = assessments.filter(
    (item) => item.candidateCount > 0 && item.enteredCount < item.candidateCount && ["ACTIVE", "MARKED"].includes(item.status),
  ).length;
  const sectionCoverage = Array.from(
    sectionComponents.reduce((map, item) => {
      const current = map.get(item.section) ?? { section: item.section, weight: 0, count: 0 };
      current.weight += item.weight;
      current.count += 1;
      map.set(item.section, current);
      return map;
    }, new Map<string, { section: string; weight: number; count: number }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => left.section.localeCompare(right.section));

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="h-2 bg-gradient-to-r from-brand-800 via-emerald-500 to-ink" />
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(238,247,241,0.96),rgba(250,245,235,0.95))] p-6 md:p-8">
          <Link href="/academics/results/broadsheets" className="text-sm font-semibold text-brand-700">
            Back to broadsheet
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
                Configuration foundation
              </p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">
                Assessment Format
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
                Define how marks are structured for this school, keep grading rules historically safe, and run the live
                assessment register from the same premium workspace so users do not need to keep jumping across pages.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                  {activeSchemes} active grading schemes
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  {completionRate}% register completion
                </span>
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70">
                  {atRiskAssessments} live assessments need follow-up
                </span>
              </div>
            </div>
            {canCreateAssessment ? (
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/academics/results/broadsheets"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-brand-100 bg-brand-50 px-5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  Open broadsheet
                </Link>
                <ResourceActionDialog
                  triggerLabel="Create assessment"
                  title="Create assessment"
                  description="Set up a class assessment that will generate candidates and feed broadsheet score entry."
                  endpoint="/api/v1/academics/academic-assessments"
                  submitLabel="Create assessment"
                  confirmLabel="Confirm creation"
                  confirmMessage="This will create the assessment and generate the enrolled class candidate list."
                  fields={[
                    { name: "title", label: "Assessment title", required: true, placeholder: "Second Term Mathematics Test 2" },
                    { name: "className", label: "Class", type: "select", required: true, options: nigerianClassFieldOptions },
                    { name: "arm", label: "Arm", placeholder: "Gold" },
                    { name: "subject", label: "Subject", required: true, placeholder: "Mathematics" },
                    { name: "assessmentType", label: "Assessment type", type: "select", required: true, options: assessmentTypeOptions },
                    { name: "maxScore", label: "Max score", type: "number", required: true, min: 1, max: 100 },
                    { name: "weight", label: "Weight toward result (%)", type: "number", required: true, min: 0, max: 100 },
                    { name: "assessmentDate", label: "Assessment date", type: "date", required: true },
                    { name: "submissionMode", label: "Submission mode", type: "select", required: true, options: submissionModeOptions },
                  ]}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <DetailTabs
        tabs={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Configuration studio", href: "#configuration" },
          { label: "Assessment register", href: "#register" },
        ]}
      />

      <section id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkspaceStatCard label="Grading schemes" value={activeSchemes} note={`${schemes.length} total schemes across current and historical setups.`} tone="brand" />
        <WorkspaceStatCard label="Assessment components" value={activeComponents} note={`${components.length} reusable score components available for schools and sections.`} tone="emerald" />
        <WorkspaceStatCard label="Section format rules" value={activeSectionComponents} note={`${sectionComponents.length} section-level weighting records are live or historical.`} tone="ink" />
        <WorkspaceStatCard label="Live assessments" value={activeAssessments} note={`${atRiskAssessments} active workspaces still need intervention.`} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Configuration guardrails</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">Keep every section historically safe</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              This workspace lets academic leaders manage grading bands, school-wide score components, and section-specific
              weighting rules without leaving the results area.
            </p>
            <div className="mt-5 grid gap-3">
              {sectionCoverage.map((item) => (
                <article key={item.section} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{item.section.replaceAll("_", " ")}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                      {item.count} components
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink/60">Combined configured weight: {item.weight}%.</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-700 via-emerald-500 to-emerald-400"
                      style={{ width: `${Math.min(item.weight, 100)}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-amber via-brand-700 to-emerald-500" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Live register health</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">See what still needs movement</h2>
            <div className="mt-5 grid gap-3">
              {filteredAssessments.slice(0, 5).map((assessment) => (
                <article key={assessment.id} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{assessment.title}</p>
                      <p className="mt-1 text-xs text-ink/55">{assessment.className} · {assessment.subject}</p>
                    </div>
                    <StatusBadge status={assessment.status} />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-700 via-emerald-500 to-emerald-400"
                      style={{ width: `${assessment.candidateCount === 0 ? 0 : Math.round((assessment.enteredCount / assessment.candidateCount) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-ink/60">
                    {assessment.enteredCount}/{assessment.candidateCount} scores entered.
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>

      {canManage ? (
        <section id="configuration" className="grid gap-6 xl:grid-cols-2">
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
                  { label: "No", value: "false" },
                ],
              },
              { name: "bandsJson", label: "Grade bands JSON", type: "textarea", required: true, defaultValue: defaultBands },
            ]}
          />
          <ResourceForm
            title="Create assessment component"
            description="Set component max score and weight for CA, project, practical, or exam workflows."
            endpoint="/api/v1/academics/assessments"
            submitLabel="Save component"
            fields={[
              { name: "name", label: "Component name", required: true, placeholder: "CA1" },
              { name: "code", label: "Code", required: true, placeholder: "CA1" },
              { name: "weight", label: "Weight", type: "number", required: true, min: 1, max: 100 },
              { name: "maxScore", label: "Maximum score", type: "number", required: true, min: 1, max: 100 },
              { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 },
            ]}
          />
          <ResourceForm
            title="Create section format rule"
            description="Define Nigerian CA/exam weights by section. Active components for a section should stay coherent."
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
                  { label: "Senior Secondary", value: "SENIOR_SECONDARY" },
                ],
              },
              { name: "name", label: "Component name", required: true, placeholder: "Terminal Examination" },
              { name: "code", label: "Code", required: true, placeholder: "EXAM" },
              {
                name: "type",
                label: "Assessment type",
                type: "select",
                required: true,
                options: assessmentTypeOptions,
              },
              { name: "weight", label: "Weight", type: "number", required: true, min: 0, max: 100, defaultValue: 100 },
              { name: "maxScore", label: "Maximum score", type: "number", required: true, min: 1, max: 100, defaultValue: 100 },
              { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 },
            ]}
          />
        </section>
      ) : null}

      <div id="register">
        <FilterToolbar
          title="Assessment register"
          description="Review live tests, assignments, practicals, and exams that feed the broadsheet."
          action={"/academics/results/assessment-format" as Route}
          controls={[
            { name: "q", label: "Search", type: "search", placeholder: "Search title, subject, or teacher", defaultValue: params?.q },
            { name: "className", label: "Class", type: "select", options: nigerianClassOptions, defaultValue: selectedClass },
            { name: "subject", label: "Subject", type: "select", options: subjectOptions, defaultValue: params?.subject },
            { name: "status", label: "Status", type: "select", options: assessmentStatusOptions, defaultValue: params?.status },
          ]}
          activeSummary={activeSummary}
          resultCount={filteredAssessments.length}
        />
      </div>

      <TableCard
        title="Configured grading and weighting"
        description="Assessment Format remains the source of truth for how scores are structured before broadsheet aggregation."
        items={schemes}
        columns={[
          { key: "name", header: "Scheme", render: (item) => item.name },
          { key: "active", header: "Active", render: (item) => (item.isActive ? "Yes" : "No") },
          { key: "ranking", header: "Ranking", render: (item) => (item.rankingEnabled ? "Enabled" : "Disabled") },
          { key: "passMark", header: "Pass", render: (item) => item.passMark },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Assessment components"
          description="Reusable score components available for school-wide or section-specific formats."
          items={components}
          columns={[
            { key: "name", header: "Component", render: (item) => item.name },
            { key: "code", header: "Code", render: (item) => item.code },
            { key: "weight", header: "Weight", render: (item) => item.weight },
            { key: "max", header: "Max", render: (item) => item.maxScore },
            { key: "active", header: "Active", render: (item) => (item.isActive ? "Yes" : "No") },
          ]}
        />
        <TableCard
          title="Section rules"
          description="Section-level assessment weights for crèche, nursery, primary, junior secondary, and senior secondary."
          items={sectionComponents}
          columns={[
            { key: "section", header: "Section", render: (item) => item.section.replaceAll("_", " ") },
            { key: "name", header: "Component", render: (item) => item.name },
            { key: "weight", header: "Weight", render: (item) => item.weight },
            { key: "max", header: "Max", render: (item) => item.maxScore },
          ]}
        />
      </section>

      <TableCard
        title="Live assessment workspaces"
        description="Teachers and exam officers can open class-level marking workspaces directly here, so the assessment format and live scoring flow stay tightly connected."
        items={filteredAssessments}
        columns={[
          {
            key: "assessment",
            header: "Assessment",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-ink/55">
                  {item.assessmentType.replaceAll("_", " ")} · {item.submissionMode}
                </p>
              </div>
            ),
          },
          { key: "class", header: "Class", render: (item) => `${item.className}${item.arm ? ` · ${item.arm}` : ""}` },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "teacher", header: "Teacher", render: (item) => item.teacherName ?? "Unassigned" },
          { key: "date", header: "Date", render: (item) => formatDate(item.assessmentDate) },
          { key: "scores", header: "Scores", render: (item) => `${item.enteredCount}/${item.candidateCount}` },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "open",
            header: "Workspace",
            render: (item) => (
              <Link className="font-semibold text-brand-700" href={`/academics/results/assessment-format/${item.id}` as Route}>
                Open
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
