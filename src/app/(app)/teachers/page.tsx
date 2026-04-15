import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { TeacherActivityView, TeacherRecordView } from "@/lib/domain/types";
import {
  formatNigeriaClassName,
  getNigeriaClassLabel,
  nigerianClassOptions,
  normalizeNigeriaClassValue
} from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type TeachersPageProps = {
  searchParams?: Promise<{
    className?: string;
    subject?: string;
    search?: string;
  }>;
};

function formatTime(value?: string) {
  if (!value) return "Not marked";
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function matchesTeacher(teacher: TeacherRecordView, search?: string) {
  if (!search) return true;
  return [teacher.fullName, teacher.email, teacher.employeeNo, teacher.designation, teacher.subjects.join(" "), teacher.classAssignments.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(search.toLowerCase());
}

export default async function TeachersPage({ searchParams }: TeachersPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/teachers")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [teachers, teacherActivities, params] = await Promise.all([
    apiGet<TeacherRecordView[]>("/api/v1/teachers"),
    apiGet<TeacherActivityView[]>("/api/v1/teachers/activities"),
    searchParams ? searchParams : Promise.resolve({ className: "", subject: "", search: "" })
  ]);
  const className = normalizeNigeriaClassValue(params.className) ?? "";
  const classNameLabel = className ? getNigeriaClassLabel(className) : "";
  const subject = params.subject ?? "";
  const search = params.search ?? "";
  const filteredTeachers = teachers.filter((teacher) =>
    (!className || teacher.classAssignments.some((item) => normalizeNigeriaClassValue(item) === className)) &&
    (!subject || teacher.subjects.some((item) => item.toLowerCase().includes(subject.toLowerCase()))) &&
    matchesTeacher(teacher, search)
  );
  const pendingResults = filteredTeachers.reduce((sum, teacher) => sum + teacher.pendingResults, 0);
  const teachersWithLeaveRisk = filteredTeachers.filter((teacher) => teacher.leaveStatus !== "No active leave").length;
  const uniqueSubjects = new Set(filteredTeachers.flatMap((teacher) => teacher.subjects)).size;
  const subjectOptions = [
    { label: "All subjects", value: "" },
    ...Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects))).map((item) => ({ label: item, value: item }))
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Teacher Directory</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Teacher deployment and class coverage</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-ink/68">
          Browse staff by class and subject, then open a dedicated teacher profile for attendance, leave, workload,
          class ownership, and recent activity. No hidden auto-selection, no scroll-hunting.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {[
          ["Teachers", filteredTeachers.length],
          ["Subjects covered", uniqueSubjects],
          ["Pending result tasks", pendingResults],
          ["Leave watchlist", teachersWithLeaveRisk],
          ["Recent activities", teacherActivities.length]
        ].map(([label, value]) => (
          <article key={label} className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">{label}</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{value}</p>
          </article>
        ))}
      </section>

      <FilterToolbar
        action="/teachers"
        title="Find staff by class or subject"
        description="Use class-level filters for JSS/SSS coverage and open teacher profiles in their own detail route."
        activeSummary={[classNameLabel ? `Class: ${classNameLabel}` : "", subject ? `Subject: ${subject}` : "", search ? `Search: ${search}` : ""].filter(Boolean)}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Name, email, employee no", defaultValue: search },
          { name: "className", label: "Class", type: "select", defaultValue: className, options: nigerianClassOptions },
          { name: "subject", label: "Subject", type: "select", defaultValue: subject, options: subjectOptions }
        ]}
      />

      <TableCard
        title="Teachers and subject ownership"
        description="Open a teacher profile to view attendance, leave, workload, and operational notes."
        items={filteredTeachers}
        emptyState="No teachers match the current filters."
        columns={[
          {
            key: "teacher",
            header: "Teacher",
            render: (item) => (
              <div>
                <Link href={`/teachers/${item.id}`} className="font-semibold text-ink underline decoration-brand-300 underline-offset-4">
                  {item.fullName}
                </Link>
                <p className="text-xs text-ink/55">{item.employeeNo} · {item.designation}</p>
              </div>
            )
          },
          { key: "subjects", header: "Subjects", render: (item) => item.subjects.join(", ") || "Not assigned" },
          { key: "classes", header: "Classes", render: (item) => item.classAssignments.map(formatNigeriaClassName).join(", ") || "Not assigned" },
          { key: "attendance", header: "Attendance today", render: (item) => <div><p>{item.attendanceStatusToday}</p><p className="text-xs text-ink/55">{formatTime(item.checkInAt)}</p></div> },
          { key: "leave", header: "Leave / workflow", render: (item) => <div><p>{item.leaveStatus}</p><p className="text-xs text-ink/55">{item.pendingResults} pending result item(s)</p></div> },
          { key: "action", header: "Action", render: (item) => <Link href={`/teachers/${item.id}`} className="rounded-full bg-sand px-3 py-2 text-xs font-semibold text-ink hover:bg-white">View profile</Link> }
        ]}
      />

      <TableCard
        title="Teacher activity feed"
        description="Recent attendance, leave, class assignment, result workflow, and intervention signals."
        items={teacherActivities.slice(0, 8)}
        columns={[
          { key: "teacher", header: "Teacher", render: (item) => <Link href={`/teachers/${item.teacherId}`} className="font-semibold text-ink underline decoration-brand-300 underline-offset-4">{item.teacherName}</Link> },
          { key: "activity", header: "Activity", render: (item) => <div><p className="font-semibold text-ink">{item.title}</p><p className="mt-1 max-w-xl text-xs leading-5 text-ink/58">{item.detail}</p></div> },
          { key: "type", header: "Type", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.type.replace("_", " ")}</span> },
          { key: "occurredAt", header: "When", render: (item) => formatDate(item.occurredAt) }
        ]}
      />
    </div>
  );
}
