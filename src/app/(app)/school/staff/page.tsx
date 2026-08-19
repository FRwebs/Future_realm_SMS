import Link from "next/link";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { PermissionsAccessPanel } from "@/components/roles/permissions-access-panel";
import { apiGet } from "@/lib/api/server";
import { allRoles, getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, PermissionGroupView, SchoolRoleView, TeacherActivityView, TeacherRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

type StaffRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  staffType: string;
  employeeNo: string;
  designation: string;
  departmentName?: string | null;
  employmentDate: string;
  lastLoginAt?: string | null;
};

type StaffPageProps = {
  searchParams?: Promise<{ tab?: string; search?: string; staffType?: string; status?: string; role?: string; view?: string }>;
};

const staffRoleOptions = allRoles
  .filter((role) => !["PARENT", "STUDENT"].includes(role) && !role.startsWith("PLATFORM_"))
  .map((role) => ({ label: roleLabels[role], value: role }));

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
}

function tabHref(tab: string) {
  return tab === "directory" ? "/school/staff" : `/school/staff?tab=${tab}`;
}

function can(permissions: string[], permission: string) {
  return permissions.includes(permission);
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/staff"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "directory";
  const myPermissions = await apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`);
  const permissions = new Set(myPermissions.permissions);
  const canCreate = permissions.has("staff.create");

  const tabs = [
    { label: "Directory", href: tabHref("directory"), active: tab === "directory" },
    { label: "Permissions", href: tabHref("permissions"), active: tab === "permissions" },
    { label: "Lifecycle & Leave", href: tabHref("lifecycle"), active: tab === "lifecycle" },
    { label: "Teaching Workload", href: tabHref("workload"), active: tab === "workload" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-eyebrow">People operations</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Staff Management, Roles & Access Control</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Manage academic and non-academic staff, role-based permissions, employment lifecycle, and teaching
              workload from one place.
            </p>
          </div>
          {tab === "directory" && canCreate ? (
            <ResourceActionDialog
              triggerLabel="Create staff"
              title="Create staff member"
              description="Onboard a staff member with HR details and a system account. They will be asked to change their password on first login."
              endpoint="/api/v1/staff"
              submitLabel="Create staff"
              fields={[
                { name: "firstName", label: "First name", required: true },
                { name: "middleName", label: "Other name" },
                { name: "lastName", label: "Surname", required: true },
                { name: "email", label: "Login email", type: "email", required: true },
                { name: "phone", label: "Phone number" },
                { name: "employeeNo", label: "Staff ID", placeholder: "Auto-generated if blank" },
                { name: "designation", label: "Designation / job title", required: true },
                { name: "staffType", label: "Staff type", type: "select", defaultValue: "ACADEMIC", options: [{ label: "Academic", value: "ACADEMIC" }, { label: "Non-academic", value: "NON_ACADEMIC" }] },
                { name: "role", label: "Primary role", type: "select", defaultValue: "TEACHER", options: staffRoleOptions },
                { name: "employmentType", label: "Employment type", type: "select", defaultValue: "full-time", options: [{ label: "Full-time", value: "full-time" }, { label: "Part-time", value: "part-time" }, { label: "Contract", value: "contract" }, { label: "Temporary", value: "temporary" }] },
                { name: "employmentDate", label: "Employment date", type: "date" },
                { name: "qualification", label: "Qualification" },
                { name: "yearsOfExperience", label: "Years of experience", type: "number", min: 0 },
                { name: "nextOfKinFirstName", label: "Next of kin first name" },
                { name: "nextOfKinLastName", label: "Next of kin surname" },
                { name: "nextOfKinPhone", label: "Next of kin phone" },
                { name: "password", label: "Temporary password", placeholder: "Defaults to ChangeMe123!" },
                { name: "notes", label: "HR notes", type: "textarea" }
              ]}
            />
          ) : null}
        </div>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "directory" ? <DirectoryTab params={params} /> : null}
      {tab === "permissions" ? <PermissionsTab schoolId={session.schoolId} myPermissions={myPermissions} /> : null}
      {tab === "lifecycle" ? <LifecycleTab /> : null}
      {tab === "workload" ? <WorkloadTab /> : null}
    </div>
  );
}

async function DirectoryTab({ params }: { params: { search?: string; staffType?: string; status?: string; role?: string; view?: string } }) {
  const path = `/api/v1/staff${queryString(params)}`;
  const staff = await apiGet<StaffRow[]>(path);
  const active = staff.filter((item) => item.status === "ACTIVE").length;
  const academic = staff.filter((item) => item.staffType === "ACADEMIC").length;
  const teachers = staff.filter((item) => ["TEACHER", "SUBJECT_TEACHER", "CLASS_TEACHER", "HEAD_OF_DEPARTMENT"].includes(item.role)).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Total staff", staff.length],
          ["Active", active],
          ["Academic", academic],
          ["Teachers", teachers]
        ].map(([label, value]) => (
          <article key={label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
          </article>
        ))}
      </section>

      <FilterToolbar
        action="/school/staff"
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Name, email, staff ID, designation", defaultValue: params.search ?? "" },
          { name: "staffType", label: "Type", type: "select", defaultValue: params.staffType ?? "", options: [{ label: "All staff", value: "" }, { label: "Academic", value: "ACADEMIC" }, { label: "Non-academic", value: "NON_ACADEMIC" }] },
          { name: "status", label: "Status", type: "select", defaultValue: params.status ?? "", options: [{ label: "All statuses", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }, { label: "Suspended", value: "SUSPENDED" }] },
          { name: "role", label: "Role", type: "select", defaultValue: params.role ?? "", options: [{ label: "All roles", value: "" }, ...staffRoleOptions] }
        ]}
      />

      <TableCard
        title="Staff records"
        description="Open a profile to review HR details, documents, role access, teacher assignments, and account status."
        items={staff}
        emptyState="No staff members match the current filters."
        columns={[
          {
            key: "staff",
            header: "Staff",
            render: (item) => (
              <div>
                <Link href={`/school/staff/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                  {item.fullName}
                </Link>
                <p className="text-xs text-[var(--color-text-muted)]">{item.employeeNo} · {item.designation}</p>
              </div>
            )
          },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "type", header: "Type", render: (item) => item.staffType.replace("_", "-") },
          { key: "department", header: "Department", render: (item) => item.departmentName ?? "Unassigned" },
          { key: "contact", header: "Contact", render: (item) => <div><p>{item.phone ?? "No phone"}</p><p className="text-xs text-[var(--color-text-muted)]">{item.email}</p></div> },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }}>{item.status}</span> },
          { key: "employment", header: "Employment", render: (item) => formatDate(item.employmentDate) }
        ]}
      />
    </div>
  );
}

async function PermissionsTab({ schoolId, myPermissions }: { schoolId: string; myPermissions: MyPermissionsView }) {
  if (!can(myPermissions.permissions, "roles.view")) {
    return <AccessDenied detail="You do not currently have the roles.view permission for this school." />;
  }

  const [roles, permissionGroups] = await Promise.all([
    apiGet<SchoolRoleView[]>(`/api/v1/school/${schoolId}/roles-management/roles`),
    apiGet<PermissionGroupView[]>(`/api/v1/school/${schoolId}/roles-management/permissions`)
  ]);

  return (
    <PermissionsAccessPanel
      roles={roles}
      permissionGroups={permissionGroups}
      schoolId={schoolId}
      canCreate={can(myPermissions.permissions, "roles.create")}
      canEdit={can(myPermissions.permissions, "roles.edit")}
      canAssign={can(myPermissions.permissions, "roles.assign")}
    />
  );
}

async function LifecycleTab() {
  const staff = await apiGet<StaffRow[]>("/api/v1/staff");
  const active = staff.filter((item) => item.status === "ACTIVE");
  const inactive = staff.filter((item) => item.status !== "ACTIVE");

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Active", active.length, "success"],
          ["Inactive / Suspended", inactive.length, "warning"],
          ["Total staff", staff.length, "neutral"]
        ].map(([label, value, tone]) => (
          <article key={label as string} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
            <p
              className="mt-2 font-[var(--font-heading)] text-[22px] font-bold"
              style={{ color: tone === "success" ? "var(--color-success)" : tone === "warning" ? "var(--color-warning)" : "var(--color-text-primary)" }}
            >
              {value}
            </p>
          </article>
        ))}
      </section>

      <TableCard
        title="Employment status"
        description="Employment date, status, and account standing for every staff member."
        items={staff}
        columns={[
          { key: "staff", header: "Staff", render: (item) => <Link href={`/school/staff/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.fullName}</Link> },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "employmentDate", header: "Employment date", render: (item) => formatDate(item.employmentDate) },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={item.status === "ACTIVE" ? { background: "var(--color-success-dim)", color: "var(--color-success)" } : { background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
              >
                {item.status}
              </span>
            )
          },
          { key: "lastLogin", header: "Last login", render: (item) => (item.lastLoginAt ? formatDate(item.lastLoginAt) : "Never") }
        ]}
      />
    </div>
  );
}

async function WorkloadTab() {
  const [teachers, activities] = await Promise.all([
    apiGet<TeacherRecordView[]>("/api/v1/teachers"),
    apiGet<TeacherActivityView[]>("/api/v1/teachers/activities")
  ]);
  const pendingResults = teachers.reduce((sum, teacher) => sum + teacher.pendingResults, 0);
  const onLeave = teachers.filter((teacher) => teacher.leaveStatus !== "No active leave").length;
  const uniqueSubjects = new Set(teachers.flatMap((teacher) => teacher.subjects)).size;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Teachers", teachers.length],
          ["Subjects covered", uniqueSubjects],
          ["Pending result tasks", pendingResults],
          ["On leave", onLeave]
        ].map(([label, value]) => (
          <article key={label} className="surface-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{value}</p>
          </article>
        ))}
      </section>

      <TableCard
        title="Teaching workload"
        description="Subject and class ownership, today's attendance, and pending result work per teacher."
        items={teachers}
        emptyState="No teachers found."
        columns={[
          { key: "teacher", header: "Teacher", render: (item) => <Link href={`/teachers/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.fullName}</Link> },
          { key: "subjects", header: "Subjects", render: (item) => item.subjects.join(", ") || "Not assigned" },
          { key: "classes", header: "Classes", render: (item) => item.classAssignments.map(formatNigeriaClassName).join(", ") || "Not assigned" },
          { key: "attendance", header: "Attendance today", render: (item) => item.attendanceStatusToday },
          { key: "leave", header: "Leave", render: (item) => item.leaveStatus },
          { key: "pending", header: "Pending results", render: (item) => item.pendingResults }
        ]}
      />

      <TableCard
        title="Recent teaching activity"
        description="Attendance, leave, class assignment, and result workflow signals."
        items={activities.slice(0, 8)}
        columns={[
          { key: "teacher", header: "Teacher", render: (item) => <Link href={`/teachers/${item.teacherId}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{item.teacherName}</Link> },
          { key: "activity", header: "Activity", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p><p className="mt-1 max-w-xl text-xs leading-5 text-[var(--color-text-muted)]">{item.detail}</p></div> },
          { key: "type", header: "Type", render: (item) => <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }}>{item.type.replace("_", " ")}</span> },
          { key: "occurredAt", header: "When", render: (item) => formatDate(item.occurredAt) }
        ]}
      />
    </div>
  );
}
