import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
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
  nigerianClassFieldOptions,
  nigerianClassOptions,
  normalizeNigeriaClassValue
} from "@/lib/school-options";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

type StudentsPageProps = {
  searchParams?: Promise<{
    tab?: string;
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

function tabHref(tab: string) {
  return tab === "registry" ? "/students" : `/students?tab=${tab}`;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/students"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = await (searchParams ? searchParams : Promise.resolve({ tab: "registry", className: "", status: "", search: "" }));
  const tab = params.tab ?? "registry";
  const canManageStudents = canManagePath(session.role, "/students");

  const tabs = [
    { label: "Registry", href: tabHref("registry"), active: tab === "registry" },
    { label: "Student Profile", href: tabHref("profile"), active: tab === "profile" },
    { label: "Data Quality", href: tabHref("dataquality"), active: tab === "dataquality" },
    { label: "Admissions & Alumni", href: tabHref("admissions"), active: tab === "admissions" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">Student register</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Student Enrolment & Records Management</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Every student your school has ever enrolled — biodata, attendance, results, fees, documents, and
              promotion history, all in one registry.
            </p>
          </div>
          {tab === "registry" && canManageStudents ? (
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

      <DetailTabs tabs={tabs} />

      {tab === "registry" ? <RegistryTab params={params} /> : null}
      {tab === "profile" ? <ProfileLookupTab /> : null}
      {tab === "dataquality" ? <DataQualityTab /> : null}
      {tab === "admissions" ? <AdmissionsAlumniTab /> : null}
    </div>
  );
}

async function RegistryTab({ params }: { params: { className?: string; status?: string; search?: string } }) {
  const className = normalizeNigeriaClassValue(params.className) ?? "";
  const status = params.status ?? "";
  const search = params.search ?? "";
  const query = new URLSearchParams();
  if (className) query.set("className", className);
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  const students = await apiGet<StudentRecordView[]>(`/api/v1/students${query.size ? `?${query.toString()}` : ""}`);
  const filteredStudents = students.filter((student) => matchesSearch(student, search));
  const flaggedStudents = filteredStudents.filter(
    (student) => student.attendanceRate < 90 || student.outstandingBalance > 0 || student.averageScore < 50
  );
  const outstandingExposure = filteredStudents.reduce((sum, student) => sum + student.outstandingBalance, 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Filtered students</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{filteredStudents.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">At-risk learners</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{flaggedStudents.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Outstanding exposure</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(outstandingExposure)}</p>
        </article>
      </section>

      <FilterToolbar
        action="/students"
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
                <Link href={`/students/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                  {item.fullName}
                </Link>
                <p className="text-xs text-[var(--color-text-muted)]">{item.admissionNumber}</p>
              </div>
            )
          },
          {
            key: "class",
            header: "Class / guardian",
            render: (item) => (
              <div>
                <p>{formatNigeriaClassName(item.className)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.guardianName}</p>
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
              <Link href={`/students/${item.id}`} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]">
                View profile
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}

async function ProfileLookupTab() {
  const students = await apiGet<StudentRecordView[]>("/api/v1/students");
  const recent = students.slice(0, 8);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Quick lookup</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Open a student profile</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every student has a dedicated profile with biodata, attendance, results, fees, documents, and promotion
          history. Search the Registry tab, or jump straight to one of the students below.
        </p>
      </section>
      <TableCard
        title="Students"
        description="Most recently enrolled first."
        items={recent}
        emptyState="No students enrolled yet."
        columns={[
          { key: "student", header: "Student", render: (item) => <Link href={`/students/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.fullName}</Link> },
          { key: "admission", header: "Admission no.", render: (item) => item.admissionNumber },
          { key: "class", header: "Class", render: (item) => formatNigeriaClassName(item.className) },
          {
            key: "action",
            header: "",
            render: (item) => (
              <Link href={`/students/${item.id}`} className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]">
                Open profile
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}

async function DataQualityTab() {
  const students = await apiGet<StudentRecordView[]>("/api/v1/students");

  const missingGuardian = students.filter((s) => !s.guardianName || !s.guardianName.trim());
  const missingClass = students.filter((s) => !s.className || !s.className.trim());
  const nameCounts = new Map<string, StudentRecordView[]>();
  for (const student of students) {
    const key = student.fullName.trim().toLowerCase();
    nameCounts.set(key, [...(nameCounts.get(key) ?? []), student]);
  }
  const possibleDuplicates = Array.from(nameCounts.values()).filter((group) => group.length > 1).flat();

  const issues = [
    { key: "guardian", label: "Missing guardian name", items: missingGuardian },
    { key: "class", label: "No class assigned", items: missingClass },
    { key: "duplicate", label: "Same full name as another student", items: possibleDuplicates }
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        {issues.map((issue) => (
          <article key={issue.key} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{issue.label}</p>
            <p
              className="mt-2 font-[var(--font-heading)] text-[22px] font-bold"
              style={{ color: issue.items.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}
            >
              {issue.items.length}
            </p>
          </article>
        ))}
      </section>

      {issues.map((issue) =>
        issue.items.length > 0 ? (
          <TableCard
            key={issue.key}
            title={issue.label}
            description="Computed from the live student register — review and correct from each student's profile."
            items={issue.items}
            columns={[
              { key: "student", header: "Student", render: (item) => <Link href={`/students/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.fullName || "(no name recorded)"}</Link> },
              { key: "admission", header: "Admission no.", render: (item) => item.admissionNumber },
              { key: "class", header: "Class", render: (item) => item.className ? formatNigeriaClassName(item.className) : "Unassigned" },
              { key: "guardian", header: "Guardian", render: (item) => item.guardianName || "Not recorded" }
            ]}
          />
        ) : null
      )}

      {issues.every((issue) => issue.items.length === 0) ? (
        <section
          className="rounded-[10px] px-4 py-8 text-center text-[13px] font-semibold"
          style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
        >
          No data quality issues detected across {students.length} student record(s).
        </section>
      ) : null}
    </div>
  );
}

async function AdmissionsAlumniTab() {
  const students = await apiGet<StudentRecordView[]>("/api/v1/students?status=GRADUATED");

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Admissions pipeline</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Applications, screening & approvals</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          The full admissions workflow — applications, screening, approvals, offers, and enrolment clearance — has its
          own dedicated workspace.
        </p>
        <Link
          href="/admissions"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--color-accent-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-primary-hover)]"
        >
          Open Admissions workspace
        </Link>
      </section>

      <TableCard
        title="Alumni"
        description="Students marked Graduated in the register."
        items={students}
        emptyState="No graduated students recorded yet."
        columns={[
          { key: "student", header: "Student", render: (item) => <Link href={`/students/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.fullName}</Link> },
          { key: "admission", header: "Admission no.", render: (item) => item.admissionNumber },
          { key: "lastClass", header: "Last class", render: (item) => formatNigeriaClassName(item.className) },
          { key: "guardian", header: "Guardian on file", render: (item) => item.guardianName }
        ]}
      />
    </div>
  );
}
