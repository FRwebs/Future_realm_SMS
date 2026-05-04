import Link from "next/link";
import type { Route } from "next";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type AssessmentFormatPageProps = {
  searchParams?: Promise<{
    q?: string;
    className?: string;
    subject?: string;
    status?: string;
  }>;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

/**
 * A simple icon-labeled action card used in the "Configuration studio" section.
 * Clicking one opens the corresponding ResourceActionDialog trigger (the dialog
 * is embedded inside this card so the layout stays coherent).
 */
function ConfigActionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode; // expects a <ResourceActionDialog> trigger
}) {
  return (
    <article className="flex items-start gap-4 rounded-[1.5rem] border border-white/70 bg-sand/55 p-5 transition hover:bg-sand/80">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-brand-700 shadow-sm">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-ink/55">{description}</p>
        <div className="mt-4">{children}</div>
      </div>
    </article>
  );
}

// ─── Icons (inline SVG to avoid extra deps) ───────────────────────────────────

const SchemeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);

const ComponentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
  </svg>
);

const SectionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const SECTION_META: Record<string, { label: string; short: string; color: string; bar: string }> = {
  CRECHE:           { label: "Crèche",           short: "CRÈ", color: "bg-violet-50 border-violet-200 text-violet-800",  bar: "from-violet-500 to-violet-400" },
  NURSERY:          { label: "Nursery",           short: "NUR", color: "bg-sky-50 border-sky-200 text-sky-800",           bar: "from-sky-500 to-sky-400" },
  PRIMARY:          { label: "Primary",           short: "PRI", color: "bg-emerald-50 border-emerald-200 text-emerald-800", bar: "from-emerald-600 to-emerald-400" },
  JUNIOR_SECONDARY: { label: "Junior Secondary",  short: "JSS", color: "bg-amber-50 border-amber-200 text-amber-800",     bar: "from-amber-500 to-amber-400" },
  SENIOR_SECONDARY: { label: "Senior Secondary",  short: "SSS", color: "bg-rose-50 border-rose-200 text-rose-800",        bar: "from-rose-500 to-rose-400" },
};

/**
 * Unified score structure panel.
 *
 * One card per school section. Each card shows:
 *   • A weight-balance bar across all its components (must total 100%)
 *   • One compact row per component: code pill · name · weight · max · active · edit button
 *
 * Global (school-wide) components are listed in a summary row at the top so
 * admins know what building blocks exist without a separate table.
 */
function ScoreStructurePanel({
  components,
  sectionComponents,
  canManage,
  assessmentTypeOptions,
}: {
  components: AssessmentComponentView[];
  sectionComponents: SectionAssessmentComponentView[];
  canManage: boolean;
  assessmentTypeOptions: { label: string; value: string }[];
}) {
  // Group section components by section key
  const bySection = sectionComponents.reduce<Record<string, SectionAssessmentComponentView[]>>(
    (acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    },
    {},
  );

  // Sections present in data, ordered by school progression
  const sectionOrder = ["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
  const activeSections = sectionOrder.filter((s) => bySection[s]?.length);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
      {/* Accent bar: multi-section rainbow */}
      <div className="h-1.5 bg-gradient-to-r from-sky-500 via-emerald-500 via-amber-400 to-rose-500" />

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
              Score structure
            </p>
            <h2 className="mt-1 font-[var(--font-heading)] text-2xl font-black text-ink">
              Components &amp; section rules
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">
              Each school section must have components that total 100%. Rules here feed directly into broadsheet aggregation — keep them tight.
            </p>
          </div>

          {/* Global component library summary */}
          <div className="shrink-0 rounded-2xl border border-white/70 bg-sand/60 px-4 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ink/45">
              Shared components
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {components.map((c) => (
                <span
                  key={c.code}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    c.isActive
                      ? "border-brand-200 bg-brand-50 text-brand-800"
                      : "border-ink/10 bg-white/60 text-ink/40 line-through"
                  }`}
                >
                  {c.code}
                  <span className="font-normal text-ink/50">·{c.weight}%</span>
                </span>
              ))}
              {canManage && (
                <ResourceActionDialog
                  presentation="drawer"
                  triggerLabel="+ New"
                  title="Create assessment component"
                  description="Add a reusable score component available across all sections."
                  endpoint="/api/v1/academics/assessments"
                  submitLabel="Save component"
                  confirmLabel="Confirm"
                  confirmMessage="This component will be available to assign to any section format rule."
                  fields={[
                    { name: "name", label: "Component name", required: true, placeholder: "Continuous Assessment" },
                    { name: "code", label: "Code", required: true, placeholder: "CA" },
                    { name: "weight", label: "Weight (%)", type: "number", required: true, min: 1, max: 100 },
                    { name: "maxScore", label: "Max score", type: "number", required: true, min: 1, max: 100 },
                    { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 },
                  ]}
                />
              )}
            </div>
          </div>
        </div>

        {/* Per-section cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeSections.map((sectionKey) => {
            const meta = SECTION_META[sectionKey] ?? { label: sectionKey, short: sectionKey.slice(0, 3), color: "bg-ink/5 border-ink/10 text-ink", bar: "from-ink to-ink/60" };
            const rows = bySection[sectionKey].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
            const balanced = totalWeight === 100;

            return (
              <article
                key={sectionKey}
                className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 shadow-sm"
              >
                {/* Section header */}
                <div className="flex items-center justify-between gap-3 border-b border-black/[0.04] bg-sand/40 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`rounded-lg border px-2 py-0.5 text-[0.65rem] font-black tracking-widest ${meta.color}`}>
                      {meta.short}
                    </span>
                    <p className="text-sm font-bold text-ink">{meta.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold ${
                        balanced
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {totalWeight}% {balanced ? "✓" : "⚠"}
                    </span>
                    {canManage && (
                      <ResourceActionDialog
                        presentation="drawer"
                        triggerLabel="Add"
                        title={`Add component to ${meta.label}`}
                        description={`Assign a score component to ${meta.label}. Keep total weight at 100%.`}
                        endpoint="/api/v1/academics/section-assessment-components"
                        submitLabel="Add rule"
                        confirmLabel="Confirm"
                        confirmMessage={`Current total for ${meta.label} is ${totalWeight}%. Adding this will update the aggregation rules.`}
                        fields={[
                          { name: "section", label: "Section", type: "select", required: true, options: [{ label: meta.label, value: sectionKey }] },
                          { name: "name", label: "Component name", required: true, placeholder: "Terminal Examination" },
                          { name: "code", label: "Code", required: true, placeholder: "EXAM" },
                          { name: "type", label: "Assessment type", type: "select", required: true, options: assessmentTypeOptions },
                          { name: "weight", label: "Weight (%)", type: "number", required: true, min: 0, max: 100, defaultValue: 100 - totalWeight > 0 ? 100 - totalWeight : 0 },
                          { name: "maxScore", label: "Max score", type: "number", required: true, min: 1, max: 100, defaultValue: 100 },
                          { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: rows.length + 1 },
                        ]}
                      />
                    )}
                  </div>
                </div>

                {/* Weight balance bar */}
                <div className="flex h-1.5 w-full overflow-hidden bg-black/[0.04]">
                  {rows.map((row, i) => {
                    const barColors = ["from-sky-500 to-sky-400", "from-emerald-600 to-emerald-400", "from-amber-500 to-amber-400", "from-rose-500 to-rose-400", "from-violet-500 to-violet-400"];
                    return (
                      <span
                        key={row.code}
                        className={`block h-full bg-gradient-to-r ${barColors[i % barColors.length]}`}
                        style={{ width: `${Math.min(row.weight, 100)}%` }}
                        title={`${row.name}: ${row.weight}%`}
                      />
                    );
                  })}
                </div>

                {/* Component rows */}
                <div className="divide-y divide-black/[0.04] px-4">
                  {rows.map((row) => (
                    <div key={row.code} className="flex items-center gap-3 py-3">
                      {/* Code pill */}
                      <span className="shrink-0 rounded-md bg-ink/[0.06] px-2 py-0.5 font-mono text-[0.68rem] font-bold text-ink/70">
                        {row.code}
                      </span>

                      {/* Name */}
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {row.name}
                      </p>

                      {/* Weight */}
                      <span className="shrink-0 text-sm font-semibold text-ink/80">
                        {row.weight}%
                      </span>

                      {/* Max score */}
                      <span className="shrink-0 rounded-full bg-sand/80 px-2 py-0.5 text-xs text-ink/55">
                        /{row.maxScore}
                      </span>

                      {/* Edit action */}
                      {canManage && (
                        <ResourceActionDialog
                          presentation="drawer"
                          triggerLabel="Edit"
                          title={`Edit — ${row.name}`}
                          description={`Adjust the weight or max score for ${row.name} in ${meta.label}. Changing weight here affects broadsheet aggregation immediately.`}
                          endpoint={`/api/v1/academics/section-assessment-components/${row.id}`}
                          method="PATCH"
                          submitLabel="Save changes"
                          confirmLabel="Save"
                          confirmMessage={`Saving will update ${row.name} for all ${meta.label} results going forward.`}
                          fields={[
                            { name: "name", label: "Component name", required: true, defaultValue: row.name },
                            { name: "code", label: "Code", required: true, defaultValue: row.code },
                            { name: "type", label: "Assessment type", type: "select", required: true, options: assessmentTypeOptions, defaultValue: row.type },
                            { name: "weight", label: "Weight (%)", type: "number", required: true, min: 0, max: 100, defaultValue: row.weight },
                            { name: "maxScore", label: "Max score", type: "number", required: true, min: 1, max: 100, defaultValue: row.maxScore },
                            { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: row.order },
                          ]}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}

          {/* Empty state */}
          {activeSections.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-ink/45">
              No section format rules configured yet.{" "}
              {canManage && "Use the Configuration studio above to add the first rule."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // ── Permissions ──────────────────────────────────────────────────────────────
  const isTeacherWorkspace = ["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role);
  const canManageConfiguration =
    !isTeacherWorkspace &&
    session.role !== "HEAD_OF_DEPARTMENT" &&
    (canManagePath(session.role, "/academics/results") ||
      permissions.some((p) =>
        ["settings.grading", "results.compile", "results.approve"].includes(p),
      ));
  const canCreateAssessment =
    !isTeacherWorkspace &&
    (canManageConfiguration ||
      permissions.some((p) => ["results.create", "results.compile", "results.approve", "exams.view"].includes(p)));

  // ── Filtering ────────────────────────────────────────────────────────────────
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

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const activeSchemes = schemes.filter((item) => item.isActive).length;
  const activeComponents = components.filter((item) => item.isActive).length;
  const activeSectionComponents = sectionComponents.filter((item) => item.isActive).length;
  const activeAssessments = assessments.filter((item) =>
    ["ACTIVE", "MARKED", "APPROVED"].includes(item.status),
  ).length;
  const totalCandidates = assessments.reduce((sum, item) => sum + item.candidateCount, 0);
  const totalEnteredScores = assessments.reduce((sum, item) => sum + item.enteredCount, 0);
  const completionRate = totalCandidates === 0 ? 0 : Math.round((totalEnteredScores / totalCandidates) * 100);
  const atRiskAssessments = assessments.filter(
    (item) =>
      item.candidateCount > 0 &&
      item.enteredCount < item.candidateCount &&
      ["ACTIVE", "MARKED"].includes(item.status),
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
    .sort((a, b) => a.section.localeCompare(b.section));

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6">
      {/* ── Hero / Page header ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="h-2 bg-gradient-to-r from-brand-800 via-emerald-500 to-ink" />
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(238,247,241,0.96),rgba(250,245,235,0.95))] p-6 md:p-8">
          <Link href="/academics/results/broadsheets" className="text-sm font-semibold text-brand-700">
            ← Back to broadsheet
          </Link>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
                Configuration foundation
              </p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">
                Assessment Format
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/68">
                Define grading bands, score components, and section weighting rules — then run the live
                assessment register from the same workspace without jumping across pages.
              </p>

              {/* Status chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                  {activeSchemes} active grading {activeSchemes === 1 ? "scheme" : "schemes"}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  {completionRate}% register completion
                </span>
                {atRiskAssessments > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    ⚠ {atRiskAssessments} {atRiskAssessments === 1 ? "assessment needs" : "assessments need"} follow-up
                  </span>
                )}
              </div>
            </div>

            {/* Primary CTA */}
            {canCreateAssessment && (
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/academics/results/broadsheets"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-brand-100 bg-brand-50 px-5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  Open broadsheet
                </Link>
                <ResourceActionDialog
                  presentation="drawer"
                  triggerLabel="+ Create assessment"
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
            )}
          </div>
        </div>
      </section>

      {/* ── Navigation tabs ─────────────────────────────────────────────────── */}
      <DetailTabs
        tabs={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Configuration studio", href: "#configuration" },
          { label: "Assessment register", href: "#register" },
        ]}
      />

      {/* ── Overview stat cards ─────────────────────────────────────────────── */}
      <section id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkspaceStatCard
          label="Grading schemes"
          value={activeSchemes}
          note={`${schemes.length} total schemes across current and historical setups.`}
          tone="brand"
        />
        <WorkspaceStatCard
          label="Assessment components"
          value={activeComponents}
          note={`${components.length} reusable score components available.`}
          tone="emerald"
        />
        <WorkspaceStatCard
          label="Section format rules"
          value={activeSectionComponents}
          note={`${sectionComponents.length} section-level weighting records live or historical.`}
          tone="ink"
        />
        <WorkspaceStatCard
          label="Live assessments"
          value={activeAssessments}
          note={`${atRiskAssessments > 0 ? `${atRiskAssessments} active workspaces still need intervention.` : "All active workspaces are on track."}`}
          tone="amber"
        />
      </section>

      {/* ── Overview panels (section coverage + register health) ─────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Section weight coverage */}
        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">
              Configuration guardrails
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">
              Section weight coverage
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              Each section's components should add up to 100%. Gaps here mean scores may not aggregate correctly.
            </p>
            <div className="mt-5 grid gap-3">
              {sectionCoverage.map((item) => (
                <article key={item.section} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink capitalize">{item.section.replaceAll("_", " ")}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                      {item.count} {item.count === 1 ? "component" : "components"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="mt-2 flex-1 h-2 overflow-hidden rounded-full bg-white">
                      <span
                        className={`block h-full rounded-full bg-gradient-to-r ${item.weight >= 100 ? "from-emerald-500 to-emerald-400" : "from-brand-700 via-emerald-500 to-emerald-400"}`}
                        style={{ width: `${Math.min(item.weight, 100)}%` }}
                      />
                    </div>
                    <span className={`ml-3 text-xs font-semibold ${item.weight === 100 ? "text-emerald-700" : "text-amber-700"}`}>
                      {item.weight}%
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Live register health */}
        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-amber via-brand-700 to-emerald-500" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">
              Live register health
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">
              Assessments needing attention
            </h2>
            <div className="mt-5 grid gap-3">
              {filteredAssessments.slice(0, 5).map((assessment) => {
                const pct =
                  assessment.candidateCount === 0
                    ? 0
                    : Math.round((assessment.enteredCount / assessment.candidateCount) * 100);
                return (
                  <article key={assessment.id} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{assessment.title}</p>
                        <p className="mt-1 text-xs text-ink/55">
                          {assessment.className} · {assessment.subject}
                        </p>
                      </div>
                      <StatusBadge status={assessment.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-brand-700 via-emerald-500 to-emerald-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-ink/55">
                        {assessment.enteredCount}/{assessment.candidateCount}
                      </span>
                    </div>
                    <Link
                      href={`/academics/results/assessment-format/${assessment.id}` as Route}
                      className="mt-3 inline-block text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Open workspace →
                    </Link>
                  </article>
                );
              })}
              {filteredAssessments.length === 0 && (
                <p className="py-6 text-center text-sm text-ink/45">No assessments match the current filters.</p>
              )}
            </div>
          </div>
        </section>
      </section>

      {/* ── Configuration studio ─────────────────────────────────────────────── */}
      {/*
          CHANGED: Forms no longer sit docked on the page.
          Each action card shows a description + a dialog trigger button.
          The heavy form UI only appears when the user deliberately opens it.
      */}
      {canManageConfiguration && (
        <section id="configuration" className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500" />
          <div className="p-6 md:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">
              Configuration studio
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">
              Manage grading rules &amp; components
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
              Use these tools to set up grading bands, create reusable score components, and define
              section-level weighting rules. Changes here affect all score aggregation downstream.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* 1. Grading scheme */}
              <ConfigActionCard
                icon={<SchemeIcon />}
                title="Add grading scheme"
                description="Define grade bands (A–F), pass marks, and ranking options. Activating a scheme automatically deactivates the previous one."
              >
                <ResourceActionDialog
                  presentation="drawer"
                  triggerLabel="Add scheme"
                  title="Create grading scheme"
                  description="Activating a scheme deactivates other schemes for this school."
                  endpoint="/api/v1/academics/grading-schemes"
                  submitLabel="Save scheme"
                  confirmLabel="Confirm"
                  confirmMessage="This will create a new grading scheme. Activating it will replace the current active scheme."
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
              </ConfigActionCard>

              {/* 2. Assessment component */}
              <ConfigActionCard
                icon={<ComponentIcon />}
                title="Add assessment component"
                description="Create a reusable score component (e.g. CA1, Exam) with max score and weight for CA, project, practical, or exam workflows."
              >
                <ResourceActionDialog
                  presentation="drawer"
                  triggerLabel="Add component"
                  title="Create assessment component"
                  description="Set component max score and weight for CA, project, practical, or exam workflows."
                  endpoint="/api/v1/academics/assessments"
                  submitLabel="Save component"
                  confirmLabel="Confirm"
                  confirmMessage="This will create a new assessment component available for section format rules."
                  fields={[
                    { name: "name", label: "Component name", required: true, placeholder: "CA1" },
                    { name: "code", label: "Code", required: true, placeholder: "CA1" },
                    { name: "weight", label: "Weight", type: "number", required: true, min: 1, max: 100 },
                    { name: "maxScore", label: "Maximum score", type: "number", required: true, min: 1, max: 100 },
                    { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 },
                  ]}
                />
              </ConfigActionCard>

              {/* 3. Section format rule */}
              <ConfigActionCard
                icon={<SectionIcon />}
                title="Add section format rule"
                description="Assign a component to a specific school section (Nursery, Primary, JSS, SSS) and define its weight within that section."
              >
                <ResourceActionDialog
                  presentation="drawer"
                  triggerLabel="Add section rule"
                  title="Create section format rule"
                  description="Define Nigerian CA/exam weights by section. Active components for a section should stay coherent."
                  endpoint="/api/v1/academics/section-assessment-components"
                  submitLabel="Save rule"
                  confirmLabel="Confirm"
                  confirmMessage="This will create a section-level format rule. Ensure the total weight for this section stays at 100%."
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
                    { name: "type", label: "Assessment type", type: "select", required: true, options: assessmentTypeOptions },
                    { name: "weight", label: "Weight", type: "number", required: true, min: 0, max: 100, defaultValue: 100 },
                    { name: "maxScore", label: "Maximum score", type: "number", required: true, min: 1, max: 100, defaultValue: 100 },
                    { name: "order", label: "Order", type: "number", required: true, min: 1, defaultValue: 1 },
                  ]}
                />
              </ConfigActionCard>
            </div>
          </div>
        </section>
      )}

      {/* ── Reference tables ─────────────────────────────────────────────────── */}
      <TableCard
        title="Configured grading schemes"
        description="The active scheme determines how letter grades and pass/fail status are computed across all results."
        items={schemes}
        columns={[
          { key: "name", header: "Scheme", render: (item) => item.name },
          { key: "active", header: "Active", render: (item) => (item.isActive ? "Yes" : "No") },
          { key: "ranking", header: "Ranking", render: (item) => (item.rankingEnabled ? "Enabled" : "Disabled") },
          { key: "passMark", header: "Pass mark", render: (item) => `${item.passMark}%` },
        ]}
      />

      {/*
       * ── Score structure panel ──────────────────────────────────────────────
       * Replaces both the "Assessment components" and "Section format rules"
       * tables. The data is the same — sections just apply components with
       * optional overrides. Showing them separately was pure redundancy.
       *
       * Layout: one card per school section. Inside each card, every component
       * is a compact row showing code · name · weight bar · max · active chip.
       * The global component library sits in a collapsible "Shared components"
       * accordion at the top so admins can see what's available without noise.
       *
       * Edit actions open ResourceActionDialog so no inline form docks appear.
       */}
        <ScoreStructurePanel
        components={components}
        sectionComponents={sectionComponents}
        canManage={canManageConfiguration}
        assessmentTypeOptions={assessmentTypeOptions}
      />

      {/* ── Assessment register ──────────────────────────────────────────────── */}
      <div id="register">
        <FilterToolbar
          title="Assessment register"
          description="Live tests, assignments, practicals, and exams that feed the broadsheet. Use filters to narrow down by class, subject, or status."
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
        title="Live assessment workspaces"
        description="Open any workspace to enter or review scores. The format rules above govern how these feed into the broadsheet."
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
          {
            key: "class",
            header: "Class",
            render: (item) => `${item.className}${item.arm ? ` · ${item.arm}` : ""}`,
          },
          { key: "subject", header: "Subject", render: (item) => item.subject },
          { key: "teacher", header: "Teacher", render: (item) => item.teacherName ?? "Unassigned" },
          { key: "date", header: "Date", render: (item) => formatDate(item.assessmentDate) },
          {
            key: "scores",
            header: "Scores",
            render: (item) => (
              <span className={item.enteredCount < item.candidateCount && ["ACTIVE", "MARKED"].includes(item.status) ? "font-semibold text-amber-700" : ""}>
                {item.enteredCount}/{item.candidateCount}
              </span>
            ),
          },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          {
            key: "open",
            header: "Workspace",
            render: (item) => (
              <Link
                className="font-semibold text-brand-700 hover:underline"
                href={`/academics/results/assessment-format/${item.id}` as Route}
              >
                Open →
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
