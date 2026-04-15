import type { Route } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { TableCard } from "@/components/data-display/table-card";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type {
  CurriculumTopicView,
  NigeriaOperationsDashboardView,
} from "@/lib/domain/types";
import {
  compareNigeriaClassOrder,
  formatNigeriaClassName,
  getNigeriaClassLabel,
  nigerianClassOptions,
  normalizeNigeriaClassValue
} from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type CurriculumPageProps = {
  searchParams?: Promise<{
    className?: string;
    subject?: string;
    progressStatus?: string;
  }>;
};

const CURRICULUM_ROUTE = "/academics/curriculum" as Route;

export default async function CurriculumPage({
  searchParams,
}: CurriculumPageProps) {
  const session = await getServerSession();

  if (!session) return null;

  if (!canAccessPath(session.role, CURRICULUM_ROUTE)) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = {
    className: resolvedSearchParams.className ?? "",
    subject: resolvedSearchParams.subject ?? "",
    progressStatus: resolvedSearchParams.progressStatus ?? "",
  };

  const [topics, dashboard] = await Promise.all([
    apiGet<CurriculumTopicView[]>("/api/v1/nigeria-operations/curriculum"),
    apiGet<NigeriaOperationsDashboardView>(
      "/api/v1/nigeria-operations/dashboard"
    ).catch(() => null),
  ]);

  const canManage = [
    "SUPER_ADMIN",
    "SCHOOL_OWNER",
    "PRINCIPAL",
    "ADMIN_OFFICER",
  ].includes(session.role);

  const className = normalizeNigeriaClassValue(params.className) ?? "";
  const classNameLabel = className ? getNigeriaClassLabel(className) : "";
  const subject = params.subject.trim();
  const progressStatus = params.progressStatus.trim();

  const filteredTopics = topics.filter((topic) => {
    const matchesClass =
      !className ||
      normalizeNigeriaClassValue(topic.className) === className ||
      topic.classId === className;

    const matchesSubject =
      !subject ||
      topic.subject === subject ||
      topic.subjectId === subject;

    const matchesProgress =
      !progressStatus || topic.progressStatus === progressStatus;

    return matchesClass && matchesSubject && matchesProgress;
  });

  const classFieldOptions = Array.from(
    new Map(
      topics.map((topic) => [
        topic.classId,
        { label: formatNigeriaClassName(topic.className), value: topic.classId },
      ])
    ).values()
  ).sort((a, b) => compareNigeriaClassOrder(a.label, b.label));

  const subjectFieldOptions = Array.from(
    new Map(
      topics.map((topic) => [
        topic.subjectId,
        { label: topic.subject, value: topic.subjectId },
      ])
    ).values()
  );

  const subjectFilterOptions = [
    { label: "All subjects", value: "" },
    ...Array.from(
      new Map(
        topics.map((topic) => [
          topic.subject,
          { label: topic.subject, value: topic.subject },
        ])
      ).values()
    ),
  ];

  const activeSummary = [
    classNameLabel ? `Class: ${classNameLabel}` : "",
    subject ? `Subject: ${subject}` : "",
    progressStatus
      ? `Progress: ${progressStatus.replaceAll("_", " ")}`
      : "",
  ].filter(Boolean);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel backdrop-blur">
        <div className="border-b border-ink/5 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(255,255,255,0.92),rgba(250,245,235,0.95))] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">
            Academics
          </p>
          <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold tracking-tight text-ink">
            Scheme of Work
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
            Plan Nigerian termly curriculum coverage by academic session, term,
            class, subject, and week.
          </p>
        </div>

        {dashboard ? (
          <div className="grid gap-4 p-6 md:grid-cols-3">
            <article className="rounded-[1.5rem] border border-ink/6 bg-sand/55 p-5 shadow-sm">
              <p className="text-sm font-medium text-ink/55">Topics</p>
              <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">
                {dashboard.curriculum.totalTopics}
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-ink/6 bg-sand/55 p-5 shadow-sm">
              <p className="text-sm font-medium text-ink/55">Coverage</p>
              <p className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-ink">
                {dashboard.curriculum.completionRate}%
              </p>
            </article>

            <article className="rounded-[1.5rem] border border-ink/6 bg-sand/55 p-5 shadow-sm">
              <p className="text-sm font-medium text-ink/55">Nigerian terms</p>
              <p className="mt-2 font-semibold text-ink">
                {dashboard.academicDefaults.terms.join(", ")}
              </p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <FilterToolbar
          action={CURRICULUM_ROUTE}
          title="Curriculum filters"
          description="Switch class, subject, or progress status without leaving the curriculum list."
          resultCount={filteredTopics.length}
          activeSummary={activeSummary}
          controls={[
            {
              name: "className",
              label: "Class",
              type: "select",
              defaultValue: className,
              options: nigerianClassOptions,
            },
            {
              name: "subject",
              label: "Subject",
              type: "select",
              defaultValue: subject,
              options: subjectFilterOptions,
            },
            {
              name: "progressStatus",
              label: "Progress",
              type: "select",
              defaultValue: progressStatus,
              options: [
                { label: "All progress", value: "" },
                { label: "Not started", value: "NOT_STARTED" },
                { label: "In progress", value: "IN_PROGRESS" },
                { label: "Taught", value: "TAUGHT" },
                { label: "Completed", value: "COMPLETED" },
              ],
            },
          ]}
        />

        {canManage ? (
          <div className="xl:pt-1">
            <ResourceActionDialog
              triggerLabel="Add topic"
              title="Add weekly topic"
              description="Create a Nigerian termly scheme-of-work topic for a configured class and subject."
              endpoint="/api/v1/nigeria-operations/curriculum"
              submitLabel="Save topic"
              confirmLabel="Confirm Topic"
              confirmMessage="Confirm the selected class, subject, week, and topic before adding it to the scheme of work."
              fields={[
                {
                  name: "classId",
                  label: "Class",
                  type: "select",
                  required: true,
                  options: classFieldOptions,
                },
                {
                  name: "subjectId",
                  label: "Subject",
                  type: "select",
                  required: true,
                  options: subjectFieldOptions,
                },
                {
                  name: "weekNumber",
                  label: "Week number",
                  type: "number",
                  required: true,
                  min: 1,
                  max: 16,
                  defaultValue: 1,
                },
                {
                  name: "topic",
                  label: "Weekly topic",
                  required: true,
                  placeholder: "Simultaneous equations",
                },
                {
                  name: "subTopic",
                  label: "Sub-topic",
                  placeholder: "Elimination method",
                },
                {
                  name: "learningObjectives",
                  label: "Learning objectives",
                  type: "textarea",
                },
                {
                  name: "recommendedResources",
                  label: "Recommended resources",
                  type: "textarea",
                },
                {
                  name: "assignmentNote",
                  label: "Homework / assignment note",
                  type: "textarea",
                },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: [
                    { label: "Active", value: "ACTIVE" },
                    { label: "Draft", value: "DRAFT" },
                    { label: "Archived", value: "ARCHIVED" },
                  ],
                },
              ]}
            />
          </div>
        ) : null}
      </section>

      <TableCard
        title="Weekly curriculum plan"
        description="Class-based subject scheme of work for the active Nigerian term."
        items={filteredTopics}
        columns={[
          {
            key: "week",
            header: "Week",
            render: (item) => `Week ${item.weekNumber}`,
          },
          {
            key: "topic",
            header: "Topic",
            render: (item) => (
              <div>
                <p className="font-semibold text-ink">{item.topic}</p>
                <p className="text-xs text-ink/55">
                  {item.subTopic ?? item.learningObjectives ?? "No sub-topic"}
                </p>
              </div>
            ),
          },
          {
            key: "class",
            header: "Class",
            render: (item) => formatNigeriaClassName(item.className),
          },
          {
            key: "subject",
            header: "Subject",
            render: (item) => item.subject,
          },
          {
            key: "progress",
            header: "Progress",
            render: (item) => item.progressStatus.replaceAll("_", " "),
          },
          {
            key: "taught",
            header: "Taught",
            render: (item) =>
              item.actualDateTaught ? formatDate(item.actualDateTaught) : "-",
          },
        ]}
        emptyState="No scheme-of-work topics have been configured yet."
      />
    </div>
  );
}
