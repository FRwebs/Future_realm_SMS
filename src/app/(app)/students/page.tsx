import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canManagePath, getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { StudentRecordView } from "@/lib/domain/types";
import {
  formatNigeriaClassName,
  getNigeriaClassLabel,
  nigerianClassFieldOptions,
  nigerianClassOptions,
  normalizeNigeriaClassValue
} from "@/lib/school-options";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

type StudentsPageProps = {
  searchParams?: Promise<{
    className?: string;
    status?: string;
    search?: string;
  }>;
};

function matchesSearch(student: StudentRecordView, search?: string) {
  if (!search) return true;
  const normalized = search.toLowerCase();
  return [student.fullName, student.admissionNumber, student.guardianName, student.className]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/students"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [students, params] = await Promise.all([
    apiGet<StudentRecordView[]>("/api/v1/students"),
    searchParams ? searchParams : Promise.resolve({ className: "", status: "", search: "" })
  ]);
  const className = normalizeNigeriaClassValue(params.className) ?? "";
  const classNameLabel = className ? getNigeriaClassLabel(className) : "";
  const status = params.status ?? "";
  const search = params.search ?? "";
  const filteredStudents = students.filter((student) =>
    (!className || normalizeNigeriaClassValue(student.className) === className) &&
    (!status || student.status === status) &&
    matchesSearch(student, search)
  );
  const canManageStudents = canManagePath(session.role, "/students");
  const flaggedStudents = filteredStudents.filter(
    (student) => student.attendanceRate < 90 || student.outstandingBalance > 0 || student.averageScore < 50
  );
  const outstandingExposure = filteredStudents.reduce((sum, student) => sum + student.outstandingBalance, 0);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Student Register</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Students</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Browse enrolled learners by Nigerian class level, then open a dedicated profile page for attendance,
              results, fees, documents, behavior notes, and promotion actions.
            </p>
          </div>
          {canManageStudents ? (
            <ResourceActionDialog
              triggerLabel="Create student"
              title="Register approved student"
              description="Admin Officers create official student records only after the admissions approval and registration handoff is complete."
              endpoint="/api/v1/students"
              submitLabel="Save student"
              confirmLabel="Confirm Registration"
              confirmMessage="Confirm that this learner has been approved for registration and should be added to the live student register."
              fields={[
                { name: "firstName", label: "First name", required: true, placeholder: "Daniel" },
                { name: "lastName", label: "Last name", required: true, placeholder: "Yusuf" },
                { name: "middleName", label: "Middle name", placeholder: "Adebayo" },
                {
                  name: "gender",
                  label: "Gender",
                  type: "select",
                  options: [
                    { label: "Male", value: "MALE" },
                    { label: "Female", value: "FEMALE" },
                    { label: "Other", value: "OTHER" }
                  ]
                },
                { name: "dateOfBirth", label: "Date of birth", type: "date", required: true },
                { name: "className", label: "Class allocation", type: "select", required: true, options: nigerianClassFieldOptions },
                { name: "guardianName", label: "Primary guardian", required: true, placeholder: "Funke Yusuf" },
                { name: "guardianPhone", label: "Guardian phone", required: true, placeholder: "08030000000" },
                { name: "guardianEmail", label: "Guardian email", type: "email", placeholder: "parent@example.com" },
                {
                  name: "guardianRelationship",
                  label: "Relationship",
                  type: "select",
                  defaultValue: "Parent",
                  options: [
                    { label: "Parent", value: "Parent" },
                    { label: "Guardian", value: "Guardian" },
                    { label: "Sponsor", value: "Sponsor" }
                  ]
                },
                { name: "stateOfOrigin", label: "State of origin", placeholder: "Oyo" },
                { name: "religion", label: "Religion", placeholder: "Christianity" },
                {
                  name: "bloodGroup",
                  label: "Blood group",
                  type: "select",
                  options: [
                    { label: "Not recorded", value: "" },
                    { label: "A+", value: "A+" },
                    { label: "A-", value: "A-" },
                    { label: "B+", value: "B+" },
                    { label: "B-", value: "B-" },
                    { label: "AB+", value: "AB+" },
                    { label: "AB-", value: "AB-" },
                    { label: "O+", value: "O+" },
                    { label: "O-", value: "O-" }
                  ]
                },
                {
                  name: "genotype",
                  label: "Genotype",
                  type: "select",
                  options: [
                    { label: "Not recorded", value: "" },
                    { label: "AA", value: "AA" },
                    { label: "AS", value: "AS" },
                    { label: "SS", value: "SS" },
                    { label: "AC", value: "AC" }
                  ]
                },
                { name: "allergies", label: "Allergies", type: "textarea", placeholder: "Dust, peanuts, medications, or Nil" },
                { name: "conditions", label: "Medical conditions", type: "textarea", placeholder: "Asthma, chronic medications, or pastoral notes" }
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.75rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Filtered students</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{filteredStudents.length}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">At-risk learners</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{flaggedStudents.length}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/50 bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-ink/55">Outstanding exposure</p>
          <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{formatCurrency(outstandingExposure)}</p>
        </article>
      </section>

      <FilterToolbar
        action="/students"
        title="Find a student quickly"
        description="Use class, status, and search together. Rows open dedicated profile pages instead of expanding lower on the same screen."
        activeSummary={[classNameLabel ? `Class: ${classNameLabel}` : "", status ? `Status: ${status}` : "", search ? `Search: ${search}` : ""].filter(Boolean)}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Name, admission no, guardian", defaultValue: search },
          { name: "className", label: "Class", type: "select", defaultValue: className, options: nigerianClassOptions },
          {
            name: "status",
            label: "Status",
            type: "select",
            defaultValue: status,
            options: [
              { label: "All statuses", value: "" },
              { label: "Active", value: "ACTIVE" },
              { label: "Graduated", value: "GRADUATED" },
              { label: "Transferred", value: "TRANSFERRED" },
              { label: "Suspended", value: "SUSPENDED" }
            ]
          }
        ]}
      />

      <TableCard
        title="Student register"
        description="Open a student profile to view tabs for biodata, attendance, welfare notes, promotion history, and documents."
        items={filteredStudents}
        emptyState="No students match the current filters."
        columns={[
          {
            key: "student",
            header: "Student",
            render: (item) => (
              <div>
                <Link href={`/students/${item.id}`} className="font-semibold text-ink underline decoration-brand-300 underline-offset-4">
                  {item.fullName}
                </Link>
                <p className="text-xs text-ink/55">{item.admissionNumber}</p>
              </div>
            )
          },
          {
            key: "class",
            header: "Class / guardian",
            render: (item) => (
              <div>
                <p>{formatNigeriaClassName(item.className)}</p>
                <p className="text-xs text-ink/55">{item.guardianName}</p>
              </div>
            )
          },
          { key: "attendanceRate", header: "Attendance", render: (item) => formatPercentage(item.attendanceRate) },
          { key: "averageScore", header: "Average", render: (item) => `${item.averageScore.toFixed(1)}%` },
          { key: "outstandingBalance", header: "Balance", render: (item) => formatCurrency(item.outstandingBalance) },
          {
            key: "action",
            header: "Action",
            render: (item) => (
              <Link href={`/students/${item.id}`} className="rounded-full bg-sand px-3 py-2 text-xs font-semibold text-ink hover:bg-white">
                View profile
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
