import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { TeacherPortalView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

type TeacherProfileView = {
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
  accountStatus: string;
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
};

function FieldLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="font-semibold text-ink">{label}:</span> {value || "Not recorded"}
    </p>
  );
}

export default async function TeacherProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/teacher/profile")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [profile, portal] = await Promise.all([
    apiGet<TeacherProfileView>("/api/v1/profile/me"),
    apiGet<TeacherPortalView>("/api/v1/teacher-portal/dashboard"),
  ]);

  const assignedClasses = Array.from(
    new Map(
      portal.assignedClasses
        .filter((item) => item.classId && !item.subjectId)
        .map((item) => [item.classId, item]),
    ).values(),
  );

  const subjectAssignments = portal.assignedClasses.filter((item) => item.subjectId);
  const portalIdentity = assignedClasses.length
    ? `Teacher · Form / Class Teacher for ${assignedClasses.map((item) => item.className).join(", ")}`
    : "Teacher";

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/teacher" className="text-sm font-semibold text-brand-700">
          Back to teacher portal
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-brand-700">
              Teacher profile
            </p>
            <h1 className="mt-2 font-[var(--font-heading)] text-4xl font-bold text-ink">
              {profile.fullName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/68">
              Review your staff details, teaching assignments, and contact record in one place. Sensitive corrections should go through a profile edit request so the school office can verify them properly.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Edit Request"
            title="Request profile correction"
            description="Request a verified correction for any teacher profile detail that should be updated by the school office."
            endpoint="/api/v1/profile/me/edit-requests"
            submitLabel="Submit request"
            variant="secondary"
            fields={[
              {
                name: "fields",
                label: "Requested fields JSON",
                type: "textarea",
                required: true,
                defaultValue: "{\n  \"phone\": \"\"\n}",
              },
              {
                name: "reason",
                label: "Reason",
                type: "textarea",
                required: true,
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel xl:col-span-2">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
            Personal and contact information
          </h2>
          <div className="mt-5 grid gap-3 text-sm text-ink/72 md:grid-cols-2">
            <FieldLine label="Staff ID" value={profile.staff?.employeeNo} />
            <FieldLine label="Role" value={profile.role.replaceAll("_", " ")} />
            <FieldLine label="Portal identity" value={portalIdentity} />
            <FieldLine label="First name" value={profile.firstName} />
            <FieldLine label="Surname" value={profile.lastName} />
            <FieldLine label="Other name" value={profile.middleName} />
            <FieldLine label="Preferred name" value={profile.preferredName} />
            <FieldLine label="Phone" value={profile.phone} />
            <FieldLine label="Secondary phone" value={profile.secondaryPhone} />
            <FieldLine label="Email" value={profile.email} />
            <FieldLine label="Alternate email" value={profile.alternateEmail} />
            <FieldLine label="Residential address" value={profile.contact.residentialAddress ?? profile.contact.homeAddress} />
            <FieldLine label="City / Country" value={[profile.contact.city, profile.contact.country].filter(Boolean).join(", ")} />
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
            Staff context
          </h2>
          <div className="mt-5 grid gap-3 text-sm text-ink/72">
            <FieldLine label="Designation" value={profile.staff?.designation} />
            <FieldLine label="Staff type" value={profile.staff?.staffType} />
            <FieldLine label="Department" value={profile.staff?.departmentName} />
            <FieldLine label="Campus" value={profile.staff?.campusName} />
            <FieldLine
              label="Employment date"
              value={profile.staff?.employmentDate ? formatDate(profile.staff.employmentDate) : undefined}
            />
            <FieldLine label="Status" value={profile.accountStatus} />
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
            Assigned classes
          </h2>
          <div className="mt-5 grid gap-3">
            {assignedClasses.length ? (
              assignedClasses.map((item) => (
                <div key={item.classId} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="font-semibold text-slate-900">{item.className}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.learners} learners · {item.pendingScores} pending scores · {item.nextAction}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink/65">No form class assignment has been linked to this teacher yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
            Subject assignments
          </h2>
          <div className="mt-5 grid gap-3">
            {subjectAssignments.length ? (
              subjectAssignments.map((item) => (
                <div key={`${item.classId}-${item.subjectId}`} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="font-semibold text-slate-900">{item.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.className} · {item.learners} learners · {item.pendingScores} score rows pending
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink/65">No subject teaching assignments are linked yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">
          Next of kin
        </h2>
        <div className="mt-5 grid gap-3 text-sm text-ink/72 md:grid-cols-2">
          <FieldLine label="Name" value={[profile.nextOfKin.firstName, profile.nextOfKin.lastName].filter(Boolean).join(" ")} />
          <FieldLine label="Relationship" value={profile.nextOfKin.relationship} />
          <FieldLine label="Phone" value={profile.nextOfKin.phone} />
          <FieldLine label="Email" value={profile.nextOfKin.email} />
          <FieldLine label="Address" value={profile.nextOfKin.address} />
        </div>
      </section>
    </div>
  );
}
