import Link from "next/link";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { allRoles, canAccessPath, getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView } from "@/lib/domain/types";
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
  searchParams?: Promise<{ search?: string; staffType?: string; status?: string; role?: string; view?: string }>;
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

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/school/staff")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const path = `/api/v1/staff${queryString(params)}`;
  const [staff, myPermissions] = await Promise.all([
    apiGet<StaffRow[]>(path),
    apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`),
  ]);

  const permissions = new Set(myPermissions.permissions);
  const canCreate = permissions.has("staff.create");
  const active = staff.filter((item) => item.status === "ACTIVE").length;
  const academic = staff.filter((item) => item.staffType === "ACADEMIC").length;
  const teachers = staff.filter((item) => ["TEACHER", "SUBJECT_TEACHER", "CLASS_TEACHER", "HEAD_OF_DEPARTMENT"].includes(item.role)).length;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">People operations</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">Staff Directory</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Manage academic and non-academic staff, teacher records, employment details, account access, and role assignment.
            </p>
          </div>
          {canCreate ? (
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
                { name: "notes", label: "HR notes", type: "textarea" },
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Total staff", staff.length],
          ["Active", active],
          ["Academic", academic],
          ["Teachers", teachers],
        ].map(([label, value]) => (
          <article key={label} className="rounded-[1.5rem] bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-ink/55">{label}</p>
            <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{value}</p>
          </article>
        ))}
      </section>

      <FilterToolbar
        action="/school/staff"
        title="Find staff"
        description="Search and filter by HR class, role, account status, or teacher-only view."
        activeSummary={[params.search ? `Search: ${params.search}` : "", params.staffType ? `Type: ${params.staffType}` : "", params.status ? `Status: ${params.status}` : "", params.role ? `Role: ${params.role}` : ""].filter(Boolean)}
        controls={[
          { name: "search", label: "Search", type: "search", placeholder: "Name, email, staff ID, designation", defaultValue: params.search ?? "" },
          { name: "staffType", label: "Staff type", type: "select", defaultValue: params.staffType ?? "", options: [{ label: "All staff", value: "" }, { label: "Academic", value: "ACADEMIC" }, { label: "Non-academic", value: "NON_ACADEMIC" }] },
          { name: "status", label: "Status", type: "select", defaultValue: params.status ?? "", options: [{ label: "All statuses", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }, { label: "Suspended", value: "SUSPENDED" }] },
          { name: "role", label: "Role", type: "select", defaultValue: params.role ?? "", options: [{ label: "All roles", value: "" }, ...staffRoleOptions] },
          { name: "view", label: "View", type: "select", defaultValue: params.view ?? "", options: [{ label: "All staff", value: "" }, { label: "Teachers only", value: "teachers" }] },
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
                <Link href={`/school/staff/${item.id}`} className="font-semibold text-ink underline decoration-brand-300 underline-offset-4">
                  {item.fullName}
                </Link>
                <p className="text-xs text-ink/55">{item.employeeNo} · {item.designation}</p>
              </div>
            ),
          },
          { key: "role", header: "Role", render: (item) => item.role.replaceAll("_", " ") },
          { key: "type", header: "Type", render: (item) => item.staffType.replace("_", "-") },
          { key: "department", header: "Department", render: (item) => item.departmentName ?? "Unassigned" },
          { key: "contact", header: "Contact", render: (item) => <div><p>{item.phone ?? "No phone"}</p><p className="text-xs text-ink/55">{item.email}</p></div> },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{item.status}</span> },
          { key: "employment", header: "Employment", render: (item) => formatDate(item.employmentDate) },
        ]}
      />
    </div>
  );
}
