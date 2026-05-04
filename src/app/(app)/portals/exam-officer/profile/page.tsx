import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import type { ExamOfficerDashboardView } from "@/lib/domain/types";

type StaffProfileView = {
  fullName: string;
  role: string;
  email: string;
  phone?: string;
  accountStatus: string;
  contact: Record<string, string | null | undefined>;
  nextOfKin: Record<string, string | null | undefined>;
  staff?: {
    employeeNo: string;
    designation: string;
    staffType: string;
    departmentName?: string;
    campusName?: string;
    employmentDate?: string;
  } | null;
};

function FieldLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="font-semibold text-[var(--color-text-primary)]">{label}:</span>{" "}
      {value || "Not recorded"}
    </p>
  );
}

export default async function ExamOfficerProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/portals/exam-officer/profile"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [profile, dashboard] = await Promise.all([
    apiGet<StaffProfileView>("/api/v1/profile/me"),
    apiGet<ExamOfficerDashboardView>("/api/v1/exam-officer/dashboard"),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface-card p-6">
        <Link href="/portals/exam-officer" className="text-sm font-semibold text-[var(--color-text-accent)]">
          Back to exam portal
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-eyebrow">Exam officer profile</p>
            <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
              {profile.fullName}
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
              Review your staff identity, communication record, and exam-office operating context without leaving the portal.
            </p>
          </div>
          <ResourceActionDialog
            triggerLabel="Edit Request"
            title="Request profile correction"
            description="Submit a verified change request for details that should be corrected by the school office."
            endpoint="/api/v1/profile/me/edit-requests"
            submitLabel="Submit request"
            variant="secondary"
            presentation="drawer"
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
        <article className="surface-card p-6 xl:col-span-2">
          <h2 className="font-[var(--font-display)] text-[24px] font-bold text-[var(--color-text-primary)]">
            Personal and contact information
          </h2>
          <div className="mt-5 grid gap-3 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
            <FieldLine label="Employee ID" value={profile.staff?.employeeNo} />
            <FieldLine label="Role" value={profile.role.replaceAll("_", " ")} />
            <FieldLine label="Portal identity" value="Exam officer / results operations" />
            <FieldLine label="Phone" value={profile.phone} />
            <FieldLine label="Email" value={profile.email} />
            <FieldLine label="Address" value={profile.contact.residentialAddress ?? profile.contact.homeAddress} />
            <FieldLine label="City / Country" value={[profile.contact.city, profile.contact.country].filter(Boolean).join(", ")} />
            <FieldLine label="Account status" value={profile.accountStatus} />
          </div>
        </article>

        <article className="surface-card p-6">
          <h2 className="font-[var(--font-display)] text-[24px] font-bold text-[var(--color-text-primary)]">
            Exam office context
          </h2>
          <div className="mt-5 grid gap-3 text-sm text-[var(--color-text-secondary)]">
            <FieldLine label="Designation" value={profile.staff?.designation} />
            <FieldLine label="Staff type" value={profile.staff?.staffType} />
            <FieldLine label="Department" value={profile.staff?.departmentName} />
            <FieldLine label="Campus" value={profile.staff?.campusName} />
            <FieldLine label="Current session" value={dashboard.currentSession} />
            <FieldLine label="Current term" value={dashboard.currentTerm} />
          </div>
        </article>
      </section>

      <section className="surface-card p-6">
        <h2 className="font-[var(--font-display)] text-[24px] font-bold text-[var(--color-text-primary)]">
          Next of kin
        </h2>
        <div className="mt-5 grid gap-3 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
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
