import { DetailPageHeader } from "@/components/data-display/detail-page-header";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { MyPermissionsView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type ProfileView = {
  id: string;
  fullName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  role: string;
  email: string;
  phone?: string;
  secondaryPhone?: string;
  alternateEmail?: string;
  avatarUrl?: string;
  accountStatus: string;
  lastLoginAt?: string;
  school?: { name: string; code?: string };
  identity: Record<string, string | null | undefined>;
  contact: Record<string, string | null | undefined>;
  nextOfKin: Record<string, string | null | undefined>;
  staff?: {
    id: string;
    employeeNo: string;
    designation: string;
    staffType: string;
    employmentDate: string;
    departmentName?: string;
    campusName?: string;
    teachingAssignments: Array<{ id: string; subjectName: string; className: string }>;
  } | null;
  student?: { admissionNumber: string; className?: string | null; status: string } | null;
  parent?: { relationship?: string; occupation?: string; children: Array<{ id: string; name: string; className?: string | null }> } | null;
  documents: Array<{ id: string; title: string; type: string; verificationStatus: string; createdAt: string; fileUrl?: string | null }>;
  editRequests: Array<{ id: string; status: string; reason?: string | null; createdAt: string; fields: unknown; reviewComment?: string | null }>;
  loginHistory: Array<{ id: string; success: boolean; ipAddress?: string | null; device?: string | null; createdAt: string }>;
};

function FieldLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="font-semibold text-ink">{label}:</span> {value || "Not recorded"}
    </p>
  );
}

export default async function ProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/school/profile")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [profile, myPermissions] = await Promise.all([
    apiGet<ProfileView>("/api/v1/profile/me"),
    apiGet<MyPermissionsView>(`/api/v1/school/${session.schoolId}/roles-management/permissions/my`),
  ]);

  const permissions = new Set(myPermissions.permissions);
  const canUpdateSelf = permissions.has("profiles.update_self");
  const canRequestEdit = permissions.has("profiles.request_edit_self");
  const canChangePassword = permissions.has("profiles.change_password_self");

  return (
    <div className="grid gap-6">
      <DetailPageHeader
        eyebrow="My profile"
        title={profile.fullName}
        backHref={getDefaultPathForRole(session.role)}
        backLabel="Back to dashboard"
        description={`${profile.role.replaceAll("_", " ")} · ${profile.school?.name ?? "School profile"} · ${profile.accountStatus}`}
        badges={[
          profile.staff?.employeeNo ? `Staff ID: ${profile.staff.employeeNo}` : "",
          profile.student?.admissionNumber ? `Admission No: ${profile.student.admissionNumber}` : "",
          profile.staff?.designation ?? profile.student?.className ?? profile.parent?.relationship ?? "Profile",
        ].filter(Boolean)}
        actions={
          <>
            {canUpdateSelf ? (
              <ResourceActionDialog
                triggerLabel="Edit profile"
                title="Update profile"
                description="Update safe self-service fields. Sensitive corrections can be submitted as an edit request."
                endpoint="/api/v1/profile/me"
                method="PATCH"
                submitLabel="Save profile"
                variant="secondary"
                fields={[
                  { name: "preferredName", label: "Preferred name", defaultValue: profile.preferredName ?? "" },
                  { name: "phone", label: "Primary phone", defaultValue: profile.phone ?? "" },
                  { name: "secondaryPhone", label: "Secondary phone", defaultValue: profile.secondaryPhone ?? "" },
                  { name: "alternateEmail", label: "Alternate email", type: "email", defaultValue: profile.alternateEmail ?? "" },
                  { name: "residentialAddress", label: "Residential address", type: "textarea", defaultValue: profile.contact.residentialAddress ?? "" },
                  { name: "city", label: "City", defaultValue: profile.contact.city ?? "" },
                  { name: "country", label: "Country", defaultValue: profile.contact.country ?? "Nigeria" },
                  { name: "nextOfKinFirstName", label: "Next of kin first name", defaultValue: profile.nextOfKin.firstName ?? "" },
                  { name: "nextOfKinLastName", label: "Next of kin surname", defaultValue: profile.nextOfKin.lastName ?? "" },
                  { name: "nextOfKinPhone", label: "Next of kin phone", defaultValue: profile.nextOfKin.phone ?? "" },
                  { name: "nextOfKinRelationship", label: "Next of kin relationship", defaultValue: profile.nextOfKin.relationship ?? "" },
                ]}
              />
            ) : null}
            {canRequestEdit ? (
              <ResourceActionDialog
                triggerLabel="Request correction"
                title="Request sensitive profile correction"
                description="Use JSON for the fields you want corrected, such as {&quot;firstName&quot;:&quot;Ada&quot;,&quot;email&quot;:&quot;ada@example.com&quot;}."
                endpoint="/api/v1/profile/me/edit-requests"
                submitLabel="Submit request"
                variant="secondary"
                fields={[
                  { name: "fields", label: "Requested fields JSON", type: "textarea", required: true, defaultValue: "{\n  \"phone\": \"\"\n}" },
                  { name: "reason", label: "Reason", type: "textarea", required: true },
                ]}
              />
            ) : null}
            {canChangePassword ? (
              <ResourceActionDialog
                triggerLabel="Change password"
                title="Change password"
                description="Set a new password for your own account."
                endpoint="/api/v1/profile/me/password"
                method="PATCH"
                submitLabel="Change password"
                variant="secondary"
                fields={[
                  { name: "currentPassword", label: "Current password", required: true },
                  { name: "newPassword", label: "New password", required: true },
                ]}
              />
            ) : null}
          </>
        }
      />

      <DetailTabs
        tabs={[
          { label: "Bio", href: "#bio", active: true },
          { label: "Work / School", href: "#context" },
          { label: "Documents", href: "#documents" },
          { label: "Requests", href: "#requests" },
          { label: "Security", href: "#security" },
        ]}
      />

      <section id="bio" className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel xl:col-span-2">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Personal and contact information</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72 md:grid-cols-2">
            <FieldLine label="First name" value={profile.firstName} />
            <FieldLine label="Surname" value={profile.lastName} />
            <FieldLine label="Other name" value={profile.middleName} />
            <FieldLine label="Gender" value={profile.identity.gender} />
            <FieldLine label="Date of birth" value={profile.identity.dateOfBirth ? formatDate(profile.identity.dateOfBirth) : undefined} />
            <FieldLine label="Nationality" value={profile.identity.nationality} />
            <FieldLine label="State of origin" value={profile.identity.stateOfOrigin} />
            <FieldLine label="LGA" value={profile.identity.lga} />
            <FieldLine label="Phone" value={profile.phone} />
            <FieldLine label="Email" value={profile.email} />
            <FieldLine label="Address" value={profile.contact.residentialAddress ?? profile.contact.homeAddress} />
            <FieldLine label="City / Country" value={[profile.contact.city, profile.contact.country].filter(Boolean).join(", ")} />
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Next of kin</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            <FieldLine label="Name" value={[profile.nextOfKin.firstName, profile.nextOfKin.lastName].filter(Boolean).join(" ")} />
            <FieldLine label="Relationship" value={profile.nextOfKin.relationship} />
            <FieldLine label="Phone" value={profile.nextOfKin.phone} />
            <FieldLine label="Email" value={profile.nextOfKin.email} />
            <FieldLine label="Address" value={profile.nextOfKin.address} />
          </div>
        </article>
      </section>

      <section id="context" className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Operational context</h2>
          <div className="mt-4 grid gap-2 text-sm text-ink/72">
            {profile.staff ? (
              <>
                <FieldLine label="Staff type" value={profile.staff.staffType} />
                <FieldLine label="Designation" value={profile.staff.designation} />
                <FieldLine label="Department" value={profile.staff.departmentName} />
                <FieldLine label="Campus" value={profile.staff.campusName} />
                <FieldLine label="Employment date" value={formatDate(profile.staff.employmentDate)} />
              </>
            ) : null}
            {profile.student ? (
              <>
                <FieldLine label="Admission number" value={profile.student.admissionNumber} />
                <FieldLine label="Class" value={profile.student.className} />
                <FieldLine label="Student status" value={profile.student.status} />
              </>
            ) : null}
            {profile.parent ? (
              <>
                <FieldLine label="Guardian relationship" value={profile.parent.relationship} />
                <FieldLine label="Occupation" value={profile.parent.occupation} />
                <FieldLine label="Linked children" value={profile.parent.children.map((child) => child.name).join(", ")} />
              </>
            ) : null}
          </div>
        </article>

        <TableCard
          title="Teaching assignments"
          description="Subjects and classes currently linked to this profile."
          items={profile.staff?.teachingAssignments ?? []}
          emptyState="No teaching assignments are linked to this profile."
          columns={[
            { key: "subject", header: "Subject", render: (item) => item.subjectName },
            { key: "class", header: "Class", render: (item) => item.className },
          ]}
        />
      </section>

      <section id="documents">
        <TableCard
          title="Profile documents"
          description="Documents uploaded for HR, compliance, identity, or school operations."
          items={profile.documents}
          emptyState="No profile documents have been uploaded."
          columns={[
            { key: "title", header: "Document", render: (item) => <div><p className="font-semibold text-ink">{item.title}</p><p className="text-xs text-ink/55">{item.type}</p></div> },
            { key: "status", header: "Verification", render: (item) => item.verificationStatus },
            { key: "date", header: "Uploaded", render: (item) => formatDate(item.createdAt) },
          ]}
        />
      </section>

      <section id="requests" className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="My edit requests"
          description="Sensitive profile corrections awaiting review or already decided."
          items={profile.editRequests}
          emptyState="No edit requests submitted."
          columns={[
            { key: "status", header: "Status", render: (item) => item.status },
            { key: "reason", header: "Reason", render: (item) => item.reason ?? "No reason provided" },
            { key: "date", header: "Submitted", render: (item) => formatDate(item.createdAt) },
          ]}
        />
        <TableCard
          title="Login history"
          description="Recent authentication attempts for this profile."
          items={profile.loginHistory}
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
