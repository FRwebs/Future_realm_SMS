import { DetailPageHeader } from "@/components/data-display/detail-page-header";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { allRoles, getDefaultPathForRole, roleLabels } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView, SchoolRoleView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type StaffDetail = {
  id: string;
  userId: string;
  fullName: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  roles: string[];
  status: string;
  staffType: string;
  employeeNo: string;
  designation: string;
  departmentName?: string | null;
  campusName?: string | null;
  employmentType?: string | null;
  staffCategory?: string | null;
  qualification?: string | null;
  yearsOfExperience?: number | null;
  employmentDate: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  identity: Record<string, string | number | null | undefined>;
  contact: Record<string, string | null | undefined>;
  nextOfKin: Record<string, string | null | undefined>;
  assignedClasses: Array<{ id: string; name: string }>;
  assignedSubjects: Array<{ id: string; subjectName: string; className: string }>;
  timetable: Array<{ id: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; subjectName?: string | null; className: string }>;
  documents: Array<{ id: string; title: string; type: string; verificationStatus: string; createdAt: string }>;
  loginHistory: Array<{ id: string; success: boolean; reason?: string | null; ipAddress?: string | null; device?: string | null; createdAt: string }>;
};

type PageProps = { params: Promise<{ staffId: string }> };

const staffRoleOptions = allRoles
  .filter((role) => !["PARENT", "STUDENT"].includes(role) && !role.startsWith("PLATFORM_"))
  .map((role) => ({ label: roleLabels[role], value: role }));

function FieldLine({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <p>
      <span className="font-semibold text-ink">{label}:</span> {value || "Not recorded"}
    </p>
  );
}

export default async function StaffDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/staff"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { staffId } = await params;
  const [staff, myPermissions, roles] = await Promise.all([
    apiGet<StaffDetail>(`/api/v1/staff/${staffId}`),
    apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`),
    apiGet<SchoolRoleView[]>(`/api/v1/school/${session.schoolId}/roles-management/roles`).catch(() => []),
  ]);

  const permissions = new Set(myPermissions.permissions);
  const canUpdate = permissions.has("staff.update") || permissions.has("staff.edit");
  const canManageStatus = permissions.has("staff.manage_status");
  const canAssignRoles = permissions.has("staff.assign_roles") || permissions.has("roles.assign");
  const canUploadDocuments = permissions.has("staff.upload_documents") || permissions.has("profiles.upload_documents");

  return (
    <div className="grid gap-6">
      <DetailPageHeader
        eyebrow="Staff profile"
        title={staff.fullName}
        backHref="/school/staff"
        backLabel="Back to staff"
        description={`${staff.employeeNo} · ${staff.designation} · ${staff.role.replaceAll("_", " ")} · ${staff.status}`}
        badges={[staff.staffType, staff.departmentName ?? "No department", staff.campusName ?? "Main campus"]}
        actions={
          <>
            {canUpdate ? (
              <ResourceActionDialog
                triggerLabel="Edit staff"
                title="Edit staff profile"
                description="Update HR, contact, and employment fields for this staff member."
                endpoint={`/api/v1/staff/${staff.id}`}
                method="PATCH"
                submitLabel="Save changes"
                variant="secondary"
                fields={[
                  { name: "firstName", label: "First name", required: true, defaultValue: staff.firstName },
                  { name: "middleName", label: "Other name", defaultValue: staff.middleName ?? "" },
                  { name: "lastName", label: "Surname", required: true, defaultValue: staff.lastName },
                  { name: "email", label: "Email", type: "email", required: true, defaultValue: staff.email },
                  { name: "phone", label: "Phone", defaultValue: staff.phone ?? "" },
                  { name: "employeeNo", label: "Staff ID", defaultValue: staff.employeeNo },
                  { name: "designation", label: "Designation", required: true, defaultValue: staff.designation },
                  { name: "staffType", label: "Staff type", type: "select", defaultValue: staff.staffType, options: [{ label: "Academic", value: "ACADEMIC" }, { label: "Non-academic", value: "NON_ACADEMIC" }] },
                  { name: "role", label: "Primary role", type: "select", defaultValue: staff.role, options: staffRoleOptions },
                  { name: "employmentType", label: "Employment type", defaultValue: staff.employmentType ?? "" },
                  { name: "qualification", label: "Qualification", defaultValue: staff.qualification ?? "" },
                  { name: "yearsOfExperience", label: "Years of experience", type: "number", min: 0, defaultValue: staff.yearsOfExperience ?? 0 },
                  { name: "nextOfKinFirstName", label: "Next of kin first name", defaultValue: staff.nextOfKin.firstName ?? "" },
                  { name: "nextOfKinLastName", label: "Next of kin surname", defaultValue: staff.nextOfKin.lastName ?? "" },
                  { name: "nextOfKinPhone", label: "Next of kin phone", defaultValue: staff.nextOfKin.phone ?? "" },
                  { name: "notes", label: "HR notes", type: "textarea", defaultValue: staff.notes ?? "" },
                ]}
              />
            ) : null}
            {canAssignRoles ? (
              <ResourceActionDialog
                triggerLabel="Assign roles"
                title="Assign staff roles"
                description="Set the primary system role and optionally attach custom roles from Roles & Permissions."
                endpoint={`/api/v1/staff/${staff.id}/roles`}
                method="POST"
                submitLabel="Save roles"
                fields={[
                  { name: "primaryRole", label: "Primary role", type: "select", defaultValue: staff.role, options: staffRoleOptions },
                  { name: "roleIds", label: "Custom roles", type: "multiselect", options: roles.map((role) => ({ label: role.name, value: role.id })) },
                ]}
              />
            ) : null}
            {canManageStatus ? (
              <ResourceActionDialog
                triggerLabel="Change status"
                title="Manage staff status"
                description="Activate, deactivate, suspend, lock, or mark this account pending."
                endpoint={`/api/v1/staff/${staff.id}/status`}
                method="PATCH"
                submitLabel="Update status"
                variant="danger"
                confirmLabel="Confirm status change"
                confirmMessage="This action changes account access and is written to the audit log."
                fields={[
                  { name: "status", label: "Status", type: "select", defaultValue: staff.status, options: [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }, { label: "Suspended", value: "SUSPENDED" }, { label: "Locked", value: "LOCKED" }, { label: "Pending", value: "PENDING" }] },
                  { name: "reason", label: "Reason", type: "textarea" },
                ]}
              />
            ) : null}
          </>
        }
      />

      <DetailTabs
        tabs={[
          { label: "Bio", href: "#bio", active: true },
          { label: "Teaching", href: "#teaching" },
          { label: "Documents", href: "#documents" },
          { label: "Security", href: "#security" },
        ]}
      />

      <section id="bio" className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel xl:col-span-2">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Employment and contact</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72 md:grid-cols-2">
            <FieldLine label="Staff ID" value={staff.employeeNo} />
            <FieldLine label="Designation" value={staff.designation} />
            <FieldLine label="Department" value={staff.departmentName} />
            <FieldLine label="Employment type" value={staff.employmentType} />
            <FieldLine label="Employment date" value={formatDate(staff.employmentDate)} />
            <FieldLine label="Qualification" value={staff.qualification} />
            <FieldLine label="Years of experience" value={staff.yearsOfExperience} />
            <FieldLine label="Phone" value={staff.phone} />
            <FieldLine label="Email" value={staff.email} />
            <FieldLine label="Address" value={staff.contact.residentialAddress ?? staff.contact.homeAddress} />
          </div>
        </article>
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Next of kin</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <FieldLine label="Name" value={[staff.nextOfKin.firstName, staff.nextOfKin.lastName].filter(Boolean).join(" ")} />
            <FieldLine label="Relationship" value={staff.nextOfKin.relationship} />
            <FieldLine label="Phone" value={staff.nextOfKin.phone} />
            <FieldLine label="Email" value={staff.nextOfKin.email} />
            <FieldLine label="Address" value={staff.nextOfKin.address} />
          </div>
        </article>
      </section>

      <section id="teaching" className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Subject assignments"
          description="Teacher-specific subject and class ownership for this term."
          items={staff.assignedSubjects}
          emptyState="No subject assignments are currently linked."
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subjectName },
            { key: "class", header: "Class", render: (item) => item.className },
          ]}
        />
        <TableCard
          title="Timetable summary"
          description="Recent published or draft periods assigned to this staff member."
          items={staff.timetable}
          emptyState="No timetable periods are linked to this staff member."
          columns={[
            { key: "day", header: "Day", render: (item) => `Day ${item.dayOfWeek}` },
            { key: "period", header: "Period", render: (item) => `P${item.periodNumber} · ${item.startTime}-${item.endTime}` },
            { key: "subject", header: "Subject / Class", render: (item) => <div><p>{item.subjectName ?? "Free / activity"}</p><p className="text-xs text-ink/55">{item.className}</p></div> },
          ]}
        />
      </section>

      <section id="documents">
        <div className="mb-4 flex justify-end">
          {canUploadDocuments ? (
            <ResourceActionDialog
              triggerLabel="Add document"
              title="Add staff document metadata"
              description="Record an employment, identity, certificate, or compliance document. File storage URLs can be linked when available."
              endpoint={`/api/v1/profiles/${staff.userId}/documents`}
              submitLabel="Save document"
              fields={[
                { name: "title", label: "Title", required: true },
                { name: "type", label: "Type", required: true, placeholder: "CV, certificate, appointment letter" },
                { name: "fileName", label: "File name" },
                { name: "fileUrl", label: "File URL" },
                { name: "verificationStatus", label: "Verification", type: "select", defaultValue: "PENDING", options: [{ label: "Pending", value: "PENDING" }, { label: "Verified", value: "VERIFIED" }, { label: "Rejected", value: "REJECTED" }] },
                { name: "notes", label: "Notes", type: "textarea" },
              ]}
            />
          ) : null}
        </div>
        <TableCard
          title="Document vault"
          description="Employment, compliance, certification, and identity document metadata."
          items={staff.documents}
          emptyState="No staff documents have been uploaded."
          columns={[
            { key: "title", header: "Document", render: (item) => <div><p className="font-semibold text-ink">{item.title}</p><p className="text-xs text-ink/55">{item.type}</p></div> },
            { key: "status", header: "Verification", render: (item) => item.verificationStatus },
            { key: "created", header: "Uploaded", render: (item) => formatDate(item.createdAt) },
          ]}
        />
      </section>

      <section id="security">
        <TableCard
          title="Login history"
          description="Recent account access attempts for this staff member."
          items={staff.loginHistory}
          emptyState="No login history recorded."
          columns={[
            { key: "status", header: "Status", render: (item) => item.success ? "Successful" : "Failed" },
            { key: "device", header: "Device / IP", render: (item) => <div><p>{item.device ?? "Unknown device"}</p><p className="text-xs text-ink/55">{item.ipAddress ?? "No IP"}</p></div> },
            { key: "date", header: "When", render: (item) => formatDate(item.createdAt) },
          ]}
        />
      </section>
    </div>
  );
}
