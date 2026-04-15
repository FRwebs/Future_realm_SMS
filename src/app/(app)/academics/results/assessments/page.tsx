import Link from "next/link";
import type { Route } from "next";

import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AcademicAssessmentView } from "@/lib/domain/types";
import { nigerianClassFieldOptions, nigerianClassOptions, normalizeNigeriaClassValue } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

const assessmentTypeOptions = [
  { label: "Assignment", value: "ASSIGNMENT" },
  { label: "Classwork", value: "CLASSWORK" },
  { label: "Quiz", value: "QUIZ" },
  { label: "Test", value: "TEST" },
  { label: "Mid-term Test", value: "MID_TERM_TEST" },
  { label: "Practical", value: "PRACTICAL" },
  { label: "Project", value: "PROJECT" },
  { label: "Examination", value: "EXAMINATION" }
];

const submissionModeOptions = [
  { label: "Paper", value: "PAPER" },
  { label: "CBT", value: "CBT" },
  { label: "Practical", value: "PRACTICAL" },
  { label: "Oral", value: "ORAL" }
];

const assessmentStatusOptions = [
  { label: "All statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Closed", value: "CLOSED" },
  { label: "Marked", value: "MARKED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Published", value: "PUBLISHED" }
];

type AcademicAssessmentsPageProps = {
  searchParams?: Promise<{
    q?: string;
    className?: string;
    subject?: string;
    status?: string;
  }>;
};

export default async function AcademicAssessmentsPage({ searchParams }: AcademicAssessmentsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/academics/results")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const assessments = await apiGet<AcademicAssessmentView[]>("/api/v1/academics/academic-assessments");
  const canManage = canManagePath(session.role, "/academics/results") && !["TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"].includes(session.role);
  const params = searchParams ? await searchParams : undefined;
  const q = params?.q?.trim().toLowerCase();
  const selectedClass = normalizeNigeriaClassValue(params?.className) ?? "";
  const subjectOptions = [
    { label: "All subjects", value: "" },
    ...Array.from(new Set(assessments.map((item) => item.subject))).sort().map((subject) => ({ label: subject, value: subject }))
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
    params?.status ? `Status: ${params.status.replaceAll("_", " ")}` : ""
  ].filter(Boolean);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(250,245,235,0.96))] p-6 md:p-8">
          <Link href="/academics/results" className="text-sm font-semibold text-brand-700">Back to results</Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Nigerian assessment workflow</p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">Assessment setup and marking</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
                Create assignments, tests, practicals, and terminal exams, generate class candidates automatically, and feed score entry into result compilation.
              </p>
            </div>
            {canManage ? (
              <ResourceActionDialog
                triggerLabel="Create assessment"
                title="Create assessment"
                description="Set up a Nigerian-school assessment for a class, arm, subject, and teacher."
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
                  { name: "submissionMode", label: "Submission mode", type: "select", required: true, options: submissionModeOptions }
                ]}
              />
            ) : null}
          </div>
        </div>
      </section>

      <FilterToolbar
        title="Find assessments fast"
        description="Filter by class, subject, status, and title before opening the marking workspace."
        action={"/academics/results/assessments" as Route}
        controls={[
          { name: "q", label: "Search", type: "search", placeholder: "Search title, subject, or teacher", defaultValue: params?.q },
          { name: "className", label: "Class", type: "select", options: nigerianClassOptions, defaultValue: selectedClass },
          { name: "subject", label: "Subject", type: "select", options: subjectOptions, defaultValue: params?.subject },
          { name: "status", label: "Status", type: "select", options: assessmentStatusOptions, defaultValue: params?.status }
        ]}
        activeSummary={activeSummary}
        resultCount={filteredAssessments.length}
      />

      <TableCard
        title="Assessment register"
        description="Class candidate lists are generated per assessment; teachers enter scores only for assigned classes and subjects."
        items={filteredAssessments}
        columns={[
          {
            key: "assessment",
            header: "Assessment",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-ink/55">{item.assessmentType.replaceAll("_", " ")} · {item.submissionMode}</p>
              </div>
            )
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
              <Link className="font-semibold text-brand-700" href={`/academics/results/assessments/${item.id}` as Route}>
                Open
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
