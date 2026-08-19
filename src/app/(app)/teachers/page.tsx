import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
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
  if (!(await canAccessServerPath(session, "/teachers"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = await (searchParams ? searchParams : Promise.resolve({ className: "", subject: "", search: "" }));
  const className = normalizeNigeriaClassValue(params.className) ?? "";
  const classNameLabel = className ? getNigeriaClassLabel(className) : "";
  const subject = params.subject ?? "";
  const search = params.search ?? "";
  const query = new URLSearchParams();
  if (className) query.set("className", className);
  if (subject) query.set("subject", subject);
  if (search) query.set("search", search);
  const [teachers, teacherActivities] = await Promise.all([
    apiGet<TeacherRecordView[]>(`/api/v1/teachers${query.size ? `?${query.toString()}` : ""}`),
    apiGet<TeacherActivityView[]>("/api/v1/teachers/activities"),
  ]);
  const filteredTeachers = teachers.filter((teacher) => matchesTeacher(teacher, search));
  const pendingResults = filteredTeachers.reduce((sum, teacher) => sum + teacher.pendingResults, 0);
  const teachersWithLeaveRisk = filteredTeachers.filter((teacher) => teacher.leaveStatus !== "No active leave").length;
  const uniqueSubjects = new Set(filteredTeachers.flatMap((teacher) => teacher.subjects)).size;
  const subjectOptions = [
    { label: "All subjects", value: "" },
    ...Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects))).map((item) => ({ label: item, value: item }))
  ];

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Teacher Directory</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Teacher deployment and class coverage</h1>
        <p className="mt-2 max-w-4xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
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
          <article key={label} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-2 text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
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
                <Link href={`/teachers/${item.id}`} className="font-semibold text-[var(--color-text-primary)] underline decoration-[var(--color-border-default)] underline-offset-4">
                  {item.fullName}
                </Link>
                <p className="text-xs text-[var(--color-text-muted)]">{item.employeeNo} · {item.designation}</p>
              </div>
            )
          },
          { key: "subjects", header: "Subjects", render: (item) => item.subjects.join(", ") || "Not assigned" },
          { key: "classes", header: "Classes", render: (item) => item.classAssignments.map(formatNigeriaClassName).join(", ") || "Not assigned" },
          { key: "attendance", header: "Attendance today", render: (item) => <div><p>{item.attendanceStatusToday}</p><p className="text-xs text-[var(--color-text-muted)]">{formatTime(item.checkInAt)}</p></div> },
          { key: "leave", header: "Leave / workflow", render: (item) => <div><p>{item.leaveStatus}</p><p className="text-xs text-[var(--color-text-muted)]">{item.pendingResults} pending result item(s)</p></div> },
          { key: "action", header: "Action", render: (item) => <Link href={`/teachers/${item.id}`} className="rounded-full bg-[var(--color-bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-accent-primary-dim)]">View profile</Link> }
        ]}
      />

      <TableCard
        title="Teacher activity feed"
        description="Recent attendance, leave, class assignment, result workflow, and intervention signals."
        items={teacherActivities.slice(0, 8)}
        columns={[
          { key: "teacher", header: "Teacher", render: (item) => <Link href={`/teachers/${item.teacherId}`} className="font-semibold text-[var(--color-text-primary)] underline decoration-[var(--color-border-default)] underline-offset-4">{item.teacherName}</Link> },
          { key: "activity", header: "Activity", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p><p className="mt-1 max-w-xl text-xs leading-5 text-[var(--color-text-muted)]">{item.detail}</p></div> },
          { key: "type", header: "Type", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.type.replace("_", " ")}</span> },
          { key: "occurredAt", header: "When", render: (item) => formatDate(item.occurredAt) }
        ]}
      />
    </div>
  );
}
