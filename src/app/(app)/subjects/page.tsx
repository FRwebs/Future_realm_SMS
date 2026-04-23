import Link from "next/link";

import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { SchemeOfWorkStatusBadge } from "@/components/scheme-of-work/status-badge";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath, getServerPermissions } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { SchemeOfWorkSummaryView, SubjectView } from "@/lib/domain/types";
import { nigerianClassFieldOptions } from "@/lib/school-options";

const sectionOptions = [
  { label: "Creche", value: "CRECHE" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Junior Secondary", value: "JUNIOR_SECONDARY" },
  { label: "Senior Secondary", value: "SENIOR_SECONDARY" },
];

type SubjectsPageProps = {
  searchParams?: Promise<{
    search?: string;
    section?: string;
    status?: string;
    classLevel?: string;
    teacherAssigned?: string;
  }>;
};

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
}

function MetricCard({
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
  const tones = {
    brand: "from-brand-700 via-brand-600 to-emerald-500",
    emerald: "from-emerald-700 via-brand-600 to-ink",
    ink: "from-ink via-brand-900 to-brand-700",
    amber: "from-amber via-brand-700 to-ink",
  };

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-panel">
      <div className={`h-1.5 bg-gradient-to-r ${tones[tone]}`} />
      <div className="p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-ink/45">{label}</p>
        <p className="mt-3 font-[var(--font-heading)] text-3xl font-black text-ink">{value}</p>
        <p className="mt-2 text-sm leading-6 text-ink/60">{note}</p>
      </div>
    </article>
  );
}

export default async function SubjectsOverviewPage({ searchParams }: SubjectsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/subjects"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const path = `/api/v1/academics/subjects${queryString(params)}`;

  const [subjects, permissions, sows] = await Promise.all([
    apiGet<SubjectView[]>(path),
    getServerPermissions(session),
    apiGet<SchemeOfWorkSummaryView[]>("/api/v1/scheme-of-work").catch(() => []),
  ]);
  const canCreate = permissions.includes("subjects.create");

  const subjectStats = new Map(
    subjects.map((subject) => {
      const rows = sows.filter((item) => item.subjectId === subject.id);
      const approved = rows.filter((item) => item.status === "APPROVED").length;
      const submitted = rows.filter((item) => item.status === "SUBMITTED").length;
      const draft = rows.filter((item) => item.status === "DRAFT" || item.status === "RETURNED").length;
      const averageCoverage =
        rows.length === 0 ? 0 : Math.round(rows.reduce((sum, item) => sum + item.coveragePercent, 0) / rows.length);
      return [subject.id, { total: rows.length, approved, submitted, draft, averageCoverage }];
    }),
  );

  const totalAssignments = subjects.reduce((sum, subject) => sum + (subject.classCount ?? 0), 0);
  const teacherReadySubjects = subjects.filter((subject) => (subject.teacherCount ?? 0) > 0).length;
  const coverageValues = Array.from(subjectStats.values()).map((item) => item.averageCoverage);
  const overallCoverage =
    coverageValues.length === 0
      ? 0
      : Math.round(coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length);

  const departmentSummary = Array.from(
    subjects.reduce((map, subject) => {
      const key = subject.departmentName ?? "General subjects";
      const current = map.get(key) ?? { name: key, count: 0, withTeachers: 0 };
      current.count += 1;
      if ((subject.teacherCount ?? 0) > 0) current.withTeachers += 1;
      map.set(key, current);
      return map;
    }, new Map<string, { name: string; count: number; withTeachers: number }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);

  const attentionSubjects = subjects
    .map((subject) => {
      const stats = subjectStats.get(subject.id);
      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        departmentName: subject.departmentName ?? "General subjects",
        coverage: stats?.averageCoverage ?? 0,
        classCount: subject.classCount ?? 0,
        teacherCount: subject.teacherCount ?? 0,
      };
    })
    .filter((subject) => subject.teacherCount === 0 || (subject.classCount > 0 && subject.coverage < 60))
    .sort((left, right) => {
      if (left.teacherCount !== right.teacherCount) return left.teacherCount - right.teacherCount;
      return left.coverage - right.coverage;
    })
    .slice(0, 5);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
        <div className="h-2 bg-gradient-to-r from-brand-800 via-emerald-500 to-ink" />
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(238,247,241,0.96),rgba(250,245,235,0.95))] p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">Academic operations</p>
              <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-black tracking-tight text-ink">Subjects</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
                Run the subject register, scheme-of-work readiness, and teaching ownership from one premium workspace
                instead of hopping across scattered academic screens.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                  {subjects.length} subjects in register
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  {teacherReadySubjects} with teaching owners
                </span>
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70">
                  {overallCoverage}% average scheme coverage
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/academics/results/assessment-format"
                className="inline-flex h-11 items-center justify-center rounded-full border border-brand-100 bg-brand-50 px-5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
              >
                Assessment format
              </Link>
              {canCreate ? (
                <>
                  <Link
                    href="/subjects/new"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 bg-white px-5 text-sm font-semibold text-ink transition hover:bg-sand/70"
                  >
                    Full subject form
                  </Link>
                  <ResourceActionDialog
                    triggerLabel="Quick add subject"
                    title="Add subject"
                    description="Create a subject quickly from the subjects workspace."
                    endpoint="/api/v1/academics/subjects"
                    submitLabel="Save subject"
                    fields={[
                      { name: "name", label: "Subject name", required: true, placeholder: "Agricultural Science" },
                      { name: "code", label: "Subject code", required: true, placeholder: "AGRIC" },
                      { name: "section", label: "Section", type: "select", required: true, options: sectionOptions },
                      { name: "applicableClassLevelsJson", label: "Applicable classes", type: "multiselect", options: nigerianClassFieldOptions },
                      { name: "description", label: "Description", type: "textarea", placeholder: "Short curriculum note" },
                      { name: "periodsPerWeek", label: "Periods per week", type: "number", defaultValue: 3, min: 1, max: 30 },
                    ]}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <DetailTabs
        tabs={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Register", href: "#register" },
          { label: "Attention", href: "#attention" },
        ]}
      />

      <section id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Subject register" value={subjects.length} note="All active and configurable academic subjects." tone="brand" />
        <MetricCard label="Class footprints" value={totalAssignments} note="Total class-level subject mappings across the school." tone="emerald" />
        <MetricCard label="Teacher-ready subjects" value={teacherReadySubjects} note="Subjects already tied to at least one teaching owner." tone="ink" />
        <MetricCard label="Average SOW coverage" value={`${overallCoverage}%`} note="Term-wide planning progress across initialized schemes of work." tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-brand-700 via-emerald-500 to-ink" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Department footprint</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">Where the curriculum is concentrated</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {departmentSummary.map((department) => (
                <article key={department.name} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{department.name}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                      {department.count} subjects
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink/60">{department.withTeachers} already have teaching ownership in place.</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-700 via-emerald-500 to-emerald-400"
                      style={{ width: `${department.count === 0 ? 0 : Math.round((department.withTeachers / department.count) * 100)}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="attention" className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/92 shadow-panel">
          <div className="h-1.5 bg-gradient-to-r from-amber via-brand-700 to-emerald-500" />
          <div className="p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">Attention needed</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-black text-ink">Subjects that still need intervention</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              We surface low-coverage or unassigned subjects here so academic leaders can fix issues without digging
              through the full register.
            </p>
            <div className="mt-5 grid gap-3">
              {attentionSubjects.length === 0 ? (
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
                  Subject ownership and scheme-of-work coverage are in a healthy state right now.
                </div>
              ) : (
                attentionSubjects.map((subject) => (
                  <article key={subject.id} className="rounded-[1.5rem] border border-white/70 bg-sand/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{subject.name}</p>
                        <p className="mt-1 text-xs text-ink/55">{subject.code} · {subject.departmentName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subject.teacherCount === 0 ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            Teacher pending
                          </span>
                        ) : null}
                        <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/65">
                          {subject.coverage}% coverage
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ActionMenu triggerLabel={`Actions for ${subject.name}`}>
                        <ActionMenuLink href={`/subjects/${subject.id}`}>Open subject</ActionMenuLink>
                        <ActionMenuLink href={`/subjects/${subject.id}/scheme-of-work`}>Review SOW</ActionMenuLink>
                      </ActionMenu>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      <div id="register">
        <FilterToolbar
          action="/subjects"
          title="Find subjects"
          description="Filter the subject register by section, class level, lifecycle status, or whether a teaching owner has already been assigned."
          resultCount={subjects.length}
          activeSummary={[
            params.search ? `Search: ${params.search}` : "",
            params.section ? `Section: ${params.section.replaceAll("_", " ")}` : "",
            params.status ? `Status: ${params.status}` : "",
            params.classLevel ? `Class: ${params.classLevel}` : "",
            params.teacherAssigned ? `Teacher assigned: ${params.teacherAssigned}` : "",
          ].filter(Boolean)}
          controls={[
            { name: "search", label: "Search", type: "search", placeholder: "Subject name, code, description", defaultValue: params.search ?? "" },
            { name: "section", label: "Section", type: "select", defaultValue: params.section ?? "", options: [{ label: "All sections", value: "" }, ...sectionOptions] },
            { name: "status", label: "Status", type: "select", defaultValue: params.status ?? "", options: [{ label: "Active only", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }] },
            { name: "classLevel", label: "Class level", type: "select", defaultValue: params.classLevel ?? "", options: [{ label: "All class levels", value: "" }, ...nigerianClassFieldOptions] },
            {
              name: "teacherAssigned",
              label: "Teacher assignment",
              type: "select",
              defaultValue: params.teacherAssigned ?? "",
              options: [
                { label: "All subjects", value: "" },
                { label: "With teacher", value: "yes" },
                { label: "Without teacher", value: "no" },
              ],
            },
          ]}
        />
      </div>

      <TableCard
        title="Subject register"
        description="Department grouping, class coverage, and scheme-of-work readiness in one table so users can inspect, open, and act without bouncing through multiple pages."
        items={subjects}
        emptyState="No subjects have been configured for this school yet."
        columns={[
          {
            key: "name",
            header: "Subject",
            render: (subject) => (
              <div>
                <p className="font-semibold text-ink">{subject.name}</p>
                <p className="text-xs text-ink/55">{subject.code} · {subject.departmentName ?? "General subjects"}</p>
              </div>
            ),
          },
          {
            key: "classes",
            header: "Assignments",
            render: (subject) => (
              <div className="text-sm text-ink/72">
                <p>{subject.classCount ?? 0} classes</p>
                <p className="text-xs text-ink/52">{subject.teacherCount ?? 0} teachers</p>
              </div>
            ),
          },
          {
            key: "sow",
            header: "SOW Status",
            render: (subject) => {
              const stats = subjectStats.get(subject.id);
              return (
                <div className="min-w-[180px]">
                  <div className="flex flex-wrap gap-2">
                    <SchemeOfWorkStatusBadge status={stats?.approved ? "APPROVED" : stats?.submitted ? "SUBMITTED" : stats?.draft ? "DRAFT" : "DRAFT"} size="sm" />
                    <span className="rounded-full border border-ink/10 bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-ink/65">
                      {stats?.total ?? 0} classes
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    {stats?.approved ?? 0} approved · {stats?.submitted ?? 0} submitted · {stats?.draft ?? 0} draft/returned
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
                    <span className="block h-full rounded-full bg-brand-600" style={{ width: `${stats?.averageCoverage ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink/52">Average coverage: {stats?.averageCoverage ?? 0}%</p>
                </div>
              );
            },
          },
            {
              key: "actions",
              header: "Actions",
              render: (subject) => (
                <ActionMenu triggerLabel={`Actions for ${subject.name}`}>
                  <ActionMenuLink href={`/subjects/${subject.id}`}>View subject</ActionMenuLink>
                  <ActionMenuLink href={`/subjects/${subject.id}/scheme-of-work`}>View SOW</ActionMenuLink>
                </ActionMenu>
              ),
            },
        ]}
      />
    </div>
  );
}
